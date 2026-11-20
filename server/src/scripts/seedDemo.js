// Demo data for testing the full flow. Refuses to run in production.
// All demo accounts use the password printed at the end.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User, PatientProfile, Membership, Assignment, DietPlan, AdherenceLog, CareNote, MembershipPlan } from '../models/index.js';
import { connect, seedPlans } from './_common.js';
import { lastNDates } from '../utils/dates.js';

if (config.isProd && process.env.FORCE_DEMO !== '1') {
  console.error('Refusing to seed demo data in production (set FORCE_DEMO=1 to override).');
  process.exit(1);
}
const PASSWORD = 'Demo@Care2026';
await connect();
await seedPlans();
const hash = await bcrypt.hash(PASSWORD, 10);
const plan = (n) => MembershipPlan.findOne({ name: n });
const mkUser = async (name, email, role, extra = {}) =>
  (await User.findOne({ email })) || User.create({ name, email, role, passwordHash: hash, ...extra });

const doc = await mkUser('Dr. Anika Rao', 'doctor@demo.com', 'LEAD_DOCTOR', { title: 'Lead Physician' });
const d1 = await mkUser('Meera Iyer', 'meera@demo.com', 'DIETITIAN', { maxLoad: 8, specialty: 'Diabetes & metabolic health' });
const d2 = await mkUser('Rohan Das', 'rohan@demo.com', 'DIETITIAN', { maxLoad: 6, specialty: 'Weight management' });
await mkUser('Sana Khan', 'sana@demo.com', 'DIETITIAN', { maxLoad: 8, specialty: "PCOS & women's health" });
const care = await mkUser('Kavya Menon', 'care@demo.com', 'CARE_TEAM');

const history = (o) => ({ activity: 'Lightly active', sleepHrs: 7, smoking: 'Never', alcohol: 'Occasionally', dislikes: '', consentAt: new Date(), consentVersion: 'v1', allergies: [], ...o });
async function patient(name, email, { age, sex, h, w, hist, status = 'PENDING_ASSISTANCE', planName, paid = false, requested }) {
  if (await User.exists({ email })) return User.findOne({ email });
  const u = await User.create({ name, email, role: 'PATIENT', passwordHash: hash });
  const dob = new Date(); dob.setFullYear(dob.getFullYear() - age);
  await PatientProfile.create({ user: u._id, dob, sex, heightCm: h, weightKg: w, phone: '+91 9876500000', history: hist ? history(hist) : undefined, historySubmittedAt: hist ? new Date() : undefined });
  const p = planName ? await plan(planName) : null;
  const events = [];
  const path = ['PENDING_ASSISTANCE', 'PLAN_SELECTED', 'ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'];
  for (let i = 0; i < path.indexOf(status); i++) events.push({ from: path[i], to: path[i + 1], by: care._id, actor: 'CARE_TEAM', at: new Date(Date.now() - (6 - i) * 36e5 * 6) });
  await Membership.create({ patient: u._id, plan: p?._id, requestedPlan: requested ? (await plan(requested))._id : undefined, status, paymentStatus: paid ? 'PAID' : 'UNPAID', paymentMethod: paid ? 'OFFLINE' : null, offlineReference: paid ? 'DEMO-UPI-001' : undefined, events, activatedAt: paid ? new Date() : undefined });
  return u;
}

const priya = await patient('Priya Sharma', 'priya@demo.com', { age: 34, sex: 'Female', h: 160, w: 78, status: 'ASSIGNED', planName: 'Advanced', paid: true, hist: { conditions: ['Type 2 Diabetes', 'High cholesterol'], allergies: ['Peanuts'], medications: 'Metformin 500 mg BD', labNotes: 'HbA1c 7.9%, LDL 148 mg/dL', dietType: 'Vegetarian', dislikes: 'Bitter gourd', goals: 'Bring HbA1c below 7% and lose 6 kg in 4 months' } });
const vikram = await patient('Vikram Singh', 'vikram@demo.com', { age: 45, sex: 'Male', h: 175, w: 104, status: 'ASSIGNED', planName: 'Clinical Premium', paid: true, hist: { conditions: ['Hypertension', 'Obesity'], medications: 'Amlodipine 5 mg', labNotes: 'BP 146/94, TG 210', activity: 'Sedentary', dietType: 'Non-vegetarian', goals: 'Lose 12 kg and lower blood pressure' } });
await patient('Neha Gupta', 'neha@demo.com', { age: 28, sex: 'Female', h: 162, w: 68, status: 'PENDING_DIETITIAN_ASSIGNMENT', planName: 'Advanced', paid: true, hist: { conditions: ['PCOS'], allergies: ['Shellfish'], medications: 'None', labNotes: 'Fasting insulin 18', dietType: 'Eggetarian', goals: 'Regularise cycles and manage weight' } });
await patient('Rahul Verma', 'rahul@demo.com', { age: 52, sex: 'Male', h: 170, w: 82, status: 'PLAN_SELECTED', planName: 'Essential', hist: { conditions: ['Thyroid disorder'], medications: 'Levothyroxine 75 mcg', labNotes: 'TSH 5.8', dietType: 'Vegetarian', goals: 'Improve cholesterol without medication increase' } });
const aisha = await patient('Aisha Khan', 'aisha@demo.com', { age: 39, sex: 'Female', h: 158, w: 61, requested: 'Advanced', hist: { conditions: ['IBS / gut issues'], allergies: ['Lactose'], medications: 'None', dietType: 'Non-vegetarian', goals: 'Reduce bloating and build a gut-friendly routine' } });
await patient('Tom Brooks', 'tom@demo.com', { age: 31, sex: 'Male' });

