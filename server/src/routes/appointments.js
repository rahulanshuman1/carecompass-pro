import { Router } from 'express';
import { z } from 'zod';
import { Appointment, Assignment, User } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId } from '../middleware/index.js';
import { APPT_MODES, WORK, canManageAppointment, dayRange, findConflict, openSlots } from '../domain/appointments.js';
import { audit } from '../services/audit.js';
import { announceFreedSlot, modeLabel, notify } from '../services/notifications.js';
import { config } from '../config.js';
import { todayStr } from '../utils/dates.js';

const r = Router();
r.use(authenticate);

const noteSelect = (user) => (['DIETITIAN', 'LEAD_DOCTOR'].includes(user.role) ? '' : '-outcomeNotes'); // outcome notes are clinical
const POP = [{ path: 'patient', select: 'name' }, { path: 'dietitian', select: 'name specialty' }];
const when = (d) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: config.tz });
const iso = z.string().datetime({ offset: true, message: 'Choose a valid date and time.' });

async function loadAppt(req, action) {
  const a = await Appointment.findById(req.params.id).populate(POP);
  need(a, 404, 'Meeting not found.', 'NOT_FOUND');
  need(canManageAppointment(req.user, a, action), 403, 'You cannot do that for this meeting.', 'FORBIDDEN');
  return a;
}

/** Clashes for the dietitian or the patient around the proposed slot. */
async function assertNoConflict({ dietitian, patient, startsAt, durationMin, ignoreId }) {
  const around = { startsAt: { $gt: new Date(startsAt.getTime() - 4 * 3600e3), $lt: new Date(startsAt.getTime() + durationMin * 60e3) }, status: 'SCHEDULED', ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) };
  const [d, p] = await Promise.all([Appointment.find({ ...around, dietitian }), Appointment.find({ ...around, patient })]);
  const dc = findConflict(d, startsAt, durationMin);
  need(!dc, 409, `The dietitian already has a meeting at ${when(dc?.startsAt)}.`, 'SLOT_TAKEN');
  const pc = findConflict(p, startsAt, durationMin);
  need(!pc, 409, `The patient already has a meeting at ${when(pc?.startsAt)}.`, 'SLOT_TAKEN');
}

/* Patients that can be booked: those with an open dietitian assignment (a dietitian sees only their own) */
r.get('/assignable', requireRole('DIETITIAN', 'CARE_TEAM', 'LEAD_DOCTOR'), asyncHandler(async (req, res) => {
  const q = { isOpen: true, ...(req.user.role === 'DIETITIAN' ? { dietitian: req.user.id } : {}) };
  const list = await Assignment.find(q).populate('patient dietitian', 'name').lean({ getters: true });
  res.json({ items: list.map((a) => ({ patientId: String(a.patient._id), patient: a.patient.name, dietitianId: String(a.dietitian._id), dietitian: a.dietitian.name })).sort((x, y) => x.patient.localeCompare(y.patient)) });
}));

/* My meetings (patient or dietitian): ?scope=upcoming (default, from the start of today) or past */
r.get('/mine', requireRole('PATIENT', 'DIETITIAN'), asyncHandler(async (req, res) => {
  const field = req.user.role === 'PATIENT' ? 'patient' : 'dietitian';
  const [dayStart] = dayRange(todayStr(config.tz), config.tz);
  const past = req.query.scope === 'past';
  const items = await Appointment.find({ [field]: req.user.id, startsAt: past ? { $lt: dayStart } : { $gte: dayStart } })
    .select(noteSelect(req.user)).sort({ startsAt: past ? -1 : 1 }).limit(past ? 20 : 80).populate(POP);
  res.json({ items, tz: config.tz, now: new Date().toISOString() });
}));

