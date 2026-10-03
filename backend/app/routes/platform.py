import io
import json
import zipfile
from types import SimpleNamespace
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field, AwareDatetime
from sqlalchemy import select, func
from app.config import settings
from app.db import Base
from app.models import (Society, PlatformSubscription, User, ResidentMembership, StaffRole,
    Upload, Document, Complaint, ComplaintComment, MaintenanceBill, BillItem, DomesticHelp, DomesticHelpVisit)
from app.schemas import Input
from app.security import Db, CurrentUser, ManagementRole, AdminRole
from app.serialization import public
from app.audit import audit
from app.storage import storage

router = APIRouter(tags=["Platform operations"])


def platform_admin(user: CurrentUser):
    if user.id not in settings().platform_admin_user_ids:
        raise HTTPException(403, "Platform operator access is required.")
    return user


PlatformAdmin = Annotated[User, Depends(platform_admin)]


class SubscriptionInput(Input):
    plan: str = Field(min_length=1, max_length=60)
    status: Literal["Trial", "Active", "Past Due", "Cancelled"]
    amount: int = Field(ge=0)
    renews_at: AwareDatetime | None = None


@router.get("/platform/access")
def platform_access(user: CurrentUser):
    return {"allowed": user.id in settings().platform_admin_user_ids}


@router.get("/platform/societies")
def society_accounts(db: Db, operator: PlatformAdmin):
    rows = db.execute(select(Society, PlatformSubscription).outerjoin(PlatformSubscription,
        PlatformSubscription.society_id == Society.id).order_by(Society.created_at.desc())).all()
    return [{"id": s.id, "name": s.name, "created_at": s.created_at,
             "subscription": public(p) if p else None} for s, p in rows]


@router.put("/platform/societies/{society_id}/subscription")
def update_subscription(society_id: str, data: SubscriptionInput, db: Db, operator: PlatformAdmin):
    society = db.scalar(select(Society).where(Society.id == society_id).with_for_update())
    if not society:
        raise HTTPException(404, "Society not found.")
    row = db.scalar(select(PlatformSubscription).where(PlatformSubscription.society_id == society_id))
    if not row:
        row = PlatformSubscription(society_id=society_id)
        db.add(row)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    db.flush()
    audit(db, SimpleNamespace(society_id=society_id, user_id=operator.id), "subscription.updated", row.id, plan=data.plan, status=data.status)
    return public(row)


@router.get("/admin/subscription")
def own_subscription(db: Db, admin: AdminRole):
    row = db.scalar(select(PlatformSubscription).where(PlatformSubscription.society_id == admin.society_id))
    return public(row) if row else {"plan": "Pilot", "status": "Trial", "amount": 0, "renews_at": None}


@router.get("/admin/export.zip")
def export_society(db: Db, admin: ManagementRole):
    """Scoped archive excluding authentication credentials and visitor/parcel secrets."""
    if admin.role != "Admin":
        raise HTTPException(403, "Only a society administrator can export the full society archive.")
    hidden = {"pin", "otp", "qr_token", "token", "join_code"}
    data = {}
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if hasattr(model, "society_id"):
            rows = db.scalars(select(model).where(model.society_id == admin.society_id)).all()
            data[model.__tablename__] = [public(r, exclude=hidden) for r in rows]
    # Parcel notification bodies contain the code even when the parcel column is excluded.
    for notification in data.get("notifications", []):
        if notification["category"] == "Parcels":
            notification["body"] = "Parcel notification; pickup code omitted from export."
    data["society"] = public(db.get(Society, admin.society_id), exclude=hidden)
    user_ids = {r["user_id"] for key in ("memberships", "staff_roles") for r in data.get(key, [])}
    data["users"] = [{"id":u.id,"name":u.name,"phone":u.phone,"email":u.email}
                     for u in db.scalars(select(User).where(User.id.in_(user_ids)))]
    for model, column, parents in ((BillItem, BillItem.bill_id, "bills"),
        (ComplaintComment, ComplaintComment.complaint_id, "complaints"), (DomesticHelpVisit, DomesticHelpVisit.help_id, "domestic_help")):
        ids = [r["id"] for r in data.get(parents, [])]
        data[model.__tablename__] = [public(r) for r in db.scalars(select(model).where(column.in_(ids)))]
    output = io.BytesIO()
    total = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for model, key_column in ((Upload, "key"), (Document, "storage_key")):
            for row in db.scalars(select(model).where(model.society_id == admin.society_id)):
                try:
                    content = storage().get(getattr(row, key_column))
                except Exception:
                    raise HTTPException(409, "A stored document is unavailable. Restore missing files before exporting a complete archive.")
                total += len(content)
                if total > 200*1024*1024:
                    raise HTTPException(413, "This archive exceeds 200 MB. Arrange an assisted export.")
                archive.writestr(f"files/{model.__tablename__}/{row.id}", content)
        archive.writestr("society.json", json.dumps(data, default=str))
    audit(db, admin, "society.exported", admin.society_id)
    return Response(output.getvalue(), media_type="application/zip", headers={"Content-Disposition":'attachment; filename="society-export.zip"'})
