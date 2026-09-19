import secrets
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models import Visitor, VisitorInvitation, now
from app.security import Db, Property, owned, scoped
from app.schemas import VisitorDecision, InvitationInput
from app.serialization import public, page

router = APIRouter(tags=["Visitors"])


@router.get("/visitors")
def visitors(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    return page(db, scoped(Visitor, member).order_by(Visitor.arrived_at.desc()), offset, limit)


@router.patch("/visitors/{record_id}")
def decision(record_id: str, data: VisitorDecision, db: Db, member: Property):
    row = owned(db, Visitor, record_id, member, lock=True)
    if row.status != "Waiting":
        raise HTTPException(409, "This visitor request has already been handled.")
    row.status, row.decided_at = data.status, now()
    return public(row)


@router.get("/visitors/invitations/list")
def invitations(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    result = page(db, scoped(VisitorInvitation, member).order_by(VisitorInvitation.start_at.desc()), offset, limit)
    for item in result["items"]:
        if item["status"] == "Active" and item["end_at"] < now():
            item["status"] = "Expired"
    return result


@router.post("/visitors/invitations", status_code=201)
def invite(data: InvitationInput, db: Db, member: Property):
    if data.start_at < now():
        raise HTTPException(422, "Choose a future visit time.")
    pin = f"{secrets.randbelow(900000) + 100000}"
    while db.scalar(select(VisitorInvitation.id).where(VisitorInvitation.pin == pin)):
        pin = f"{secrets.randbelow(900000) + 100000}"
    row = VisitorInvitation(**data.model_dump(), society_id=member.society_id, unit_id=member.unit_id,
                            user_id=member.user_id, pin=pin, qr_token=secrets.token_urlsafe(32))
    db.add(row)
    db.flush()
    return public(row)


@router.get("/visitors/invitations/{record_id}")
def invitation(record_id: str, db: Db, member: Property):
    row = owned(db, VisitorInvitation, record_id, member)
    result = public(row)
    if row.status == "Active" and row.end_at < now():
        result["status"] = "Expired"
    return result


@router.delete("/visitors/invitations/{record_id}", status_code=204)
def cancel(record_id: str, db: Db, member: Property):
    row = owned(db, VisitorInvitation, record_id, member)
    row.status = "Cancelled"
