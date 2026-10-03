import secrets
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from app.models import (
    Notice, Complaint, ComplaintComment, ResidentMembership,
    User, Unit, Building, Visitor, Parcel, MaintenanceBill,
    BillItem, Payment, now
)
from app.security import Db, AdminRole
from app.schemas import (
    AdminNoticeInput, AdminComplaintUpdate, MemberStatusUpdate,
    BulkBillInput, ReminderInput, OfflinePaymentInput
)
from app.serialization import public, page
from app.notifications import notify

router = APIRouter(prefix="/admin", tags=["Society Administration"])


@router.get("/stats")
def society_stats(db: Db, admin: AdminRole):
    open_complaints = db.scalar(
        select(func.count(Complaint.id)).where(
            Complaint.society_id == admin.society_id,
            Complaint.status.in_(["Open", "In Progress"])
        )
    ) or 0

    active_visitors = db.scalar(
        select(func.count(Visitor.id)).where(
            Visitor.society_id == admin.society_id,
            Visitor.status == "Inside"
        )
    ) or 0

    active_parcels = db.scalar(
        select(func.count(Parcel.id)).where(
            Parcel.society_id == admin.society_id,
            Parcel.status == "Arrived"
        )
    ) or 0

    total_units = db.scalar(
        select(func.count(Unit.id)).where(Unit.society_id == admin.society_id)
    ) or 0

    total_members = db.scalar(
        select(func.count(ResidentMembership.id)).where(
            ResidentMembership.society_id == admin.society_id,
            ResidentMembership.active.is_(True)
        )
    ) or 0

    return {
        "open_complaints": open_complaints,
        "active_visitors": active_visitors,
        "active_parcels": active_parcels,
        "total_units": total_units,
        "total_members": total_members
    }


@router.post("/notices", status_code=201)
def publish_notice(data: AdminNoticeInput, db: Db, admin: AdminRole):
    notice = Notice(
        society_id=admin.society_id,
        title=data.title,
        category=data.category,
        content=data.content,
        priority=data.priority,
        attachments=data.attachments,
        published_at=now()
    )
    db.add(notice)
    db.flush()


    # Broadcast notification to all active residents in this society
    members = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.society_id == admin.society_id,
            ResidentMembership.active.is_(True)
        )
    ).all()

    for m in members:
        notify(db, m, f"New Notice: {data.title}", data.content[:150], "Notices", f"/notice/{notice.id}")

    return public(notice)


@router.delete("/notices/{notice_id}", status_code=204)
def delete_notice(notice_id: str, db: Db, admin: AdminRole):
    notice = db.scalar(
        select(Notice).where(Notice.id == notice_id, Notice.society_id == admin.society_id)
    )
    if not notice:
        raise HTTPException(404, "Notice not found.")
    db.delete(notice)


@router.get("/complaints")
def list_complaints(
    db: Db,
    admin: AdminRole,
    status: str | None = None,
    category: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=100)
):
    query = (
        select(Complaint, Unit, Building, User)
        .join(Unit, Unit.id == Complaint.unit_id)
        .join(Building, Building.id == Unit.building_id)
        .join(User, User.id == Complaint.user_id)
        .where(Complaint.society_id == admin.society_id)
    )
    if status:
        query = query.where(Complaint.status == status)
    if category:
        query = query.where(Complaint.category == category)

    query = query.order_by(Complaint.created_at.desc())

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = db.execute(query.offset(offset).limit(limit)).all()

    items = [
        {
            "id": c.id,
            "title": c.title,
            "description": c.description,
            "category": c.category,
            "priority": c.priority,
            "status": c.status,
            "assigned_to": c.assigned_to,
            "tower": b.name,
            "flat": u.number,
            "resident_name": usr.name,
            "resident_phone": usr.phone,
            "created_at": c.created_at
        }
        for c, u, b, usr in records
    ]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.patch("/complaints/{complaint_id}")
def update_complaint(complaint_id: str, data: AdminComplaintUpdate, db: Db, admin: AdminRole):
    complaint = db.scalar(
        select(Complaint).where(
            Complaint.id == complaint_id,
            Complaint.society_id == admin.society_id
        ).with_for_update()
    )
    if not complaint:
        raise HTTPException(404, "Complaint not found.")

    old_status = complaint.status
    if data.status:
        complaint.status = data.status
    if data.priority:
        complaint.priority = data.priority
    if data.assigned_to is not None:
        complaint.assigned_to = data.assigned_to

    # Log timeline comments
    if data.comment:
        db.add(ComplaintComment(complaint_id=complaint.id, text=data.comment, kind="comment"))
    elif data.status and data.status != old_status:
        db.add(ComplaintComment(complaint_id=complaint.id, text=f"Status updated to {data.status} by Admin", kind="status"))

    db.flush()

    # Notify the resident who filed the complaint
    resident_mem = db.scalar(
        select(ResidentMembership).where(
            ResidentMembership.society_id == admin.society_id,
            ResidentMembership.unit_id == complaint.unit_id,
            ResidentMembership.user_id == complaint.user_id
        )
    )
    if resident_mem:
        notify(
            db, resident_mem,
            f"Complaint Update: {complaint.title}",
            f"Status is now '{complaint.status}'. {data.comment or ''}",
            "Complaints",
            f"/complaint/{complaint.id}"
        )

    return public(complaint)


