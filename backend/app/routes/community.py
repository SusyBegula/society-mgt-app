import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, UploadFile, Response
from sqlalchemy import select, update, or_
from app.models import Notice, Vehicle, DomesticHelp, DomesticHelpVisit, Document, DirectoryContact, Notification, Device, EmergencyAlert, Upload, Parcel, now
from app.security import Db, Property, CurrentUser, SocietyContext, scoped, owned, manage_household, limit
from app.schemas import VehicleInput, DeviceInput, EmergencyInput
from app.serialization import public, page
from app.storage import storage, validate_file
from app.notifications import notify, notify_staff

router = APIRouter(tags=["Community"])


@router.get("/parcels")
def parcels(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    result = page(db, scoped(Parcel, member).order_by(Parcel.created_at.desc()), offset, limit)
    for row in result["items"]:
        if row["status"] == "Collected":
            row.pop("otp", None)
    return result


@router.get("/notices")
def notices(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    return page(db, scoped(Notice, member).where(Notice.published_at <= now()).order_by(Notice.published_at.desc()), offset, limit)


@router.get("/notices/{record_id}")
def notice(record_id: str, db: Db, member: Property):
    row = owned(db, Notice, record_id, member)
    if row.published_at > now():
        raise HTTPException(404, "Notice unavailable.")
    return public(row)


@router.get("/vehicles")
def vehicles(db: Db, member: Property):
    return [public(v) for v in db.scalars(scoped(Vehicle, member))]


@router.post("/vehicles", status_code=201)
def add_vehicle(data: VehicleInput, db: Db, member: Property):
    manage_household(member)
    row = Vehicle(**data.model_dump(), society_id=member.society_id, unit_id=member.unit_id)
    db.add(row)
    db.flush()
    return public(row)


@router.put("/vehicles/{record_id}")
def edit_vehicle(record_id: str, data: VehicleInput, db: Db, member: Property):
    manage_household(member)
    row = owned(db, Vehicle, record_id, member)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    return public(row)


@router.delete("/vehicles/{record_id}", status_code=204)
def delete_vehicle(record_id: str, db: Db, member: Property):
    manage_household(member)
    db.delete(owned(db, Vehicle, record_id, member))


@router.get("/staff")
def staff(db: Db, member: Property):
    result = []
    for row in db.scalars(scoped(DomesticHelp, member)):
        visits = db.scalars(select(DomesticHelpVisit).where(DomesticHelpVisit.help_id == row.id).order_by(DomesticHelpVisit.entry_at.desc()).limit(1)).all()
        result.append({**public(row), "last_visit": public(visits[0]) if visits else None})
    return result


@router.get("/staff/{record_id}/visits")
def staff_visits(record_id: str, db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    row = owned(db, DomesticHelp, record_id, member)
    return {"staff": public(row), **page(db, select(DomesticHelpVisit).where(DomesticHelpVisit.help_id == row.id).order_by(DomesticHelpVisit.entry_at.desc()), offset, limit)}


@router.get("/documents")
def documents(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    query = scoped(Document, member)
    if member.role != "Owner":
        query = query.where(Document.owners_only.is_(False))
    return page(db, query.order_by(Document.created_at.desc()), offset, limit, exclude=("storage_key",))


@router.get("/documents/{record_id}/download")
def download(record_id: str, db: Db, member: Property):
    row = owned(db, Document, record_id, member)
    if row.owners_only and member.role != "Owner":
        raise HTTPException(403, "This document is available to owners only.")
    return Response(storage().get(row.storage_key), media_type=row.content_type,
                    headers={"Content-Disposition": f'attachment; filename="document-{row.id}.pdf"', "X-Content-Type-Options": "nosniff"})


@router.post("/uploads", status_code=201)
async def upload(file: UploadFile, db: Db, member: Property):
    limit(db, "upload:" + member.user_id, 30, 3600)
    content = await file.read(10 * 1024 * 1024 + 1)
    if not content or len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "Choose a file smaller than 10 MB.")
    mime = file.content_type or ""
    validate_file(content, mime)
    key = f"{member.society_id}/{uuid.uuid4()}"
    storage().put(key, content, mime)
    row = Upload(society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id,
                  filename=Path(file.filename or "upload").name[:200], key=key, content_type=mime, size=len(content))
    db.add(row)
    db.flush()
    return public(row, exclude=("key",))


@router.get("/uploads/{record_id}")
def get_upload(record_id: str, db: Db, member: Property, user: CurrentUser):
    row = db.get(Upload, record_id)
    if not row or not (row.user_id == user.id or (row.society_id == member.society_id and row.unit_id == member.unit_id)):
        raise HTTPException(404, "File unavailable.")
    return Response(storage().get(row.key), media_type=row.content_type, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.get("/directory")
def directory(db: Db, member: Property):
    return [public(row) for row in db.scalars(scoped(DirectoryContact, member).order_by(DirectoryContact.name))]


@router.get("/notifications")
def notifications(db: Db, member: SocietyContext, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    return page(db, scoped(Notification, member).where(Notification.user_id == member.user_id).order_by(Notification.created_at.desc()), offset, limit)


@router.post("/notifications/read-all", status_code=204)
def read_all(db: Db, member: SocietyContext):
    db.execute(update(Notification).where(Notification.society_id == member.society_id, Notification.user_id == member.user_id,
        or_(Notification.context_id == member.id, Notification.context_id.is_(None))).values(read_at=now()))


@router.post("/notifications/{record_id}/read", status_code=204)
def mark_read(record_id: str, db: Db, member: SocietyContext):
    row = owned(db, Notification, record_id, member)
    if row.user_id != member.user_id:
        raise HTTPException(404, "Notification unavailable.")
    row.read_at = now()


@router.post("/notifications/devices", status_code=201)
def device(data: DeviceInput, db: Db, user: CurrentUser):
    row = db.scalar(select(Device).where(Device.token == data.token))
    if row:
        row.user_id, row.platform = user.id, data.platform
    else:
        row = Device(user_id=user.id, **data.model_dump())
        db.add(row)
    return {"registered": True}


@router.delete("/notifications/devices", status_code=204)
def remove_devices(db: Db, user: CurrentUser):
    for row in db.scalars(select(Device).where(Device.user_id == user.id)):
        db.delete(row)


@router.post("/emergency", status_code=201)
def emergency(data: EmergencyInput, db: Db, member: Property):
    limit(db, "emergency:" + member.user_id, 3, 300)
    row = EmergencyAlert(society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id, kind=data.kind)
    db.add(row)
    db.flush()
    notify_staff(db, member.society_id, f"{data.kind} emergency", f"An emergency was reported for flat {member.unit_id}. Acknowledge in the response desk.", "Emergency", "/guard/emergencies")
    notify(db, member, f"{data.kind} alert recorded", "Call security or emergency services now for immediate assistance.", "Emergency", "/emergency")
    return {**public(row), "message": "Alert recorded. Call security or emergency services for immediate assistance."}
