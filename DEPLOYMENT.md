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

## 5. Android and iPhone apps (built by GitHub Actions)
Two workflows build the apps from the same `web/` code with Capacitor:

| Workflow | Runs on | Output |
|---|---|---|
| `.github/workflows/android.yml` | every push to `main` touching `web/`, or **Actions → Build Android app → Run workflow** | `CareCompass.apk` on the rolling release **android-latest** (also an artifact) |
| `.github/workflows/ios.yml` | same | simulator build on release **ios-latest**; a real signed `CareCompass.ipa` only if you add Apple secrets |

One-time setup:
1. **Render:** add `https://localhost` to `CLIENT_ORIGINS` (comma-separated, keep your Vercel URL). Leave `COOKIE_SAMESITE` alone: the apps send `X-Client: native` and keep their own rotating refresh token, so they need no cross-site cookies.
2. **GitHub → Settings → Actions → General → Workflow permissions:** choose *Read and write permissions* (the workflows publish releases).
3. Optional repo variable `API_URL` (Settings → Secrets and variables → Actions → Variables) if your API is not `https://carecompass-pro.onrender.com/api/v1`.
4. Push. The Android build takes about 8 to 12 minutes the first time. The APK link is
   `https://github.com/<owner>/<repo>/releases/download/android-latest/CareCompass.apk`
   (the repository must be **public** for anyone to download; on a private repo only signed-in collaborators can).
5. The website's **Download for Android / iPhone** buttons already point at those releases. Override with `VITE_ANDROID_APK_URL` / `VITE_IOS_APP_URL` on Vercel.
6. Android installs: open the APK on the phone and allow "install unknown apps". These are debug-signed builds, fine for testing. For Google Play you need a release keystore and an AAB build.

### iOS: what is and is not possible without an Apple Developer account
- Without the paid account ($99/year) the workflow still builds the iOS project and a **simulator** build, which proves it compiles. That build cannot be installed on a real iPhone.
- iPhone users can meanwhile use the website: Safari → Share → **Add to Home Screen** (it installs as an app).
- To ship a real iPhone app, enrol in the Apple Developer Program, then add these repository **secrets** and the workflow signs and (optionally) uploads to TestFlight automatically:

| Secret | What it is |
|---|---|
| `IOS_CERT_P12_BASE64` | Apple Distribution certificate exported as .p12, base64-encoded |
| `IOS_CERT_PASSWORD` | the .p12 password |
| `IOS_PROFILE_BASE64` | provisioning profile for bundle id `com.carecompass.app`, base64-encoded |
| `APPLE_TEAM_ID` | your 10-character team id |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_BASE64` | App Store Connect API key (only for the TestFlight upload) |

  Then set `VITE_IOS_APP_URL` on Vercel to your TestFlight public link. (Base64 on Windows: `certutil -encode file out.txt`, or on Mac/Linux `base64 -i file`.)
- Neither workflow has been run yet. Expect to fix small things on the first run (mostly signing).
- Razorpay checkout inside the apps should be tested on a real device before you rely on it.

## Plan Studio (no-code automated diet plans)
Lead Doctor → **Plan Studio**. Everything the generator does is configured there, with no code:
- **Rules**: drag blocks (conditions such as BMI, age, conditions, allergies, goals; actions such as change calories by %, set macro split, leave out foods, add a note, flag for doctor) into IF / THEN rules. Drag the grip to reorder; rules run top to bottom.
- **Meals**: drag to reorder the day's meals, set times and each meal's share of calories.
- **Formulas**: BMR formula, activity factors, calorie limits, macro split, water per kg, plan title.
- **Allergies**: which food words each allergy removes.
- **Test**: run the on-screen rules on a real or sample patient before saving. Nothing is stored.

Flow: when the care team assigns a dietitian, the system generates the patient's first plan and puts it in **Reviews** (badge "Auto", plus "flagged" if a rule asked for doctor attention). The Lead approves with one click, or requests changes (the dietitian can edit it or press *Generate automatically* again). Nothing reaches the patient before approval. The starter rules are examples, not clinical advice: review them with your clinical team.
Use **Generate for patients without a plan** to backfill existing assigned patients.

## Consultations, reminders and app downloads

| Where | Variable | Purpose |
|---|---|---|
| Render (API) | `REMINDER_LEAD_MIN` | Minutes before a consultation that reminders are created (default 30) |
| Vercel (web) | `VITE_TZ` | Clinic time zone for showing times (default `Asia/Kolkata`; keep it equal to the API's `TZ`) |
| Vercel (web) | `VITE_ANDROID_APK_URL` | Android download link (default: the `android-latest` release APK) |
| Vercel (web) | `VITE_IOS_APP_URL` | iOS download link (default: the `ios-latest` release; later your TestFlight link) |

Demo consultations are created on startup when `DEMO_DATA=seed` and there are no appointments yet.
Reminders are created when people use the app (the bell checks every minute), so no background worker is needed. For reminders
while the app is closed you would add web push, email or WhatsApp later.
