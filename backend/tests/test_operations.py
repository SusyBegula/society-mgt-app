"""Integration tests use ONLY the explicitly supplied disposable PostgreSQL database."""
import os
import json
import secrets
import hmac
import hashlib
import unittest
import io
import zipfile
from datetime import timedelta
from unittest.mock import Mock, patch

test_url = os.environ.get("TEST_DATABASE_URL", "")
if not test_url or not test_url.split("?")[0].endswith("/neighbourly_test"):
    raise RuntimeError("Set TEST_DATABASE_URL to a disposable database named neighbourly_test.")
os.environ.update(DATABASE_URL=test_url, APP_ENV="development", PAYMENT_PROVIDER="development",
                  JWT_SECRET="test-only-neighbourly-operations-secret", STORAGE_BACKEND="local", STORAGE_PATH="/tmp/neighbourly-test-uploads")

from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db import SessionLocal
from app.models import (User, Society, Unit, Building, StaffRole, ResidentMembership,
    VisitorInvitation, Visitor, MaintenanceBill, Payment, Notification, Device, PushDelivery, now)
from app.security import issue_tokens
from app.push_worker import enqueue, deliver_one


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.people = {}
        with SessionLocal.begin() as db:
            self.society = Society(name="Test " + secrets.token_hex(4), address="Test address", join_code=secrets.token_urlsafe(12))
            db.add(self.society); db.flush()
            building = Building(society_id=self.society.id, name="A")
            db.add(building); db.flush()
            self.unit = Unit(society_id=self.society.id, building_id=building.id, number="101", area_sqft=1000)
            db.add(self.unit); db.flush()
            for role in ("Admin", "Guard", "Secretary", "Treasurer", "Owner", "Tenant"):
                user = User(name=role, phone="+919" + str(secrets.randbelow(10**9)).zfill(9))
                db.add(user); db.flush()
                if role in ("Owner", "Tenant"):
                    context = ResidentMembership(society_id=self.society.id, unit_id=self.unit.id, user_id=user.id, role=role)
                else:
                    context = StaffRole(society_id=self.society.id, user_id=user.id, role=role)
                db.add(context); db.flush()
                token = issue_tokens(db, user)["access_token"]
                self.people[role] = (user.id, {"Authorization": "Bearer " + token, "X-Property-Id": context.id})

    def call(self, method, path, role="Admin", data=None, expected=200):
        response = self.client.request(method, path, headers=self.people[role][1], json=data)
        self.assertEqual(response.status_code, expected, response.text)
        return response.json() if response.content else None

    def walkin(self):
        return self.call("POST", "/guard/visitors/walk-in", "Guard", {"unit_id": self.unit.id,
            "name": "Guest", "phone": "+919876543210", "purpose": "Visiting resident"}, 201)

    def bill(self, amount=10000):
        with SessionLocal.begin() as db:
            row = MaintenanceBill(society_id=self.society.id, unit_id=self.unit.id, period="Test",
                                  due_date=now() + timedelta(days=5), amount=amount, outstanding=amount)
            db.add(row); db.flush()
            return row.id

    def test_walkin_requires_approval_and_guard_admission(self):
        visitor = self.walkin()
        self.assertEqual(visitor["status"], "Waiting")
        self.assertIsNone(visitor["entry_at"])
        self.call("POST", f"/guard/visitors/{visitor['id']}/admit", "Guard", expected=409)
        self.call("PATCH", f"/visitors/{visitor['id']}", "Owner", {"status": "Allowed"})
        admitted = self.call("POST", f"/guard/visitors/{visitor['id']}/admit", "Guard")
        self.assertEqual(admitted["status"], "Inside")
        self.assertIsNotNone(admitted["entry_at"])
        self.call("POST", f"/guard/visitors/{visitor['id']}/admit", "Guard")
        self.call("POST", f"/guard/visitors/{visitor['id']}/check-out", "Guard")

    def test_denied_visitor_cannot_enter(self):
        visitor = self.walkin()
        self.call("PATCH", f"/visitors/{visitor['id']}", "Tenant", {"status": "Denied"})
        self.call("POST", f"/guard/visitors/{visitor['id']}/admit", "Guard", expected=409)
        self.call("POST", f"/guard/visitors/{visitor['id']}/check-out", "Guard", expected=409)

    def test_parcel_code_is_resident_only_and_collection_requires_it(self):
        parcel = self.call("POST", "/guard/parcels", "Guard", {
            "unit_id": self.unit.id, "courier": "Test courier", "recipient_name": "Owner"}, 201)
        self.assertNotIn("otp", parcel)
        self.assertNotIn("otp", self.call("GET", "/guard/parcels/active", "Guard")[0])
        self.call("GET", "/parcels", "Guard", expected=403)
        resident_parcel = self.call("GET", "/parcels", "Owner")["items"][0]
        code = resident_parcel["otp"]
        wrong = "0000" if code != "0000" else "1111"
        self.call("POST", f"/guard/parcels/{parcel['id']}/collect", "Guard", {"otp": wrong}, 400)
        collected = self.call("POST", f"/guard/parcels/{parcel['id']}/collect", "Guard", {"otp": code})
        self.assertEqual(collected["status"], "Collected")
        self.assertNotIn("otp", collected)
        self.assertNotIn("otp", self.call("GET", "/parcels", "Owner")["items"][0])
        self.call("POST", f"/guard/parcels/{parcel['id']}/collect", "Guard", {"otp": code}, 400)

    def test_notifications_follow_exact_membership_and_revocation(self):
        from app.notifications import notify
        from app.push_worker import has_access
        with SessionLocal.begin() as db:
            original = db.get(ResidentMembership, self.people["Owner"][1]["X-Property-Id"])
            other_unit = Unit(society_id=self.society.id, building_id=self.unit.building_id, number="102")
            db.add(other_unit); db.flush()
            other_member = ResidentMembership(society_id=self.society.id, unit_id=other_unit.id,
                user_id=original.user_id, role="Owner")
            db.add(other_member); db.flush()
            notification = notify(db, original, "Private arrival", "For flat 101", "Visitors", "/visitors")
            db.flush(); notification_id = notification.id; other_context = other_member.id
            self.assertTrue(has_access(db, notification))
        self.assertEqual(self.call("GET", "/notifications", "Owner")["total"], 1)
        other_headers = {**self.people["Owner"][1], "X-Property-Id": other_context}
        response = self.client.get("/notifications", headers=other_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 0)
        self.assertEqual(self.client.post(f"/notifications/{notification_id}/read", headers=other_headers).status_code, 404)
        self.client.post("/notifications/read-all", headers=other_headers)
        with SessionLocal.begin() as db:
            notification = db.get(Notification, notification_id)
            self.assertIsNone(notification.read_at)
            original = db.get(ResidentMembership, self.people["Owner"][1]["X-Property-Id"])
            original.active = False; db.flush()
            self.assertFalse(has_access(db, notification))

    def test_direct_checkin_rechecks_expiration(self):
        with SessionLocal.begin() as db:
            invite = VisitorInvitation(society_id=self.society.id, unit_id=self.unit.id, user_id=self.people["Owner"][0],
                name="Expired", phone="+919876543210", start_at=now()-timedelta(hours=2), end_at=now()-timedelta(hours=1),
                pin=str(secrets.randbelow(900000)+100000), qr_token=secrets.token_urlsafe(32))
            db.add(invite); db.flush(); invitation_id = invite.id
        self.call("POST", "/guard/visitors/check-in", "Guard", {"invitation_id": invitation_id}, 409)

    def test_roles_and_cross_society_access(self):
        self.call("GET", "/admin/finance/summary", "Secretary", expected=403)
        self.call("POST", "/admin/setup/units", "Treasurer", {"building":"B", "number":"202"}, 403)
        self.call("GET", "/admin/setup", "Owner", expected=403)
        with SessionLocal.begin() as db:
            other = Society(name="Other", address="Other test society")
            db.add(other); db.flush()
            building = Building(society_id=other.id, name="Other")
            db.add(building); db.flush()
            unit = Unit(society_id=other.id, building_id=building.id, number="999")
            db.add(unit); db.flush(); unit_id = unit.id
        self.call("GET", "/admin/finance/ledger/" + unit_id, expected=404)
        self.call("POST", "/guard/visitors/walk-in", "Guard", {"unit_id":unit_id, "name":"Guest", "phone":"+919876543210", "purpose":"visit"}, 400)

    def test_cheque_clearance_is_idempotent_and_credit_is_bounded(self):
        bill_id = self.bill()
        payment = self.call("POST", "/admin/finance/payments/record-offline", data={"bill_id": bill_id,
            "amount":4000, "method":"Cheque", "reference":secrets.token_hex(8)}, expected=201)
        self.assertEqual(payment["status"], "Awaiting Clearance")
        self.assertEqual(self.call("GET", "/bills/"+bill_id, "Owner")["outstanding"], 10000)
        self.call("POST", "/admin/finance/cheques/"+payment["id"], data={"decision":"Cleared"})
        self.assertEqual(self.call("GET", "/bills/"+bill_id, "Owner")["outstanding"], 6000)
        self.call("POST", "/admin/finance/cheques/"+payment["id"], data={"decision":"Cleared"}, expected=409)
        self.call("POST", f"/admin/finance/bills/{bill_id}/credit", data={"amount":7000,"reason":"Correction"}, expected=409)
        self.call("POST", f"/admin/finance/bills/{bill_id}/credit", data={"amount":6000,"reason":"Correction"})
        self.assertEqual(self.call("GET", "/bills/"+bill_id, "Owner")["outstanding"], 0)

    def test_billing_preview_and_repeat_generation(self):
        self.call("POST", "/admin/finance/rules", data={"label":"Area charge", "amount":200,"basis":"Area"}, expected=201)
        data = {"month":"2026-11", "due_date":(now()+timedelta(days=10)).isoformat(), "preview":True}
        preview = self.call("POST", "/admin/finance/cycle", data=data)
        self.assertEqual(preview["total"], 200000)
        self.assertEqual(self.call("GET", "/bills", "Owner")["total"], 0)
        data["preview"] = False
        self.call("POST", "/admin/finance/cycle", data=data)
        repeated = self.call("POST", "/admin/finance/cycle", data=data)
        self.assertEqual(repeated["total"], 0)
        self.assertEqual(self.call("GET", "/bills", "Owner")["total"], 1)

    def test_emergency_requires_acknowledgement(self):
        alert = self.call("POST", "/emergency", "Owner", {"kind":"Medical","confirmed":True}, 201)
        self.call("PATCH", "/guard/emergencies/"+alert["id"], "Guard", {"status":"Resolved","note":"Contacted resident"}, 409)
        self.call("PATCH", "/guard/emergencies/"+alert["id"], "Guard", {"status":"Acknowledged","note":"Calling resident"})
        self.call("PATCH", "/guard/emergencies/"+alert["id"], "Guard", {"status":"Resolved","note":"Resident confirmed resolved"})
        self.assertEqual(self.call("GET", "/emergency", "Owner")[0]["status"], "Resolved")

    def test_monthly_cycle_does_not_duplicate_legacy_month_labels(self):
        with SessionLocal.begin() as db:
            db.add(MaintenanceBill(society_id=self.society.id, unit_id=self.unit.id,
                period="November 2026", due_date=now(), amount=5000, outstanding=5000))
        self.call("POST", "/admin/finance/rules", data={"label":"Maintenance", "amount":5000}, expected=201)
        data = {"month":"2026-11", "due_date":now().isoformat(), "preview":False}
        self.assertEqual(self.call("POST", "/admin/finance/cycle", data=data)["total"], 0)
        bulk = {"period":"Nov 2026", "due_date":now().isoformat(), "items":[{"label":"Maintenance", "amount":5000}]}
        self.assertEqual(self.call("POST", "/admin/finance/bills/bulk", data=bulk, expected=201)["generated_count"], 0)
        self.assertEqual(self.call("GET", "/bills", "Owner")["total"], 1)

    def test_csv_preview_atomic_import_and_moveout(self):
        data = {"csv":"building,number,area_sqft,opening_balance\nB,201,900,10000\nB,202,950,0\n", "preview":True}
        self.assertEqual(self.call("POST", "/admin/setup/import", data=data)["count"], 2)
        self.assertEqual(len(self.call("GET", "/admin/setup")["units"]), 1)
        data["preview"] = False
        self.call("POST", "/admin/setup/import", data=data)
        self.call("POST", "/admin/setup/import", data=data, expected=409)
        self.assertEqual(len(self.call("GET", "/admin/setup")["units"]), 3)
        self.call("POST", "/admin/setup/units/"+self.unit.id+"/move-out")
        self.call("GET", "/bills", "Tenant", expected=403)
        self.call("GET", "/bills", "Owner")

    def test_expense_requires_second_approver(self):
        vendor = self.call("POST", "/admin/finance/vendors", data={"name":"Lift service","category":"Maintenance"}, expected=201)
        expense = self.call("POST", "/admin/finance/expenses", "Treasurer", {"vendor_id":vendor["id"],"title":"Monthly service", "amount":10000,"invoice_number":"INV1", "due_at":now().isoformat()}, 201)
        path = "/admin/finance/expenses/"+expense["id"]
        self.call("PATCH", path, "Treasurer", {"status":"Approved"}, 403)
        self.call("PATCH", path, data={"status":"Approved"})
        self.call("PATCH", path, data={"status":"Paid"}, expected=422)
        self.call("PATCH", path, data={"status":"Paid","reference":"BANK-1"})

    def test_push_jobs_and_receipts_do_not_resend_accepted_messages(self):
        with SessionLocal.begin() as db:
            notification = Notification(society_id=self.society.id, user_id=self.people["Owner"][0],
                title="Test", body="Test", category="Visitors", route="/visitors")
            db.add(notification)
            db.add(Device(user_id=self.people["Owner"][0], token="ExpoPushToken["+secrets.token_hex(8)+"]", platform="android"))
            db.flush(); notification_id = notification.id
        with SessionLocal.begin() as db:
            enqueue(db)
        client = Mock()
        client.post.return_value.json.return_value = {"data":{"status":"ok", "id":"ticket-test"}}
        with SessionLocal.begin() as db:
            # Drain unrelated jobs only after limiting this fixture's due job.
            job = db.scalar(select(PushDelivery).where(PushDelivery.notification_id == notification_id))
            job.next_attempt_at = now()-timedelta(days=365)
        with SessionLocal.begin() as db:
            self.assertTrue(deliver_one(db, client))
        with SessionLocal.begin() as db:
            job = db.scalar(select(PushDelivery).where(PushDelivery.notification_id == notification_id))
            self.assertEqual(job.state, "Accepted")
            job.next_attempt_at = now()-timedelta(days=365)
        client.post.return_value.json.return_value = {"data":{"ticket-test":{"status":"ok"}}}
        with SessionLocal.begin() as db:
            deliver_one(db, client)
            job = db.scalar(select(PushDelivery).where(PushDelivery.notification_id == notification_id))
            self.assertEqual(job.state, "Provider Delivered")
        self.assertEqual(client.post.call_count, 2)

    def test_join_request_requires_verified_approval(self):
        unit = self.call("POST", "/admin/setup/units", data={"building":"B", "number":"202"}, expected=201)
        join = self.call("POST", "/onboarding/join", "Tenant", {"code":self.society.join_code,"building":"B","flat":"202","role":"Tenant"}, 201)
        self.call("POST", f"/admin/setup/requests/{join['id']}", "Guard", {"decision":"Approved"}, 403)
        self.call("POST", f"/admin/setup/requests/{join['id']}", data={"decision":"Approved"})
        properties = self.call("GET", "/properties", "Tenant")
        self.assertTrue(any(p.get("flat")=="202" for p in properties))
        self.call("POST", f"/admin/setup/requests/{join['id']}", data={"decision":"Approved"}, expected=409)

    def test_poll_one_vote_per_flat(self):
        poll = self.call("POST", "/admin/polls", data={"question":"Change garden hours?", "options":["Yes","No"],"closes_at":(now()+timedelta(days=1)).isoformat()}, expected=201)
        self.call("POST", f"/community/polls/{poll['id']}/vote", "Tenant", {"option":0},403)
        self.call("POST", f"/community/polls/{poll['id']}/vote", "Owner", {"option":0})
        self.call("POST", f"/community/polls/{poll['id']}/vote", "Owner", {"option":1},409)
        self.assertEqual(self.call("GET", "/community/polls", "Owner")[0]["counts"], [1,0])

    def test_privacy_requests_are_private_and_response_is_persisted(self):
        row=self.call("POST", "/privacy/requests", "Tenant", {"kind":"Correction","details":"Please correct my profile name."},201)
        self.assertEqual(self.call("GET","/privacy/requests","Owner"),[])
        self.call("PATCH",f"/admin/privacy/{row['id']}",data={"status":"In Progress","response":"Office is verifying the requested correction."})
        self.assertEqual(self.call("GET","/privacy/requests","Tenant")[0]["status"],"In Progress")

    def test_platform_access_is_separate_from_society_admin(self):
        self.call("GET","/platform/societies",expected=403)
        self.assertFalse(self.call("GET","/platform/access")["allowed"])

    def test_society_export_excludes_authentication_secrets(self):
        self.call("POST", "/guard/parcels", "Guard", {"unit_id":self.unit.id,"courier":"Export test"}, 201)
        response=self.client.get("/admin/export.zip",headers=self.people["Admin"][1])
        self.assertEqual(response.status_code,200,response.text[:200] if response.status_code!=200 else "")
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            data=json.loads(archive.read("society.json"))
        self.assertEqual(data["society"]["id"],self.society.id)
        for forbidden in ("refresh_tokens","otp_challenges","devices","push_deliveries"):
            self.assertNotIn(forbidden,data)
        self.assertNotIn("join_code",data["society"])
        self.assertNotIn("otp", data["parcels"][0])
        self.assertTrue(all("Pickup OTP:" not in row["body"] for row in data["notifications"]))
        self.assertTrue(all(r["society_id"]==self.society.id for r in data["memberships"]))

    def test_captured_payment_in_review_stays_idempotent_after_balance_changes(self):
        from app.payments import settle
        bill_id = self.bill(10000)
        with SessionLocal.begin() as db:
            bill = db.get(MaintenanceBill, bill_id)
            bill.outstanding = 5000
            payment = Payment(society_id=self.society.id, unit_id=self.unit.id, bill_id=bill_id,
                user_id=self.people["Owner"][0], amount=10000, provider="razorpay")
            db.add(payment); db.flush()
            reference = "pay_" + secrets.token_hex(12)
            settle(db, payment, reference, "upi")
            self.assertEqual(payment.status, "Review Required")
            self.assertEqual(bill.outstanding, 5000)
            db.flush()
            notification_count = len(list(db.scalars(select(Notification).where(Notification.society_id == self.society.id))))
            bill.outstanding = 10000; db.flush()
            settle(db, payment, reference, "upi")
            self.assertEqual(payment.status, "Review Required")
            self.assertEqual(bill.outstanding, 10000)
            db.flush()
            self.assertEqual(len(list(db.scalars(select(Notification).where(Notification.society_id == self.society.id)))), notification_count)

    def test_bank_matching_checks_amount_and_duplicate_match(self):
        bill_id=self.bill()
        payment=self.call("POST","/admin/finance/payments/record-offline",data={"bill_id":bill_id,"amount":5000,"method":"Bank Transfer","reference":secrets.token_hex(8)},expected=201)
        self.call("POST","/admin/finance/bank/import",data={"rows":[{"reference":"BANK1","occurred_at":now().isoformat(),"amount":5000}],"preview":False})
        row=self.call("GET","/admin/finance/bank")[0]
        candidates=self.call("GET",f"/admin/finance/bank/{row['id']}/candidates")
        self.assertEqual(candidates[0]["id"],payment["id"])
        self.call("POST",f"/admin/finance/bank/{row['id']}/match",data={"kind":"Payment","record_id":payment["id"]})
        self.call("POST",f"/admin/finance/bank/{row['id']}/match",data={"kind":"Payment","record_id":payment["id"]},expected=409)

    def test_scheduler_billing_is_repeatable(self):
        from app.maintenance_worker import run_society
        self.call("POST","/admin/finance/rules",data={"label":"Maintenance","amount":10000},expected=201)
        self.call("PUT","/admin/finance/schedule",data={"enabled":True,"due_day":10,"reminders":False})
        for _ in range(2):
            with SessionLocal.begin() as db:
                run_society(db,db.get(Society,self.society.id))
        self.assertEqual(self.call("GET","/bills","Owner")["total"],1)

    def test_refund_approval_reserves_amount_and_completion_reopens_dues_once(self):
        bill_id=self.bill()
        payment=self.call("POST","/admin/finance/payments/record-offline",data={"bill_id":bill_id,"amount":10000,"method":"Bank Transfer","reference":secrets.token_hex(8)},expected=201)
        refund=self.call("POST","/refunds","Owner",{"payment_id":payment["id"],"amount":6000,"reason":"Incorrect maintenance payment"},201)
        self.call("POST","/refunds","Owner",{"payment_id":payment["id"],"amount":5000,"reason":"Second refund request"},409)
        self.call("POST",f"/admin/finance/refunds/{refund['id']}/process",data={"reference":"BANK-REFUND"},expected=409)
        self.call("PATCH",f"/admin/finance/refunds/{refund['id']}",data={"status":"Approved"})
        ref=secrets.token_hex(8)
        for _ in range(2):
            result=self.call("POST",f"/admin/finance/refunds/{refund['id']}/process",data={"reference":ref})
            self.assertEqual(result["status"],"Completed")
        self.assertEqual(self.call("GET","/bills/"+bill_id,"Owner")["outstanding"],6000)
        self.assertEqual(self.call("GET","/admin/finance/summary")["total_collected"],4000)

    def test_provider_refund_retry_reuses_durable_idempotency_key(self):
        from fastapi import HTTPException
        bill_id=self.bill()
        with SessionLocal.begin() as db:
            payment=Payment(society_id=self.society.id,unit_id=self.unit.id,user_id=self.people["Owner"][0],bill_id=bill_id,
                amount=10000,status="Paid",provider="razorpay",reference="pay_"+secrets.token_hex(8),paid_at=now())
            db.add(payment); db.get(MaintenanceBill,bill_id).outstanding=0; db.flush();payment_id=payment.id;provider_reference=payment.reference
        refund=self.call("POST","/refunds","Owner",{"payment_id":payment_id,"amount":5000,"reason":"Incorrect amount"},201)
        self.call("PATCH",f"/admin/finance/refunds/{refund['id']}",data={"status":"Approved"})
        remote={"payment_id":provider_reference,"amount":5000,"currency":"INR","id":"rfnd_"+secrets.token_hex(8),"status":"processed"}
        with patch("app.routes.refunds.gateway",side_effect=[HTTPException(502,"Temporary provider failure"),remote]) as gateway:
            self.call("POST",f"/admin/finance/refunds/{refund['id']}/process",data={},expected=502)
            self.call("POST",f"/admin/finance/refunds/{refund['id']}/process",data={})
            first,second=gateway.call_args_list
            self.assertEqual(first.kwargs["headers"],second.kwargs["headers"])
            self.assertEqual(first.kwargs["headers"]["X-Refund-Idempotency"],refund["id"])
        self.assertEqual(self.call("GET","/bills/"+bill_id,"Owner")["outstanding"],5000)

    def test_payment_accounts_and_webhooks_are_society_scoped(self):
        from app.config import settings
        from app.payments import merchant
        from fastapi import HTTPException
        account={"key_id":"rzp_test_societyA","key_secret":"secretA","webhook_secret":"webhookA"}
        with patch.object(settings(),"razorpay_accounts",{self.society.id:account}):
            self.assertEqual(merchant(self.society.id)["key_id"],account["key_id"])
            with self.assertRaises(HTTPException):
                merchant("unconfigured-society")
            raw=json.dumps({"event":"payment.captured","payload":{"payment":{"entity":{"order_id":"unknown-order","id":"pay_test"}}}}).encode()
            path=f"/payments/webhook/{self.society.id}"
            bad=self.client.post(path,content=raw,headers={"X-Razorpay-Signature":"wrong"})
            self.assertEqual(bad.status_code,400)
            signature=hmac.new(b"webhookA",raw,hashlib.sha256).hexdigest()
            with patch("app.routes.billing.verify_capture") as verify:
                good=self.client.post(path,content=raw,headers={"X-Razorpay-Signature":signature})
                self.assertEqual(good.status_code,204)
                verify.assert_not_called()


if __name__ == "__main__":
    unittest.main()
