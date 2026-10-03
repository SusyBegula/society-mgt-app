from sqlalchemy import select
from app.models import Notification, Device, User
from app.models import ResidentMembership, StaffRole


def notify(db, member, title, body, category, route):
    context_id = member.id if isinstance(member, (ResidentMembership, StaffRole)) else None
    row = Notification(society_id=member.society_id, context_id=context_id, user_id=member.user_id, title=title[:150], body=body[:500], category=category, route=route)
    db.add(row)
    return row


def notify_staff(db, society_id, title, body, category, route, roles=("Admin", "Secretary", "Guard")):
    seen = set()
    for staff in db.scalars(select(StaffRole).where(StaffRole.society_id == society_id,
                           StaffRole.active.is_(True), StaffRole.role.in_(roles))):
        if staff.user_id not in seen:
            notify(db, staff, title, body, category, route)
            seen.add(staff.user_id)


def notify_household(db, society_id, unit_id, title, body, category, route, visitors_only=False):
    query = select(ResidentMembership).where(ResidentMembership.society_id == society_id,
        ResidentMembership.unit_id == unit_id, ResidentMembership.active.is_(True))
    if visitors_only:
        query = query.where(ResidentMembership.receives_visitors.is_(True))
    for member in db.scalars(query):
        notify(db, member, title, body, category, route)
