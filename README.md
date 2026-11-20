# CareCompass: Hospital & Dietitian Care Management

Responsive web app + Android app for a lead doctor, dietitians, a membership/care team and patients.

| Layer | Tech | Hosted on |
|---|---|---|
| Web + Android UI | React 18, Vite, Tailwind, TanStack Query; Capacitor wraps the same build for Android | **Vercel** (web) |
| API | Node 20, Express, Zod, JWT (15 min) + rotating httpOnly refresh cookie | **Render** |
| Database | MongoDB via Mongoose (AES-256-GCM field encryption for medications, lab notes, notes) | **MongoDB Atlas** |
| Subscriptions | Razorpay Subscriptions (monthly plans) + signed webhooks | **Razorpay** |

```
Browser ──► Vercel (static React app)
              │  /api/*  rewrite (same-site, so the refresh cookie is first-party)
              ▼
           Render: Express API ◄── Razorpay webhooks (HMAC verified, idempotent)
              │
              ▼
           MongoDB Atlas
```

## Care workflow (enforced by the API, not just the UI)

**Membership:** `PENDING_ASSISTANCE → PLAN_SELECTED → ACTIVE → PENDING_DIETITIAN_ASSIGNMENT → ASSIGNED → EXPIRED`, with `CANCELLED` allowed from any live state. Guards: a plan must exist; `ACTIVE` needs payment `PAID`; `ASSIGNED` needs an open assignment, a submitted history and dietitian capacity. Every transition is appended to the membership's event log and the audit log.

**Diet plan:** `DRAFT → IN_REVIEW → ACTIVE → ARCHIVED`. Only the assigned dietitian edits a draft; only the lead doctor approves or requests changes (note required). One `ACTIVE` plan per patient is enforced by a partial unique index; approving a revision archives the old plan.

**Payments:** the patient subscribes via Razorpay Checkout → `/me/subscription/verify` checks the signature → membership activates. The `subscription.charged` webhook does the same through one atomic, idempotent function, so whichever arrives first wins and the other is a no-op. Offline (cash/UPI) payments can be recorded by the care team.

## Access control

| | Patient | Care team | Dietitian | Lead doctor |
|---|---|---|---|---|
| Own history, plan, tracking | ✔ | | | |
| Patient demographics, goals, allergies | own | all | assigned only | all |
| Medications and lab notes | own | **hidden** | assigned only | all |
| Plans catalog, confirm plan, payment, assign | | ✔ | | ✔ |
| Build diet plan | | | assigned only | |
| Approve plan, analytics, audit log, staff admin | | | | ✔ |

## Run locally

```bash
# 1. API
cd server && cp .env.example .env     # fill MONGODB_URI + secrets
npm install
npm run seed:admin                    # lead doctor + 3 membership plans
npm run seed:demo                     # optional demo patients/dietitians (password: Demo@Care2026)
npm run dev                           # http://localhost:8080

# 2. Web (second terminal)
cd web && npm install && npm run dev  # http://localhost:5173 (proxies /api to :8080)

# 3. Tests (no database needed)
cd server && npm test
```

Use a MongoDB Atlas free cluster for local work (diet-plan approval uses a transaction, which needs a replica set; Atlas has one; the code falls back gracefully on a standalone `mongod`).

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the step-by-step guide (Atlas → Render → Razorpay → Vercel → Android).
