from typing import Literal
from fastapi import APIRouter, HTTPException
from pydantic import Field
from sqlalchemy import select
from app.models import EmergencyAlert, Unit, Building, User, now
from app.schemas import Input
from app.security import Db, GuardRole, Property, scoped
from app.serialization import public
from app.notifications import notify_household
from app.audit import audit

router = APIRouter(tags=["Emergency response"])


class ResponseInput(Input):
    status: Literal["Acknowledged", "Resolved"]
    note: str = Field(min_length=3, max_length=1000)


@router.get("/emergency")
def own_alerts(db: Db, member: Property):
    return [public(r) for r in db.scalars(scoped(EmergencyAlert, member)
        .order_by(EmergencyAlert.created_at.desc()).limit(30))]


@router.get("/guard/emergencies")
def response_queue(db: Db, guard: GuardRole):
    rows = db.execute(select(EmergencyAlert, Unit, Building, User)
        .join(Unit, Unit.id == EmergencyAlert.unit_id).join(Building, Building.id == Unit.building_id)
        .join(User, User.id == EmergencyAlert.user_id).where(EmergencyAlert.society_id == guard.society_id,
            EmergencyAlert.status != "Resolved").order_by(EmergencyAlert.created_at)).all()
    return [{**public(r), "flat": u.number, "building": b.name, "resident": usr.name,
             "phone": usr.phone} for r, u, b, usr in rows]


@router.patch("/guard/emergencies/{record_id}")
def respond(record_id: str, data: ResponseInput, db: Db, guard: GuardRole):
    row = db.scalar(select(EmergencyAlert).where(EmergencyAlert.id == record_id,
        EmergencyAlert.society_id == guard.society_id).with_for_update())
    if not row:
        raise HTTPException(404, "Alert not found.")
    if row.status == "Resolved" or (data.status == "Resolved" and row.status != "Acknowledged"):
        raise HTTPException(409, "Acknowledge the alert before resolving it. Resolved alerts cannot be changed.")
    if row.status == "Open":
        row.acknowledged_by, row.acknowledged_at = guard.user_id, now()
    row.status, row.response_note = data.status, data.note
    if data.status == "Resolved":
        row.resolved_at = now()
    audit(db, guard, "emergency." + data.status.lower(), row.id, note=data.note)
    notify_household(db, guard.society_id, row.unit_id, "Emergency " + data.status.lower(), data.note, "Emergency", "/emergency")
    return public(row)
