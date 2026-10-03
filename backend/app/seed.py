"""Comprehensive demonstration data for all society roles and workflows. Run after migrations."""
import io
import os
import sys
import uuid
import logging
from datetime import timedelta
from sqlalchemy import select, delete, text
from reportlab.pdfgen import canvas
from app.config import settings
from app.db import SessionLocal
from app.models import *
from app.storage import storage


def seed(force: bool = False):
    cfg = settings()
    allow_seed = (
        force
        or cfg.app_env in ("development", "staging", "production")
        or os.getenv("ALLOW_DEMO_SEED", "").lower() in ("true", "1")
    )
    if not allow_seed:
        raise RuntimeError("Demo seeding is only allowed with --force or ALLOW_DEMO_SEED=true")

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.phone == "+919876543201")):
            if not force:
                print("Demo data already exists. Run with --force to wipe and re-seed.")
                return

        print("Wiping existing demo data for clean re-seed...")
        db.execute(text("TRUNCATE TABLE users, societies CASCADE;"))
        db.commit()

        def add(entity, **values):
            row = entity(**values)
            db.add(row)
            db.flush()
            return row

        print("Creating demo users across all roles...")
        # 1. Admin - Vikram Malhotra (Owner & Society President)
        user_admin = add(User, phone="+919876543201", name="Vikram Malhotra", email="vikram.malhotra@greenheights.org")

        # 2. Secretary - Arjun Sharma (Owner, Tenant in Bangalore, Society Secretary)
        user_secretary = add(User, phone="+919876543210", name="Arjun Sharma", email="arjun.sharma@example.com")

        # 3. Treasurer - Pooja Iyer (Owner & Finance Lead)
        user_treasurer = add(User, phone="+919876543202", name="Pooja Iyer", email="pooja.iyer@example.com")

        # 4. Security Guard 1 - Ramesh Singh (Head Security Guard, Main Gate)
        user_guard1 = add(User, phone="+919876543211", name="Ramesh Singh", email="guard.ramesh@greenheights.local")

        # 5. Security Guard 2 - Bahadur Thapa (Tower & Service Gate Guard)
        user_guard2 = add(User, phone="+919876543212", name="Bahadur Thapa", email="guard.bahadur@greenheights.local")

        # 6. Resident Owner - Sunil Kulkarni (Flat Owner)
        user_owner = add(User, phone="+919876543203", name="Sunil Kulkarni", email="sunil.kulkarni@example.com")

        # 7. Resident Tenant - Neha Kapoor (Tenant with active lease)
        user_tenant = add(User, phone="+919876543204", name="Neha Kapoor", email="neha.kapoor@example.com")

        # 8. Family Member - Ananya Sharma (Spouse of Arjun Sharma)
        user_family = add(User, phone="+919876543205", name="Ananya Sharma", email="ananya.sharma@example.com")

        # ----------------------------------------------------
        # Societies & Buildings
        # ----------------------------------------------------
        print("Creating societies, buildings, and units...")
        # Society 1: Green Heights (Primary Demo Society in Pune)
        society_gh = add(Society, name="Green Heights", address="Baner Road, Pune, Maharashtra 411045", settings={
            "billing_schedule": {"enabled": True, "due_day": 10, "reminders": True},
            "visitor_retention_days": 90,
            "currency": "INR",
        })

        # Society 2: Sunrise Residency (Secondary Society in Bengaluru)
        society_sr = add(Society, name="Sunrise Residency", address="Whitefield Main Road, Bengaluru, Karnataka 560066", settings={
            "billing_schedule": {"enabled": False},
            "visitor_retention_days": 60,
        })

        # Green Heights Buildings & Units
        bldg_a = add(Building, society_id=society_gh.id, name="Tower A")
        bldg_b = add(Building, society_id=society_gh.id, name="Tower B")

        unit_a1001 = add(Unit, society_id=society_gh.id, building_id=bldg_a.id, number="1001", area_sqft=1850) # Admin
        unit_a1204 = add(Unit, society_id=society_gh.id, building_id=bldg_a.id, number="1204", area_sqft=1420) # Secretary & Family
        unit_a502  = add(Unit, society_id=society_gh.id, building_id=bldg_a.id, number="502",  area_sqft=1380) # Owner Sunil
        unit_b402  = add(Unit, society_id=society_gh.id, building_id=bldg_b.id, number="402",  area_sqft=1250) # Treasurer Pooja
        unit_b203  = add(Unit, society_id=society_gh.id, building_id=bldg_b.id, number="203",  area_sqft=980)  # Tenant Neha
        unit_b101  = add(Unit, society_id=society_gh.id, building_id=bldg_b.id, number="101",  area_sqft=1150) # Ground Floor

        # Sunrise Residency Buildings & Units
        bldg_c = add(Building, society_id=society_sr.id, name="Tower C")
        unit_c305 = add(Unit, society_id=society_sr.id, building_id=bldg_c.id, number="305", area_sqft=1100) # Arjun Tenant
        unit_c102 = add(Unit, society_id=society_sr.id, building_id=bldg_c.id, number="102", area_sqft=1050)

        # ----------------------------------------------------
        # Staff Roles & Resident Memberships
        # ----------------------------------------------------
        print("Assigning memberships and staff roles...")
        # 1. Staff Roles at Green Heights
        add(StaffRole, society_id=society_gh.id, user_id=user_admin.id, role="Admin", title="Management Committee President")
        add(StaffRole, society_id=society_gh.id, user_id=user_secretary.id, role="Secretary", title="Hon. Society Secretary")
        add(StaffRole, society_id=society_gh.id, user_id=user_treasurer.id, role="Treasurer", title="Treasurer & Finance Lead")
        add(StaffRole, society_id=society_gh.id, user_id=user_guard1.id, role="Guard", title="Main Gate Security Supervisor")
        add(StaffRole, society_id=society_gh.id, user_id=user_guard2.id, role="Guard", title="Tower A & Service Gate Guard")

        # 2. Resident Memberships at Green Heights
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_a1001.id, user_id=user_admin.id, role="Owner")
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_a1204.id, user_id=user_secretary.id, role="Owner")
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_a1204.id, user_id=user_family.id, role="Family Member")
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_a502.id,  user_id=user_owner.id, role="Owner")
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_b402.id,  user_id=user_treasurer.id, role="Owner")
        add(ResidentMembership, society_id=society_gh.id, unit_id=unit_b203.id,  user_id=user_tenant.id, role="Tenant")

        # 3. Resident Membership at Sunrise Residency (Multi-society demo)
        add(ResidentMembership, society_id=society_sr.id, unit_id=unit_c305.id,  user_id=user_secretary.id, role="Tenant")

        # Family member record for flat 1204
        add(FamilyMember, society_id=society_gh.id, unit_id=unit_a1204.id, name="Ananya Sharma", phone="+919876543205", relationship="Spouse", app_access=True)
        add(FamilyMember, society_id=society_gh.id, unit_id=unit_a1204.id, name="Aarav Sharma", phone="+919876543206", relationship="Child", app_access=False)
        add(FamilyMember, society_id=society_gh.id, unit_id=unit_a502.id,  name="Sunita Kulkarni", phone="+919876543207", relationship="Spouse", app_access=False)

        # ----------------------------------------------------
        # Billing Rules & Ledgers
        # ----------------------------------------------------
        print("Setting up billing rules, ledgers, and payments...")
        add(BillingRule, society_id=society_gh.id, label="General Maintenance & Cleanliness", amount=350000, basis="Flat") # 3,500
        add(BillingRule, society_id=society_gh.id, label="24/7 Water & Pumping Charges", amount=50000, basis="Flat") # 500
        add(BillingRule, society_id=society_gh.id, label="Covered Car Parking Slot", amount=50000, basis="Flat") # 500
        add(BillingRule, society_id=society_gh.id, label="Sinking & Infrastructure Fund", amount=50, basis="Area") # 50 paise/sqft

        # Past 3 months paid bills for Flat 1204 (Arjun) & Flat 502 (Sunil)
        for unit, user in [(unit_a1204, user_secretary), (unit_a502, user_owner)]:
            scope = {"society_id": society_gh.id, "unit_id": unit.id}
            for m in (1, 2, 3):
                past = now() - timedelta(days=m * 30)
                period_name = past.strftime("%B %Y")
                b = add(MaintenanceBill, **scope, period=period_name, due_date=past, amount=450000, outstanding=0, status="Paid")
                add(BillItem, bill_id=b.id, label="Society Maintenance & Utilities", amount=400000)
                add(BillItem, bill_id=b.id, label="Covered Parking Maintenance", amount=50000)
                add(Payment, **scope, bill_id=b.id, user_id=user.id, amount=450000, status="Paid",
                    method="UPI / Razorpay", provider="development", order_id=f"ord_paid_{unit.number}_{m}",
                    reference=f"UPI-20260{m}-99{unit.number}82", paid_at=past, created_at=past)

        # Current Active Unpaid Bill for Flat 1204 (Arjun Sharma)
        due_curr = (now() + timedelta(days=12)).replace(hour=23, minute=59, second=0, microsecond=0)
        curr_bill = add(MaintenanceBill, society_id=society_gh.id, unit_id=unit_a1204.id, period=due_curr.strftime("%B %Y"),
                        due_date=due_curr, amount=450000, outstanding=450000, status="Unpaid")
        add(BillItem, bill_id=curr_bill.id, label="Society Maintenance & Utilities", amount=400000)
        add(BillItem, bill_id=curr_bill.id, label="Reserved Parking Fee", amount=50000)

        # Overdue Bill for Flat 203 (Tenant Neha)
        past_due = now() - timedelta(days=6)
        overdue_bill = add(MaintenanceBill, society_id=society_gh.id, unit_id=unit_b203.id, period=past_due.strftime("%B %Y"),
                           due_date=past_due, amount=380000, outstanding=380000, status="Unpaid")
        add(BillItem, bill_id=overdue_bill.id, label="Monthly Maintenance & Water", amount=380000)

        # ----------------------------------------------------
        # Vendors & Expenses (For Treasurer & Admin)
        # ----------------------------------------------------
        print("Populating vendor expenses and financial ledger...")
        v_lift = add(Vendor, society_id=society_gh.id, name="Apex Elevator Systems Pvt Ltd", phone="+912027110091", category="Elevator AMC")
        v_sec = add(Vendor, society_id=society_gh.id, name="SecuraGuard Services India", phone="+912027110092", category="Security Services")
        v_clean = add(Vendor, society_id=society_gh.id, name="CleanForce Facility Management", phone="+912027110093", category="Housekeeping")
        v_dg = add(Vendor, society_id=society_gh.id, name="Torrent Diesel & Energy Supplies", phone="+912027110094", category="DG Generator Fuel")

        # 1. Paid Monthly Security Bill
        exp1 = add(Expense, society_id=society_gh.id, vendor_id=v_sec.id, title="Main Gate & Tower Security Staff (Sep 2026)",
                   amount=8500000, invoice_number="SEC-2026-09-082", due_at=now() - timedelta(days=15),
                   status="Paid", submitted_by=user_treasurer.id, approved_by=user_admin.id,
                   paid_at=now() - timedelta(days=10), reference="NEFT-SBIN-882103")

        # 2. Paid Lift AMC Q3
        exp2 = add(Expense, society_id=society_gh.id, vendor_id=v_lift.id, title="Quarterly Elevator AMC (4 Passenger Lifts)",
                   amount=3600000, invoice_number="APX-Q3-9182", due_at=now() - timedelta(days=20),
                   status="Paid", submitted_by=user_treasurer.id, approved_by=user_admin.id,
                   paid_at=now() - timedelta(days=18), reference="NEFT-HDFC-991204")

        # 3. Pending Approval Expense (Diesel generator refill)
        exp3 = add(Expense, society_id=society_gh.id, vendor_id=v_dg.id, title="Diesel Refill 250L for Cummins DG Backup",
                   amount=2250000, invoice_number="TOR-DSL-4412", due_at=now() + timedelta(days=5),
                   status="Submitted", submitted_by=user_secretary.id)

        # ----------------------------------------------------
        # Visitors & Gate Passes
        # ----------------------------------------------------
        print("Adding visitor activity and invitations at security gate...")
        # 1. Visitor Waiting right now for Flat 1204 (Arjun Sharma) -> Shows in app as "Waiting"!
        add(Visitor, society_id=society_gh.id, unit_id=unit_a1204.id, name="Rajesh Agarwal",
            phone="+919812345678", kind="Guest", purpose="Personal visit / Tea",
            status="Waiting", arrived_at=now() - timedelta(minutes=5))

        # 2. Delivery waiting for Flat 502 (Sunil Kulkarni)
        add(Visitor, society_id=society_gh.id, unit_id=unit_a502.id, name="Suresh Patil",
            phone="+919823456789", kind="Delivery", purpose="Swiggy Food Delivery",
            status="Waiting", arrived_at=now() - timedelta(minutes=2))

        # 3. Visitor inside society (Flat 1001 - Vikram)
        add(Visitor, society_id=society_gh.id, unit_id=unit_a1001.id, name="Dr. Meera Joshi",
            phone="+919834567890", kind="Guest", purpose="Consultation",
            status="Inside", arrived_at=now() - timedelta(minutes=45), entry_at=now() - timedelta(minutes=42))

        # 4. Past visitor exited
        add(Visitor, society_id=society_gh.id, unit_id=unit_a1204.id, name="Karan Verma",
            phone="+919845678901", kind="Delivery", purpose="Amazon Courier Delivery",
            status="Exited", arrived_at=now() - timedelta(hours=3),
            entry_at=now() - timedelta(hours=3), exit_at=now() - timedelta(hours=2, minutes=45))

        # 5. Pre-Approved Guest Invitation (Pass PIN: 739201)
        add(VisitorInvitation, society_id=society_gh.id, unit_id=unit_a1204.id, user_id=user_secretary.id,
            name="Kavita Nair", phone="+919856789012",
            start_at=now() + timedelta(hours=2), end_at=now() + timedelta(hours=8),
            pin="739201", qr_token="invitation-kavita-nair-pass-token-2026", notes="Family dinner guest")

        # ----------------------------------------------------
        # Parcels & Deliveries at Guard Desk
        # ----------------------------------------------------
        print("Logging incoming parcels and pickup OTPs...")
        # Parcel 1: Arrived for Flat 1204 (Arjun) - Pickup OTP 4821
        add(Parcel, society_id=society_gh.id, unit_id=unit_a1204.id, courier="Amazon Prime",
            recipient_name="Arjun Sharma", tracking_code="AMZ-882103",
            status="Arrived", otp="4821", logged_by=user_guard1.id)

        # Parcel 2: Arrived for Flat 203 (Neha) - Pickup OTP 7193
        add(Parcel, society_id=society_gh.id, unit_id=unit_b203.id, courier="Blinkit",
            recipient_name="Neha Kapoor", tracking_code="BLK-993214",
            status="Arrived", otp="7193", logged_by=user_guard1.id)

        # Parcel 3: Collected yesterday
        add(Parcel, society_id=society_gh.id, unit_id=unit_a502.id, courier="Flipkart",
            recipient_name="Sunil Kulkarni", tracking_code="FK-448210",
            status="Collected", otp="1934", logged_by=user_guard1.id,
            collected_at=now() - timedelta(days=1))

        # ----------------------------------------------------
        # Resident Complaints & Workflow
        # ----------------------------------------------------
        print("Populating resident complaints across categories...")
        # Complaint 1: Plumbing issue in progress for Flat 1204
        c1 = add(Complaint, society_id=society_gh.id, unit_id=unit_a1204.id, user_id=user_secretary.id,
                 title="Water leakage under kitchen sink",
                 description="The main shutoff valve under the kitchen sink is dripping continuously. Need plumber inspection.",
                 category="Plumbing", priority="Normal", status="In Progress", assigned_to="Society Maintenance Plumber",
                 created_at=now() - timedelta(days=1))
        add(ComplaintComment, complaint_id=c1.id, text="Complaint registered by Arjun Sharma.", kind="status", created_at=now() - timedelta(days=1))
        add(ComplaintComment, complaint_id=c1.id, text="Assigned to plumber (Santosh). Visit scheduled for 4 PM today.", kind="status", created_at=now() - timedelta(hours=3))

        # Complaint 2: Lift noise in Tower B
        c2 = add(Complaint, society_id=society_gh.id, unit_id=unit_b203.id, user_id=user_tenant.id,
                 title="Tower B Passenger Lift screeching sound",
                 description="Lift 1 in Tower B makes a loud screeching vibration when ascending between floors 3 and 5.",
                 category="Lift", priority="High", status="Open", assigned_to="Apex Elevators Technician",
                 created_at=now() - timedelta(hours=5))
        add(ComplaintComment, complaint_id=c2.id, text="Technician ticket #APX-491 logged with service vendor.", kind="comment", created_at=now() - timedelta(hours=4))

        # Complaint 3: Resolved electrical issue
        c3 = add(Complaint, society_id=society_gh.id, unit_id=unit_a502.id, user_id=user_owner.id,
                 title="Corridor sensor light replacement on 5th floor",
                 description="The automatic motion sensor light outside Flat 502 was turned off.",
                 category="Electrical", priority="Normal", status="Resolved", assigned_to="Society Electrician",
                 created_at=now() - timedelta(days=3))
        add(ComplaintComment, complaint_id=c3.id, text="LED sensor bulb replaced and tested. Issue resolved.", kind="status", created_at=now() - timedelta(days=1))

        # ----------------------------------------------------
        # Amenities & Bookings
        # ----------------------------------------------------
        print("Setting up sports, clubhouse amenities, and resident bookings...")
        am_badminton = add(Amenity, society_id=society_gh.id, name="Badminton Court",
                           description="Indoor synthetic court with LED floodlighting and shoe racks.",
                           icon="fitness-outline", opens=6, closes=22, fee=0)
        am_pool = add(Amenity, society_id=society_gh.id, name="Swimming Pool",
                      description="Half-Olympic lap pool and kids wading pool with certified lifeguard.",
                      icon="water-outline", opens=6, closes=21, fee=0)
        am_clubhouse = add(Amenity, society_id=society_gh.id, name="Community Clubhouse",
                           description="Air-conditioned party hall, lounge seating, and pantry for family gatherings.",
                           icon="cafe-outline", opens=9, closes=23, fee=50000) # 500 deposit
        am_gym = add(Amenity, society_id=society_gh.id, name="Fitness Center & Gym",
                     description="Modern cardio machines, power racks, free weights, and stretching zone.",
                     icon="barbell-outline", opens=5, closes=23, fee=0)

        # Booking: Badminton court booked by Arjun for tomorrow morning
        b_start = (now() + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
        add(AmenityBooking, society_id=society_gh.id, unit_id=unit_a1204.id, user_id=user_secretary.id,
            amenity_id=am_badminton.id, start_at=b_start, end_at=b_start + timedelta(hours=1))

        # Booking: Clubhouse booked by Sunil for birthday celebration
        ch_start = (now() + timedelta(days=4)).replace(hour=18, minute=0, second=0, microsecond=0)
        add(AmenityBooking, society_id=society_gh.id, unit_id=unit_a502.id, user_id=user_owner.id,
            amenity_id=am_clubhouse.id, start_at=ch_start, end_at=ch_start + timedelta(hours=4))

        # ----------------------------------------------------
        # Registered Vehicles & Parking Slots
        # ----------------------------------------------------
        print("Registering resident vehicles and parking allocations...")
        add(Vehicle, society_id=society_gh.id, unit_id=unit_a1001.id, kind="Car",
            registration="MH12-VM-1001", manufacturer="Mercedes-Benz", model="C-Class", color="Obsidian Black", parking_slot="B1 · P-01")
        add(Vehicle, society_id=society_gh.id, unit_id=unit_a1204.id, kind="Car",
            registration="MH12-AS-1204", manufacturer="Hyundai", model="Creta SX", color="Polar White", parking_slot="B1 · P-24")
        add(Vehicle, society_id=society_gh.id, unit_id=unit_a1204.id, kind="Scooter",
            registration="MH12-EV-0421", manufacturer="Ather", model="450X Gen 3", color="Space Grey", parking_slot="B1 · EV-05")
        add(Vehicle, society_id=society_gh.id, unit_id=unit_a502.id, kind="Car",
            registration="MH12-SK-0502", manufacturer="Tata", model="Nexon EV Max", color="Teal Blue", parking_slot="B2 · P-12")
        add(Vehicle, society_id=society_gh.id, unit_id=unit_b203.id, kind="Car",
            registration="MH12-NK-0203", manufacturer="Maruti Suzuki", model="Swift ZXi", color="Silky Silver", parking_slot="B2 · P-35")

        # ----------------------------------------------------
        # Domestic Help (Maids, Cooks, Drivers)
        # ----------------------------------------------------
        print("Registering domestic help staff and entry logs...")
        help_maid = add(DomesticHelp, society_id=society_gh.id, unit_id=unit_a1204.id, name="Sunita Devi", kind="Housekeeper / Maid", status="Inside")
        # Entry log for Sunita Devi (entered 40 mins ago)
        add(DomesticHelpVisit, help_id=help_maid.id, entry_at=now() - timedelta(minutes=40))

        help_cook = add(DomesticHelp, society_id=society_gh.id, unit_id=unit_a502.id, name="Raju Yadav", kind="Cook", status="Outside")
        add(DomesticHelpVisit, help_id=help_cook.id, entry_at=now() - timedelta(days=1, hours=2), exit_at=now() - timedelta(days=1))

        # ----------------------------------------------------
        # Society Notices & Announcements
        # ----------------------------------------------------
        print("Publishing society notices and bulletins...")
        add(Notice, society_id=society_gh.id, title="Annual General Meeting (AGM) - FY 2026-27", category="General",
            content="Notice is hereby given that the 12th Annual General Body Meeting of Green Heights Co-operative Housing Society will be held on Sunday, 25th October at 10:30 AM in the Clubhouse. Key agenda: Audit report presentation, election of new managing committee members, and approval of capital improvement works. High tea will follow.")

        add(Notice, society_id=society_gh.id, title="Quarterly Overhead Water Tank Cleaning", category="Maintenance",
            content="Routine chemical cleaning and UV disinfection of overhead and underground water reservoirs is scheduled for this coming Saturday from 09:00 AM to 02:00 PM. Water supply will be temporarily turned off during these hours. Kindly store sufficient water in advance.")

        add(Notice, society_id=society_gh.id, title="Diwali Grand Celebration & Cultural Night", category="Events",
            content="The Cultural Committee invites all residents, children, and seniors to our annual Diwali Night on Saturday evening at the central amphitheatre. Programs include rangoli competition, classical music performances, kids talent show, and dinner buffet. Please RSVP by Wednesday.")

        add(Notice, society_id=society_gh.id, title="Mandatory Basement EV Charger Safety Inspection", category="Safety",
            content="All residents owning electric four-wheelers and two-wheelers must ensure their private chargers in Basements B1 and B2 comply with society fire safety codes (proper MCB earthing and industrial plug points). The electrical committee audit will begin next Monday.")

        # ----------------------------------------------------
        # Society Assets & Equipment
        # ----------------------------------------------------
        print("Adding society physical infrastructure assets...")
        add(Asset, society_id=society_gh.id, name="Cummins 160 kVA Silent Diesel Generator Set", kind="Power Backup",
            quantity=1, notes="Provides automatic power backup for elevators, water pumps, and common area lighting.",
            last_service_at=now() - timedelta(days=40), next_service_at=now() + timedelta(days=50))

        add(Asset, society_id=society_gh.id, name="Otis Gen2 High-Speed Passenger Lifts", kind="Elevators",
            quantity=4, notes="Covered under comprehensive AMC with Otis India. Emergency auto rescue device tested.",
            last_service_at=now() - timedelta(days=20), next_service_at=now() + timedelta(days=70))

        add(Asset, society_id=society_gh.id, name="Rooftop Grid-Tied Solar PV System (60 kWp)", kind="Renewable Energy",
            quantity=1, notes="Generates clean solar power offsetting 40% of monthly common area electricity consumption.",
            last_service_at=now() - timedelta(days=60), next_service_at=now() + timedelta(days=120))

        add(Asset, society_id=society_gh.id, name="Grundfos Hydro-Pneumatic Water Pumping Station", kind="Water Supply",
            quantity=2, notes="Dual booster pumps supplying pressurized domestic water across all 15 floors.")

        # ----------------------------------------------------
        # Meetings & Advisory Polls
        # ----------------------------------------------------
        print("Creating managing committee meeting and community poll...")
        add(Meeting, society_id=society_gh.id, title="Managing Committee Monthly Review Meeting",
            starts_at=now() + timedelta(days=6, hours=10),
            agenda="1. Review of Q3 accounts and outstanding maintenance collections.\n2. Security guard agency performance review.\n3. Quotation review for central EV charging stations in B1.\n4. Monsoon roof waterproofing contractor selection.")

        poll1 = add(Poll, society_id=society_gh.id, question="Should the society install 6 dedicated 11 kW EV fast-charging stations in Basement B1?",
                    options=["Yes, approve proposal", "No, keep private meter chargers", "Need more technical and cost details"],
                    closes_at=now() + timedelta(days=10))

        # Sample votes on the poll
        add(PollVote, society_id=society_gh.id, unit_id=unit_a1001.id, poll_id=poll1.id, user_id=user_admin.id, option=0)
        add(PollVote, society_id=society_gh.id, unit_id=unit_a1204.id, poll_id=poll1.id, user_id=user_secretary.id, option=0)
        add(PollVote, society_id=society_gh.id, unit_id=unit_a502.id,  poll_id=poll1.id, user_id=user_owner.id, option=2)

        # ----------------------------------------------------
        # Emergency Alert (Resolved Sample)
        # ----------------------------------------------------
        print("Adding sample emergency incident record...")
        add(EmergencyAlert, society_id=society_gh.id, unit_id=unit_b203.id, user_id=user_tenant.id,
            kind="Elevator Stuck Alarm", status="Resolved", acknowledged_by=user_guard1.id,
            acknowledged_at=now() - timedelta(days=2, hours=3), resolved_at=now() - timedelta(days=2, hours=2, minutes=50),
            response_note="Power switch glitch triggered emergency brake. Guard Ramesh manually leveled lift to 2nd floor; tenant Neha exited safely. Lift restarted after technician clearance.")

        # ----------------------------------------------------
        # Directory Contacts
        # ----------------------------------------------------
        print("Populating emergency and essential directory contacts...")
        for name, phone, cat in [
            ("Main Gate Security Desk", "+912027001001", "Security"),
            ("Society Management Office", "+912027001002", "Office"),
            ("Facility Manager (Mr. Kulkarni)", "+919876540001", "Manager"),
            ("Society On-Call Electrician", "+919876540002", "Electrician"),
            ("Society On-Call Plumber", "+919876540003", "Plumber"),
            ("Otis Lift Emergency Rescue", "18002098471", "Lift Emergency"),
            ("National Emergency Helpline", "112", "Emergency"),
            ("Ambulance Services", "108", "Medical"),
            ("City Fire Brigade", "101", "Fire"),
            ("Baner Police Station", "+912027291100", "Police"),
        ]:
            add(DirectoryContact, society_id=society_gh.id, name=name, phone=phone, category=cat)

        # ----------------------------------------------------
        # Society Documents & PDF Uploads
        # ----------------------------------------------------
        print("Generating and uploading society guidelines and documents...")
        for doc_title, doc_cat in [
            ("Society Living Guidelines & Code of Conduct", "Society Rules"),
            ("Minutes of 11th Annual General Meeting", "Meeting Minutes"),
            ("Flat Interior Renovation Policy & Timings", "Forms"),
            ("Basement EV Charging and Parking Rules", "Society Rules"),
        ]:
            try:
                buf = io.BytesIO()
                pdf = canvas.Canvas(buf)
                pdf.setFont("Helvetica-Bold", 18)
                pdf.drawString(48, 770, "Green Heights Co-operative Housing Society")
                pdf.setFont("Helvetica-Bold", 14)
                pdf.drawString(48, 740, doc_title)
                pdf.setFont("Helvetica", 10)
                pdf.drawString(48, 715, f"Category: {doc_cat}  |  Official Society Document")
                pdf.setLineWidth(0.5)
                pdf.line(48, 705, 550, 705)
                for idx, line in enumerate([
                    "1. All residents must adhere to community quiet hours from 10:00 PM to 07:00 AM.",
                    "2. Waste segregation into Dry, Wet, and Domestic Hazardous waste is strictly mandatory.",
                    "3. Visitor vehicles must be parked only in designated Visitor Bays on the ground floor.",
                    "4. For maintenance or emergency assistance, contact the Security Desk or Society Office.",
                    "5. Official records are maintained digitally via the Neighbourly management system."
                ]):
                    pdf.drawString(48, 680 - (idx * 22), line)
                pdf.save()

                storage_key = f"{society_gh.id}/documents/{uuid.uuid4()}.pdf"
                storage().put(storage_key, buf.getvalue(), "application/pdf")
                add(Document, society_id=society_gh.id, title=doc_title, category=doc_cat,
                    storage_key=storage_key, filename=doc_title.lower().replace(" ", "-") + ".pdf")
            except Exception as e:
                logging.warning(f"Could not upload sample document '{doc_title}': {e}")

        # ----------------------------------------------------
        # Notifications for Users
        # ----------------------------------------------------
        print("Seeding in-app notifications for Arjun Sharma...")
        for notif_title, notif_body, notif_cat, notif_route in [
            ("Visitor waiting at Main Gate", "Rajesh Agarwal has arrived at the Main Gate to meet you.", "Visitors", "/visitors"),
            ("Parcel received at Security Desk", "Amazon Prime courier (Tracking AMZ-882103) is ready for pickup with OTP 4821.", "Parcels", "/parcels"),
            ("October Maintenance Bill Ready", "Your maintenance bill of INR 4,500.00 is due on Oct 24.", "Payments", "/bills"),
            ("Water Leakage Complaint in Progress", "Society plumber has been assigned to your request.", "Complaints", f"/complaints/{c1.id}"),
            ("AGM Meeting Announced", "Join the Annual General Body Meeting on Sunday 25th Oct.", "Notices", "/notices"),
        ]:
            add(Notification, society_id=society_gh.id, user_id=user_secretary.id,
                title=notif_title, body=notif_body, category=notif_cat, route=notif_route)

        db.commit()
        print("\n==================================================================")
        print("  🎉 DATABASE SUCCESSFULLY POPULATED WITH REALISTIC DEMO DATA!  ")
        print("==================================================================")
        print("  All accounts use fixed OTP: 123456 (India +91)\n")
        print("  1. Society Admin (President):     +91 9876543201  (Vikram Malhotra)")
        print("  2. Society Secretary:             +91 9876543210  (Arjun Sharma - Owner)")
        print("  3. Society Treasurer (Finance):   +91 9876543202  (Pooja Iyer)")
        print("  4. Security Guard (Main Gate):    +91 9876543211  (Ramesh Singh)")
        print("  5. Security Guard (Service Gate): +91 9876543212  (Bahadur Thapa)")
        print("  6. Flat Owner:                    +91 9876543203  (Sunil Kulkarni)")
        print("  7. Flat Tenant:                   +91 9876543204  (Neha Kapoor)")
        print("  8. Family Member:                 +91 9876543205  (Ananya Sharma)")
        print("==================================================================\n")


if __name__ == "__main__":
    force_flag = "--force" in sys.argv or "-f" in sys.argv
    seed(force=force_flag)
