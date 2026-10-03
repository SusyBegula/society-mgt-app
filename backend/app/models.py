import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, Index, CheckConstraint, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


def now():
    return datetime.now(timezone.utc)


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class SocietyRecord(Record):
    society_id: Mapped[str] = mapped_column(ForeignKey("societies.id"), index=True)


class UnitRecord(SocietyRecord):
    unit_id: Mapped[str] = mapped_column(ForeignKey("units.id"), index=True)


class User(Record, Base):
    __tablename__ = "users"
    phone: Mapped[str] = mapped_column(String(16), unique=True)
    name: Mapped[str] = mapped_column(String(100), default="Resident")
    email: Mapped[str] = mapped_column(String(254), default="")
    avatar_id: Mapped[str | None] = mapped_column(String(36))
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)


class Society(Record, Base):
    __tablename__ = "societies"
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(Text)


class Building(SocietyRecord, Base):
    __tablename__ = "buildings"
    name: Mapped[str] = mapped_column(String(80))
    __table_args__ = (UniqueConstraint("society_id", "name"),)


class Unit(SocietyRecord, Base):
    __tablename__ = "units"
    building_id: Mapped[str] = mapped_column(ForeignKey("buildings.id"))
    number: Mapped[str] = mapped_column(String(20))
    __table_args__ = (UniqueConstraint("building_id", "number"),)


class ResidentMembership(UnitRecord, Base):
    __tablename__ = "memberships"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True)
    __table_args__ = (UniqueConstraint("user_id", "unit_id"), CheckConstraint("role IN ('Owner', 'Tenant', 'Family Member')"))


class RefreshToken(Record, Base):
    __tablename__ = "refresh_tokens"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    family: Mapped[str] = mapped_column(String(36), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(default=False)


class OtpChallenge(Record, Base):
    __tablename__ = "otp_challenges"
    phone: Mapped[str] = mapped_column(String(16), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
    consumed: Mapped[bool] = mapped_column(default=False)


class RateLimit(Base):
    __tablename__ = "rate_limits"
    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    count: Mapped[int] = mapped_column(default=1)
    resets_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class FamilyMember(UnitRecord, Base):
    __tablename__ = "family_members"
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(16))
    relationship: Mapped[str] = mapped_column(String(40))
    app_access: Mapped[bool] = mapped_column(default=False)
    __table_args__ = (UniqueConstraint("unit_id", "phone"),)


class MaintenanceBill(UnitRecord, Base):
    __tablename__ = "bills"
    period: Mapped[str] = mapped_column(String(80))
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    amount: Mapped[int]
    outstanding: Mapped[int]
    status: Mapped[str] = mapped_column(String(24), default="Pending")
    __table_args__ = (CheckConstraint("amount > 0 AND outstanding >= 0 AND outstanding <= amount"),)


class BillItem(Record, Base):
    __tablename__ = "bill_items"
    bill_id: Mapped[str] = mapped_column(ForeignKey("bills.id"), index=True)
    label: Mapped[str] = mapped_column(String(100))
    amount: Mapped[int]


class Payment(UnitRecord, Base):
    __tablename__ = "payments"
    bill_id: Mapped[str] = mapped_column(ForeignKey("bills.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[int]
    status: Mapped[str] = mapped_column(String(24), default="Created")
    method: Mapped[str] = mapped_column(String(40), default="")
    provider: Mapped[str] = mapped_column(String(20))
    order_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    reference: Mapped[str | None] = mapped_column(String(100), unique=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("amount > 0"),)


class Visitor(UnitRecord, Base):
    __tablename__ = "visitors"
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(16))
    kind: Mapped[str] = mapped_column(String(40))
    gate: Mapped[str] = mapped_column(String(80), default="Main Gate")
    purpose: Mapped[str] = mapped_column(String(200), default="")
    vehicle_number: Mapped[str] = mapped_column(String(20), default="")
    photo_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(24), default="Waiting")
    arrived_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    exit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class VisitorInvitation(UnitRecord, Base):
    __tablename__ = "invitations"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(16))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    vehicle_number: Mapped[str] = mapped_column(String(20), default="")
    notes: Mapped[str] = mapped_column(String(500), default="")
    pin: Mapped[str] = mapped_column(String(6), unique=True)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="Active")
    __table_args__ = (CheckConstraint("end_at > start_at"),)


