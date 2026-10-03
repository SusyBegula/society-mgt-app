"""Durable, at-least-once push delivery. Run as `python -m app.push_worker`.

Transactions only expose committed notifications. Device-level jobs prevent successful
devices being retried with a failing one. A crash after provider acceptance can still
duplicate a push; notification_id lets clients deduplicate it.
"""
import logging
import time
from datetime import timedelta
import httpx
from sqlalchemy import select
from app.db import SessionLocal
from app.models import Notification, PushDelivery, Device, User, ResidentMembership, StaffRole, now


def has_access(db, row):
    if row.context_id:
        for model in (ResidentMembership, StaffRole):
            if db.scalar(select(model.id).where(model.id == row.context_id,
                    model.society_id == row.society_id, model.user_id == row.user_id,
                    model.active.is_(True))):
                return True
        return False
    return bool(db.scalar(select(ResidentMembership.id).where(
        ResidentMembership.society_id == row.society_id, ResidentMembership.user_id == row.user_id,
        ResidentMembership.active.is_(True)).limit(1)) or db.scalar(select(StaffRole.id).where(
        StaffRole.society_id == row.society_id, StaffRole.user_id == row.user_id,
        StaffRole.active.is_(True)).limit(1)))


def enqueue(db):
    rows = db.scalars(select(Notification).where(Notification.push_state == "Pending")
                      .order_by(Notification.created_at).limit(100).with_for_update(skip_locked=True)).all()
    for row in rows:
        user = db.get(User, row.user_id)
        if not user or not has_access(db, row) or not user.preferences.get(row.category.lower(), True):
            row.push_state = "Skipped"
            continue
        devices = db.scalars(select(Device).where(Device.user_id == row.user_id)).all()
        for device in devices:
            db.add(PushDelivery(notification_id=row.id, device_id=device.id, token=device.token))
        row.push_state = "Queued" if devices else "No Device"


def deliver_one(db, client):
    job = db.scalar(select(PushDelivery).where(PushDelivery.state.in_(["Pending", "Accepted"]),
        PushDelivery.next_attempt_at <= now()).order_by(PushDelivery.next_attempt_at)
        .limit(1).with_for_update(skip_locked=True))
    if not job:
        return False
    row = db.get(Notification, job.notification_id)
    device = db.get(Device, job.device_id)
    user = db.get(User, row.user_id)
    if not device or device.user_id != row.user_id or device.token != job.token or not has_access(db, row) or not user.preferences.get(row.category.lower(), True):
        job.state = "Skipped"
        return True
    job.attempts += 1
    try:
        if job.state == "Accepted":
            response = client.post("https://exp.host/--/api/v2/push/getReceipts", json={"ids": [job.ticket_id]})
            response.raise_for_status()
            result = response.json().get("data", {}).get(job.ticket_id)
            if not result:
                raise ValueError("ReceiptPending")
            if result.get("status") == "ok":
                job.state, job.error = "Provider Delivered", ""
                return True
        else:
            response = client.post("https://exp.host/--/api/v2/push/send", json={
                "to": job.token, "title": row.title, "body": row.body, "sound": "default",
                "data": {"route": row.route, "society_id": row.society_id,
                         "property_id": row.context_id, "notification_id": row.id}})
            response.raise_for_status()
            result = response.json().get("data", {})
            if result.get("status") == "ok" and result.get("id"):
                job.ticket_id, job.state, job.error = result["id"], "Accepted", ""
                job.attempts = 0
                job.next_attempt_at = now() + timedelta(minutes=15)
                return True
        error = result.get("details", {}).get("error", "ProviderError")
        if error == "DeviceNotRegistered":
            db.delete(device)
        if error in ("DeviceNotRegistered", "MessageTooBig", "InvalidCredentials", "MismatchSenderId"):
            job.state, job.error = "Failed", error
            return True
        raise ValueError(error)
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        # Do not persist provider bodies or tokens in error logs.
        job.error = "Provider request failed or receipt unavailable"
        if job.attempts >= 8:
            job.state = "Failed"
        job.next_attempt_at = now() + timedelta(seconds=min(3600, 15 * 2 ** job.attempts))
    return True


def tick():
    with SessionLocal.begin() as db:
        enqueue(db)
    with httpx.Client(timeout=10) as client:
        for _ in range(100):
            with SessionLocal.begin() as db:
                if not deliver_one(db, client):
                    break


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            tick()
        except Exception:
            logging.exception("Push worker iteration failed")
        time.sleep(5)
