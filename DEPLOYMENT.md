# Deployment guide

Order matters: database → API → Razorpay webhook → web → Android.

## 1. MongoDB Atlas
1. Create a cluster (M10+ for production so you get backups; M0 is fine for testing).
2. **Database Access** → add a user with read/write on the `carecompass` database.
3. **Network Access** → allow Render's outbound IPs (Render dashboard → your service → Connect → Outbound) or, for testing only, `0.0.0.0/0`.
4. Copy the connection string into `MONGODB_URI` (append `/carecompass`).
5. Production: enable continuous backups and encryption at rest (default on Atlas).

## 2. Render (API)
1. Push this repo to GitHub. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml`.
2. Fill the `sync: false` variables:
   - `MONGODB_URI`
   - `PHI_ENCRYPTION_KEY`: generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` and **store it in a password manager**. Losing it makes encrypted medications/lab notes unreadable.
   - `CLIENT_ORIGINS`: your Vercel URL(s), comma separated, e.g. `https://carecompass.vercel.app`
   - `RAZORPAY_*` (step 3), `ADMIN_*` (first lead doctor).
3. Deploy, then open the service **Shell** and run `npm run seed:admin`. This creates the lead doctor (forced to change password at first login) and three default plans.
4. Check `https://<service>.onrender.com/healthz` returns `{"ok":true,"db":true}`.
5. Use a paid instance. Free instances sleep, which delays webhook processing.

## 3. Razorpay
1. Dashboard → **Account & Settings → API Keys**. Start with **Test mode** keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. **Webhooks → Add**: URL `https://<service>.onrender.com/api/v1/webhooks/razorpay`, set a secret (= `RAZORPAY_WEBHOOK_SECRET`), and tick:
   `subscription.authenticated, activated, charged, pending, halted, cancelled, completed` and `payment.failed`.
3. Make sure **Subscriptions** is enabled on your account (it may need activation for live mode).
4. Test: sign up as a patient, have the care team confirm a plan, then subscribe with Razorpay's test UPI/cards. Confirm the membership moves to *Pending Dietitian Assignment*.
5. Going live: complete KYC, switch to Live keys and a live webhook (separate secret), redeploy.

How plans map: each `MembershipPlan` becomes a Razorpay monthly plan on first checkout (`total_count` = number of months). Razorpay plans are immutable, so the app only lets you add new plans, not change a price.

## 4. Vercel (web)
1. **Import** the repo, set **Root Directory** to `web`. Framework preset: Vite.
2. Edit `web/vercel.json`: replace `YOUR-RENDER-SERVICE.onrender.com` with your Render hostname.
3. Leave `VITE_API_URL` empty. The browser calls `/api/v1/...` on Vercel, which proxies to Render, so the refresh cookie stays first-party.
4. Deploy. Add the Vercel URL to `CLIENT_ORIGINS` on Render if you haven't.
5. Custom domain: add it in Vercel, then append it to `CLIENT_ORIGINS`.

## 5. Android app (Capacitor)
The native app has no Vercel proxy, so it talks to Render directly.
1. On Render set `CLIENT_ORIGINS` to include `https://localhost` and set `COOKIE_SAMESITE=none` (cookies are Secure over HTTPS).
2. In `web/.env.production` set `VITE_API_URL=https://<service>.onrender.com/api/v1`.
3. Build and open Android Studio:
   ```bash
   cd web
   npm install
   npx cap add android        # first time only
   npm run android:sync
   npm run android:open       # Run ▶ on a device, or Build → Generate Signed Bundle for Play Store
   ```
4. Payments in the app open Razorpay's hosted subscription page in the system browser; the webhook activates the membership and the app refreshes when you return.
5. Hardening: add `android:allowBackup="false"` and `FLAG_SECURE` in the native project, add biometric unlock, and complete Google Play's Data Safety form and a privacy policy.

> Note: with `COOKIE_SAMESITE=none` the web app should also call the API directly or you should use separate Render services for web and mobile; do not weaken the cookie for the web deployment if you do not need to.

## 6. Before real patient data
- Sign BAAs/DPAs with hosting vendors (Render, Atlas, Vercel, Razorpay) and review India's DPDP Act 2023 and your hospital's compliance requirements.
- Rotate secrets; keep `PHI_ENCRYPTION_KEY` in a secret manager and plan key rotation.
- Add MFA for staff accounts, email delivery for staff onboarding (currently the temporary password is shown once in the admin UI), and file upload (lab reports) to encrypted object storage.
- Set up log shipping and uptime alerts on `/healthz`; take and test database restores.
- Have a clinician and a security reviewer sign off. This codebase is a strong starting point; it is not a substitute for a compliance review.
