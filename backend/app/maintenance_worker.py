"""Scheduled billing, reminders and visitor data retention. Run hourly."""
import logging
import time
from datetime import timedelta, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo
from sqlalchemy import select
from app.db import SessionLocal
from app.models import (Society, StaffRole, MaintenanceBill, Visitor, VisitorInvitation,
    AuditEvent, Complaint, Asset, now)
from app.routes.finance import generate_cycle, CycleInput
from app.notifications import notify_household, notify_staff
from app.audit import audit

IST = ZoneInfo("Asia/Kolkata")


def run_society(db, society):
    admin = db.scalar(select(StaffRole).where(StaffRole.society_id == society.id,
        StaffRole.role.in_(["Admin", "Treasurer"]), StaffRole.active.is_(True)).order_by(StaffRole.created_at))
    timestamp = now()
    today = timestamp.astimezone(IST)
    schedule = society.settings.get("billing_schedule", {})
    if admin and schedule.get("enabled"):
        due_day = schedule.get("due_day", 10)
        due = datetime(today.year, today.month, due_day, 23, 59, 59, tzinfo=IST)
        generate_cycle(CycleInput(month=today.strftime("%Y-%m"), due_date=due, preview=False), db, admin)
    if admin and schedule.get("reminders"):
        for bill in db.scalars(select(MaintenanceBill).where(MaintenanceBill.society_id == society.id,
                MaintenanceBill.outstanding > 0, MaintenanceBill.due_date < timestamp)):
            already = db.scalar(select(AuditEvent.id).where(AuditEvent.society_id == society.id,
                AuditEvent.action == "scheduled.dues_reminder", AuditEvent.resource_id == bill.id,
                AuditEvent.created_at >= timestamp - timedelta(days=7)).limit(1))
            if not already:
                notify_household(db, society.id, bill.unit_id, "Maintenance payment reminder",
                    f"{bill.period}: INR {bill.outstanding / 100:,.2f} outstanding.", "Payments", f"/bills/{bill.id}")
                audit(db, admin, "scheduled.dues_reminder", bill.id)
    retention = timestamp - timedelta(days=society.settings.get("visitor_retention_days", 90))
    for visitor in db.scalars(select(Visitor).where(Visitor.society_id == society.id, Visitor.arrived_at < retention,
                Visitor.status != "Inside", Visitor.name != "Removed under retention policy")):
        visitor.name = "Removed under retention policy"
        visitor.phone = visitor.purpose = visitor.vehicle_number = ""
        visitor.photo_id = None
    for invitation in db.scalars(select(VisitorInvitation).where(VisitorInvitation.society_id == society.id,
            VisitorInvitation.end_at < retention, VisitorInvitation.name != "Removed under retention policy")):
        invitation.name = "Removed under retention policy"
        invitation.phone = invitation.notes = invitation.vehicle_number = ""
        invitation.status = "Expired"
    for visitor in db.scalars(select(Visitor).where(Visitor.society_id == society.id,
            Visitor.status.in_(["Waiting", "Allowed"]), Visitor.arrived_at < timestamp-timedelta(hours=12))):
        visitor.status = "Expired"


def tick():
    with SessionLocal() as db:
        society_ids = list(db.scalars(select(Society.id)))
    for society_id in society_ids:
        try:
            with SessionLocal.begin() as db:
                society = db.scalar(select(Society).where(Society.id == society_id).with_for_update(skip_locked=True))
                if society:
                    run_society(db, society)
        except Exception:
            logging.exception("Society maintenance failed: %s", society_id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    while True:
        tick()
        time.sleep(3600)
