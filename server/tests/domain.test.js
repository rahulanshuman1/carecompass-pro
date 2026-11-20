import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { assertMembershipTransition, MEMBERSHIP_TRANSITIONS } from '../src/domain/membership.js';
import { assertPlanTransition, validatePlanContent } from '../src/domain/dietplan.js';
import { canViewPatient, redactProfileFor } from '../src/domain/rbac.js';
import { verifyCheckoutSignature, verifyWebhookSignature } from '../src/domain/razorpaySignature.js';
import { createCipher } from '../src/utils/cipher.js';

const ctx = (o = {}) => ({ actorRole: 'CARE_TEAM', hasPlan: true, paymentStatus: 'PAID', hasAssignment: true, ...o });
const throwsCode = (fn, code) => assert.throws(fn, (e) => e.code === code, `expected ${code}`);

test('membership: valid happy path', () => {
  assertMembershipTransition('PENDING_ASSISTANCE', 'PLAN_SELECTED', ctx());
  assertMembershipTransition('PLAN_SELECTED', 'ACTIVE', ctx());
  assertMembershipTransition('ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', ctx());
  assertMembershipTransition('PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED', ctx());
});

test('membership: every non-listed jump is rejected', () => {
  for (const from of Object.keys(MEMBERSHIP_TRANSITIONS)) {
    for (const to of Object.keys(MEMBERSHIP_TRANSITIONS)) {
      if (MEMBERSHIP_TRANSITIONS[from].includes(to)) continue;
      throwsCode(() => assertMembershipTransition(from, to, ctx()), 'INVALID_TRANSITION');
    }
  }
});

test('membership: guards', () => {
  throwsCode(() => assertMembershipTransition('PLAN_SELECTED', 'ACTIVE', ctx({ paymentStatus: 'UNPAID' })), 'PAYMENT_REQUIRED');
  throwsCode(() => assertMembershipTransition('PENDING_ASSISTANCE', 'PLAN_SELECTED', ctx({ hasPlan: false })), 'PLAN_REQUIRED');
  throwsCode(() => assertMembershipTransition('PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED', ctx({ hasAssignment: false })), 'ASSIGNMENT_REQUIRED');
  throwsCode(() => assertMembershipTransition('PENDING_ASSISTANCE', 'PLAN_SELECTED', ctx({ actorRole: 'PATIENT' })), 'FORBIDDEN');
  throwsCode(() => assertMembershipTransition('PENDING_ASSISTANCE', 'PLAN_SELECTED', ctx({ actorRole: 'DIETITIAN' })), 'FORBIDDEN');
  assertMembershipTransition('PLAN_SELECTED', 'ACTIVE', ctx({ actorRole: 'SYSTEM' }));
});

const goodPlan = () => ({
  title: 'Balanced 1,600 kcal', startDate: '2026-12-01', dietitian: 'd1', status: 'DRAFT',
  targets: { kcal: 1600, protein: 80, carbs: 190, fat: 55, waterMl: 2500 },
  meals: [{ name: 'Breakfast', time: '08:00', items: [{ name: 'Poha', qty: '1 bowl', kcal: 250 }] }],
});

test('diet plan: validation', () => {
  assert.deepEqual(validatePlanContent(goodPlan()), []);
  const bad = goodPlan(); bad.meals[0].items = []; bad.targets.kcal = 100; bad.title = '';
  const errs = validatePlanContent(bad);
  assert.ok(errs.length >= 3);
});