for (const [p, d, by] of [[priya, d1, care], [vikram, d2, doc]]) {
  if (!(await Assignment.exists({ patient: p._id }))) await Assignment.create({ patient: p._id, dietitian: d._id, assignedBy: by._id });
}
if (!(await DietPlan.exists({ patient: priya._id }))) {
  const meals = [
    { time: '08:00', name: 'Breakfast', items: [{ name: 'Vegetable oats upma', qty: '1 bowl', kcal: 220 }, { name: 'Greek yoghurt (unsweetened)', qty: '100 g', kcal: 60 }] },
    { time: '11:00', name: 'Mid-morning', items: [{ name: 'Apple', qty: '1 medium', kcal: 80 }, { name: 'Almonds', qty: '8', kcal: 55 }] },
    { time: '13:30', name: 'Lunch', items: [{ name: 'Multigrain roti', qty: '2', kcal: 200 }, { name: 'Dal tadka', qty: '1 cup', kcal: 180 }, { name: 'Mixed vegetable sabzi', qty: '1 cup', kcal: 110 }] },
    { time: '17:00', name: 'Evening', items: [{ name: 'Roasted chana', qty: '30 g', kcal: 110 }, { name: 'Green tea', qty: '1 cup', kcal: 0 }] },
    { time: '20:00', name: 'Dinner', items: [{ name: 'Paneer bhurji', qty: '100 g', kcal: 220 }, { name: 'Sauteed greens', qty: '1 cup', kcal: 90 }, { name: 'Millet roti', qty: '1', kcal: 100 }] },
  ];
  const active = await DietPlan.create({ patient: priya._id, dietitian: d1._id, version: 1, status: 'ACTIVE', title: 'Glycaemic control: 1,500 kcal', startDate: lastNDates(5, config.tz)[4], targets: { kcal: 1500, protein: 75, carbs: 170, fat: 50, waterMl: 2500 }, supplements: 'Vitamin D3 60,000 IU weekly (as prescribed)', notes: 'Avoid fruit juices. Keep dinner 3 hours before bed. Walk 20 minutes after lunch.', reviewNote: 'Approved. Good protein distribution.', meals, submittedAt: new Date(), approvedBy: doc._id, approvedAt: new Date() });
  const dates = lastNDates(6, config.tz);
  const done = [5, 4, 5, 3, 5, 4];
  for (let i = 1; i < 6; i++) await AdherenceLog.create({ patient: priya._id, date: dates[i], mealsDone: active.meals.slice(0, done[i]).map((m) => String(m._id)), waterMl: 2000 + i * 100, weightKg: 78 - i * 0.2 });
  await DietPlan.create({ patient: vikram._id, dietitian: d2._id, version: 1, status: 'IN_REVIEW', title: 'Weight loss and BP: 1,800 kcal, low sodium', startDate: dates[0], targets: { kcal: 1800, protein: 100, carbs: 200, fat: 60, waterMl: 3000 }, notes: 'Sodium under 2 g/day.', submittedAt: new Date(), meals: [
    { time: '08:30', name: 'Breakfast', items: [{ name: 'Egg white omelette (3 eggs)', qty: '1', kcal: 140 }, { name: 'Whole wheat toast', qty: '2 slices', kcal: 140 }] },
    { time: '13:00', name: 'Lunch', items: [{ name: 'Grilled chicken', qty: '120 g', kcal: 200 }, { name: 'Brown rice', qty: '1 cup', kcal: 215 }] },
    { time: '20:00', name: 'Dinner', items: [{ name: 'Fish curry (light)', qty: '1 cup', kcal: 220 }, { name: 'Jowar roti', qty: '2', kcal: 180 }] }] });
}
if (!(await CareNote.exists({ patient: aisha._id }))) await CareNote.create({ patient: aisha._id, author: aisha._id, kind: 'PATIENT_MESSAGE', text: 'I am interested in the Advanced plan. Can you explain the lab review?' });

console.log(`Demo data ready. Password for every demo account: ${PASSWORD}`);
console.log('doctor@demo.com · care@demo.com · meera@demo.com · priya@demo.com · tom@demo.com (new patient) …');
await mongoose.disconnect();
