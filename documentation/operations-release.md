# Society operations release

The app supports English first. Each society has its own merchant mapping; the platform subscription is separate from maintenance collections.

## Getting a society started

1. Sign in and choose **Join or create a society → Create a society**. The creator receives the society Admin role.
2. Open **Society Setup**. Add flats or preview and import CSV with `building,number,area_sqft,opening_balance`. Opening balances are integer paise. Imports are atomic and reject existing or duplicate flats.
3. Add verified residents or distribute the invitation code and review join requests. A code never grants immediate access. Rotate it if needed.
4. Grant staff access. Admin manages setup and finance; Secretary manages society operations; Treasurer manages finance; Guard handles the gate. Staff contexts do not require owning a flat.
5. Configure charge rules in **Office Accounts** and preview a monthly cycle before publishing. Area rules need a square-foot value on every affected flat. Flat-specific rules are additional charges.
6. Add service contacts, amenities, domestic-help assignments, parking allocations and documents in **Society Resources**. Publish the society's policies and complaint-response target in **Policies & Activity**.

## Payments and refunds

`RAZORPAY_ACCOUNTS` is a server-only JSON map keyed by society UUID:

```json
{"society-uuid":{"key_id":"rzp_test_example","key_secret":"replace","webhook_secret":"replace"}}
```

Do not put secrets in mobile environment variables, source control, logs or society settings. Configure that merchant's webhook as `/payments/webhook/{society_id}`. The global legacy keys are used only when `RAZORPAY_SOCIETY_ID` exactly matches the society. Unmapped societies cannot create online orders. Never map multiple societies to the same merchant unless their contractual settlement arrangement explicitly calls for it.

Existing installations using `/payments/webhook` must configure the new scoped webhook before enabling collections. Changing a merchant account while it has pending orders requires an operator migration; old orders must be reconciled with the original account.

Cheque records remain **Awaiting Clearance** until finance confirms clearance. A bounced cheque does not reduce dues. Credit adjustments cannot exceed unpaid dues. Expenses require approval by a different authorised finance user before payment can be recorded. Bank statement imports are previewable, use signed paise, and only match paid records with the exact amount; they do not guess matches or initiate bank transfers.

Monthly billing recognizes legacy English month labels such as `November 2026` and `Nov 2026` as the `2026-11` cycle. Existing bills for that flat/month suppress regeneration. Review existing bill history before enabling the schedule. Bank matching currently supports individual collections and expenses; aggregated gateway settlements, fees and refund outflows need manual reconciliation.

Refund requests reserve the requested amount, require finance approval, and use the request UUID as Razorpay's `X-Refund-Idempotency` key. A timeout leaves the refund in Processing for a safe retry. Provider status must be processed before the ledger changes. Offline refund processing records a refund already made outside the app. Refunding a paid maintenance amount reopens the corresponding dues; use a separate credit adjustment when the charge itself is waived. Original payment receipts remain records of the original collection. Cashbook export includes completed refunds as withdrawals.

## Workers

Apply migrations before starting workers:

```bash
docker compose up -d --build api
docker compose --profile workers up -d --build push-worker maintenance-worker
```

Workers are separate processes and opt-in locally. Hosting platforms need equivalent worker services running `python -m app.push_worker` and `python -m app.maintenance_worker` using the same database configuration as the API.

The push worker consumes committed in-app notifications, creates a job per registered device, retries transient failures, checks Expo receipts and removes unregistered devices. Provider acceptance is not proof that a person saw a notification. Push is at least once; a crash after sending can cause a duplicate. Native EAS/FCM/APNs credentials and user permission are still required. Old notifications are marked skipped by the migration so deploying the worker does not send historical alerts.

The hourly maintenance worker generates a monthly billing cycle only when explicitly enabled, sends overdue reminders at most weekly, expires old waiting visitors, and removes identifying fields from old visitor records according to each society's retention setting. Stored uploads and financial records have separate retention needs; this job does not delete financial history or purge every copy of uploaded documents.

Guard walk-ins now remain Waiting. Residents approve or deny; guards record admission separately, within 30 minutes of approval. Guest passes are checked again at admission. Move-out revokes tenant/family access and their unused invitations. Manual phone calls are available to authorised guards while a visitor is waiting. During an outage, follow the society's manual gate procedure; an offline request is never treated as approval.

Residents see pending parcels and pickup codes in **My parcels**. Guards log deliveries and verify the resident's code during collection; the guard API does not return pickup codes. New notifications identify the exact originating flat/staff context. Tapping a native alert switches to that verified context; ambiguous legacy alerts open the property selector.

Emergency alerts are routed to the society response desk for acknowledgement and resolution. They do not dispatch public emergency services.

## Platform and data operations

`PLATFORM_ADMIN_USER_IDS` is a server-only JSON list of verified user UUIDs. A society administrator does not automatically become a platform operator. The platform screen shows society subscriptions, not resident records. Subscription status is bookkeeping: automated subscription charging and tax invoices are not enabled.

A society Admin can download an archive of scoped records and stored uploads/documents. Authentication tokens and gate/pickup secrets are excluded. Archives fail explicitly if a stored file is unavailable or file content exceeds 200 MB; arrange an assisted export for larger societies. Privacy requests support an office response workflow; a request marked Completed must reflect actions actually performed by the office.

Create restricted database backups and test recovery to a new database:

```bash
python3 scripts/database-backup.py backup --container your-postgres-container --file /secure/path/society.dump
python3 scripts/database-backup.py verify-restore --container your-restore-container --file /secure/path/society.dump
```

The restore tool refuses to overwrite an existing database and requires a `restore_check_` target. Keep an independent backup/versioning policy for object storage or the uploads volume. Do not use a database-only dump as your sole backup.

## Verification and launch work

Use a disposable PostgreSQL database named `neighbourly_test`. Scripts default to port 55439 and cannot use the normal app database by accident:

```bash
docker run -d --name neighbourly-review-test-db \
  -e POSTGRES_USER=neighbourly_test -e POSTGRES_PASSWORD=local-test-only \
  -e POSTGRES_DB=neighbourly_test -p 127.0.0.1:55439:5432 postgres:17-alpine
```

If that test container already exists, start it instead of creating another. Install the backend lockfile dependencies and mobile dependencies first, then run:

```bash
bash scripts/test-backend.sh
CHECK_MIGRATIONS=1 bash scripts/test-backend.sh
bash scripts/test-browser.sh
```

The browser suite builds against local test services and exercises society creation, flats, billing, resident approval and guard admission. Test output and screenshots are under `/tmp/neighbourly-*`. It does not contact the live app API.

Before a real pilot: verify native QR scanning, Android/iOS push receipt and tap behavior, real SMS delivery, merchant test-mode payments/webhooks/refunds, object-storage recovery, and migration against a copy of the current database. The native camera/document-picker additions require rebuilding the development client. Address the dependency advisories recorded in [verification evidence](smoke.md) through compatible dependency updates.

## Scope boundaries

This release implements operational workflows, not a full statutory accounting package. Advanced double-entry accounts, GST/TDS reports, advance balances, utility meter billing, automatic penalty calculations, subscription invoices/charging, formal elections, automated voice calls, offline data synchronisation, technician-specific accounts, and malware scanning remain separate work. Advisory polls use one owner vote per flat. No claim of legal compliance or production readiness follows from passing the automated tests.
