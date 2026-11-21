import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User, PatientProfile, Membership, Assignment, DietPlan, AdherenceLog, CareNote, MembershipPlan, Appointment, Notification } from '../models/index.js';
import { seedPlans } from '../scripts/_common.js';
import { lastNDates, todayStr } from '../utils/dates.js';
import { zonedStartOfDay } from '../domain/appointments.js';

export const DEMO_PASSWORD = 'Demo@Care2026';
export const DEMO_ACCOUNTS = [
  ['doctor@demo.com', 'Lead Doctor (Dr. Anika Rao)'], ['care@demo.com', 'Care Team (Kavya Menon)'],
  ['meera@demo.com', 'Dietitian (Meera Iyer)'], ['rohan@demo.com', 'Dietitian (Rohan Das)'], ['sana@demo.com', 'Dietitian (Sana Khan)'],
  ['priya@demo.com', 'Patient: assigned, ACTIVE diet plan + 5 days of tracking'], ['vikram@demo.com', 'Patient: assigned, plan IN REVIEW'],
  ['neha@demo.com', 'Patient: paid, awaiting dietitian assignment'], ['rahul@demo.com', 'Patient: plan selected, awaiting payment'],
  ['aisha@demo.com', 'Patient: requested a plan, awaiting care team'], ['tom@demo.com', 'Patient: brand new, no history yet'],
];

/** Idempotent: existing demo users are reused, so running twice does not duplicate anything. */
export async function seedDemoData() {
  const PASSWORD = DEMO_PASSWORD;
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

  const priya = await patient('Priya Sharma', 'priya@demo.com', { age: 34, sex: 'Female', h: 160, w: 78, status: 'ASSIGNED', planName: 'Advanced', paid: true, hist: { conditions: ['Type 2 Diabetes', 'High cholesterol'], allergies: ['Peanuts'], medications: 'Metformin 500 mg BD', labNotes: 'HbA1c 7.9%, LDL 148 mg/dL', dietType: 'Vegetarian', country: 'India', state: 'Maharashtra', cuisine: 'Maharashtrian', dislikes: 'Bitter gourd', goals: 'Bring HbA1c below 7% and lose 6 kg in 4 months' } });
  const vikram = await patient('Vikram Singh', 'vikram@demo.com', { age: 45, sex: 'Male', h: 175, w: 104, status: 'ASSIGNED', planName: 'Clinical Premium', paid: true, hist: { conditions: ['Hypertension', 'Obesity'], medications: 'Amlodipine 5 mg', labNotes: 'BP 146/94, TG 210', activity: 'Sedentary', dietType: 'Non-vegetarian', country: 'India', state: 'Punjab', cuisine: 'Punjabi', goals: 'Lose 12 kg and lower blood pressure' } });
  await patient('Neha Gupta', 'neha@demo.com', { age: 28, sex: 'Female', h: 162, w: 68, status: 'PENDING_DIETITIAN_ASSIGNMENT', planName: 'Advanced', paid: true, hist: { conditions: ['PCOS'], allergies: ['Shellfish'], medications: 'None', labNotes: 'Fasting insulin 18', dietType: 'Eggetarian', country: 'India', state: 'West Bengal', cuisine: 'Bengali', goals: 'Regularise cycles and manage weight' } });
  await patient('Rahul Verma', 'rahul@demo.com', { age: 52, sex: 'Male', h: 170, w: 82, status: 'PLAN_SELECTED', planName: 'Essential', hist: { conditions: ['Thyroid disorder'], medications: 'Levothyroxine 75 mcg', labNotes: 'TSH 5.8', dietType: 'Vegetarian', country: 'India', state: 'Tamil Nadu', cuisine: 'Tamil', goals: 'Improve cholesterol without medication increase' } });
  const aisha = await patient('Aisha Khan', 'aisha@demo.com', { age: 39, sex: 'Female', h: 158, w: 61, requested: 'Advanced', hist: { conditions: ['IBS / gut issues'], allergies: ['Lactose'], medications: 'None', dietType: 'Non-vegetarian', country: 'United Arab Emirates', state: '', cuisine: 'Middle Eastern', goals: 'Reduce bloating and build a gut-friendly routine' } });
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
    const active = await DietPlan.create({ patient: priya._id, dietitian: d1._id, version: 1, status: 'ACTIVE', region: { country: 'India', state: 'Maharashtra', cuisine: 'Maharashtrian' }, title: 'Glycaemic control: 1,500 kcal', startDate: lastNDates(5, config.tz)[4], targets: { kcal: 1500, protein: 75, carbs: 170, fat: 50, waterMl: 2500 }, supplements: 'Vitamin D3 60,000 IU weekly (as prescribed)', notes: 'Avoid fruit juices. Keep dinner 3 hours before bed. Walk 20 minutes after lunch.', reviewNote: 'Approved. Good protein distribution.', meals, submittedAt: new Date(), approvedBy: doc._id, approvedAt: new Date() });
    const dates = lastNDates(6, config.tz);
    const done = [5, 4, 5, 3, 5, 4];
    for (let i = 1; i < 6; i++) await AdherenceLog.create({ patient: priya._id, date: dates[i], mealsDone: active.meals.slice(0, done[i]).map((m) => String(m._id)), waterMl: 2000 + i * 100, weightKg: 78 - i * 0.2 });
    await DietPlan.create({ patient: vikram._id, dietitian: d2._id, version: 1, status: 'IN_REVIEW', region: { country: 'India', state: 'Punjab', cuisine: 'Punjabi' }, title: 'Weight loss and BP: 1,800 kcal, low sodium', startDate: dates[0], targets: { kcal: 1800, protein: 100, carbs: 200, fat: 60, waterMl: 3000 }, notes: 'Sodium under 2 g/day.', submittedAt: new Date(), meals: [
      { time: '08:30', name: 'Breakfast', items: [{ name: 'Egg white omelette (3 eggs)', qty: '1', kcal: 140 }, { name: 'Whole wheat toast', qty: '2 slices', kcal: 140 }] },
      { time: '13:00', name: 'Lunch', items: [{ name: 'Grilled chicken', qty: '120 g', kcal: 200 }, { name: 'Brown rice', qty: '1 cup', kcal: 215 }] },
      { time: '20:00', name: 'Dinner', items: [{ name: 'Fish curry (light)', qty: '1 cup', kcal: 220 }, { name: 'Jowar roti', qty: '2', kcal: 180 }] }] });
  }
  if (!(await CareNote.exists({ patient: aisha._id }))) await CareNote.create({ patient: aisha._id, author: aisha._id, kind: 'PATIENT_MESSAGE', text: 'I am interested in the Advanced plan. Can you explain the lab review?' });

  return DEMO_ACCOUNTS;
}

