import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, findConflict, dayRange, zonedStartOfDay, reminderDue, humanLead, canManageAppointment, tzOffsetMin } from '../src/domain/appointments.js';

const T = (s) => new Date(s);

test('overlap: partial and nested clash, back-to-back does not', () => {
  assert.equal(overlaps('2026-11-21T10:00:00Z', 30, '2026-11-21T10:15:00Z', 30), true);
  assert.equal(overlaps('2026-11-21T10:00:00Z', 60, '2026-11-21T10:10:00Z', 15), true);
  assert.equal(overlaps('2026-11-21T10:00:00Z', 30, '2026-11-21T10:30:00Z', 30), false);
  assert.equal(overlaps('2026-11-21T10:30:00Z', 30, '2026-11-21T10:00:00Z', 30), false);
});

test('findConflict returns the clashing meeting', () => {
  const list = [{ startsAt: T('2026-11-21T09:00:00Z'), durationMin: 30 }, { startsAt: T('2026-11-21T10:00:00Z'), durationMin: 30 }];
  assert.equal(findConflict(list, T('2026-11-21T10:20:00Z'), 30), list[1]);
  assert.equal(findConflict(list, T('2026-11-21T09:30:00Z'), 30), undefined);
});

test('IST day boundaries (UTC+5:30)', () => {
  assert.equal(tzOffsetMin(Date.UTC(2026, 10, 21, 12), 'Asia/Kolkata'), 330);
  assert.equal(zonedStartOfDay('2026-11-21', 'Asia/Kolkata').toISOString(), '2026-11-20T18:30:00.000Z');
  const [a, b] = dayRange('2026-11-21', 'Asia/Kolkata');
  assert.equal(b - a, 86_400_000);
});

test('day boundaries follow daylight saving', () => {
  const [a, b] = dayRange('2026-03-08', 'America/New_York'); // clocks go forward that day
  assert.equal(b - a, 23 * 3_600_000);
  assert.equal(a.toISOString(), '2026-03-08T05:00:00.000Z');
});

test('reminder window: only scheduled meetings within the lead time', () => {
  const now = Date.parse('2026-11-21T10:00:00Z');
  const a = (mins, status = 'SCHEDULED') => ({ status, startsAt: new Date(now + mins * 60_000) });
  assert.equal(reminderDue(a(20), now, 30), true);
  assert.equal(reminderDue(a(30), now, 30), true);
  assert.equal(reminderDue(a(31), now, 30), false);
  assert.equal(reminderDue(a(-2), now, 30), true);   // just started
  assert.equal(reminderDue(a(-10), now, 30), false); // too late
  assert.equal(reminderDue(a(20, 'CANCELLED'), now, 30), false);
});

test('humanLead wording', () => {
  const now = Date.now();
  assert.equal(humanLead(now + 25 * 60_000, now), 'in 25 min');
  assert.equal(humanLead(now + 90 * 60_000, now), 'in 1 h 30 min');
  assert.equal(humanLead(now - 1000, now), 'now');
});

test('who can change a meeting', () => {
  const appt = { dietitian: 'd1', patient: 'p1' };
  assert.equal(canManageAppointment({ id: 'd1', role: 'DIETITIAN' }, appt, 'reschedule'), true);
  assert.equal(canManageAppointment({ id: 'd2', role: 'DIETITIAN' }, appt, 'reschedule'), false);
  assert.equal(canManageAppointment({ id: 'p1', role: 'PATIENT' }, appt, 'cancel'), true);
  assert.equal(canManageAppointment({ id: 'p1', role: 'PATIENT' }, appt, 'reschedule'), false);
  assert.equal(canManageAppointment({ id: 'p2', role: 'PATIENT' }, appt, 'cancel'), false);
  assert.equal(canManageAppointment({ id: 'c1', role: 'CARE_TEAM' }, appt, 'reschedule'), true);
  assert.equal(canManageAppointment({ id: 'c1', role: 'CARE_TEAM' }, appt, 'complete'), false);
  assert.equal(canManageAppointment({ id: 'x', role: 'LEAD_DOCTOR' }, appt, 'complete'), true);
});

import { openSlots, weekdayOf, WORK } from '../src/domain/appointments.js';

test('open slots: full day, cancelled frees a slot, busy slots removed, past slots skipped', () => {
  const tz = 'Asia/Kolkata';
  const date = '2026-11-23'; // Monday
  const before = Date.parse('2026-11-22T00:00:00Z');
  const all = openSlots({ date, tz, appts: [], now: before });
  assert.equal(all.length, 18); // 09:00 to 18:00 in 30-minute slots
  assert.equal(all[0].toISOString(), '2026-11-23T03:30:00.000Z'); // 09:00 IST
  const at10 = { startsAt: new Date('2026-11-23T04:30:00Z'), durationMin: 60, status: 'SCHEDULED' }; // 10:00 to 11:00 IST
  assert.equal(openSlots({ date, tz, appts: [at10], now: before }).length, 16);
  assert.equal(openSlots({ date, tz, appts: [{ ...at10, status: 'CANCELLED' }], now: before }).length, 18);
  assert.equal(openSlots({ date, tz, appts: [{ ...at10, status: 'COMPLETED' }], now: before }).length, 16);
  const noon = Date.parse('2026-11-23T06:30:00Z'); // 12:00 IST
  assert.ok(openSlots({ date, tz, appts: [], now: noon }).every((s) => s.getTime() > noon));
});

test('no open slots on Sunday', () => {
  assert.equal(weekdayOf('2026-11-22'), 0);
  assert.deepEqual(openSlots({ date: '2026-11-22', tz: 'Asia/Kolkata', appts: [], now: 0 }), []);
  assert.ok(WORK.days.includes(1) && !WORK.days.includes(0));
});