/* Clinic schedule for one day: every dietitian with their meetings (care team and lead doctor) */
r.get('/schedule', requireRole('CARE_TEAM', 'LEAD_DOCTOR'), asyncHandler(async (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayStr(config.tz)).parse(req.query.date || undefined);
  const [from, to] = dayRange(date, config.tz);
  const [dietitians, appts] = await Promise.all([
    User.find({ role: 'DIETITIAN' }).select('name specialty').sort({ name: 1 }),
    Appointment.find({ startsAt: { $gte: from, $lt: to } }).select(noteSelect(req.user)).sort({ startsAt: 1 }).populate(POP),
  ]);
  const by = new Map(dietitians.map((d) => [String(d.id), []]));
  for (const a of appts) by.get(String(a.dietitian?.id))?.push(a);
  const rows = dietitians.map((d) => {
    const list = by.get(String(d.id));
    const live = list.filter((a) => a.status !== 'CANCELLED');
    const open = openSlots({ date, tz: config.tz, appts: list }).map((x) => x.toISOString());
    return { id: d.id, name: d.name, specialty: d.specialty, appointments: list, openSlots: open, stats: { total: live.length, completed: list.filter((a) => a.status === 'COMPLETED').length, upcoming: list.filter((a) => a.status === 'SCHEDULED' && a.startsAt > new Date()).length, rescheduled: list.filter((a) => a.rescheduleCount > 0).length, cancelled: list.filter((a) => a.status === 'CANCELLED').length, minutes: live.reduce((s, a) => s + a.durationMin, 0) } };
  });
  res.json({ date, tz: config.tz, now: new Date().toISOString(), work: WORK, dietitians: rows, totals: { meetings: appts.filter((a) => a.status !== 'CANCELLED').length, completed: appts.filter((a) => a.status === 'COMPLETED').length, rescheduled: appts.filter((a) => a.rescheduleCount > 0).length, cancelled: appts.filter((a) => a.status === 'CANCELLED').length } });
}));

const createBody = z.object({
  patientId: z.string().regex(/^[a-f\d]{24}$/i),
  startsAt: iso,
  durationMin: z.coerce.number().int().min(10).max(120).default(30),
  mode: z.enum(APPT_MODES).default('VIDEO'),
  meetingLink: z.string().trim().url('Enter a valid meeting link.').max(300).or(z.literal('')).default(''),
  topic: z.string().trim().min(2).max(120).default('Diet consultation'),
});

r.post('/', requireRole('DIETITIAN', 'CARE_TEAM', 'LEAD_DOCTOR'), validate(createBody), asyncHandler(async (req, res) => {
  const b = req.body;
  const assignment = await Assignment.findOne({ patient: b.patientId, isOpen: true }).populate('patient', 'name').populate('dietitian', 'name');
  need(assignment, 409, 'This patient has no dietitian yet. Assign one first.', 'NO_ASSIGNMENT');
  need(req.user.role !== 'DIETITIAN' || String(assignment.dietitian._id) === req.user.id, 403, 'You can only schedule your own patients.', 'FORBIDDEN');
  const startsAt = new Date(b.startsAt);
  need(startsAt.getTime() > Date.now() - 5 * 60_000, 400, 'Choose a time in the future.', 'VALIDATION');
  need(b.mode !== 'VIDEO' || b.meetingLink, 400, 'Add a meeting link for video consultations.', 'VALIDATION');
  await assertNoConflict({ dietitian: assignment.dietitian._id, patient: assignment.patient._id, startsAt, durationMin: b.durationMin });
  const a = await Appointment.create({ patient: assignment.patient._id, dietitian: assignment.dietitian._id, startsAt, durationMin: b.durationMin, mode: b.mode, meetingLink: b.meetingLink, topic: b.topic, createdBy: req.user.id });
  await audit(req, 'APPOINTMENT_CREATED', 'Appointment', a._id, when(startsAt));
  const text = `${b.topic} · ${when(startsAt)} · ${modeLabel[b.mode]}`;
  await notify(assignment.patient._id, { kind: 'BOOKED', title: 'Consultation booked', body: `${text} with ${assignment.dietitian.name}`, link: '/meetings', appointment: a._id });
  if (String(assignment.dietitian._id) !== req.user.id) await notify(assignment.dietitian._id, { kind: 'BOOKED', title: 'New consultation scheduled', body: `${text} with ${assignment.patient.name}`, link: '/agenda', appointment: a._id });
  res.status(201).json({ appointment: await a.populate(POP) });
}));

