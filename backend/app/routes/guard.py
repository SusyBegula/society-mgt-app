import secrets
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, or_
from app.models import (
    Visitor, VisitorInvitation, Parcel, Unit, Building, User,
    ResidentMembership, now
)
from app.security import Db, GuardRole
from app.schemas import (
    VerifyPassInput, CheckInInput, WalkInVisitorInput,
    ParcelInput, ParcelCollectInput
)
from app.serialization import public
from app.notifications import notify

router = APIRouter(prefix="/guard", tags=["Security & Gate Guard"])


@router.get("/units")
def list_units(db: Db, guard: GuardRole):
    records = db.execute(
        select(Unit, Building)
        .join(Building, Building.id == Unit.building_id)
        .where(Unit.society_id == guard.society_id)
        .order_by(Building.name, Unit.number)
    ).all()
    return [{"id": u.id, "tower": b.name, "flat": u.number} for u, b in records]


@router.post("/verify-pass")
def verify_pass(data: VerifyPassInput, db: Db, guard: GuardRole):
    if not data.token and not data.pin:
        raise HTTPException(400, "Provide either a QR token or a 6-digit PIN.")

    query = select(VisitorInvitation).where(VisitorInvitation.society_id == guard.society_id)
    if data.token:
        # Strip potential JSON wrapper if raw QR payload was passed
        token = data.token.strip()
        query = query.where(VisitorInvitation.qr_token == token)
    elif data.pin:
        query = query.where(VisitorInvitation.pin == data.pin.strip())

    invitation = db.scalar(query)
    if not invitation:
        raise HTTPException(404, "Invalid gate pass. No matching invitation found.")

    current_time = now()
    # Allow entry 1 hour before start time up to 1 hour after expiration
    if current_time < (invitation.start_at - timedelta(hours=1)):
        raise HTTPException(400, f"This pass is scheduled for later: valid from {invitation.start_at.strftime('%d %b %I:%M %p')}.")
    if current_time > (invitation.end_at + timedelta(hours=1)):
        raise HTTPException(400, "This gate pass has expired.")
    if invitation.status != "Active":
        raise HTTPException(400, f"This pass cannot be used. Current status: {invitation.status}.")

    unit = db.get(Unit, invitation.unit_id)
    building = db.get(Building, unit.building_id) if unit else None
    host = db.get(User, invitation.user_id)

    return {
        "valid": True,
        "invitation_id": invitation.id,
        "visitor_name": invitation.name,
        "visitor_phone": invitation.phone,
        "tower": building.name if building else "",
        "flat": unit.number if unit else "",
        "host_name": host.name if host else "Resident",
        "valid_from": invitation.start_at,
        "valid_until": invitation.end_at,
        "notes": invitation.notes or "Guest visit"
    }


@router.post("/visitors/check-in", status_code=201)
def check_in_visitor(data: CheckInInput, db: Db, guard: GuardRole):
    invitation = db.scalar(
        select(VisitorInvitation).where(
            VisitorInvitation.id == data.invitation_id,
            VisitorInvitation.society_id == guard.society_id
        ).with_for_update()
    )
    if not invitation:
        raise HTTPException(404, "Invitation not found.")
    if invitation.status != "Active":
        raise HTTPException(400, f"Invitation cannot be checked in. Status: {invitation.status}")

    invitation.status = "Checked In"

    visitor = Visitor(
        society_id=guard.society_id,
        unit_id=invitation.unit_id,
        name=invitation.name,
        phone=invitation.phone,
        kind="Guest",
        purpose=invitation.notes or "Guest visit",
        status="Inside",
        arrived_at=now(),
        entry_at=now()
    )

    db.add(visitor)
    db.flush()

    # Notify flat residents
    memberships = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == invitation.unit_id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    for m in memberships:
        notify(db, m, "Guest Arrived at Gate", f"{invitation.name} has checked in at the main gate.", "Visitors", "/visitors")

    return public(visitor)


@router.post("/visitors/{visitor_id}/check-out")
def check_out_visitor(visitor_id: str, db: Db, guard: GuardRole):
    visitor = db.scalar(
        select(Visitor).where(
            Visitor.id == visitor_id,
            Visitor.society_id == guard.society_id
        ).with_for_update()
    )
    if not visitor:
        raise HTTPException(404, "Visitor not found.")
    if visitor.status == "Exited":
        return public(visitor)

    visitor.status = "Exited"
    visitor.exit_at = now()
    return public(visitor)