@router.get("/members")
def list_members(
    db: Db,
    admin: AdminRole,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    query = (
        select(ResidentMembership, User, Unit, Building)
        .join(User, User.id == ResidentMembership.user_id)
        .join(Unit, Unit.id == ResidentMembership.unit_id)
        .join(Building, Building.id == Unit.building_id)
        .where(ResidentMembership.society_id == admin.society_id)
        .order_by(Building.name, Unit.number, ResidentMembership.role)
    )

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    records = db.execute(query.offset(offset).limit(limit)).all()

    items = [
        {
            "id": m.id,
            "user_id": u.id,
            "name": u.name,
            "phone": u.phone,
            "role": m.role,
            "tower": b.name,
            "flat": un.number,
            "active": m.active,
            "created_at": m.created_at
        }
        for m, u, un, b in records
    ]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.patch("/members/{member_id}/status")
def toggle_member_status(member_id: str, data: MemberStatusUpdate, db: Db, admin: AdminRole):
    member = db.scalar(
        select(ResidentMembership).where(
            ResidentMembership.id == member_id,
            ResidentMembership.society_id == admin.society_id
        ).with_for_update()
    )
    if not member:
        raise HTTPException(404, "Member record not found.")

    member.active = data.active
    db.flush()
    return {"id": member.id, "active": member.active}


@router.get("/finance/summary")
def finance_summary(db: Db, admin: AdminRole):
    total_billed = db.scalar(
        select(func.coalesce(func.sum(MaintenanceBill.amount), 0)).where(
            MaintenanceBill.society_id == admin.society_id
        )
    ) or 0

    total_collected = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.society_id == admin.society_id,
            Payment.status == "Paid"
        )
    ) or 0

    total_outstanding = db.scalar(
        select(func.coalesce(func.sum(MaintenanceBill.outstanding), 0)).where(
            MaintenanceBill.society_id == admin.society_id
        )
    ) or 0

    defaulters_count = db.scalar(
        select(func.count(func.distinct(MaintenanceBill.unit_id))).where(
            MaintenanceBill.society_id == admin.society_id,
            MaintenanceBill.outstanding > 0,
            MaintenanceBill.due_date < now()
        )
    ) or 0

    return {
        "total_billed": total_billed,
        "total_collected": total_collected,
        "total_outstanding": total_outstanding,
        "defaulters_count": defaulters_count
    }


@router.get("/finance/defaulters")
def list_defaulters(db: Db, admin: AdminRole):
    query = (
        select(MaintenanceBill, Unit, Building)
        .join(Unit, Unit.id == MaintenanceBill.unit_id)
        .join(Building, Building.id == Unit.building_id)
        .where(
            MaintenanceBill.society_id == admin.society_id,
            MaintenanceBill.outstanding > 0
        )
        .order_by(Building.name, Unit.number, MaintenanceBill.due_date.asc())
    )
    records = db.execute(query).all()

    units_map = {}
    for bill, unit, building in records:
        if unit.id not in units_map:
            membership = db.scalar(
                select(ResidentMembership)
                .where(ResidentMembership.unit_id == unit.id, ResidentMembership.active.is_(True))
                .order_by(ResidentMembership.role.desc())
            )
            res_user = db.get(User, membership.user_id) if membership else None
            units_map[unit.id] = {
                "unit_id": unit.id,
                "tower": building.name,
                "flat": unit.number,
                "resident_name": res_user.name if res_user else "Resident",
                "resident_phone": res_user.phone if res_user else "",
                "total_outstanding": 0,
                "oldest_due_date": bill.due_date,
                "bills_count": 0,
                "bills": []
            }
        u = units_map[unit.id]
        u["total_outstanding"] += bill.outstanding
        u["bills_count"] += 1
        if bill.due_date < u["oldest_due_date"]:
            u["oldest_due_date"] = bill.due_date
        u["bills"].append({
            "id": bill.id,
            "period": bill.period,
            "amount": bill.amount,
            "outstanding": bill.outstanding,
            "due_date": bill.due_date,
            "is_overdue": bill.due_date < now()
        })

    return list(units_map.values())


