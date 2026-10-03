from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select, func
from app.models import Refund, Payment, MaintenanceBill, Unit, Building, now
from app.schemas import Input
from app.security import Db, Property, FinanceRole, scoped, owned
from app.serialization import public
from app.routes.finance import society_row
from app.payments import gateway
from app.audit import audit
from app.notifications import notify_household, notify_staff

router = APIRouter(tags=["Refunds"])


class RefundInput(Input):
    payment_id: str
    amount: int = Field(gt=0)
    reason: str = Field(min_length=5, max_length=500)


class RefundDecision(Input):
    status: Literal["Approved", "Declined"]


class RefundProcess(Input):
    reference: str = Field(default="", max_length=100)


def create(db, actor, payment, data):
    if payment.status not in ("Paid", "Review Required"):
        raise HTTPException(409, "Only confirmed collections can be refunded.")
    reserved = db.scalar(select(func.coalesce(func.sum(Refund.amount), 0)).where(
        Refund.payment_id == payment.id, Refund.status.not_in(["Declined", "Failed"])))
    if data.amount > payment.amount - reserved:
        raise HTTPException(409, "This exceeds the refundable amount, including pending requests.")
    row = Refund(society_id=payment.society_id, unit_id=payment.unit_id, payment_id=payment.id,
        requested_by=actor.user_id, amount=data.amount, reason=data.reason)
    db.add(row); db.flush()
    audit(db, actor, "refund.requested", row.id, amount=row.amount)
    notify_staff(db, actor.society_id, "Refund review required", data.reason, "Payments", "/admin/refunds", roles=("Admin", "Treasurer"))
    return public(row)


@router.post("/refunds", status_code=201)
def request_refund(data: RefundInput, db: Db, member: Property):
    payment = owned(db, Payment, data.payment_id, member, lock=True)
    return create(db, member, payment, data)


@router.get("/refunds")
def own_refunds(db: Db, member: Property):
    return [public(r) for r in db.scalars(scoped(Refund, member).order_by(Refund.created_at.desc()))]


@router.post("/admin/finance/refunds", status_code=201)
def office_request(data: RefundInput, db: Db, admin: FinanceRole):
    payment = society_row(db, Payment, data.payment_id, admin, lock=True)
    return create(db, admin, payment, data)


@router.get("/admin/finance/refunds")
def refund_queue(db: Db, admin: FinanceRole):
    rows = db.execute(select(Refund, Unit, Building, Payment).join(Unit, Unit.id == Refund.unit_id)
        .join(Building, Building.id == Unit.building_id).join(Payment, Payment.id == Refund.payment_id)
        .where(Refund.society_id == admin.society_id).order_by(Refund.created_at.desc())).all()
    return [{**public(r), "flat": f"{b.name}/{u.number}", "provider": p.provider} for r, u, b, p in rows]


@router.get("/admin/finance/refundable-payments")
def refundable_payments(db: Db, admin: FinanceRole):
    rows = db.execute(select(Payment, Unit, Building).join(Unit, Unit.id == Payment.unit_id)
        .join(Building, Building.id == Unit.building_id).where(Payment.society_id == admin.society_id,
            Payment.status.in_(["Paid", "Review Required"])).order_by(Payment.created_at.desc()).limit(200)).all()
    return [{**public(p), "flat": f"{b.name}/{u.number}"} for p, u, b in rows]


@router.patch("/admin/finance/refunds/{record_id}")
def decide_refund(record_id: str, data: RefundDecision, db: Db, admin: FinanceRole):
    row = society_row(db, Refund, record_id, admin, lock=True)
    if row.status != "Requested":
        raise HTTPException(409, "Only requested refunds can be reviewed.")
    if row.requested_by == admin.user_id:
        raise HTTPException(403, "A second finance authorised person must review this refund.")
    row.status, row.reviewed_by = data.status, admin.user_id
    audit(db, admin, "refund." + data.status.lower(), row.id)
    return public(row)


@router.post("/admin/finance/refunds/{record_id}/process")
def process_refund(record_id: str, data: RefundProcess, db: Db, admin: FinanceRole):
    row = society_row(db, Refund, record_id, admin, lock=True)
    if row.status == "Completed":
        return public(row)
    if row.status not in ("Approved", "Processing"):
        raise HTTPException(409, "Approve the refund before processing it.")
    payment = db.get(Payment, row.payment_id)
    if payment.provider == "offline" and not data.reference.strip():
        raise HTTPException(422, "Enter the reference of the refund already made through your bank or cashbook.")
    row.status = "Processing"
    db.commit()  # Durable before contacting the provider; row.id is the retry key.
    if payment.provider == "razorpay":
        remote = gateway(row.society_id, "GET", f"refunds/{row.reference}") if row.reference else gateway(
            row.society_id, "POST", f"payments/{payment.reference}/refund",
            headers={"X-Refund-Idempotency": row.id}, json={"amount": row.amount})
        if remote.get("payment_id") != payment.reference or remote.get("amount") != row.amount or remote.get("currency") != "INR":
            raise HTTPException(409, "The provider refund does not match this request. Contact support.")
        reference, state = remote["id"], remote.get("status")
    else:
        reference = data.reference.strip() if payment.provider == "offline" else "DEV-REFUND-" + row.id
        state = "processed"
    row = db.scalar(select(Refund).where(Refund.id == record_id).execution_options(populate_existing=True).with_for_update())
    if row.status == "Completed":
        return public(row)
    row.reference = reference
    if state == "failed":
        row.status = "Failed"
    elif state == "processed":
        payment = db.scalar(select(Payment).where(Payment.id == row.payment_id).with_for_update())
        if payment.status == "Paid":
            bill = db.scalar(select(MaintenanceBill).where(MaintenanceBill.id == payment.bill_id).with_for_update())
            bill.outstanding += row.amount
            bill.status = "Pending" if bill.outstanding == bill.amount else "Partially Paid"
        row.status, row.completed_at = "Completed", now()
        notify_household(db, row.society_id, row.unit_id, "Refund completed",
            f"INR {row.amount / 100:,.2f} refunded. Refunded maintenance becomes due again unless the office issues a credit adjustment.", "Payments", "/refunds")
    audit(db, admin, "refund.processed", row.id, status=row.status)
    return public(row)
