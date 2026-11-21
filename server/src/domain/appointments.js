/** Pure scheduling rules (no database), unit-tested in tests/appointments.test.js */

export const APPT_MODES = ['VIDEO', 'PHONE', 'IN_PERSON'];
export const APPT_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const min = (n) => n * 60_000;

/** Do two meetings overlap? Back-to-back (one ends exactly when the next starts) is allowed. */
export function overlaps(aStart, aDurMin, bStart, bDurMin) {
  const a0 = new Date(aStart).getTime(), a1 = a0 + min(aDurMin);
  const b0 = new Date(bStart).getTime(), b1 = b0 + min(bDurMin);
  return a0 < b1 && b0 < a1;
}

export const findConflict = (list, startsAt, durationMin) => list.find((x) => overlaps(x.startsAt, x.durationMin, startsAt, durationMin));

/** Minutes the zone is ahead of UTC at the given instant (IST = 330). */
export function tzOffsetMin(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(utcMs);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** The UTC instant at which the given calendar day (YYYY-MM-DD) starts in `tz`. */
export function zonedStartOfDay(dateStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const first = guess - tzOffsetMin(guess, tz) * 60_000;
  return new Date(guess - tzOffsetMin(first, tz) * 60_000);
}

export function dayRange(dateStr, tz) {
  const next = new Date(Date.parse(`${dateStr}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return [zonedStartOfDay(dateStr, tz), zonedStartOfDay(next, tz)];
}

/** Reminder window: upcoming, scheduled, and starting within `leadMin` minutes. */
export const reminderDue = (appt, now, leadMin) => {
  if (appt.status !== 'SCHEDULED') return false;
  const diff = new Date(appt.startsAt).getTime() - now;
  return diff > -min(5) && diff <= min(leadMin);
};

export function humanLead(startsAt, now) {
  const m = Math.round((new Date(startsAt).getTime() - now) / 60_000);
  if (m <= 0) return 'now';
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return `in ${h} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}

/** Who may change a meeting? Dietitians only their own; care team and lead doctor any. Patients may only cancel their own. */
export function canManageAppointment(user, appt, action) {
  const owner = String(appt.dietitian?._id || appt.dietitian?.id || appt.dietitian) === String(user.id);
  const mine = String(appt.patient?._id || appt.patient?.id || appt.patient) === String(user.id);
  if (user.role === 'LEAD_DOCTOR' || user.role === 'CARE_TEAM') return action !== 'complete' || user.role === 'LEAD_DOCTOR';
  if (user.role === 'DIETITIAN') return owner;
  if (user.role === 'PATIENT') return mine && action === 'cancel';
  return false;
}

/** Consultation hours used to work out open slots (Mon to Sat, 09:00 to 18:00, 30-minute slots). */
export const WORK = { startMin: 9 * 60, endMin: 18 * 60, slotMin: 30, days: [1, 2, 3, 4, 5, 6] };

/** Calendar weekday of a YYYY-MM-DD date (0 = Sunday), independent of the server's own zone. */
export const weekdayOf = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay();

/**
 * Free consultation slots for one dietitian on one day. Cancelled meetings free their slot;
 * scheduled, completed and no-show meetings keep it. Slots that have already started are skipped.
 */
export function openSlots({ date, tz, appts, now = Date.now(), work = WORK }) {
  if (!work.days.includes(weekdayOf(date))) return [];
  const dayStart = zonedStartOfDay(date, tz).getTime();
  const busy = appts.filter((a) => a.status !== 'CANCELLED');
  const out = [];
  for (let m = work.startMin; m + work.slotMin <= work.endMin; m += work.slotMin) {
    const start = dayStart + m * 60_000;
    if (start <= now) continue;
    if (!busy.some((a) => overlaps(a.startsAt, a.durationMin, start, work.slotMin))) out.push(new Date(start));
  }
  return out;
}
