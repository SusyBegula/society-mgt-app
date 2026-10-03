from datetime import datetime
from typing import Literal, Annotated
from pydantic import BaseModel, Field, StringConstraints, AwareDatetime, model_validator, field_validator

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Phone = Annotated[str, StringConstraints(pattern=r"^\+91[6-9][0-9]{9}$")]


class Input(BaseModel):
    model_config = {"extra": "forbid"}


class PhoneInput(Input):
    phone: Phone


class OtpInput(PhoneInput):
    challenge_id: str
    code: Annotated[str, StringConstraints(pattern=r"^\d{6}$")]


class RefreshInput(Input):
    refresh_token: str = Field(min_length=20, max_length=200)


class ProfileInput(Input):
    name: Name
    email: str = Field(default="", max_length=254)
    avatar_id: str | None = None

    @field_validator("email")
    @classmethod
    def email_valid(cls, value):
        if value and ("@" not in value or "." not in value.split("@")[-1]):
            raise ValueError("Enter a valid email address")
        return value


class PreferencesInput(Input):
    visitors: bool = True
    payments: bool = True
    complaints: bool = True
    notices: bool = True
    amenities: bool = True
    emergency: bool = True
    language: Literal["en"] = "en"


class InvitationInput(Input):
    name: Name
    phone: Phone
    start_at: AwareDatetime
    end_at: AwareDatetime
    vehicle_number: str = Field(default="", max_length=20)
    notes: str = Field(default="", max_length=500)

    @model_validator(mode="after")
    def dates(self):
        if self.end_at <= self.start_at or (self.end_at - self.start_at).total_seconds() > 86400:
            raise ValueError("Visit must end after it starts and last at most 24 hours")
        return self


class VisitorDecision(Input):
    status: Literal["Allowed", "Denied"]


class ComplaintInput(Input):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=10, max_length=5000)
    category: Literal["Plumbing", "Electrical", "Lift", "Security", "Housekeeping", "Parking", "Common Area", "Other"]
    priority: Literal["Low", "Normal", "High", "Urgent"] = "Normal"
    attachments: list[str] = Field(default_factory=list, max_length=5)


class CommentInput(Input):
    text: str = Field(min_length=1, max_length=2000)


class ResolutionInput(Input):
    action: Literal["confirm", "reopen"]
    rating: int | None = Field(default=None, ge=1, le=5)


class BookingInput(Input):
    amenity_id: str
    start_at: AwareDatetime


class VehicleInput(Input):
    kind: Literal["Car", "Bike"]
    registration: str = Field(min_length=6, max_length=20, pattern=r"^[A-Z0-9 -]+$")
    manufacturer: Name
    model: Name
    color: Name


class FamilyInput(Input):
    name: Name
    phone: Phone
    relationship: Literal["Spouse", "Child", "Parent", "Sibling", "Other"]
    app_access: bool = False


class DeviceInput(Input):
    token: str = Field(pattern=r"^(ExponentPushToken|ExpoPushToken)\[[a-zA-Z0-9_-]+\]$", max_length=255)
    platform: Literal["android", "ios"]


class EmergencyInput(Input):
    kind: Literal["Medical", "Security", "Fire", "Other"]
    confirmed: Literal[True]


class OrderInput(Input):
    bill_id: str


class PaymentVerification(Input):
    payment_id: str
    razorpay_payment_id: str = Field(max_length=100)
    razorpay_signature: str = Field(max_length=128)


class VerifyPassInput(Input):
    token: str | None = None
    pin: str | None = None


class CheckInInput(Input):
    invitation_id: str


class WalkInVisitorInput(Input):
    unit_id: str
    name: Name
    phone: Phone
    kind: Literal["Guest", "Delivery", "Cab", "Service"] = "Guest"
    purpose: str = Field(min_length=1, max_length=120)


class ParcelInput(Input):
    unit_id: str
    courier: str = Field(min_length=1, max_length=80)
    recipient_name: str = Field(default="", max_length=120)
    tracking_code: str = Field(default="", max_length=120)


class ParcelCollectInput(Input):
    otp: str = Field(min_length=4, max_length=6)


class AdminNoticeInput(Input):
    title: str = Field(min_length=3, max_length=150)
    category: Literal["General", "Maintenance", "Rules", "Events", "Urgent"] = "General"
    content: str = Field(min_length=10, max_length=2000)
    priority: Literal["Normal", "Urgent"] = "Normal"
    attachments: list[str] = []



class AdminComplaintUpdate(Input):
    status: Literal["Open", "In Progress", "Resolved", "Closed"] | None = None
    priority: Literal["Low", "Normal", "High", "Urgent"] | None = None
    assigned_to: str | None = None
    comment: str | None = None


class MemberStatusUpdate(Input):
    active: bool


class BulkBillItem(Input):
    label: str = Field(min_length=1, max_length=100)
    amount: int = Field(gt=0)


class BulkBillInput(Input):
    period: str = Field(min_length=3, max_length=80)
    due_date: datetime
    items: list[BulkBillItem] = Field(min_length=1)


class ReminderInput(Input):
    unit_id: str


class OfflinePaymentInput(Input):
    bill_id: str
    amount: int = Field(gt=0)
    method: Literal["Bank Transfer", "Cheque", "UPI", "Cash"] = "Bank Transfer"
    reference: str = Field(default="", max_length=100)