@router.post("/finance/reminder")
def send_reminder(data: ReminderInput, db: Db, admin: AdminRole):
    unit = db.get(Unit, data.unit_id)
    if not unit or unit.society_id != admin.society_id:
        raise HTTPException(404, "Unit not found.")

    building = db.get(Building, unit.building_id)
    flat_label = f"{building.name} - {unit.number}" if building else unit.number

    total_due = db.scalar(
        select(func.coalesce(func.sum(MaintenanceBill.outstanding), 0)).where(
            MaintenanceBill.unit_id == unit.id,
            MaintenanceBill.outstanding > 0
        )
    ) or 0

    if total_due <= 0:
        raise HTTPException(400, "This unit has no pending dues.")

    members = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == unit.id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    for m in members:
        notify(
            db, m,
            "Maintenance Dues Reminder",
            f"You have pending maintenance dues of INR {total_due / 100:,.0f} for {flat_label}. Please clear your dues on the app.",
            "Payments",
            "/payments"
        )

    return {"sent": True, "recipients": len(members), "total_due": total_due}


@router.post("/finance/bills/bulk", status_code=201)
def generate_bulk_bills(data: BulkBillInput, db: Db, admin: AdminRole):
    units = db.scalars(
        select(Unit).where(Unit.society_id == admin.society_id)
    ).all()
    if not units:
        raise HTTPException(400, "No units registered in this society.")

    total_amount = sum(item.amount for item in data.items)
    generated_count = 0

    for unit in units:
        existing = db.scalar(
            select(MaintenanceBill).where(
                MaintenanceBill.unit_id == unit.id,
                MaintenanceBill.period == data.period
            )
        )
        if existing:
            continue

        bill = MaintenanceBill(
            society_id=admin.society_id,
            unit_id=unit.id,
            period=data.period,
            due_date=data.due_date,
            amount=total_amount,
            outstanding=total_amount,
            status="Pending"
        )
        db.add(bill)
        db.flush()

        for it in data.items:
            db.add(BillItem(bill_id=bill.id, label=it.label, amount=it.amount))

        generated_count += 1

        members = db.scalars(
            select(ResidentMembership).where(
                ResidentMembership.unit_id == unit.id,
                ResidentMembership.active.is_(True)
            )
        ).all()
        for m in members:
            notify(
                db, m,
                f"New Maintenance Bill: {data.period}",
                f"Maintenance bill of INR {total_amount / 100:,.0f} has been published. Due by {data.due_date.strftime('%d %b %Y')}.",
                "Payments",
                f"/bills/{bill.id}"
            )

    return {
        "generated_count": generated_count,
        "period": data.period,
        "total_amount": total_amount
    }


@router.post("/finance/payments/record-offline", status_code=201)
def record_offline_payment(data: OfflinePaymentInput, db: Db, admin: AdminRole):
    bill = db.scalar(
        select(MaintenanceBill).where(
            MaintenanceBill.id == data.bill_id,
            MaintenanceBill.society_id == admin.society_id
        ).with_for_update()
    )
    if not bill:
        raise HTTPException(404, "Bill not found.")
    if bill.outstanding <= 0:
        raise HTTPException(400, "This bill is already fully settled.")
    if data.amount > bill.outstanding:
        raise HTTPException(400, f"Payment amount cannot exceed outstanding balance of INR {bill.outstanding / 100:,.0f}.")

    ref = data.reference.strip() or f"OFFLINE-{secrets.token_hex(6).upper()}"
    payment = Payment(
        society_id=admin.society_id,
        unit_id=bill.unit_id,
        user_id=admin.user_id,
        bill_id=bill.id,
        amount=data.amount,
        status="Paid",
        method=data.method,
        provider="offline",
        reference=ref,
        paid_at=now()
    )
    db.add(payment)
    bill.outstanding -= data.amount
    if bill.outstanding == 0:
        bill.status = "Paid"
    elif bill.status != "Partially Paid":
        bill.status = "Partially Paid"
    db.flush()

    members = db.scalars(
        select(ResidentMembership).where(
            ResidentMembership.unit_id == bill.unit_id,
            ResidentMembership.active.is_(True)
        )
    ).all()
    for m in members:
        notify(
            db, m,
            f"Payment Recorded: INR {data.amount / 100:,.0f}",
            f"Offline payment via {data.method} ({ref}) recorded for {bill.period}. Remaining dues: INR {bill.outstanding / 100:,.0f}.",
            "Payments",
            f"/bills/{bill.id}"
        )

    return public(payment)

