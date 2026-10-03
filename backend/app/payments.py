import hashlib
import hmac
import io
import httpx
from fastapi import HTTPException
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from sqlalchemy import select
from app.config import settings
from app.models import Payment, MaintenanceBill, BillItem, User, Society, Unit, now
from app.notifications import notify_household, notify_staff


def merchant(society_id):
    cfg = settings()
    account = cfg.razorpay_accounts.get(society_id)
    if not account and cfg.razorpay_society_id == society_id:
        account = {"key_id": cfg.razorpay_key_id, "key_secret": cfg.razorpay_key_secret,
                   "webhook_secret": cfg.razorpay_webhook_secret}
    if not account or not all(account.get(k) for k in ("key_id", "key_secret", "webhook_secret")):
        raise HTTPException(503, "Online payments are not configured for this society. Contact your society office.")
    return account


def gateway(society_id, method, path, **kwargs):
    account = merchant(society_id)
    try:
        response = httpx.request(method, f"https://api.razorpay.com/v1/{path}",
            auth=(account["key_id"], account["key_secret"]), timeout=20, **kwargs)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, "The payment provider is temporarily unavailable. Please try again.")


def settle(db, payment, reference, method):
    if payment.status in ("Paid", "Review Required"):
        return
    bill = db.scalar(select(MaintenanceBill).where(MaintenanceBill.id == payment.bill_id).with_for_update())
    if bill.outstanding < payment.amount:
        payment.status = "Review Required"
        payment.reference, payment.method, payment.paid_at = reference, method, now()
        notify_household(db, payment.society_id, payment.unit_id, "Payment received for review",
            "Your payment was received but could not be applied to the current bill. Contact the society office.",
            "Payments", "/payments")
        notify_staff(db, payment.society_id, "Collection requires review", "A captured payment exceeds the current bill balance.",
            "Payments", "/admin/refunds", roles=("Admin", "Treasurer"))
        return
    payment.status, payment.reference, payment.method, payment.paid_at = "Paid", reference, method, now()
    bill.outstanding -= payment.amount
    bill.status = "Paid" if bill.outstanding == 0 else "Partially Paid"
    notify_household(db, payment.society_id, payment.unit_id, "Payment successful",
        f"INR {payment.amount / 100:,.2f} maintenance payment received.", "Payments", f"/receipt/{payment.id}")


def verify_capture(db, payment, provider_payment_id):
    remote = gateway(payment.society_id, "GET", f"payments/{provider_payment_id}")
    if remote.get("order_id") != payment.order_id or remote.get("amount") != payment.amount or remote.get("currency") != "INR":
        raise HTTPException(400, "Payment details could not be verified.")
    if remote.get("status") == "authorized":
        remote = gateway(payment.society_id, "POST", f"payments/{provider_payment_id}/capture", json={"amount": payment.amount, "currency": "INR"})
    if remote.get("status") != "captured":
        raise HTTPException(409, "Payment is awaiting confirmation. Check payment history shortly.")
    settle(db, payment, provider_payment_id, remote.get("method", "Online"))


def receipt_data(db, payment):
    bill = db.get(MaintenanceBill, payment.bill_id)
    return {"id": payment.id, "amount": payment.amount, "society": db.get(Society, payment.society_id).name,
            "resident": payment.payer_name or ("Flat account" if payment.provider == "offline" else db.get(User, payment.user_id).name), "flat": db.get(Unit, payment.unit_id).number,
            "period": bill.period, "paid_at": payment.paid_at, "method": payment.method,
            "reference": payment.reference, "provider": payment.provider}


def receipt_pdf(data):
    output = io.BytesIO()
    pdf = canvas.Canvas(output, pagesize=(420, 595))
    pdf.setTitle("Maintenance payment receipt")
    pdf.setFillColor(HexColor("#175D4F"))
    pdf.rect(0, 465, 420, 130, fill=True, stroke=False)
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(32, 547, "Payment successful")
    pdf.setFont("Helvetica-Bold", 32)
    pdf.drawString(32, 495, f"INR {data['amount'] / 100:,.2f}")
    pdf.setFillColor(HexColor("#20342F"))
    values = [("Society", data["society"]), ("Resident", data["resident"]), ("Flat", data["flat"]),
              ("Billing period", data["period"]), ("Payment date", str(data["paid_at"])[:19]),
              ("Payment method", data["method"]), ("Reference", data["reference"]), ("Receipt", data["id"])]
    for index, (label, value) in enumerate(values):
        y = 427 - index * 40
        pdf.setFont("Helvetica", 10)
        pdf.drawString(32, y, label)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(32, y - 16, str(value)[:58])
    pdf.setFont("Helvetica", 9)
    pdf.drawString(32, 54, "Development payment - no money collected" if data["provider"] == "development" else "Digitally generated receipt")
    pdf.save()
    return output.getvalue()
