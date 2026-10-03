from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models import User, Society, Building, Unit, ResidentMembership, FamilyMember, Upload, StaffRole
from app.security import Db, CurrentUser, Property, scoped, owned, manage_household
from app.serialization import public
from app.schemas import ProfileInput, PreferencesInput, FamilyInput


router = APIRouter(tags=["Residents & properties"])


@router.get("/residents/me")
def me(user: CurrentUser):
    return public(user)


@router.patch("/residents/me")
def profile(data: ProfileInput, db: Db, user: CurrentUser):
    if data.avatar_id:
        image = db.get(Upload, data.avatar_id)
        if not image or image.user_id != user.id or not image.content_type.startswith("image/"):
            raise HTTPException(400, "Choose an image you uploaded.")
    for key, value in data.model_dump().items():
        setattr(user, key, value)
    db.flush()
    return public(user)


@router.put("/residents/me/preferences")
def preferences(data: PreferencesInput, db: Db, user: CurrentUser):
    user.preferences = data.model_dump()
    return user.preferences


@router.get("/properties")
def properties(db: Db, user: CurrentUser):
    records = db.execute(select(ResidentMembership, Society, Unit, Building)
        .join(Society, Society.id == ResidentMembership.society_id)
        .join(Unit, Unit.id == ResidentMembership.unit_id).join(Building, Building.id == Unit.building_id)
        .where(ResidentMembership.user_id == user.id, ResidentMembership.active.is_(True))).all()
    results = [
        dict(
            id=m.id,
            context_type="unit",
            society_id=s.id,
            society=s.name,
            address=s.address,
            tower=b.name,
            flat=u.number,
            role=m.role
        )
        for m, s, u, b in records
    ]

    staff_records = db.execute(
        select(StaffRole, Society)
        .join(Society, Society.id == StaffRole.society_id)
        .where(StaffRole.user_id == user.id, StaffRole.active.is_(True))
    ).all()
    for sr, s in staff_records:
        results.append(dict(
            id=sr.id,
            context_type="staff",
            society_id=s.id,
            society=s.name,
            address=s.address,
            tower="Management" if sr.role != "Guard" else "Security",
            flat=sr.title or sr.role,
            role=sr.role
        ))

    return results



@router.get("/societies/current")
def society(db: Db, member: Property):
    return public(db.get(Society, member.society_id))


@router.get("/residents/family")
def family(db: Db, member: Property):
    return [public(row) for row in db.scalars(scoped(FamilyMember, member))]


def sync_access(db, member, row, enabled):
    user = db.scalar(select(User).where(User.phone == row.phone))
    if enabled and not user:
        user = User(phone=row.phone, name=row.name)
        db.add(user)
        db.flush()
    if not user:
        return
    existing = db.scalar(select(ResidentMembership).where(ResidentMembership.user_id == user.id, ResidentMembership.unit_id == member.unit_id))
    if existing and existing.role != "Family Member":
        if enabled:
            raise HTTPException(409, "This phone already belongs to an owner or tenant of this flat.")
        return
    if existing:
        existing.active = enabled
    elif enabled:
        db.add(ResidentMembership(user_id=user.id, society_id=member.society_id, unit_id=member.unit_id, role="Family Member"))


@router.post("/residents/family", status_code=201)
def add_family(data: FamilyInput, db: Db, member: Property):
    manage_household(member)
    row = FamilyMember(**data.model_dump(), society_id=member.society_id, unit_id=member.unit_id)
    sync_access(db, member, row, data.app_access)
    db.add(row)
    db.flush()
    return public(row)


@router.put("/residents/family/{record_id}")
def edit_family(record_id: str, data: FamilyInput, db: Db, member: Property):
    manage_household(member)
    row = owned(db, FamilyMember, record_id, member)
    sync_access(db, member, row, False)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    sync_access(db, member, row, data.app_access)
    return public(row)


@router.delete("/residents/family/{record_id}", status_code=204)
def delete_family(record_id: str, db: Db, member: Property):
    manage_household(member)
    row = owned(db, FamilyMember, record_id, member)
    sync_access(db, member, row, False)
    db.delete(row)