class Complaint(UnitRecord, Base):
    __tablename__ = "complaints"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    priority: Mapped[str] = mapped_column(String(20), default="Normal")
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(24), default="Open")
    assigned_to: Mapped[str | None] = mapped_column(String(100))
    rating: Mapped[int | None]


class ComplaintComment(Record, Base):
    __tablename__ = "complaint_comments"
    complaint_id: Mapped[str] = mapped_column(ForeignKey("complaints.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20), default="comment")


class Notice(SocietyRecord, Base):
    __tablename__ = "notices"
    title: Mapped[str] = mapped_column(String(150))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    priority: Mapped[str] = mapped_column(String(20), default="Normal")
    attachments: Mapped[list] = mapped_column(JSON, default=list)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Amenity(SocietyRecord, Base):
    __tablename__ = "amenities"
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    icon: Mapped[str] = mapped_column(String(40))
    opens: Mapped[int]
    closes: Mapped[int]
    fee: Mapped[int] = mapped_column(default=0)
    cancel_hours: Mapped[int] = mapped_column(default=2)


class AmenityBooking(UnitRecord, Base):
    __tablename__ = "bookings"
    amenity_id: Mapped[str] = mapped_column(ForeignKey("amenities.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="Confirmed")
    fee: Mapped[int] = mapped_column(default=0)
    __table_args__ = (CheckConstraint("end_at > start_at"), Index("ix_booking_overlap", "amenity_id", "start_at", "end_at"))


class Vehicle(UnitRecord, Base):
    __tablename__ = "vehicles"
    kind: Mapped[str] = mapped_column(String(10))
    registration: Mapped[str] = mapped_column(String(20))
    manufacturer: Mapped[str] = mapped_column(String(50))
    model: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(30))
    parking_slot: Mapped[str] = mapped_column(String(30), default="Unassigned")
    __table_args__ = (UniqueConstraint("society_id", "registration"),)


class DomesticHelp(UnitRecord, Base):
    __tablename__ = "domestic_help"
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(30))
    photo_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(20), default="Outside")


class DomesticHelpVisit(Record, Base):
    __tablename__ = "help_visits"
    help_id: Mapped[str] = mapped_column(ForeignKey("domestic_help.id"), index=True)
    entry_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    exit_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Upload(UnitRecord, Base):
    __tablename__ = "uploads"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(200))
    key: Mapped[str] = mapped_column(String(300), unique=True)
    content_type: Mapped[str] = mapped_column(String(80))
    size: Mapped[int]


class Document(SocietyRecord, Base):
    __tablename__ = "documents"
    title: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(60))
    storage_key: Mapped[str] = mapped_column(String(300))
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(80), default="application/pdf")
    owners_only: Mapped[bool] = mapped_column(default=False)


class DirectoryContact(SocietyRecord, Base):
    __tablename__ = "directory"
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(40))


class Notification(SocietyRecord, Base):
    __tablename__ = "notifications"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(150))
    body: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(30))
    route: Mapped[str] = mapped_column(String(200), default="/")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Device(Record, Base):
    __tablename__ = "devices"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True)
    platform: Mapped[str] = mapped_column(String(10))


class EmergencyAlert(UnitRecord, Base):
    __tablename__ = "emergency_alerts"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(30))


class StaffRole(SocietyRecord, Base):
    __tablename__ = "staff_roles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(80), default="")
    active: Mapped[bool] = mapped_column(default=True)
    __table_args__ = (UniqueConstraint("user_id", "society_id", "role"), CheckConstraint("role IN ('Admin', 'Secretary', 'Treasurer', 'Guard')"))


class Parcel(UnitRecord, Base):
    __tablename__ = "parcels"
    courier: Mapped[str] = mapped_column(String(80))
    recipient_name: Mapped[str] = mapped_column(String(120), default="")
    tracking_code: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[str] = mapped_column(String(20), default="Arrived")
    otp: Mapped[str] = mapped_column(String(6))
    photo_id: Mapped[str | None] = mapped_column(String(36), default=None)
    logged_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    collected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    __table_args__ = (CheckConstraint("status IN ('Arrived', 'Collected')"),)

