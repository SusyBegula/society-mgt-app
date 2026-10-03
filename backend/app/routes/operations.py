"""Facilities, community governance and privacy request handling."""
from datetime import timedelta
from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, Field, model_validator
from sqlalchemy import select, func
from app.models import (Asset, Meeting, Poll, PollVote, PrivacyRequest, Society, ResidentMembership,
    StaffRole, Unit, Building, Notification, User, now)
from app.schemas import Input, Name
from app.security import Db, ManagementRole, Property, SocietyContext, scoped, limit
from app.routes.finance import society_row
from app.serialization import public
from app.audit import audit
from app.notifications import notify_staff, notify

router = APIRouter(tags=["Community operations"])


class AssetInput(Input):
    name: Name
    kind: Literal["Asset", "Inventory", "Contract"]
    quantity: int = Field(default=1, ge=0)
    notes: str = Field(default="", max_length=2000)
    next_service_at: AwareDatetime | None = None


class ServiceInput(Input):
    next_service_at: AwareDatetime
    note: str = Field(min_length=3, max_length=1000)


class MeetingInput(Input):
    title: str = Field(min_length=3, max_length=150)
    starts_at: AwareDatetime
    agenda: str = Field(min_length=3, max_length=20000)
    minutes: str = Field(default="", max_length=50000)


class PollInput(Input):
    question: str = Field(min_length=5, max_length=300)
    options: list[str] = Field(min_length=2, max_length=10)
    closes_at: AwareDatetime

    @model_validator(mode="after")
    def valid_options(self):
        self.options = [o.strip() for o in self.options]
        if any(not o or len(o) > 100 for o in self.options) or len(set(self.options)) != len(self.options):
            raise ValueError("Use distinct options with 1–100 characters.")
        if self.closes_at <= now():
            raise ValueError("Poll closing time must be in the future.")
        return self


class VoteInput(Input):
    option: int = Field(ge=0, le=9)


class PrivacyInput(Input):
    kind: Literal["Correction", "Deletion", "Access", "Grievance"]
    details: str = Field(min_length=10, max_length=2000)


class PrivacyResponse(Input):
    status: Literal["In Progress", "Completed", "Declined"]
    response: str = Field(min_length=10, max_length=2000)


@router.get("/admin/assets")
def assets(db: Db, admin: ManagementRole):
    return [public(r) for r in db.scalars(select(Asset).where(Asset.society_id == admin.society_id).order_by(Asset.next_service_at))]


