import secrets
import json
from datetime import timedelta
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, or_
from app.models import (
    Visitor, VisitorInvitation, Parcel, Unit, Building, User,
    ResidentMembership, now
)
from app.security import Db, GuardRole, limit
from app.audit import audit
from app.schemas import (
    VerifyPassInput, CheckInInput, WalkInVisitorInput,
    ParcelInput, ParcelCollectInput
)
from app.serialization import public
from app.notifications import notify, notify_household

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
    limit(db, "gate-pass:" + guard.user_id, 20, 300)
    if not data.token and not data.pin:
        raise HTTPException(400, "Provide either a QR token or a 6-digit PIN.")

    query = select(VisitorInvitation).where(VisitorInvitation.society_id == guard.society_id)
    if data.token:
        # Strip potential JSON wrapper if raw QR payload was passed
        token = data.token.strip()
        if token.startswith("{"):
            try:
                payload = json.loads(token)
                if payload.get("v") != 1 or payload.get("type") != "society-invitation":
                    raise ValueError()
                token = payload["token"]
                if not isinstance(token, str) or not token:
                    raise ValueError()
            except (ValueError, KeyError, AttributeError):
                raise HTTPException(400, "Invalid QR pass.")
        query = query.where(VisitorInvitation.qr_token == token)
    elif data.pin:
        query = query.where(VisitorInvitation.pin == data.pin.strip())

    invitation = db.scalar(query)
    if not invitation:
        raise HTTPException(404, "Invalid gate pass. No matching invitation found.")

    current_time = now()
    if current_time < invitation.start_at:
        raise HTTPException(400, f"This pass is scheduled for later: valid from {invitation.start_at.strftime('%d %b %I:%M %p')}.")
    if current_time > invitation.end_at:
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
    if not invitation.start_at <= now() <= invitation.end_at:
        raise HTTPException(409, "This pass is not valid at this time.")
    if not db.scalar(select(ResidentMembership.id).where(ResidentMembership.unit_id == invitation.unit_id,
            ResidentMembership.user_id == invitation.user_id, ResidentMembership.active.is_(True))):
        raise HTTPException(409, "The host no longer has access to this flat.")

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
    audit(db, guard, "visitor.check_in", visitor.id)

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
    if visitor.status != "Inside":
        raise HTTPException(409, "Only a visitor inside can be checked out.")

    visitor.status = "Exited"
    visitor.exit_at = now()
    audit(db, guard, "visitor.check_out", visitor.id)
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
        status="Waiting",
        arrived_at=now(),
        entry_at=None
    )
    db.add(visitor)
    db.flush()

    memberships = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == data.unit_id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    notify_household(db, guard.society_id, data.unit_id, "Visitor awaiting approval",
        f"{data.name} ({data.kind}) is waiting at the gate. Approve or deny entry.",
        "Visitors", "/visitors", visitors_only=True)
    audit(db, guard, "visitor.request", visitor.id)

    return public(visitor)


@router.get("/visitors/queue")
def visitor_queue(db: Db, guard: GuardRole):
    records = db.execute(select(Visitor, Unit, Building).join(Unit, Unit.id == Visitor.unit_id)
        .join(Building, Building.id == Unit.building_id).where(Visitor.society_id == guard.society_id,
        Visitor.status.in_(["Waiting", "Allowed", "Denied"]), Visitor.arrived_at > now() - timedelta(hours=12))
        .order_by(Visitor.arrived_at.desc()).limit(200)).all()
    return [{**public(v), "tower": b.name, "flat": u.number} for v, u, b in records]


@router.get("/visitors/{visitor_id}/contacts")
def host_contacts(visitor_id: str, db: Db, guard: GuardRole):
    visitor = db.get(Visitor, visitor_id)
    if not visitor or visitor.society_id != guard.society_id or visitor.status != "Waiting":
        raise HTTPException(404, "Waiting visitor not found.")
    records = db.execute(select(User).join(ResidentMembership, ResidentMembership.user_id == User.id)
        .where(ResidentMembership.unit_id == visitor.unit_id, ResidentMembership.active.is_(True),
               ResidentMembership.receives_visitors.is_(True))).scalars().all()
    audit(db, guard, "visitor.host_contacts_viewed", visitor.id)
    return [{"name": u.name, "phone": u.phone} for u in records]


@router.post("/visitors/{visitor_id}/admit")
def admit_visitor(visitor_id: str, db: Db, guard: GuardRole):
    visitor = db.scalar(select(Visitor).where(Visitor.id == visitor_id,
        Visitor.society_id == guard.society_id).with_for_update())
    if not visitor:
        raise HTTPException(404, "Visitor not found.")
    if visitor.status == "Inside":
        return public(visitor)
    if visitor.status != "Allowed" or not visitor.decided_at or visitor.decided_at < now() - timedelta(minutes=30):
        raise HTTPException(409, "Entry requires resident approval within the last 30 minutes.")
    visitor.status, visitor.entry_at = "Inside", now()
    audit(db, guard, "visitor.admitted", visitor.id)
    notify_household(db, guard.society_id, visitor.unit_id, "Visitor entered", visitor.name + " entered the gate.", "Visitors", "/visitors", visitors_only=True)
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
            "/parcels"
        )

    audit(db, guard, "parcel.arrived", parcel.id)
    return public(parcel, exclude=("otp",))


@router.post("/parcels/{parcel_id}/collect")
def collect_parcel(parcel_id: str, data: ParcelCollectInput, db: Db, guard: GuardRole):
    limit(db, "parcel-pickup:" + guard.user_id, 15, 300)
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
    audit(db, guard, "parcel.collected", parcel.id)
    return public(parcel, exclude=("otp",))


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
