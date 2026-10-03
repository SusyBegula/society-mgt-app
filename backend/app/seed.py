"""Idempotent demonstration data. Run after migrations."""
import io
import os
import sys
import uuid
from datetime import timedelta
from sqlalchemy import select, delete
from reportlab.pdfgen import canvas
from app.config import settings
from app.db import SessionLocal
from app.models import *
from app.storage import storage


def seed(force: bool = False):
    cfg = settings()
    allow_seed = (
        force
        or cfg.app_env in ("development", "staging")
        or os.getenv("ALLOW_DEMO_SEED", "").lower() in ("true", "1")
    )
    if not allow_seed:
        raise RuntimeError("Demo seeding is only allowed in development/staging or with ALLOW_DEMO_SEED=true or --force")
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.phone == "+919876543210")):
            if not force:
                print("Demo data already exists")
                return
            # Wipe existing demo data for clean re-seed
            for model in [
                Parcel, StaffRole, EmergencyAlert, Device, Notification,
                DirectoryContact, Document, Upload, DomesticHelpVisit,
                DomesticHelp, Vehicle, AmenityBooking, Amenity, Notice,
                ComplaintComment, Complaint, Visitor, VisitorInvitation,
                Payment, BillItem, MaintenanceBill, FamilyMember,
                ResidentMembership, RefreshToken, OtpChallenge, Unit,
                Building, Society, User
            ]:
                db.execute(delete(model))
            db.flush()

        def add(entity, **values):
            row = entity(**values)
            db.add(row)
            db.flush()
            return row

        resident = add(User, phone="+919876543210", name="Arjun Sharma", email="arjun@example.com")
        guard_user = add(User, phone="+919876543211", name="Ramesh Singh", email="guard@greenheights.local")

        green_heights = None
        unit_1204 = None

        for index, name in enumerate(["Green Heights", "Sunrise Residency"]):
            society = add(Society, name=name, address="Baner Road, Pune, Maharashtra" if index == 0 else "Whitefield, Bengaluru, Karnataka")
            if index == 0:
                green_heights = society
            building = add(Building, society_id=society.id, name="Tower A" if index == 0 else "Tower C")
            unit = add(Unit, society_id=society.id, building_id=building.id, number="1204" if index == 0 else "305")
            if index == 0:
                unit_1204 = unit

            scope = {"society_id": society.id, "unit_id": unit.id}
            add(ResidentMembership, **scope, user_id=resident.id, role="Owner" if index == 0 else "Tenant")

            due_date = (now() + timedelta(days=21)).replace(hour=18, minute=29, second=0, microsecond=0)
            current = add(MaintenanceBill, **scope, period=due_date.strftime("%B %Y"), due_date=due_date, amount=450000, outstanding=450000)
            for label, amount in [("Maintenance", 350000), ("Water", 50000), ("Parking", 50000)]:
                add(BillItem, bill_id=current.id, label=label, amount=amount)
            for month in (1, 2, 3):
                past = now() - timedelta(days=month * 31)
                bill = add(MaintenanceBill, **scope, period=past.strftime("%B %Y"), due_date=past, amount=450000, outstanding=0, status="Paid")
                add(BillItem, bill_id=bill.id, label="Monthly maintenance, water and parking", amount=450000)
                add(Payment, **scope, bill_id=bill.id, user_id=resident.id, amount=450000, status="Paid", method="Development / UPI", provider="development", order_id=f"dev_seed_{index}_{month}", reference=f"DEV2026{index}{month}827419", paid_at=past, created_at=past)

            add(Visitor, **scope, name="Rahul Verma", phone="+919812345678", kind="Guest", purpose="Visiting your home", status="Waiting")
            add(Visitor, **scope, name="Amit Kumar", phone="+919823456789", kind="Delivery", purpose="Amazon delivery", status="Exited", arrived_at=now()-timedelta(hours=3), entry_at=now()-timedelta(hours=3), exit_at=now()-timedelta(hours=2, minutes=50))
            add(VisitorInvitation, **scope, user_id=resident.id, name="Priya Mehta", phone="+919834567890", start_at=now()+timedelta(days=1), end_at=now()+timedelta(days=1, hours=3), pin=f"82471{index}", qr_token=f"development-invitation-{index}-not-a-production-token", notes="Dinner with family")

            complaint = add(Complaint, **scope, user_id=resident.id, title="Leaking tap in the kitchen", description="The kitchen tap has been dripping since yesterday. Please arrange a plumber to inspect it.", category="Plumbing", priority="Normal", status="In Progress", assigned_to="Maintenance team", created_at=now()-timedelta(days=2))
            for days, text in [(2, "Complaint opened"), (1, "Assigned to the maintenance team"), (0, "Plumber scheduled to visit today")]:
                add(ComplaintComment, complaint_id=complaint.id, text=text, kind="status", created_at=now()-timedelta(days=days))
            resolved = add(Complaint, **scope, user_id=resident.id, title="Corridor light replacement", description="The light outside the lift on our floor was not working.", category="Electrical", status="Resolved", assigned_to="Electrical team")
            add(ComplaintComment, complaint_id=resolved.id, text="Light replaced. Please confirm the resolution.", kind="status")

            for title, category, content in [
                ("A little care for our shared spaces", "General", "Let's keep our community welcoming. Please keep corridors clear, segregate household waste, and use the designated areas for deliveries. Thank you for doing your part."),
                ("Water tank cleaning this Sunday", "Maintenance", "Water supply will be paused between 10:00 AM and 12:00 PM on Sunday for routine tank cleaning. Please store enough water in advance. Contact the society office if you need assistance."),
                ("Let's meet this weekend", "Events", "Join the residents' meeting at the clubhouse on Saturday at 5:00 PM. We will discuss community events and common-area improvements. All residents are welcome.")]:
                add(Notice, society_id=society.id, title=title, category=category, content=content)

            for amenity_name, icon, desc, opens, closes in [("Badminton Court", "fitness-outline", "A little friendly competition. Indoor court with lighting and changing rooms.", 6, 22), ("Swimming Pool", "water-outline", "Make time for a refreshing swim. Please follow pool safety rules.", 6, 20), ("Clubhouse", "cafe-outline", "A space to catch up, celebrate, and spend time together.", 9, 22), ("Gym", "barbell-outline", "Your daily dose of movement. Bring a towel and indoor shoes.", 5, 23)]:
                amenity = add(Amenity, society_id=society.id, name=amenity_name, description=desc, icon=icon, opens=opens, closes=closes, fee=0)
                if amenity_name == "Badminton Court":
                    start = (now()+timedelta(days=2)).replace(hour=12, minute=30, second=0, microsecond=0)
                    add(AmenityBooking, **scope, user_id=resident.id, amenity_id=amenity.id, start_at=start, end_at=start+timedelta(hours=1))

            add(Vehicle, **scope, kind="Car", registration=f"MH12AB120{index}", manufacturer="Hyundai", model="Creta", color="White", parking_slot="B1 · P-24")
            help = add(DomesticHelp, **scope, name="Sunita Devi", kind="Maid", status="Outside")
            for day in range(4):
                entered = now()-timedelta(days=day, hours=4)
                add(DomesticHelpVisit, help_id=help.id, entry_at=entered, exit_at=entered+timedelta(hours=1))

            add(FamilyMember, **scope, name="Ananya Sharma", phone=f"+91987654321{index+2}", relationship="Spouse", app_access=False)
            for contact, phone, category in [("Society Office", "+912027001001", "Office"), ("Main Gate Security", "+912027001002", "Security"), ("Society Manager", "+919876540003", "Manager"), ("Electrician", "+919876540004", "Electrician"), ("Plumber", "+919876540005", "Plumber"), ("Emergency Response", "112", "Emergency"), ("Ambulance", "108", "Medical")]:
                add(DirectoryContact, society_id=society.id, name=contact, phone=phone, category=category)

            for title, category in [("Community living guidelines", "Society Rules"), ("Residents meeting minutes", "Meeting Minutes"), ("Move-in request form", "Forms")]:
                output = io.BytesIO()
                pdf = canvas.Canvas(output)
                pdf.setFont("Helvetica-Bold", 20)
                pdf.drawString(48, 780, name)
                pdf.setFont("Helvetica-Bold", 15)
                pdf.drawString(48, 740, title)
                pdf.setFont("Helvetica", 11)
                for i, line in enumerate(["Demonstration document for local development.", "Contact the society office for official documents.", "Office hours: Monday to Saturday, 9 AM to 6 PM."]):
                    pdf.drawString(48, 690-i*25, line)
                pdf.save()
                key = f"{society.id}/documents/{uuid.uuid4()}.pdf"
                storage().put(key, output.getvalue(), "application/pdf")
                add(Document, society_id=society.id, title=title, category=category, storage_key=key, filename=title.lower().replace(" ", "-")+".pdf")

            for title, body, category, route in [("You're home. Welcome!", "Everything for your community, in one place.", "Notices", "/notices"), ("Visitor waiting at Main Gate", "Rahul Verma is here to visit you.", "Visitors", "/visitors"), ("Your maintenance bill is ready", "INR 4,500 is due. View your bill for the breakdown.", "Payments", "/payments"), ("Your complaint is in progress", "The maintenance team is working on your request.", "Complaints", f"/complaints/{complaint.id}")]:
                add(Notification, society_id=society.id, user_id=resident.id, title=title, body=body, category=category, route=route)

        # Multi-role staff setup
        if green_heights and unit_1204:
            # 1. Arjun Sharma is also the Society Secretary of Green Heights
            add(StaffRole, society_id=green_heights.id, user_id=resident.id, role="Secretary", title="Society Secretary")

            # 2. Ramesh Singh is the Main Gate Security Guard
            add(StaffRole, society_id=green_heights.id, user_id=guard_user.id, role="Guard", title="Main Gate Security")

            # 3. Sample parcels at the gate for Flat 1204
            add(
                Parcel,
                society_id=green_heights.id,
                unit_id=unit_1204.id,
                courier="Amazon",
                recipient_name="Arjun Sharma",
                tracking_code="AMZ-827419",
                status="Arrived",
                otp="4821",
                logged_by=guard_user.id
            )
            add(
                Parcel,
                society_id=green_heights.id,
                unit_id=unit_1204.id,
                courier="Flipkart",
                recipient_name="Arjun Sharma",
                tracking_code="FK-991204",
                status="Collected",
                otp="1934",
                logged_by=guard_user.id,
                collected_at=now() - timedelta(days=1)
            )

        db.commit()
        print("Seeded demo societies, residents, admin roles, and guard staff.")
        print("Login 1 (Resident + Secretary): +91 9876543210 (OTP: 123456)")
        print("Login 2 (Security Guard):      +91 9876543211 (OTP: 123456)")


if __name__ == "__main__":
    force_seed = "--force" in sys.argv or "-f" in sys.argv
    seed(force=force_seed)