/** Removes every @demo.com user and all of their records. */
export async function purgeDemoData() {
  const users = await User.find({ email: /@demo\.com$/i }).select('_id');
  const ids = users.map((u) => u._id);
  if (!ids.length) return 0;
  await Promise.all([
    PatientProfile.deleteMany({ user: { $in: ids } }), Membership.deleteMany({ patient: { $in: ids } }),
    Assignment.deleteMany({ $or: [{ patient: { $in: ids } }, { dietitian: { $in: ids } }] }),
    DietPlan.deleteMany({ $or: [{ patient: { $in: ids } }, { dietitian: { $in: ids } }] }),
    AdherenceLog.deleteMany({ patient: { $in: ids } }), CareNote.deleteMany({ $or: [{ patient: { $in: ids } }, { author: { $in: ids } }] }),
    Appointment.deleteMany({ $or: [{ patient: { $in: ids } }, { dietitian: { $in: ids } }] }), Notification.deleteMany({ user: { $in: ids } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

/**
 * Demo consultations, relative to "now" so the dashboards always have something today, tomorrow and yesterday.
 * Runs only when there are no appointments yet, so it is safe on every startup.
 */
export async function seedDemoAppointments() {
  if (await Appointment.exists({})) return 0;
  const [d1, d2, priya, vikram, care] = await Promise.all(['meera@demo.com', 'rohan@demo.com', 'priya@demo.com', 'vikram@demo.com', 'care@demo.com'].map((e) => User.findOne({ email: e })));
  if (!d1 || !d2 || !priya || !vikram) return 0;
  const [a1, a2] = await Promise.all([Assignment.exists({ patient: priya._id, dietitian: d1._id, isOpen: true }), Assignment.exists({ patient: vikram._id, dietitian: d2._id, isOpen: true })]);
  const MIN = 60_000, now = Date.now();
  const round = (ms) => Math.ceil(ms / (5 * MIN)) * 5 * MIN;
  const day0 = zonedStartOfDay(todayStr(config.tz), config.tz).getTime();
  const at = (dayOffset, h, m = 0) => new Date(day0 + dayOffset * 864e5 + (h * 60 + m) * MIN);
  const link = 'https://meet.example.com/carecompass-demo';
  const rows = [];
  const add = (patient, dietitian, startsAt, o = {}) => rows.push({ patient: patient._id, dietitian: dietitian._id, startsAt, durationMin: 30, mode: 'VIDEO', meetingLink: link, topic: 'Diet consultation', createdBy: care?._id || dietitian._id, ...o });
  if (a1) {
    add(priya, d1, at(-1, 11), { status: 'COMPLETED', topic: 'Weekly review', outcomeNotes: 'Fasting sugars improving. Continue the plan; add a 20-minute walk after lunch.' });
    add(priya, d1, new Date(round(now + 25 * MIN)), { topic: 'Weekly review' });
    add(priya, d1, new Date(round(now + 4 * 3600e3)), { mode: 'PHONE', meetingLink: '', topic: 'Quick check-in', durationMin: 15 });
    add(priya, d1, at(1, 10, 30), { topic: 'Meal plan walkthrough', rescheduleCount: 1, history: [{ from: at(1, 9), to: at(1, 10, 30), by: d1._id, reason: 'Dietitian training session' }] });
    add(priya, d1, at(3, 17), { topic: 'Monthly progress review' });
  }
  if (a2) {
    add(vikram, d2, at(-1, 16), { status: 'COMPLETED', topic: 'Plan discussion', outcomeNotes: 'Agreed on a low-sodium plan; submitted for doctor review.' });
    add(vikram, d2, new Date(round(now + 2 * 3600e3)), { topic: 'Plan follow-up' });
    add(vikram, d2, at(1, 15), { mode: 'IN_PERSON', meetingLink: '', topic: 'Body composition check' });
    add(vikram, d2, at(2, 11), { status: 'CANCELLED', cancelReason: 'Patient travelling', topic: 'Follow-up' });
  }
  if (rows.length) await Appointment.insertMany(rows);
  return rows.length;
}
