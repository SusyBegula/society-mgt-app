# Verification evidence

## Operations release · 3 October 2026

- 24 backend integration tests passed against a disposable PostgreSQL 17 database on port 55439. Coverage includes society/role isolation, resident approval before gate entry, expiring passes, parcel-code privacy, exact notification context and access revocation, legacy-month billing idempotency, repeated captured payments, cheque clearance, refunds, bank matching, CSV imports, move-out, privacy, exports and mocked push delivery.
- Legacy-data migration upgrade, Alembic schema comparison, downgrade and re-upgrade passed in a temporary schema. The migration check reported no new upgrade operations.
- TypeScript compilation passed.
- Browser verification covers society creation, flat setup, billing preview/publication, resident approval, guard admission, parcel pickup and the Treasurer's restricted office view. It runs local API/static servers and does not call the live API. Screenshots are written to `/tmp/neighbourly-office.png` and `/tmp/neighbourly-guard.png`.
- The database backup script created a restricted dump of the disposable database and restored it into a new `restore_check_operations` database without overwriting the source.
- `npm audit` reported 30 dependency findings (19 high, 11 moderate). Advisories concern transitive `braces`, `node-forge`, `decode-uri-component` and `uuid`; many packages are reported through these dependencies. Suggested automatic fixes include incompatible major Expo/React Native changes. No forced upgrade was applied. Dependency remediation remains launch work.

Live SMS, Razorpay merchant calls, native camera/push, iOS, object-storage recovery, and migrations against a copy of the real database still need verification. No live configuration or production data was changed by these checks.

## Earlier Android smoke · 19 September 2026

- PostgreSQL container started; initial Alembic migration applied.
- FastAPI started; `/health` returned `ok` with an active database connection.
- TypeScript compilation passed.
- Native Android debug build succeeded and installed on the USB-connected Realme RMX3471.
- Metro bundled the Android app; the Expo development client launched successfully.
- Demo phone `9876543210` / OTP `123456` signed in on the physical phone.
- The property selector displayed both societies; Green Heights opened with live API data.
- Home, Visitors, Payments, Complaints and More opened. Main resource requests returned HTTP 200.
- No obvious startup crash appeared in the sampled React Native / Android runtime logs.

At that time testing stopped after these checks. The automated operations verification above is subsequent work; it does not replace new native-device testing.

The phone was left on Home. Docker services and Metro were left running. [Home screen captured on the phone](home-android.png).