@router.post("/visitors/walk-in", status_code=201)
def walk_in_visitor(data: WalkInVisitorInput, db: Db, guard: GuardRole):
    unit = db.get(Unit, data.unit_id)
    if not unit or unit.society_id != guard.society_id:
        raise HTTPException(400, "Invalid unit selected.")

    visitor = Visitor(
        society_id=guard.society_id,
        unit_id=data.unit_id,
        name=data.name,
        phone=data.phone,
        kind=data.kind,
        purpose=data.purpose,
        status="Inside",
        arrived_at=now(),
        entry_at=now()
    )
    db.add(visitor)
    db.flush()

    memberships = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == data.unit_id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    for m in memberships:
        notify(db, m, f"{data.kind} Arrival", f"{data.name} entered the gate for your flat.", "Visitors", "/visitors")

    return public(visitor)


@router.get("/visitors/active")
def active_visitors(db: Db, guard: GuardRole):
    records = db.execute(
        select(Visitor, Unit, Building)
        .join(Unit, Unit.id == Visitor.unit_id)
        .join(Building, Building.id == Unit.building_id)
        .where(Visitor.society_id == guard.society_id, Visitor.status == "Inside")
        .order_by(Visitor.entry_at.desc())
    ).all()

    return [
        {
            "id": v.id,
            "name": v.name,
            "phone": v.phone,
            "kind": v.kind,
            "purpose": v.purpose,
            "tower": b.name,
            "flat": u.number,
            "entry_at": v.entry_at
        }
        for v, u, b in records
    ]


@router.post("/parcels", status_code=201)
def log_parcel(data: ParcelInput, db: Db, guard: GuardRole):
    unit = db.get(Unit, data.unit_id)
    if not unit or unit.society_id != guard.society_id:
        raise HTTPException(400, "Invalid unit selected.")

    otp = f"{secrets.randbelow(10000):04d}"
    parcel = Parcel(
        society_id=guard.society_id,
        unit_id=data.unit_id,
        courier=data.courier,
        recipient_name=data.recipient_name,
        tracking_code=data.tracking_code,
        status="Arrived",
        otp=otp,
        logged_by=guard.user_id
    )
    db.add(parcel)
    db.flush()

    memberships = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == data.unit_id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    building = db.get(Building, unit.building_id)
    flat_label = f"{building.name} - {unit.number}" if building else unit.number

    for m in memberships:
        notify(
            db, m,
            f"Delivery Package from {data.courier}",
            f"Package arrived at the gate for {flat_label}. Pickup OTP: {otp}",
            "Parcels",
            "/home"
        )

    return public(parcel)


@router.post("/parcels/{parcel_id}/collect")
def collect_parcel(parcel_id: str, data: ParcelCollectInput, db: Db, guard: GuardRole):
    parcel = db.scalar(
        select(Parcel).where(
            Parcel.id == parcel_id,
            Parcel.society_id == guard.society_id
        ).with_for_update()
    )
    if not parcel:
        raise HTTPException(404, "Parcel not found.")
    if parcel.status == "Collected":
        raise HTTPException(400, "This parcel was already collected.")
    if parcel.otp != data.otp.strip():
        raise HTTPException(400, "Incorrect pickup OTP. Please check the code with the resident.")

    parcel.status = "Collected"
    parcel.collected_at = now()
    return public(parcel)


@router.get("/parcels/active")
def active_parcels(db: Db, guard: GuardRole):
    records = db.execute(
        select(Parcel, Unit, Building)
        .join(Unit, Unit.id == Parcel.unit_id)
        .join(Building, Building.id == Unit.building_id)
        .where(Parcel.society_id == guard.society_id, Parcel.status == "Arrived")
        .order_by(Parcel.created_at.desc())
    ).all()

    return [
        {
            "id": p.id,
            "courier": p.courier,
            "recipient_name": p.recipient_name,
            "tracking_code": p.tracking_code,
            "tower": b.name,
            "flat": u.number,
            "created_at": p.created_at
        }
        for p, u, b in records
    ]
