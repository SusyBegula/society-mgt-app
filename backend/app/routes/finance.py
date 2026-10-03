import csv
import io
from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Response
from pydantic import Field, AwareDatetime
from sqlalchemy import select
from app.models import (Society, Unit, Building, MaintenanceBill, BillItem, Payment,
    BillingRule, BillAdjustment, Vendor, Expense, BankTransaction, Refund, now)
from app.schemas import Input, Name
from app.security import Db, FinanceRole, AdminRole
from app.audit import audit
from app.serialization import public
from app.notifications import notify_household
from app.payments import merchant, settle
from app.billing_periods import period_key

router = APIRouter(prefix="/admin/finance", tags=["Office accounting"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/units")
def finance_units(db: Db, admin: FinanceRole):
    rows = db.execute(select(Unit, Building).join(Building, Unit.building_id == Building.id)
        .where(Unit.society_id == admin.society_id).order_by(Building.name, Unit.number)).all()
    return [{**public(u), "building": b.name} for u, b in rows]


class RuleInput(Input):
    label: Name
    amount: int = Field(gt=0, le=100000000)
    basis: Literal["Flat", "Area"] = "Flat"
    unit_id: str | None = None


class CycleInput(Input):
    month: str = Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")
    due_date: AwareDatetime
    preview: bool = True


class ScheduleInput(Input):
    enabled: bool = False
    due_day: int = Field(default=10, ge=1, le=28)
    reminders: bool = False


@router.get("/schedule")
def get_schedule(db: Db, admin: FinanceRole):
    return db.get(Society, admin.society_id).settings.get("billing_schedule", {"enabled": False, "due_day": 10, "reminders": False})


@router.put("/schedule")
def save_schedule(data: ScheduleInput, db: Db, admin: FinanceRole):
    row = db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    row.settings = {**row.settings, "billing_schedule": data.model_dump()}
    audit(db, admin, "billing.schedule_changed", row.id, **data.model_dump())
    return data.model_dump()


class CreditInput(Input):
    amount: int = Field(gt=0)
    reason: str = Field(min_length=5, max_length=500)


class ChequeInput(Input):
    decision: Literal["Cleared", "Bounced"]


class VendorInput(Input):
    name: Name
    phone: str = Field(default="", max_length=16)
    category: str = Field(min_length=1, max_length=80)


class ExpenseInput(Input):
    vendor_id: str
    title: str = Field(min_length=3, max_length=150)
    amount: int = Field(gt=0, le=1000000000)
    invoice_number: str = Field(min_length=1, max_length=100)
    due_at: AwareDatetime


class ExpenseDecision(Input):
    status: Literal["Approved", "Rejected", "Paid"]
    reference: str = Field(default="", max_length=100)


class BankInput(Input):
    reference: str = Field(min_length=1, max_length=100)
    occurred_at: AwareDatetime
    description: str = Field(default="", max_length=500)
    amount: int


class BankImport(Input):
    rows: list[BankInput] = Field(min_length=1, max_length=2000)
    preview: bool = True


class BankCsvInput(Input):
    csv: str = Field(min_length=1, max_length=500000)
    preview: bool = True


@router.post("/bank/import-csv")
def bank_csv(data: BankCsvInput, db: Db, admin: FinanceRole):
    try:
        rows = list(csv.DictReader(io.StringIO(data.csv.lstrip("\ufeff"))))
        validated = BankImport(rows=rows, preview=data.preview)
    except (ValueError, TypeError, csv.Error):
        raise HTTPException(422, "Use reference,occurred_at,description,amount headers with valid dates and signed integer paise.")
    return import_bank(validated, db, admin)


class MatchInput(Input):
    kind: Literal["Payment", "Expense"]
    record_id: str


def society_row(db, model, record_id, actor, lock=False):
    query = select(model).where(model.id == record_id, model.society_id == actor.society_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Record not found.")
    return row


@router.get("/payment-account")
def payment_account(db: Db, admin: FinanceRole):
    try:
        merchant(admin.society_id)
        configured = True
    except HTTPException:
        configured = False
    return {"society_id": admin.society_id, "configured": configured,
            "webhook_path": f"/payments/webhook/{admin.society_id}"}


@router.get("/rules")
def rules(db: Db, admin: FinanceRole):
    return [public(r) for r in db.scalars(select(BillingRule).where(BillingRule.society_id == admin.society_id, BillingRule.active.is_(True)))]


@router.post("/rules", status_code=201)
def create_rule(data: RuleInput, db: Db, admin: FinanceRole):
    if data.unit_id:
        society_row(db, Unit, data.unit_id, admin)
    row = BillingRule(society_id=admin.society_id, **data.model_dump())
    db.add(row)
    db.flush()
    audit(db, admin, "billing_rule.created", row.id)
    return public(row)


@router.delete("/rules/{record_id}", status_code=204)
def remove_rule(record_id: str, db: Db, admin: FinanceRole):
    row = society_row(db, BillingRule, record_id, admin)
    row.active = False
    audit(db, admin, "billing_rule.deactivated", row.id)


@router.post("/cycle")
def generate_cycle(data: CycleInput, db: Db, admin: FinanceRole):
    db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    rules = db.scalars(select(BillingRule).where(BillingRule.society_id == admin.society_id, BillingRule.active.is_(True))).all()
    if not rules:
        raise HTTPException(422, "Add billing rules first.")
    existing_periods = {(unit_id, period_key(period)) for unit_id, period in db.execute(
        select(MaintenanceBill.unit_id, MaintenanceBill.period).where(MaintenanceBill.society_id == admin.society_id))}
    rows = db.execute(select(Unit, Building).join(Building, Unit.building_id == Building.id)
        .where(Unit.society_id == admin.society_id).order_by(Building.name, Unit.number)).all()
    result = []
    for unit, building in rows:
        key = f"{unit.id}:{data.month}"
        existing = (unit.id, data.month) in existing_periods
        applicable = [r for r in rules if not r.unit_id or r.unit_id == unit.id]
        if any(r.basis == "Area" for r in applicable) and not unit.area_sqft:
            raise HTTPException(422, f"Set area for {building.name}/{unit.number} before billing by area.")
        items = [{"label": r.label, "amount": r.amount * (unit.area_sqft if r.basis == "Area" else 1)} for r in applicable]
        amount = sum(i["amount"] for i in items)
        if amount > 2_000_000_000:
            raise HTTPException(422, f"The total for {building.name}/{unit.number} exceeds the supported bill amount.")
        if not amount:
            continue
        result.append({"unit_id": unit.id, "flat": f"{building.name}/{unit.number}", "amount": amount, "existing": bool(existing), "items": items})
        if not data.preview and not existing:
            bill = MaintenanceBill(society_id=admin.society_id, unit_id=unit.id, period=data.month,
                due_date=data.due_date, amount=amount, outstanding=amount, billing_key=key)
            db.add(bill)
            db.flush()
            for item in items:
                db.add(BillItem(bill_id=bill.id, **item))
            notify_household(db, admin.society_id, unit.id, "Maintenance bill published",
                f"{data.month}: INR {amount / 100:,.2f}", "Payments", f"/bills/{bill.id}")
    if not data.preview and any(not r["existing"] for r in result):
        audit(db, admin, "billing.cycle_generated", admin.society_id, month=data.month)
    return {"preview": data.preview, "units": result, "total": sum(r["amount"] for r in result if not r["existing"])}


@router.get("/ledger/{unit_id}")
def ledger(unit_id: str, db: Db, admin: FinanceRole):
    unit = society_row(db, Unit, unit_id, admin)
    bills = db.scalars(select(MaintenanceBill).where(MaintenanceBill.unit_id == unit.id).order_by(MaintenanceBill.created_at)).all()
    payments = db.scalars(select(Payment).where(Payment.unit_id == unit.id).order_by(Payment.created_at)).all()
    credits = db.scalars(select(BillAdjustment).where(BillAdjustment.unit_id == unit.id)).all()
    return {"unit": public(unit), "bills": [public(r) for r in bills], "payments": [public(r) for r in payments],
            "credits": [public(r) for r in credits], "outstanding": sum(b.outstanding for b in bills)}


@router.post("/bills/{bill_id}/credit")
def credit_bill(bill_id: str, data: CreditInput, db: Db, admin: FinanceRole):
    bill = society_row(db, MaintenanceBill, bill_id, admin, lock=True)
    if data.amount > bill.outstanding:
        raise HTTPException(409, "Credit cannot exceed outstanding dues. Paid amounts require a refund workflow.")
    row = BillAdjustment(society_id=admin.society_id, unit_id=bill.unit_id, bill_id=bill.id,
        amount=data.amount, reason=data.reason, actor_id=admin.user_id)
    db.add(row)
    bill.outstanding -= data.amount
    bill.status = "Settled" if bill.outstanding == 0 else "Partially Paid"
    db.flush()
    audit(db, admin, "bill.credit_issued", row.id, amount=data.amount, reason=data.reason)
    notify_household(db, admin.society_id, bill.unit_id, "Bill adjustment",
        f"Credit of INR {data.amount / 100:,.2f}: {data.reason}", "Payments", f"/bills/{bill.id}")
    return public(row)


@router.get("/cheques")
def pending_cheques(db: Db, admin: FinanceRole):
    return [public(r) for r in db.scalars(select(Payment).where(Payment.society_id == admin.society_id, Payment.status == "Awaiting Clearance"))]


@router.post("/cheques/{record_id}")
def cheque_decision(record_id: str, data: ChequeInput, db: Db, admin: FinanceRole):
    payment = society_row(db, Payment, record_id, admin, lock=True)
    if payment.status != "Awaiting Clearance":
        raise HTTPException(409, "This cheque is no longer awaiting clearance.")
    if data.decision == "Cleared":
        settle(db, payment, payment.reference, "Cheque")
    else:
        payment.status = "Bounced"
    audit(db, admin, "cheque." + data.decision.lower(), payment.id)
    notify_household(db, admin.society_id, payment.unit_id, "Cheque " + data.decision.lower(),
        f"Reference {payment.reference}. Status: {payment.status}.", "Payments", f"/bills/{payment.bill_id}")
    return public(payment)


@router.get("/vendors")
def vendors(db: Db, admin: FinanceRole):
    return [public(r) for r in db.scalars(select(Vendor).where(Vendor.society_id == admin.society_id))]


@router.post("/vendors", status_code=201)
def add_vendor(data: VendorInput, db: Db, admin: FinanceRole):
    row = Vendor(society_id=admin.society_id, **data.model_dump())
    db.add(row)
    db.flush()
    audit(db, admin, "vendor.created", row.id)
    return public(row)


@router.get("/expenses")
def expenses(db: Db, admin: FinanceRole):
    return [public(r) for r in db.scalars(select(Expense).where(Expense.society_id == admin.society_id).order_by(Expense.due_at.desc()))]


@router.post("/expenses", status_code=201)
def add_expense(data: ExpenseInput, db: Db, admin: FinanceRole):
    society_row(db, Vendor, data.vendor_id, admin)
    row = Expense(society_id=admin.society_id, submitted_by=admin.user_id, **data.model_dump())
    db.add(row)
    db.flush()
    audit(db, admin, "expense.submitted", row.id, amount=row.amount)
    return public(row)


@router.patch("/expenses/{record_id}")
def decide_expense(record_id: str, data: ExpenseDecision, db: Db, admin: FinanceRole):
    row = society_row(db, Expense, record_id, admin, lock=True)
    allowed = {"Submitted": {"Approved", "Rejected"}, "Approved": {"Paid"}}
    if data.status not in allowed.get(row.status, set()):
        raise HTTPException(409, "Invalid expense transition.")
    if data.status in ("Approved", "Rejected"):
        if row.submitted_by == admin.user_id:
            raise HTTPException(403, "A second finance authorised person must review this expense.")
        row.approved_by = admin.user_id
    if data.status == "Paid":
        if not data.reference.strip():
            raise HTTPException(422, "Enter the bank payment reference.")
        row.paid_at, row.reference = now(), data.reference.strip()
    row.status = data.status
    audit(db, admin, "expense." + data.status.lower(), row.id, reference=data.reference)
    return public(row)


@router.get("/bank")
def bank_transactions(db: Db, admin: FinanceRole):
    return [public(r) for r in db.scalars(select(BankTransaction).where(BankTransaction.society_id == admin.society_id)
        .order_by(BankTransaction.occurred_at.desc()).limit(2000))]


@router.post("/bank/import")
def import_bank(data: BankImport, db: Db, admin: FinanceRole):
    db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    if len({r.reference for r in data.rows}) != len(data.rows):
        raise HTTPException(422, "Duplicate bank references in import.")
    existing = set(db.scalars(select(BankTransaction.reference).where(BankTransaction.society_id == admin.society_id,
        BankTransaction.reference.in_([r.reference for r in data.rows]))))
    for row in data.rows:
        if row.amount == 0:
            raise HTTPException(422, "Bank amounts cannot be zero.")
        if not data.preview and row.reference not in existing:
            db.add(BankTransaction(society_id=admin.society_id, **row.model_dump()))
    if not data.preview:
        audit(db, admin, "bank.imported", admin.society_id, count=len(data.rows) - len(existing))
    return {"count": len(data.rows) - len(existing), "skipped": len(existing), "preview": data.preview}


@router.post("/bank/{record_id}/match")
def match_bank(record_id: str, data: MatchInput, db: Db, admin: FinanceRole):
    row = society_row(db, BankTransaction, record_id, admin, lock=True)
    if row.payment_id or row.expense_id:
        raise HTTPException(409, "This transaction is already reconciled.")
    model = Payment if data.kind == "Payment" else Expense
    target = society_row(db, model, data.record_id, admin, lock=True)
    expected = target.amount if data.kind == "Payment" else -target.amount
    if target.status != "Paid" or row.amount != expected:
        raise HTTPException(409, "Match requires a paid record with exactly the same signed amount.")
    if data.kind == "Payment":
        row.payment_id = target.id
    else:
        row.expense_id = target.id
    audit(db, admin, "bank.matched", row.id, kind=data.kind, record_id=target.id)
    return public(row)


@router.get("/bank/{record_id}/candidates")
def match_candidates(record_id: str, db: Db, admin: FinanceRole):
    row = society_row(db, BankTransaction, record_id, admin)
    if row.amount > 0:
        matched = select(BankTransaction.payment_id).where(BankTransaction.payment_id.is_not(None))
        records = db.execute(select(Payment, Unit, Building).join(Unit, Unit.id == Payment.unit_id)
            .join(Building, Building.id == Unit.building_id).where(Payment.society_id == admin.society_id,
                Payment.status == "Paid", Payment.amount == row.amount, Payment.id.not_in(matched))).all()
        return [{"id": p.id, "label": f"{b.name}/{u.number} · {p.reference} · {p.paid_at.date()}"} for p, u, b in records]
    matched = select(BankTransaction.expense_id).where(BankTransaction.expense_id.is_not(None))
    return [{"id": e.id, "label": f"{e.title} · {e.invoice_number} · {e.reference}"}
        for e in db.scalars(select(Expense).where(Expense.society_id == admin.society_id, Expense.status == "Paid",
            Expense.amount == -row.amount, Expense.id.not_in(matched)))]


def csv_cell(value):
    value = str(value or "")
    return "'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value


@router.get("/report.csv")
def export_report(db: Db, admin: FinanceRole, financial_year: int = 2026):
    if not 2000 <= financial_year <= 2100:
        raise HTTPException(422, "Invalid financial year.")
    start, end = datetime(financial_year, 4, 1, tzinfo=IST), datetime(financial_year + 1, 4, 1, tzinfo=IST)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["type", "id", "date", "description", "amount_paise", "reference"])
    for row in db.scalars(select(Payment).where(Payment.society_id == admin.society_id, Payment.status.in_(["Paid", "Review Required"]), Payment.paid_at >= start, Payment.paid_at < end)):
        writer.writerow(["Collection", row.id, str(row.paid_at), csv_cell(row.unit_id), row.amount, csv_cell(row.reference)])
    for row in db.scalars(select(Expense).where(Expense.society_id == admin.society_id, Expense.status == "Paid", Expense.paid_at >= start, Expense.paid_at < end)):
        writer.writerow(["Expense", row.id, str(row.paid_at), csv_cell(row.title), -row.amount, csv_cell(row.reference)])
    for row in db.scalars(select(Refund).where(Refund.society_id == admin.society_id, Refund.status == "Completed", Refund.completed_at >= start, Refund.completed_at < end)):
        writer.writerow(["Refund", row.id, str(row.completed_at), csv_cell(row.reason), -row.amount, csv_cell(row.reference)])
    audit(db, admin, "finance.exported", admin.society_id, financial_year=financial_year)
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="cashbook-{financial_year}.csv"'})
