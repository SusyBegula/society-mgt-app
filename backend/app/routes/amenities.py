from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models import Amenity, AmenityBooking, now
from app.security import Db, Property, scoped, owned
from app.schemas import BookingInput
from app.serialization import public, page
from app.notifications import notify

router = APIRouter(tags=["Amenities"])
IST = ZoneInfo("Asia/Kolkata")


@router.get("/amenities")
def amenities(db: Db, member: Property):
    return [public(a) for a in db.scalars(scoped(Amenity, member).order_by(Amenity.name))]


@router.get("/amenities/{record_id}/slots")
def slots(record_id: str, day: date, db: Db, member: Property):
    amenity = owned(db, Amenity, record_id, member)
    if day < now().astimezone(IST).date() or day > (now() + timedelta(days=30)).astimezone(IST).date():
        raise HTTPException(422, "Choose a date within the next 30 days.")
    result = []
    for hour in range(amenity.opens, amenity.closes):
        start = datetime(day.year, day.month, day.day, hour, tzinfo=IST)
        end = start + timedelta(hours=1)
        overlap = db.scalar(select(AmenityBooking.id).where(AmenityBooking.amenity_id == record_id,
            AmenityBooking.status == "Confirmed", AmenityBooking.start_at < end, AmenityBooking.end_at > start).limit(1))
        result.append({"start_at": start, "end_at": end, "available": not overlap and start > now()})
    return {"amenity": public(amenity), "slots": result}


@router.get("/bookings")
def bookings(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    result = page(db, scoped(AmenityBooking, member).order_by(AmenityBooking.start_at.desc()), offset, limit)
    for row in result["items"]:
        amenity = db.get(Amenity, row["amenity_id"])
        row["amenity_name"] = amenity.name
        row["cancel_hours"] = amenity.cancel_hours
    return result


@router.post("/bookings", status_code=201)
def book(data: BookingInput, db: Db, member: Property):
    # Lock the amenity, not just existing bookings: concurrent first bookings serialize too.
    amenity = owned(db, Amenity, data.amenity_id, member, lock=True)
    start = data.start_at.astimezone(IST)
    end = start + timedelta(hours=1)
    if start <= now() or start > now() + timedelta(days=30) or start.minute or start.second or start.microsecond or start.hour < amenity.opens or start.hour >= amenity.closes:
        raise HTTPException(422, "Choose an available one-hour slot within the next 30 days.")
    overlap = db.scalar(select(AmenityBooking.id).where(AmenityBooking.amenity_id == amenity.id,
        AmenityBooking.status == "Confirmed", AmenityBooking.start_at < end, AmenityBooking.end_at > start).limit(1))
    if overlap:
        raise HTTPException(409, "This slot was just booked. Please choose another.")
    row = AmenityBooking(society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id,
                         amenity_id=amenity.id, start_at=start, end_at=end, fee=amenity.fee)
    db.add(row)
    db.flush()
    notify(db, member, "Booking confirmed", f"{amenity.name} · {start.strftime('%d %b, %I:%M %p')}", "Amenities", "/bookings")
    return public(row)


@router.delete("/bookings/{record_id}", status_code=204)
def cancel(record_id: str, db: Db, member: Property):
    row = owned(db, AmenityBooking, record_id, member, lock=True)
    amenity = db.get(Amenity, row.amenity_id)
    if row.status != "Confirmed" or row.start_at - timedelta(hours=amenity.cancel_hours) <= now():
        raise HTTPException(409, f"Cancel at least {amenity.cancel_hours} hours before your booking.")
    row.status = "Cancelled"
