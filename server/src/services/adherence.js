import { DietPlan, AdherenceLog } from '../models/index.js';
import { lastNDates } from '../utils/dates.js';
import { config } from '../config.js';

/** 7-day meal adherence % per patient who has an ACTIVE plan. Missing days count as 0. */
export async function adherenceMap(patientIds, days = 7) {
  const ids = patientIds.map(String);
  const out = new Map();
  if (!ids.length) return out;
  const dates = lastNDates(days, config.tz);
  const [plans, logs] = await Promise.all([
    DietPlan.find({ patient: { $in: ids }, status: 'ACTIVE' }),
    AdherenceLog.find({ patient: { $in: ids }, date: { $in: dates } }),
  ]);
  const byPatient = new Map();
  for (const l of logs) {
    const k = String(l.patient);
    if (!byPatient.has(k)) byPatient.set(k, []);
    byPatient.get(k).push(l);
  }
  for (const p of plans) {
    const mealIds = new Set(p.meals.map((m) => String(m._id)));
    if (!mealIds.size) continue;
    let total = 0;
    for (const l of byPatient.get(String(p.patient)) || []) {
      total += Math.min(1, l.mealsDone.filter((x) => mealIds.has(x)).length / mealIds.size);
    }
    out.set(String(p.patient), Math.round((total / days) * 100));
  }
  return out;
}