@router.post("/admin/assets", status_code=201)
def create_asset(data: AssetInput, db: Db, admin: ManagementRole):
    row = Asset(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush(); audit(db, admin, "asset.created", row.id)
    return public(row)


@router.post("/admin/assets/{record_id}/service")
def service_asset(record_id: str, data: ServiceInput, db: Db, admin: ManagementRole):
    row = society_row(db, Asset, record_id, admin, lock=True)
    if data.next_service_at <= now():
        raise HTTPException(422, "Next service must be in the future.")
    row.last_service_at, row.next_service_at = now(), data.next_service_at
    audit(db, admin, "asset.serviced", row.id, note=data.note)
    return public(row)


def broadcast(db, actor, title, body):
    seen = set()
    for member in db.scalars(select(ResidentMembership).where(ResidentMembership.society_id == actor.society_id, ResidentMembership.active.is_(True))):
        if member.user_id not in seen:
            notify(db, member, title, body, "Notices", "/community")
            seen.add(member.user_id)


@router.get("/community/meetings")
def meetings(db: Db, member: SocietyContext):
    return [public(r) for r in db.scalars(select(Meeting).where(Meeting.society_id == member.society_id).order_by(Meeting.starts_at.desc()))]


@router.post("/admin/meetings", status_code=201)
def create_meeting(data: MeetingInput, db: Db, admin: ManagementRole):
    row = Meeting(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush(); audit(db, admin, "meeting.created", row.id)
    broadcast(db, admin, "Society meeting", row.title)
    return public(row)


@router.put("/admin/meetings/{record_id}")
def edit_meeting(record_id: str, data: MeetingInput, db: Db, admin: ManagementRole):
    row = society_row(db, Meeting, record_id, admin, lock=True)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    audit(db, admin, "meeting.updated", row.id)
    return public(row)


@router.get("/community/polls")
def polls(db: Db, member: SocietyContext):
    result = []
    for row in db.scalars(select(Poll).where(Poll.society_id == member.society_id).order_by(Poll.created_at.desc()).limit(100)):
        counts = dict(db.execute(select(PollVote.option, func.count()).where(PollVote.poll_id == row.id).group_by(PollVote.option)).all())
        voted = db.scalar(select(PollVote).where(PollVote.poll_id == row.id, PollVote.unit_id == getattr(member, "unit_id", "")))
        result.append({**public(row), "counts": [counts.get(i, 0) for i in range(len(row.options))], "my_vote": voted.option if voted else None})
    return result


@router.post("/admin/polls", status_code=201)
def create_poll(data: PollInput, db: Db, admin: ManagementRole):
    row = Poll(society_id=admin.society_id, **data.model_dump())
    db.add(row); db.flush(); audit(db, admin, "poll.created", row.id)
    broadcast(db, admin, "Society poll", row.question)
    return public(row)


@router.post("/community/polls/{record_id}/vote")
def vote(record_id: str, data: VoteInput, db: Db, member: Property):
    row = society_row(db, Poll, record_id, member, lock=True)
    if member.role != "Owner":
        raise HTTPException(403, "These advisory polls allow one vote per flat, cast by an owner.")
    if row.closes_at <= now() or data.option >= len(row.options):
        raise HTTPException(409, "Poll is closed or option is invalid.")
    if db.scalar(select(PollVote).where(PollVote.poll_id == row.id, PollVote.unit_id == member.unit_id)):
        raise HTTPException(409, "Your flat has already voted.")
    db.add(PollVote(society_id=member.society_id, unit_id=member.unit_id, user_id=member.user_id, poll_id=row.id, option=data.option))
    return {"voted": True}


@router.post("/privacy/requests", status_code=201)
def request_privacy(data: PrivacyInput, db: Db, member: SocietyContext):
    limit(db, "privacy:" + member.user_id, 5, 86400)
    row = PrivacyRequest(society_id=member.society_id, user_id=member.user_id, **data.model_dump())
    db.add(row); db.flush()
    notify_staff(db, member.society_id, "Privacy request received", data.kind + " request requires a response.", "Privacy", "/admin/privacy", roles=("Admin", "Secretary"))
    return public(row)


@router.get("/privacy/requests")
def my_privacy_requests(db: Db, member: SocietyContext):
    return [public(r) for r in db.scalars(select(PrivacyRequest).where(PrivacyRequest.society_id == member.society_id,
        PrivacyRequest.user_id == member.user_id).order_by(PrivacyRequest.created_at.desc()))]


@router.get("/admin/privacy")
def privacy_queue(db: Db, admin: ManagementRole):
    return [public(r) for r in db.scalars(select(PrivacyRequest).where(PrivacyRequest.society_id == admin.society_id).order_by(PrivacyRequest.created_at.desc()))]


@router.patch("/admin/privacy/{record_id}")
def respond_privacy(record_id: str, data: PrivacyResponse, db: Db, admin: ManagementRole):
    row = society_row(db, PrivacyRequest, record_id, admin, lock=True)
    if row.status in ("Completed", "Declined"):
        raise HTTPException(409, "This request is already closed.")
    row.status, row.response = data.status, data.response
    audit(db, admin, "privacy.responded", row.id, status=data.status)
    notify(db, row, "Privacy request updated", data.response, "Privacy", "/privacy")
    return public(row)
