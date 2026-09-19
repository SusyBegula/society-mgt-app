import hashlib
import hmac
import secrets
import uuid
from datetime import timedelta
from typing import Annotated
import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.models import User, ResidentMembership, RefreshToken, RateLimit, now

Db = Annotated[Session, Depends(get_db)]
bearer = HTTPBearer(auto_error=False)


def digest(value: str):
    return hmac.new(settings().jwt_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def issue_tokens(db: Session, user: User, family: str | None = None):
    cfg = settings()
    token = secrets.token_urlsafe(48)
    db.add(RefreshToken(user_id=user.id, token_hash=digest(token), family=family or str(uuid.uuid4()),
                        expires_at=now() + timedelta(days=cfg.refresh_token_days)))
    access = jwt.encode({"sub": user.id, "exp": now() + timedelta(minutes=cfg.access_token_minutes),
                         "iat": now(), "iss": "society-api", "aud": "society-resident", "type": "access"}, cfg.jwt_secret, algorithm="HS256")
    return {"access_token": access, "refresh_token": token, "token_type": "bearer"}


def current_user(db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    try:
        if not credentials:
            raise ValueError()
        claims = jwt.decode(credentials.credentials, settings().jwt_secret, algorithms=["HS256"],
                            issuer="society-api", audience="society-resident", options={"require": ["exp", "sub", "iat"]})
        user = db.get(User, claims["sub"])
        if not user or claims.get("type") != "access":
            raise ValueError()
        return user
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Your session has expired. Please sign in again.")


CurrentUser = Annotated[User, Depends(current_user)]


def membership(db: Db, user: CurrentUser, x_property_id: Annotated[str, Header()]):
    member = db.scalar(select(ResidentMembership).where(ResidentMembership.id == x_property_id,
                       ResidentMembership.user_id == user.id, ResidentMembership.active.is_(True)))
    if not member:
        raise HTTPException(403, "You do not have access to this property.")
    return member


Property = Annotated[ResidentMembership, Depends(membership)]


def scoped(model, member):
    query = select(model).where(model.society_id == member.society_id)
    if hasattr(model, "unit_id"):
        query = query.where(model.unit_id == member.unit_id)
    return query


def owned(db, model, record_id, member, lock=False):
    query = scoped(model, member).where(model.id == record_id)
    record = db.scalar(query.with_for_update() if lock else query)
    if not record:
        raise HTTPException(404, "This item is unavailable.")
    return record


def manage_household(member):
    if member.role not in ("Owner", "Tenant"):
        raise HTTPException(403, "Only an owner or tenant can manage the household.")


def limit(db, key, count=5, seconds=300):
    # Database-backed counters also work across multiple API workers.
    timestamp = now()
    db.execute(insert(RateLimit).values(key=key, count=0, resets_at=timestamp + timedelta(seconds=seconds)).on_conflict_do_nothing())
    row = db.scalar(select(RateLimit).where(RateLimit.key == key).with_for_update())
    if row.resets_at <= timestamp:
        row.count, row.resets_at = 0, timestamp + timedelta(seconds=seconds)
    row.count += 1
    exceeded = row.count > count
    db.commit()
    if exceeded:
        raise HTTPException(429, "Too many attempts. Please try again in a few minutes.", headers={"Retry-After": str(seconds)})
