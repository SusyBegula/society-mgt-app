# Supabase & Production Setup Guide

This guide walks you through connecting **Neighbourly** to **Supabase** (PostgreSQL & Storage bucket) and deploying it for your client demonstration.

---

## 1. Create a Supabase Project

1. Log in to [Supabase](https://supabase.com) and create a new project (choose the region closest to your users, e.g., `ap-south-1 Mumbai`).
2. Note down your **Database Password**.

---

## 2. Configure Database Connection

Supabase provides two connection types in **Project Settings $\rightarrow$ Database $\rightarrow$ Connection string**:

### Recommended for API & Migrations: Session Pooler (Port 5432)
```env
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
```

### For High-Concurrency / Serverless: Transaction Pooler (Port 6543)
```env
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

> [!TIP]
> Always ensure `?sslmode=require` is at the end of the `DATABASE_URL` string so psycopg initiates a secure TLS connection.

---

## 3. Create Supabase Storage Bucket

1. In the Supabase Dashboard, go to **Storage** $\rightarrow$ **New Bucket**.
2. Name the bucket `society` (or match your `SUPABASE_BUCKET` variable).
3. Set the bucket to **Private** (recommended; the backend securely issues authenticated downloads).
4. Retrieve your **Project URL** and **Service Role Key**:
   - Go to **Project Settings** $\rightarrow$ **API**.
   - Copy **Project URL** (e.g., `https://[PROJECT-REF].supabase.co`).
   - Copy **service_role secret** (this key has permission to bypass RLS and read/write to the storage bucket from your backend).

---

## 4. Update `backend/.env`

Update your `backend/.env` with your Supabase credentials:

```env
# Set to 'staging' for client demo or 'production' for live release
APP_ENV=staging

# Supabase PostgreSQL connection
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require

# Supabase Storage Configuration
STORAGE_BACKEND=supabase
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_SERVICE_KEY=[YOUR-SERVICE-ROLE-KEY]
SUPABASE_BUCKET=society

# Demo Flags (allows fixed OTP '123456' and simulated payments for the demo)
ALLOW_DEMO_AUTH=true
ALLOW_DEMO_PAYMENT=true
DEV_OTP=123456
PAYMENT_PROVIDER=development
```

---

## 5. Run Migrations & Seed Supabase

Once `DATABASE_URL` points to Supabase, run:

### Apply Database Schema:
```bash
cd backend
.venv/bin/alembic upgrade head
```
*(Or via Docker: `docker compose exec api alembic upgrade head`)*

### Seed Demo Data to Supabase:
```bash
.venv/bin/python -m app.seed --force
```
This will:
- Create the demo resident (`+91 9876543210` / `123456`).
- Create demo societies (*Green Heights* and *Sunrise Residency*).
- Pre-populate maintenance dues, complaints, visitors, notices, and amenities.
- **Upload sample society guideline PDFs directly into your Supabase Storage bucket**.

---

## 6. Run the Backend API

Because PostgreSQL is now hosted on Supabase, you do not need to run local PostgreSQL in Docker.

### Option A: Local Python process
```bash
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Option B: Docker Compose
```bash
docker compose up -d --build
```
*(The `db` service is now optional; Docker Compose will run the `api` container connected directly to Supabase).*

---

## 7. Prepare Mobile App for Client Demo

In `mobile/.env`:
```env
# Point to your publicly accessible backend URL (e.g. Render, Railway, ngrok, or local IP)
EXPO_PUBLIC_API_URL=https://your-api-domain.com
```

### Building for the Client:
1. **Physical Phone Demo (USB/Wi-Fi)**:
   ```bash
   cd mobile
   npm run android
   ```
2. **Standalone Shareable APK (EAS Build)**:
   ```bash
   npx eas-cli build -p android --profile preview
   ```
   This generates a downloadable `.apk` file that your client can install on any Android device without development tools.
