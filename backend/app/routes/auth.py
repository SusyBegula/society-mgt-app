import secrets
from datetime import timedelta
import httpx
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select, update
from app.config import settings
from app.models import User, OtpChallenge, RefreshToken, now
from app.security import Db, CurrentUser, digest, issue_tokens, limit
from app.schemas import PhoneInput, OtpInput, RefreshInput

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/otp/request", status_code=201)
def request_otp(data: PhoneInput, request: Request, db: Db):
    limit(db, "otp-ip:" + digest(request.client.host if request.client else "unknown"), 20)
    limit(db, "otp:" + digest(data.phone), 4)
    cfg = settings()
    is_demo = cfg.app_env in ("development", "staging") or cfg.allow_demo_auth
    code = cfg.dev_otp if is_demo else f"{secrets.randbelow(1000000):06d}"
    if not is_demo:
        try:
            response = httpx.post(cfg.sms_url, json={"phone": data.phone, "message": f"Your Society verification code is {code}. Valid for 5 minutes."},
                                  headers={"Authorization": f"Bearer {cfg.sms_token}"}, timeout=10)
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(503, "We could not send a code. Please try again shortly.")
    db.execute(update(OtpChallenge).where(OtpChallenge.phone == data.phone).values(consumed=True))
    challenge = OtpChallenge(phone=data.phone, code_hash=digest(data.phone + code), expires_at=now() + timedelta(minutes=5))
    db.add(challenge)
    db.flush()
    return {"challenge_id": challenge.id, "expires_in": 300, "development": is_demo}


@router.post("/otp/verify")
def verify_otp(data: OtpInput, db: Db):
    row = db.scalar(select(OtpChallenge).where(OtpChallenge.id == data.challenge_id, OtpChallenge.phone == data.phone).with_for_update())
    if not row or row.consumed or row.expires_at < now() or row.attempts >= 5:
        raise HTTPException(400, "This code has expired. Request a new one.")
    row.attempts += 1
    if not secrets.compare_digest(row.code_hash, digest(data.phone + data.code)):
        db.commit()
        raise HTTPException(400, "That code is incorrect. Please try again.")
    row.consumed = True
    user = db.scalar(select(User).where(User.phone == data.phone))
    if not user:
        user = User(phone=data.phone)
        db.add(user)
        db.flush()
    return issue_tokens(db, user)


@router.post("/refresh")
def refresh(data: RefreshInput, db: Db):
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest(data.refresh_token)).with_for_update())
    if not row or row.expires_at < now():
        raise HTTPException(401, "Please sign in again.")
    if row.revoked:
        db.execute(update(RefreshToken).where(RefreshToken.family == row.family).values(revoked=True))
        db.commit()
        raise HTTPException(401, "Please sign in again.")
    row.revoked = True
    return issue_tokens(db, db.get(User, row.user_id), row.family)


@router.post("/logout", status_code=204)
def logout(data: RefreshInput, db: Db, user: CurrentUser):
    row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == digest(data.refresh_token), RefreshToken.user_id == user.id))
    if row:
        db.execute(update(RefreshToken).where(RefreshToken.family == row.family).values(revoked=True))
