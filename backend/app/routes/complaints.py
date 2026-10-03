from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from sqlalchemy import select
from app.models import Complaint, ComplaintComment, Upload
from app.security import Db, Property, scoped, owned
from app.schemas import ComplaintInput, CommentInput, ResolutionInput
from app.serialization import public, page
from app.notifications import notify, notify_staff

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.get("")
def complaints(db: Db, member: Property, offset: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100)):
    return page(db, scoped(Complaint, member).order_by(Complaint.created_at.desc()), offset, limit)


@router.post("", status_code=201)
def create(data: ComplaintInput, db: Db, member: Property, tasks: BackgroundTasks):
    for attachment in data.attachments:
        owned(db, Upload, attachment, member)
    row = Complaint(**data.model_dump(), society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id)
    db.add(row)
    db.flush()
    db.add(ComplaintComment(complaint_id=row.id, user_id=member.user_id, text="Complaint opened", kind="status"))
    route = f"/complaints/{row.id}"
    notify(db, member, "Complaint submitted", row.title, "Complaints", route)
    notify_staff(db, member.society_id, "New complaint", row.title, "Complaints", "/admin/complaints", roles=("Admin", "Secretary"))
    return public(row)


@router.get("/{record_id}")
def detail(record_id: str, db: Db, member: Property):
    row = owned(db, Complaint, record_id, member)
    return {**public(row), "timeline": [public(c) for c in db.scalars(select(ComplaintComment).where(ComplaintComment.complaint_id == row.id).order_by(ComplaintComment.created_at))]}


@router.post("/{record_id}/comments", status_code=201)
def comment(record_id: str, data: CommentInput, db: Db, member: Property):
    owned(db, Complaint, record_id, member)
    row = ComplaintComment(complaint_id=record_id, user_id=member.user_id, text=data.text)
    db.add(row)
    db.flush()
    return public(row)


@router.post("/{record_id}/resolution")
def resolution(record_id: str, data: ResolutionInput, db: Db, member: Property):
    row = owned(db, Complaint, record_id, member, lock=True)
    if row.status != "Resolved":
        raise HTTPException(409, "Only resolved complaints can be confirmed or reopened.")
    row.status = "Closed" if data.action == "confirm" else "Open"
    row.rating = data.rating if data.action == "confirm" else None
    db.add(ComplaintComment(complaint_id=row.id, user_id=member.user_id, text="Resolution confirmed" if data.action == "confirm" else "Reopened: issue is unresolved", kind="status"))
    return public(row)
