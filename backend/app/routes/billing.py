import hashlib
import hmac
import json
import secrets
from fastapi import APIRouter, HTTPException, Query, Request, Response
from sqlalchemy import select
from app.config import settings
from app.models import MaintenanceBill, BillItem, Payment, now
from app.security import Db, Property, owned, scoped
from app.schemas import OrderInput, PaymentVerification
from app.serialization import public, page
from app.payments import gateway, settle, verify_capture, receipt_data, receipt_pdf
from app.notifications import notify

router = APIRouter(tags=["Bills & payments"])


def bill_public(row):
    result = public(row)
    if row.outstanding > 0 and row.due_date < now():
        result["status"] = "Overdue"
    return result


@router.get("/bills")
def bills(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    result = page(db, scoped(MaintenanceBill, member).order_by(MaintenanceBill.due_date.desc()), offset, limit)
    for row in result["items"]:
        if row["outstanding"] > 0 and row["due_date"] < now():
            row["status"] = "Overdue"
    return result


@router.get("/bills/{record_id}")
def bill(record_id: str, db: Db, member: Property):
    row = owned(db, MaintenanceBill, record_id, member)
    return {**bill_public(row), "items": [public(i) for i in db.scalars(select(BillItem).where(BillItem.bill_id == row.id))]}


@router.get("/payments")
def payments(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    result = page(db, scoped(Payment, member).order_by(Payment.created_at.desc()), offset, limit)
    for row in result["items"]:
        row["period"] = db.get(MaintenanceBill, row["bill_id"]).period
    return result


@router.post("/payments/orders", status_code=201)
def order(data: OrderInput, db: Db, member: Property):
    bill = owned(db, MaintenanceBill, data.bill_id, member, lock=True)
    if bill.outstanding <= 0:
        raise HTTPException(409, "This bill is already paid.")
    cfg = settings()
    payment = db.scalar(scoped(Payment, member).where(Payment.bill_id == bill.id, Payment.status == "Created", Payment.amount == bill.outstanding, Payment.provider == cfg.payment_provider))
    if not payment:
        payment = Payment(society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id,
                           bill_id=bill.id, amount=bill.outstanding, provider=cfg.payment_provider)
        db.add(payment)
        db.flush()
        if cfg.payment_provider == "development":
            payment.order_id = "dev_" + secrets.token_hex(12)
        else:
            remote = gateway("POST", "orders", json={"amount": payment.amount, "currency": "INR", "receipt": payment.id})
            payment.order_id = remote["id"]
    return {**public(payment), "key_id": cfg.razorpay_key_id, "currency": "INR"}


@router.post("/payments/verify")
def verify(data: PaymentVerification, db: Db, member: Property):
    payment = owned(db, Payment, data.payment_id, member, lock=True)
    if payment.provider != "razorpay":
        raise HTTPException(400, "Invalid payment provider.")
    expected = hmac.new(settings().razorpay_key_secret.encode(), f"{payment.order_id}|{data.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, data.razorpay_signature):
        raise HTTPException(400, "Payment verification failed. Please contact support if money was debited.")
    verify_capture(db, payment, data.razorpay_payment_id)
    return public(payment)


@router.post("/payments/{record_id}/simulate")
def simulate(record_id: str, db: Db, member: Property):
    cfg = settings()
    allow_sim = cfg.payment_provider == "development" and (cfg.app_env in ("development", "staging") or cfg.allow_demo_payment)
    if not allow_sim:
        raise HTTPException(404, "Not found")
    payment = owned(db, Payment, record_id, member, lock=True)
    if payment.provider != "development":
        raise HTTPException(400, "Invalid payment provider.")
    was_paid = payment.status == "Paid"
    settle(db, payment, "DEV" + secrets.token_hex(10), "Development / UPI")
    if not was_paid:
        notify(db, member, "Payment successful", f"INR {payment.amount / 100:,.0f} maintenance payment received.", "Payments", f"/receipt/{payment.id}")
    return public(payment)


@router.post("/payments/{record_id}/reconcile")
def reconcile(record_id: str, db: Db, member: Property):
    payment = owned(db, Payment, record_id, member, lock=True)
    if payment.provider == "razorpay" and payment.status != "Paid":
        remote = gateway("GET", f"orders/{payment.order_id}/payments")
        for item in remote.get("items", []):
            if item.get("status") in ("captured", "authorized"):
                verify_capture(db, payment, item["id"])
                break
    return public(payment)


@router.post("/payments/webhook", status_code=204)
async def webhook(request: Request, db: Db):
    if not settings().razorpay_webhook_secret:
        raise HTTPException(503, "Webhook unavailable")
    raw = await request.body()
    expected = hmac.new(settings().razorpay_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-Razorpay-Signature", "")):
        raise HTTPException(400, "Invalid signature")
    try:
        event = json.loads(raw)
        remote = event["payload"]["payment"]["entity"]
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Invalid event")
    payment = db.scalar(select(Payment).where(Payment.order_id == remote.get("order_id")).with_for_update())
    if payment and payment.provider == "razorpay" and event.get("event") == "payment.captured":
        verify_capture(db, payment, remote["id"])


@router.get("/payments/{record_id}/receipt")
def receipt(record_id: str, db: Db, member: Property):
    payment = owned(db, Payment, record_id, member)
    if payment.status != "Paid":
        raise HTTPException(409, "A receipt is available after payment confirmation.")
    return receipt_data(db, payment)


@router.get("/payments/{record_id}/receipt.pdf")
def pdf(record_id: str, db: Db, member: Property):
    return Response(receipt_pdf(receipt(record_id, db, member)), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="receipt-{record_id}.pdf"'})