test('diet plan: transitions and roles', () => {
  const p = goodPlan();
  throwsCode(() => assertPlanTransition(p, 'IN_REVIEW', { role: 'DIETITIAN', userId: 'other' }), 'FORBIDDEN');
  throwsCode(() => assertPlanTransition(p, 'ACTIVE', { role: 'LEAD_DOCTOR', userId: 'x' }), 'INVALID_TRANSITION');
  assertPlanTransition(p, 'IN_REVIEW', { role: 'DIETITIAN', userId: 'd1' });
  const r = { ...p, status: 'IN_REVIEW' };
  throwsCode(() => assertPlanTransition(r, 'ACTIVE', { role: 'DIETITIAN', userId: 'd1' }), 'FORBIDDEN');
  throwsCode(() => assertPlanTransition(r, 'DRAFT', { role: 'LEAD_DOCTOR', userId: 'x', note: '' }), 'NOTE_REQUIRED');
  assertPlanTransition(r, 'DRAFT', { role: 'LEAD_DOCTOR', userId: 'x', note: 'Reduce sodium please' });
  assertPlanTransition(r, 'ACTIVE', { role: 'LEAD_DOCTOR', userId: 'x' });
  throwsCode(() => assertPlanTransition({ ...p, status: 'ACTIVE' }, 'DRAFT', { role: 'LEAD_DOCTOR' }), 'INVALID_TRANSITION');
  const empty = { ...p, meals: [] };
  throwsCode(() => assertPlanTransition(empty, 'IN_REVIEW', { role: 'DIETITIAN', userId: 'd1' }), 'PLAN_INVALID');
});

test('rbac: record-level access and redaction', () => {
  assert.equal(canViewPatient({ id: 'p1', role: 'PATIENT' }, 'p1'), true);
  assert.equal(canViewPatient({ id: 'p2', role: 'PATIENT' }, 'p1'), false);
  assert.equal(canViewPatient({ id: 'c1', role: 'CARE_TEAM' }, 'p1'), true);
  assert.equal(canViewPatient({ id: 'd1', role: 'DIETITIAN' }, 'p1', { dietitian: 'd1' }), true);
  assert.equal(canViewPatient({ id: 'd2', role: 'DIETITIAN' }, 'p1', { dietitian: 'd1' }), false);
  assert.equal(canViewPatient({ id: 'd2', role: 'DIETITIAN' }, 'p1', null), false);
  const prof = { history: { goals: 'g', medications: 'secret', labNotes: 'secret' } };
  const care = redactProfileFor('CARE_TEAM', prof);
  assert.equal(care.history.medications, undefined);
  assert.equal(care.history.labNotes, undefined);
  assert.equal(prof.history.medications, 'secret', 'original not mutated');
  assert.equal(redactProfileFor('DIETITIAN', prof).history.medications, 'secret');
});

test('razorpay: checkout signature (subscription format payment|subscription)', () => {
  const secret = 'sek';
  const sig = crypto.createHmac('sha256', secret).update('pay_1|sub_1').digest('hex');
  assert.equal(verifyCheckoutSignature({ paymentId: 'pay_1', subscriptionId: 'sub_1', signature: sig }, secret), true);
  assert.equal(verifyCheckoutSignature({ paymentId: 'pay_1', subscriptionId: 'sub_2', signature: sig }, secret), false);
  assert.equal(verifyCheckoutSignature({ paymentId: 'pay_1', subscriptionId: 'sub_1', signature: 'bad' }, secret), false);
  assert.equal(verifyCheckoutSignature({}, secret), false);
});

test('razorpay: webhook signature over raw body', () => {
  const body = Buffer.from(JSON.stringify({ event: 'subscription.charged' }));
  const sig = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  assert.equal(verifyWebhookSignature(body, sig, 'whsec'), true);
  assert.equal(verifyWebhookSignature(Buffer.from(body.toString() + ' '), sig, 'whsec'), false);
  assert.equal(verifyWebhookSignature(body, sig, 'other'), false);
  assert.equal(verifyWebhookSignature(body, undefined, 'whsec'), false);
});

test('cipher: round trip, unique IVs, tamper detection', () => {
  const c = createCipher('a'.repeat(40));
  const e1 = c.enc('HbA1c 7.9%'), e2 = c.enc('HbA1c 7.9%');
  assert.notEqual(e1, e2);
  assert.ok(e1.startsWith('enc1:'));
  assert.equal(c.dec(e1), 'HbA1c 7.9%');
  assert.equal(c.dec(e1.slice(0, -4) + 'AAAA'), '[unreadable]');
  assert.equal(c.dec('plain'), 'plain');
  assert.equal(c.enc(''), '');
  assert.equal(createCipher('b'.repeat(40)).dec(e1), '[unreadable]');
});
