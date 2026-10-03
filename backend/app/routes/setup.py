"""Society onboarding and membership lifecycle. No public resident directory."""
import csv
import io
import secrets
from datetime import datetime
from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from sqlalchemy import select, func
from app.models import (Society, Building, Unit, User, ResidentMembership, StaffRole,
                        JoinRequest, MaintenanceBill, BillItem, AuditEvent, FamilyMember, VisitorInvitation, now)
from app.schemas import Input, Name, Phone
from app.security import Db, CurrentUser, ManagementRole, AdminRole, limit
from app.audit import audit
from app.serialization import public, page
from app.notifications import notify, notify_staff

router = APIRouter(tags=["Society setup"])


class SocietyInput(Input):
    name: Name
    address: str = Field(min_length=5, max_length=1000)


class UnitInput(Input):
    building: str = Field(min_length=1, max_length=80)
    number: str = Field(min_length=1, max_length=20)
    area_sqft: int = Field(default=0, ge=0, le=100000)
    opening_balance: int = Field(default=0, ge=0, le=100000000)


class CsvInput(Input):
    csv: str = Field(min_length=1, max_length=200000)
    preview: bool = True


class MemberInput(Input):
    unit_id: str
    name: Name
    phone: Phone
    role: Literal["Owner", "Tenant"]
    receives_visitors: bool = True


class StaffInput(Input):
    name: Name
    phone: Phone
    role: Literal["Secretary", "Treasurer", "Guard"]
    title: str = Field(default="", max_length=80)


class JoinInput(Input):
    code: str = Field(min_length=8, max_length=32)
    building: str = Field(min_length=1, max_length=80)
    flat: str = Field(min_length=1, max_length=20)
    role: Literal["Owner", "Tenant"]
    note: str = Field(default="", max_length=500)


class DecisionInput(Input):
    decision: Literal["Approved", "Rejected"]


class SocietySettingsInput(Input):
    office_phone: str = Field(default="", max_length=16, pattern=r"^(\+91[0-9]{10})?$")
    security_phone: str = Field(default="", max_length=16, pattern=r"^(\+91[0-9]{10})?$")
    privacy_policy: str = Field(default="", max_length=20000)
    terms: str = Field(default="", max_length=20000)
    grievance_email: str = Field(default="", max_length=254)
    visitor_retention_days: int = Field(default=90, ge=7, le=365)
    complaint_response_hours: int = Field(default=48, ge=1, le=720)


@router.post("/onboarding/societies", status_code=201)
def create_society(data: SocietyInput, db: Db, user: CurrentUser):
    limit(db, "create-society:" + user.id, 3, 86400)
    society = Society(**data.model_dump(), join_code=secrets.token_urlsafe(12))
    db.add(society)
    db.flush()
    staff = StaffRole(society_id=society.id, user_id=user.id, role="Admin", title="Society administrator")
    db.add(staff)
    db.flush()
    audit(db, staff, "society.created", society.id)
    return {"society_id": society.id, "staff_id": staff.id, "join_code": society.join_code}


@router.get("/admin/setup")
def setup_summary(db: Db, admin: ManagementRole):
    society = db.get(Society, admin.society_id)
    records = db.execute(select(Unit, Building).join(Building, Unit.building_id == Building.id)
        .where(Unit.society_id == admin.society_id).order_by(Building.name, Unit.number)).all()
    return {"society": public(society), "units": [{**public(u), "building": b.name} for u, b in records]}


@router.put("/admin/setup/settings")
def update_settings(data: SocietySettingsInput, db: Db, admin: ManagementRole):
    society = db.get(Society, admin.society_id)
    society.settings = {**society.settings, **data.model_dump()}
    audit(db, admin, "society.settings_changed", society.id, fields=list(data.model_fields))
    return society.settings


@router.post("/admin/setup/rotate-code")
def rotate_code(db: Db, admin: ManagementRole):
    society = db.get(Society, admin.society_id)
    society.join_code = secrets.token_urlsafe(12)
    audit(db, admin, "society.join_code_rotated", society.id)
    return {"join_code": society.join_code}


def add_unit(db, admin, data):
    building_name, number = data.building.strip(), data.number.strip()
    if not building_name or not number:
        raise HTTPException(422, "Building and flat cannot be blank.")
    building = db.scalar(select(Building).where(Building.society_id == admin.society_id, Building.name == building_name))
    if not building:
        building = Building(society_id=admin.society_id, name=building_name)
        db.add(building)
        db.flush()
    if db.scalar(select(Unit.id).where(Unit.building_id == building.id, Unit.number == number)):
        raise HTTPException(409, f"{building_name} / {number} already exists.")
    unit = Unit(society_id=admin.society_id, building_id=building.id, number=number, area_sqft=data.area_sqft)
    db.add(unit)
    db.flush()
    if data.opening_balance:
        bill = MaintenanceBill(society_id=admin.society_id, unit_id=unit.id, period="Opening balance",
            amount=data.opening_balance, outstanding=data.opening_balance, due_date=now(), billing_key=f"{unit.id}:opening")
        db.add(bill)
        db.flush()
        db.add(BillItem(bill_id=bill.id, label="Opening balance", amount=data.opening_balance))
    audit(db, admin, "unit.created", unit.id, opening_balance=data.opening_balance)
    return unit


