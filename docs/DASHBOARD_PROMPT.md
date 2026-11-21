# Prompt: consultations, reminders and dashboards for CareCompass Pro

Paste this into an AI coding assistant (Claude Code, Cursor, and so on) together with the repository.
It describes what was built in this version, so it doubles as the specification.

---

You are working in CareCompass Pro: Node/Express/MongoDB API in `server/`, React/Vite/Tailwind web app in `web/`.
Roles: PATIENT, DIETITIAN, CARE_TEAM, LEAD_DOCTOR. Follow the existing patterns (zod validation, `asyncHandler`, `need()`,
`requireRole`, audit log, TanStack Query, the UI kit in `web/src/components/ui.jsx`).

## Goal
Give every role a professional, animated, mobile-friendly dashboard for dietitian consultations, like the Fitterfly app,
with reminders, and let the app be installed or downloaded on phones.

## Data
- `Appointment`: patient, dietitian, startsAt (UTC), durationMin (10-120), mode VIDEO/PHONE/IN_PERSON, meetingLink, topic,
  status SCHEDULED/COMPLETED/CANCELLED/NO_SHOW, rescheduleCount, history[{from,to,by,reason,at}], cancelReason, outcomeNotes (clinical:
  never sent to patients or care team), createdBy.
- `Notification`: user, kind (REMINDER, AGENDA, BOOKED, RESCHEDULED, CANCELLED, OPEN_SLOT), title, body, link, appointment,
  dedupeKey (unique per user), readAt.

## Rules (pure functions in `server/src/domain/appointments.js`, unit-tested)
- A patient can only be booked if they have an open dietitian assignment. A dietitian can only book their own patients.
- No overlap for the dietitian or the patient (back-to-back is fine). Times in the past are rejected.
- Working hours Mon-Sat 09:00-18:00 in 30-minute slots. Cancelled meetings free their slot; scheduled, completed and no-show keep it.
- Dietitians manage their own meetings; care team and lead doctor manage any; only dietitian and lead doctor close a meeting;
  a patient may only cancel their own.
- Days are computed in the clinic time zone (`config.tz`, default Asia/Kolkata), including DST-safe day boundaries.

## API
`GET /appointments/mine?scope=upcoming|past` (patient, dietitian) · `GET /appointments/schedule?date=` (care team, lead doctor:
every dietitian with meetings, stats and `openSlots`) · `GET /appointments/assignable` · `POST /appointments` ·
`PATCH /appointments/:id/reschedule|cancel|complete` · `GET /notifications` (also creates due reminders) · `POST /notifications/read`.

## Notifications
- Dietitian and patient: a reminder `REMINDER_LEAD_MIN` (default 30) minutes before each meeting, a once-a-day agenda note,
  and an immediate note when a meeting is booked, rescheduled or cancelled by someone else.
- Care team: one daily digest of open slots (today and tomorrow, per dietitian) and an immediate "Slot opened up" note when a meeting is
  cancelled or moved. Duplicates are prevented with `dedupeKey`.
- Reminders are created when the app polls (every 60 s), so no worker is needed. The bell shows a badge, toasts new items, and can
  raise desktop alerts after the user allows them.

## Dashboards
- Dietitian `/agenda`: greeting, live "next consultation" card with countdown and Join, stat tiles (animated counters), today's
  timeline with a pulsing "now" marker, coming-up groups by day, recently completed, schedule/reschedule/cancel/close actions.
- Care team and lead doctor `/schedule`: day navigator, totals, a day-view grid (rows = dietitians, hours across, blocks coloured by status,
  rescheduled marked, open slots clickable to book, "now" line), and an agenda card per dietitian with open-slot chips.
- Patient: Home shows the next consultation with countdown, a reminder banner inside 30 minutes, today's diet plan and food diary;
  `/meetings` lists today, upcoming and past consultations with Join and Cancel.
- Motion: staggered reveal, count-up numbers, pulsing live indicators, floating glow; everything respects `prefers-reduced-motion`.

## Mobile and app downloads
- Phone layout: bottom tab bar with a "More" sheet (extra pages, profile, sign out, app downloads), safe-area padding, touch-sized controls.
- Installable web app (manifest, icons, service worker, "Install web app" button where the browser allows it).
- "Download for Android (APK)" and "Download for iPhone (iOS)" buttons on Login, Profile, patient Home and the mobile More sheet.
  Both point to the project's GitHub Actions page for now; override with `VITE_ANDROID_APK_URL` and `VITE_IOS_APP_URL`.

## Done when
`npm test` passes in `server/`, `npm run build` passes in `web/`, and each role can complete its flow on a 390 px wide screen.
