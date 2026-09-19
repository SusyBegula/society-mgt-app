import httpx
from sqlalchemy import select
from app.models import Notification, Device, User
from app.db import SessionLocal


def notify(db, member, title, body, category, route):
    row = Notification(society_id=member.society_id, user_id=member.user_id, title=title, body=body, category=category, route=route)
    db.add(row)
    return row


def send_push(user_id: str, title: str, body: str, category: str, route: str):
    """Optional adapter. Invoke after a committed event; in-app records remain canonical."""
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user or not user.preferences.get(category.lower(), True):
            return
        devices = db.scalars(select(Device).where(Device.user_id == user_id)).all()
        for device in devices:
            try:
                response = httpx.post("https://exp.host/--/api/v2/push/send", json={"to": device.token, "title": title, "body": body, "data": {"route": route}}, timeout=10)
                result = response.json().get("data", {})
                if isinstance(result, dict) and result.get("details", {}).get("error") == "DeviceNotRegistered":
                    db.delete(device)
            except (httpx.HTTPError, ValueError):
                continue
        db.commit()