@router.post("/admin/setup/units", status_code=201)
def create_unit(data: UnitInput, db: Db, admin: ManagementRole):
    db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    return public(add_unit(db, admin, data))


@router.post("/admin/setup/import")
def import_units(data: CsvInput, db: Db, admin: ManagementRole):
    try:
        reader = csv.DictReader(io.StringIO(data.csv.lstrip("\ufeff")))
        if not reader.fieldnames or set(reader.fieldnames) != {"building", "number", "area_sqft", "opening_balance"}:
            raise ValueError("Use headers: building,number,area_sqft,opening_balance (amounts in paise).")
        rows = [UnitInput(**row) for row in reader]
        if not rows or len(rows) > 2000:
            raise ValueError("Import between 1 and 2000 flats.")
        if len({(r.building.strip(), r.number.strip()) for r in rows}) != len(rows):
            raise ValueError("Duplicate flats in import.")
    except (ValueError, TypeError, csv.Error) as exc:
        raise HTTPException(422, str(exc)[:500])
    db.scalar(select(Society).where(Society.id == admin.society_id).with_for_update())
    existing = set(db.execute(select(Building.name, Unit.number).join(Unit, Unit.building_id == Building.id)
        .where(Building.society_id == admin.society_id)).all())
    conflicts = [f"{r.building}/{r.number}" for r in rows if (r.building.strip(), r.number.strip()) in existing]
    if conflicts:
        raise HTTPException(409, "Existing flats: " + ", ".join(conflicts[:10]))
    if not data.preview:
        for row in rows:
            add_unit(db, admin, row)
    return {"preview": data.preview, "count": len(rows), "opening_balance": sum(r.opening_balance for r in rows),
            "rows": [r.model_dump() for r in rows[:20]]}


def ensure_user(db, phone, name):
    user = db.scalar(select(User).where(User.phone == phone))
    if not user:
        user = User(phone=phone, name=name)
        db.add(user)
        db.flush()
    return user


def link_member(db, admin, unit_id, user_id, role, receives_visitors=True):
    unit = db.scalar(select(Unit).where(Unit.id == unit_id, Unit.society_id == admin.society_id).with_for_update())
    if not unit:
        raise HTTPException(404, "Flat not found.")
    row = db.scalar(select(ResidentMembership).where(ResidentMembership.user_id == user_id, ResidentMembership.unit_id == unit_id))
    if row and row.active:
        raise HTTPException(409, "This member already has active access to the flat.")
    if not row:
        row = ResidentMembership(society_id=admin.society_id, unit_id=unit_id, user_id=user_id, role=role)
        db.add(row)
    row.role, row.active, row.receives_visitors = role, True, receives_visitors
    row.moved_in_at, row.moved_out_at = now(), None
    db.flush()
    audit(db, admin, "member.added", row.id, role=role)
    notify(db, row, "Society access approved", "Your home is ready in the property selector.", "Membership", "/properties")
    return row


@router.post("/admin/setup/members", status_code=201)
def create_member(data: MemberInput, db: Db, admin: ManagementRole):
    user = ensure_user(db, data.phone, data.name)
    return public(link_member(db, admin, data.unit_id, user.id, data.role, data.receives_visitors))


@router.post("/admin/setup/staff", status_code=201)
def create_staff(data: StaffInput, db: Db, admin: ManagementRole):
    if admin.role != "Admin":
        raise HTTPException(403, "Only the administrator can grant staff access.")
    user = ensure_user(db, data.phone, data.name)
    row = db.scalar(select(StaffRole).where(StaffRole.society_id == admin.society_id,
        StaffRole.user_id == user.id, StaffRole.role == data.role))
    if not row:
        row = StaffRole(society_id=admin.society_id, user_id=user.id, role=data.role)
        db.add(row)
    row.active, row.title = True, data.title
    db.flush()
    audit(db, admin, "staff.granted", row.id, role=data.role)
    return public(row)


@router.get("/admin/setup/staff")
def list_staff(db: Db, admin: ManagementRole):
    records = db.execute(select(StaffRole, User).join(User, StaffRole.user_id == User.id)
        .where(StaffRole.society_id == admin.society_id)).all()
    return [{**public(s), "name": u.name, "phone": u.phone} for s, u in records]


