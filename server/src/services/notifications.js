import { Appointment, Notification, User } from '../models/index.js';
import { config } from '../config.js';
import { reminderDue, humanLead, dayRange, openSlots } from '../domain/appointments.js';
import { todayStr } from '../utils/dates.js';

export const REMINDER_LEAD_MIN = Number(process.env.REMINDER_LEAD_MIN) || 30;

const timeLabel = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: config.tz });
export const modeLabel = { VIDEO: 'Video call', PHONE: 'Phone call', IN_PERSON: 'In person' };

/** Creates a notification once. Duplicate dedupeKey for the same user is silently ignored. */
export async function notify(user, { kind, title, body = '', link = '', appointment, dedupeKey }) {
  try {
    return await Notification.create({ user, kind, title, body, link, appointment, dedupeKey });
  } catch (e) {
    if (e?.code === 11000) return null;
    console.error('notify failed', e.message);
    return null;
  }
}

/**
 * Generated on demand when the person opens the app or the bell polls (no background worker needed):
 *  - a morning agenda note, once per day, if they have meetings today
 *  - a reminder when a meeting is within REMINDER_LEAD_MIN minutes (once per meeting time)
 */
export async function ensureDueReminders(user) {
  if (user.role === 'CARE_TEAM') return ensureOpenSlotDigest(user);
  if (!['PATIENT', 'DIETITIAN'].includes(user.role)) return;
  const now = Date.now();
  const field = user.role === 'DIETITIAN' ? 'dietitian' : 'patient';
  const [dayStart, dayEnd] = dayRange(todayStr(config.tz), config.tz);
  const upcoming = await Appointment.find({ [field]: user.id, status: 'SCHEDULED', startsAt: { $gte: new Date(now - 5 * 60_000), $lt: dayEnd } })
    .sort({ startsAt: 1 })
    .populate('patient dietitian', 'name');
  const link = user.role === 'DIETITIAN' ? '/agenda' : '/meetings';
  const todays = upcoming.filter((a) => a.startsAt >= dayStart);
  if (todays.length) {
    const first = todays[0];
    await notify(user.id, {
      kind: 'AGENDA',
      title: todays.length === 1 ? 'You have 1 consultation today' : `You have ${todays.length} consultations today`,
      body: `First one at ${timeLabel(first.startsAt)} with ${(user.role === 'DIETITIAN' ? first.patient : first.dietitian)?.name || 'your care team'}.`,
      link,
      dedupeKey: `agenda:${todayStr(config.tz)}`,
    });
  }
  for (const a of todays.filter((x) => reminderDue(x, now, REMINDER_LEAD_MIN))) {
    const other = (user.role === 'DIETITIAN' ? a.patient : a.dietitian)?.name || 'your care team';
    await notify(user.id, {
      kind: 'REMINDER',
      title: `Consultation ${humanLead(a.startsAt, now)}`,
      body: `${a.topic} with ${other} at ${timeLabel(a.startsAt)} · ${modeLabel[a.mode]}`,
      link,
      appointment: a.id,
      dedupeKey: `rem:${a.id}:${a.startsAt.getTime()}`,
    });
  }
}

const firstName = (n = '') => n.split(' ')[0];
const dateLabel = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Care team: one digest per day listing every dietitian's open consultation slots for today (what is left)
 * and tomorrow, so they can fill them. Created when a care team member opens the app.
 */
export async function ensureOpenSlotDigest(user) {
  const today = todayStr(config.tz);
  if (await Notification.exists({ user: user.id, dedupeKey: `openslots:${today}` })) return; // already sent today
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const [from] = dayRange(today, config.tz);
  const [, to] = dayRange(tomorrow, config.tz);
  const [dietitians, appts] = await Promise.all([
    User.find({ role: 'DIETITIAN' }).select('name').sort({ name: 1 }),
    Appointment.find({ startsAt: { $gte: from, $lt: to }, status: { $ne: 'CANCELLED' } }).select('dietitian startsAt durationMin status'),
  ]);
  if (!dietitians.length) return;
  const parts = [];
  let total = 0;
  for (const [label, date] of [['Today', today], ['Tomorrow', tomorrow]]) {
    const row = dietitians.map((d) => [firstName(d.name), openSlots({ date, tz: config.tz, appts: appts.filter((a) => String(a.dietitian) === String(d.id)) }).length]).filter(([, n]) => n > 0);
    total += row.reduce((s, [, n]) => s + n, 0);
    if (row.length) parts.push(`${label}: ${row.map(([n, c]) => `${n} ${c}`).join(', ')}`);
  }
  if (!total) return;
  await notify(user.id, { kind: 'OPEN_SLOT', title: 'Open consultation slots', body: `${parts.join(' · ')} open slots.`.slice(0, 400), link: '/schedule', dedupeKey: `openslots:${today}` });
}

/** A cancelled or moved meeting frees a slot: tell the care team straight away so it can be refilled. */
export async function announceFreedSlot(appt, reason) {
  if (new Date(appt.startsAt).getTime() <= Date.now()) return;
  const team = await User.find({ role: 'CARE_TEAM' }).select('_id');
  const name = appt.dietitian?.name || 'A dietitian';
  const key = dayStr(appt.startsAt);
  await Promise.all(team.map((u) => notify(u._id, {
    kind: 'OPEN_SLOT',
    title: 'Slot opened up',
    body: `${name} is free at ${timeLabel(appt.startsAt)} on ${dateLabel(key)} (${reason}).`,
    link: `/schedule?date=${key}`,
    dedupeKey: `freed:${appt.id}:${new Date(appt.startsAt).getTime()}`,
  })));
}
const dayStr = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: config.tz });