r.patch('/:id/reschedule', validObjectId, requireRole('DIETITIAN', 'CARE_TEAM', 'LEAD_DOCTOR'), validate(z.object({ startsAt: iso, durationMin: z.coerce.number().int().min(10).max(120).optional(), reason: z.string().trim().max(200).default('') })), asyncHandler(async (req, res) => {
  const a = await loadAppt(req, 'reschedule');
  need(a.status === 'SCHEDULED', 409, 'Only upcoming meetings can be rescheduled.', 'INVALID_STATE');
  const startsAt = new Date(req.body.startsAt);
  need(startsAt.getTime() > Date.now() - 5 * 60_000, 400, 'Choose a time in the future.', 'VALIDATION');
  const durationMin = req.body.durationMin || a.durationMin;
  await assertNoConflict({ dietitian: a.dietitian._id, patient: a.patient._id, startsAt, durationMin, ignoreId: a._id });
  const from = a.startsAt;
  a.history.push({ from, to: startsAt, by: req.user.id, reason: req.body.reason });
  a.set({ startsAt, durationMin, rescheduleCount: a.rescheduleCount + 1 });
  await a.save();
  await announceFreedSlot({ id: a.id, startsAt: from, dietitian: a.dietitian }, 'rescheduled');
  await audit(req, 'APPOINTMENT_RESCHEDULED', 'Appointment', a._id, `${when(from)} -> ${when(startsAt)}`);
  const text = `Moved from ${when(from)} to ${when(startsAt)}${req.body.reason ? `. Reason: ${req.body.reason}` : ''}`;
  if (String(a.patient._id) !== req.user.id) await notify(a.patient._id, { kind: 'RESCHEDULED', title: 'Consultation rescheduled', body: text, link: '/meetings', appointment: a._id });
  if (String(a.dietitian._id) !== req.user.id) await notify(a.dietitian._id, { kind: 'RESCHEDULED', title: 'Consultation rescheduled', body: `${a.patient.name}: ${text}`, link: '/agenda', appointment: a._id });
  res.json({ appointment: a });
}));

r.patch('/:id/cancel', validObjectId, validate(z.object({ reason: z.string().trim().min(3, 'Please give a short reason.').max(200) })), asyncHandler(async (req, res) => {
  const a = await loadAppt(req, 'cancel');
  need(a.status === 'SCHEDULED', 409, 'Only upcoming meetings can be cancelled.', 'INVALID_STATE');
  a.set({ status: 'CANCELLED', cancelReason: req.body.reason });
  await a.save();
  await announceFreedSlot(a, 'cancelled');
  await audit(req, 'APPOINTMENT_CANCELLED', 'Appointment', a._id, req.body.reason);
  const text = `${when(a.startsAt)} was cancelled. Reason: ${req.body.reason}`;
  if (String(a.patient._id) !== req.user.id) await notify(a.patient._id, { kind: 'CANCELLED', title: 'Consultation cancelled', body: text, link: '/meetings', appointment: a._id });
  if (String(a.dietitian._id) !== req.user.id) await notify(a.dietitian._id, { kind: 'CANCELLED', title: 'Consultation cancelled', body: `${a.patient.name}: ${text}`, link: '/agenda', appointment: a._id });
  res.json({ appointment: a });
}));

r.patch('/:id/complete', validObjectId, requireRole('DIETITIAN', 'LEAD_DOCTOR'), validate(z.object({ status: z.enum(['COMPLETED', 'NO_SHOW']).default('COMPLETED'), notes: z.string().trim().max(1000).default('') })), asyncHandler(async (req, res) => {
  const a = await loadAppt(req, 'complete');
  need(a.status === 'SCHEDULED', 409, 'This meeting is already closed.', 'INVALID_STATE');
  need(a.startsAt.getTime() <= Date.now() + 15 * 60_000, 409, 'You can close a meeting once it has started.', 'INVALID_STATE');
  a.set({ status: req.body.status, outcomeNotes: req.body.notes });
  await a.save();
  await audit(req, `APPOINTMENT_${req.body.status}`, 'Appointment', a._id);
  res.json({ appointment: a });
}));

export default r;
