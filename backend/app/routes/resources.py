from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import Field, model_validator
from sqlalchemy import select
from datetime import timedelta
from app.models import (Amenity, AmenityBooking, DirectoryContact, DomesticHelp, DomesticHelpVisit,
                        Document, Vehicle, Unit, Complaint, Society, now)
from app.schemas import Input, Name
from app.security import Db, ManagementRole, GuardRole, Staff
from app.serialization import public
from app.audit import audit
from app.routes.finance import society_row
from app.storage import storage, validate_file
import uuid

router = APIRouter(tags=["Society resources"])


class AmenityInput(Input):
    name: Name
    description: str = Field(min_length=3, max_length=2000)
    icon: str = "business-outline"
    opens: int = Field(ge=0, le=23)
    closes: int = Field(ge=1, le=24)
    fee: int = Field(default=0, ge=0)
    cancel_hours: int = Field(default=2, ge=0, le=168)

    @model_validator(mode="after")
    def hours(self):
        if self.closes <= self.opens:
            raise ValueError("Closing hour must be after opening hour.")
        return self


class ContactInput(Input):
    name: Name
    phone: str = Field(pattern=r"^\+?[0-9]{3,16}$")
    category: str = Field(min_length=1, max_length=40)


class HelpInput(Input):
    unit_id: str
    name: Name
    kind: str = Field(min_length=1, max_length=30)


class ParkingInput(Input):
    slot: str = Field(min_length=1, max_length=30)


@router.get("/admin/resources")
def resources(db: Db, admin: ManagementRole):
    return {name: [public(row, exclude=("storage_key",)) for row in db.scalars(select(model).where(model.society_id == admin.society_id))]
            for name, model in [("amenities", Amenity), ("contacts", DirectoryContact), ("help", DomesticHelp), ("documents", Document), ("vehicles", Vehicle)]}


@router.post("/admin/resources/amenities", status_code=201)
def add_amenity(data: AmenityInput, db: Db, admin: ManagementRole):
    row = Amenity(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush()
    audit(db, admin, "amenity.created", row.id)
    return public(row)


@router.put("/admin/resources/amenities/{record_id}")
def edit_amenity(record_id: str, data: AmenityInput, db: Db, admin: ManagementRole):
    row = society_row(db, Amenity, record_id, admin, lock=True)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    audit(db, admin, "amenity.updated", row.id)
    return public(row)


@router.post("/admin/resources/contacts", status_code=201)
def add_contact(data: ContactInput, db: Db, admin: ManagementRole):
    row = DirectoryContact(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush()
    audit(db, admin, "contact.created", row.id)
    return public(row)


@router.delete("/admin/resources/contacts/{record_id}", status_code=204)
def delete_contact(record_id: str, db: Db, admin: ManagementRole):
    row = society_row(db, DirectoryContact, record_id, admin)
    audit(db, admin, "contact.deleted", row.id)
    db.delete(row)


@router.post("/admin/resources/help", status_code=201)
def add_help(data: HelpInput, db: Db, admin: ManagementRole):
    society_row(db, Unit, data.unit_id, admin)
    row = DomesticHelp(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush()
    audit(db, admin, "domestic_help.added", row.id)
    return public(row)


@router.get("/guard/help")
def guard_help(db: Db, guard: GuardRole):
    return [public(r) for r in db.scalars(select(DomesticHelp).where(DomesticHelp.society_id == guard.society_id))]


@router.post("/guard/help/{record_id}/entry")
def help_entry(record_id: str, db: Db, guard: GuardRole):
    row = society_row(db, DomesticHelp, record_id, guard, lock=True)
    if row.status == "Inside":
        raise HTTPException(409, "Already marked inside.")
    row.status = "Inside"
    db.add(DomesticHelpVisit(help_id=row.id, entry_at=now()))
    audit(db, guard, "domestic_help.entry", row.id)
    return public(row)


@router.post("/guard/help/{record_id}/exit")
def help_exit(record_id: str, db: Db, guard: GuardRole):
    row = society_row(db, DomesticHelp, record_id, guard, lock=True)
    visit = db.scalar(select(DomesticHelpVisit).where(DomesticHelpVisit.help_id == row.id,
        DomesticHelpVisit.exit_at.is_(None)).order_by(DomesticHelpVisit.entry_at.desc()))
    if row.status != "Inside" or not visit:
        raise HTTPException(409, "No active visit found.")
    visit.exit_at, row.status = now(), "Outside"
    audit(db, guard, "domestic_help.exit", row.id)
    return public(row)


@router.put("/admin/resources/parking/{record_id}")
def assign_parking(record_id: str, data: ParkingInput, db: Db, admin: ManagementRole):
    db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    row = society_row(db, Vehicle, record_id, admin)
    if data.slot != "Unassigned" and db.scalar(select(Vehicle.id).where(Vehicle.society_id == admin.society_id,
        Vehicle.parking_slot == data.slot, Vehicle.id != row.id)):
        raise HTTPException(409, "That parking slot is already allocated.")
    row.parking_slot = data.slot
    audit(db, admin, "parking.allocated", row.id, slot=data.slot)
    return public(row)


@router.post("/admin/resources/documents", status_code=201)
async def publish_document(file: UploadFile, db: Db, admin: ManagementRole, title: str, category: str = "General", owners_only: bool = False):
    if not 1 <= len(title.strip()) <= 150 or not 1 <= len(category) <= 60:
        raise HTTPException(422, "Enter a title and category within the length limits.")
    content = await file.read(10*1024*1024+1)
    if not content or len(content) > 10*1024*1024:
        raise HTTPException(413, "Choose a file smaller than 10 MB.")
    mime = file.content_type or ""
    validate_file(content, mime)
    key = f"{admin.society_id}/documents/{uuid.uuid4()}"
    storage().put(key, content, mime)
    row = Document(society_id=admin.society_id, title=title.strip(), category=category,
        storage_key=key, filename=(file.filename or "document")[:200], content_type=mime, owners_only=owners_only)
    db.add(row); db.flush()
    audit(db, admin, "document.published", row.id)
    return public(row, exclude=("storage_key",))


@router.get("/guard/directory")
def guard_directory(db: Db, guard: GuardRole):
    return [public(r) for r in db.scalars(select(DirectoryContact).where(DirectoryContact.society_id == guard.society_id))]


@router.get("/admin/complaints/overdue/list")
def overdue_complaints(db: Db, admin: ManagementRole):
    hours = db.get(Society, admin.society_id).settings.get("complaint_response_hours", 48)
    return [public(r) for r in db.scalars(select(Complaint).where(Complaint.society_id == admin.society_id,
        Complaint.status.in_(["Open", "In Progress"]), Complaint.created_at < now()-timedelta(hours=hours)))]