@router.delete("/admin/setup/staff/{record_id}", status_code=204)
def revoke_staff(record_id: str, db: Db, admin: ManagementRole):
    if admin.role != "Admin":
        raise HTTPException(403, "Only the administrator can revoke staff access.")
    row = db.scalar(select(StaffRole).where(StaffRole.id == record_id, StaffRole.society_id == admin.society_id).with_for_update())
    if not row:
        raise HTTPException(404, "Staff record not found.")
    if row.role == "Admin":
        raise HTTPException(409, "Administrator access requires a committee handover.")
    row.active = False
    audit(db, admin, "staff.revoked", row.id)


@router.post("/onboarding/join", status_code=201)
def join(data: JoinInput, db: Db, user: CurrentUser):
    limit(db, "join:" + user.id, 10, 3600)
    society = db.scalar(select(Society).where(Society.join_code == data.code))
    unit = db.scalar(select(Unit).join(Building, Unit.building_id == Building.id).where(
        Unit.society_id == society.id, Building.name == data.building.strip(), Unit.number == data.flat.strip())) if society else None
    if not unit:
        raise HTTPException(404, "Check the invitation code, building and flat with your office.")
    existing = db.scalar(select(JoinRequest).where(JoinRequest.user_id == user.id, JoinRequest.unit_id == unit.id))
    if existing:
        if existing.status != "Rejected":
            raise HTTPException(409, "A request already exists for this flat.")
        existing.status, existing.role, existing.note = "Pending", data.role, data.note
        row = existing
    else:
        row = JoinRequest(society_id=society.id, unit_id=unit.id, user_id=user.id, role=data.role, note=data.note)
        db.add(row)
    db.flush()
    notify_staff(db, society.id, "Membership verification required", f"A resident requested access to {data.building} / {data.flat}.", "Membership", "/admin/setup", roles=("Admin", "Secretary"))
    return public(row)


@router.get("/onboarding/requests")
def own_requests(db: Db, user: CurrentUser):
    return [public(r) for r in db.scalars(select(JoinRequest).where(JoinRequest.user_id == user.id))]


@router.get("/admin/setup/requests")
def join_requests(db: Db, admin: ManagementRole):
    records = db.execute(select(JoinRequest, User, Unit, Building).join(User, User.id == JoinRequest.user_id)
        .join(Unit, Unit.id == JoinRequest.unit_id).join(Building, Building.id == Unit.building_id)
        .where(JoinRequest.society_id == admin.society_id, JoinRequest.status == "Pending")).all()
    return [{**public(r), "name": u.name, "phone": u.phone, "flat": un.number, "building": b.name} for r, u, un, b in records]


@router.post("/admin/setup/requests/{record_id}")
def decide_join(record_id: str, data: DecisionInput, db: Db, admin: ManagementRole):
    row = db.scalar(select(JoinRequest).where(JoinRequest.id == record_id, JoinRequest.society_id == admin.society_id).with_for_update())
    if not row or row.status != "Pending":
        raise HTTPException(409, "No pending request found.")
    if data.decision == "Approved":
        link_member(db, admin, row.unit_id, row.user_id, row.role)
    row.status = data.decision
    audit(db, admin, "membership_request." + data.decision.lower(), row.id)
    return public(row)


@router.post("/admin/setup/units/{unit_id}/move-out")
def move_out(unit_id: str, db: Db, admin: ManagementRole):
    unit = db.scalar(select(Unit).where(Unit.id == unit_id, Unit.society_id == admin.society_id).with_for_update())
    if not unit:
        raise HTTPException(404, "Flat not found.")
    rows = db.scalars(select(ResidentMembership).where(ResidentMembership.unit_id == unit_id,
        ResidentMembership.role.in_(["Tenant", "Family Member"]), ResidentMembership.active.is_(True))).all()
    for row in rows:
        row.active, row.moved_out_at = False, now()
        audit(db, admin, "member.moved_out", row.id)
    departed = [r.user_id for r in rows]
    for invitation in db.scalars(select(VisitorInvitation).where(VisitorInvitation.unit_id == unit_id,
            VisitorInvitation.user_id.in_(departed), VisitorInvitation.status == "Active")):
        invitation.status = "Cancelled"
    for family in db.scalars(select(FamilyMember).where(FamilyMember.unit_id == unit_id)):
        family.app_access = False
    return {"revoked": len(rows)}


@router.get("/admin/audit")
def audit_events(db: Db, admin: ManagementRole, offset: int = Query(0, ge=0)):
    return page(db, select(AuditEvent).where(AuditEvent.society_id == admin.society_id)
                .order_by(AuditEvent.created_at.desc()), offset, 50)
