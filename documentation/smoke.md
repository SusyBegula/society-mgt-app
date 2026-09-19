# Basic smoke verification · 19 September 2026

- PostgreSQL container started; initial Alembic migration applied.
- FastAPI started; `/health` returned `ok` with an active database connection.
- TypeScript compilation passed.
- Native Android debug build succeeded and installed on the USB-connected Realme RMX3471.
- Metro bundled the Android app; the Expo development client launched successfully.
- Demo phone `9876543210` / OTP `123456` signed in on the physical phone.
- The property selector displayed both societies; Green Heights opened with live API data.
- Home, Visitors, Payments, Complaints and More opened. Main resource requests returned HTTP 200.
- No obvious startup crash appeared in the sampled React Native / Android runtime logs.

Testing stopped after these checks. No comprehensive unit, integration, E2E, payment-provider, iOS or edge-case QA was performed.

The phone was left on Home. Docker services and Metro were left running. [Home screen captured on the phone](home-android.png).
