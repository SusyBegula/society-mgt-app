from fastapi import APIRouter
from sqlalchemy import select, func
from app.models import MaintenanceBill, Visitor, Complaint, Notice, AmenityBooking, Amenity, Notification, now
from app.security import Db, Property, scoped
from app.serialization import public

router = APIRouter(tags=["Home"])


@router.get("/home")
def home(db: Db, member: Property):
    bills = db.scalars(scoped(MaintenanceBill, member).where(MaintenanceBill.outstanding > 0).order_by(MaintenanceBill.due_date)).all()
    visitors = db.scalars(scoped(Visitor, member).where(Visitor.arrived_at >= now().replace(hour=0, minute=0, second=0, microsecond=0)).order_by(Visitor.arrived_at.desc()).limit(3)).all()
    complaints = db.scalar(select(func.count()).select_from(scoped(Complaint, member).where(Complaint.status.notin_(["Resolved", "Closed"])).subquery()))
    notice = db.scalar(scoped(Notice, member).where(Notice.published_at <= now()).order_by(Notice.published_at.desc()).limit(1))
    booking = db.scalar(scoped(AmenityBooking, member).where(AmenityBooking.start_at > now(), AmenityBooking.status == "Confirmed").order_by(AmenityBooking.start_at).limit(1))
    unread = db.scalar(select(func.count()).select_from(scoped(Notification, member).where(Notification.user_id == member.user_id, Notification.read_at.is_(None)).subquery()))
    return {"due": sum(b.outstanding for b in bills), "bill": public(bills[0]) if bills else None,
            "visitors": [public(v) for v in visitors], "active_complaints": complaints, "notice": public(notice) if notice else None,
            "booking": {**public(booking), "amenity_name": db.get(Amenity, booking.amenity_id).name} if booking else None, "unread": unread}
