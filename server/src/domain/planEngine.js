import { searchFoods } from '../data/foods.js';

/** Pure functions: no database, no clock except the optional `today` argument. */

const lc = (s) => String(s ?? '').trim().toLowerCase();
const words = (s) => String(s || '').split(/[,;\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const roundTo = (v, step) => (step > 1 ? Math.round(v / step) * step : Math.round(v));

export function ageFrom(dob, today = new Date()) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a -= 1;
  return a;
}

/** Flattens a patient's profile into the values rules can look at. */
export function buildContext(user, profile, today = new Date()) {
  const h = profile?.history || {};
  const weightKg = profile?.weightKg ?? null;
  const heightCm = profile?.heightCm ?? null;
  return {
    name: user?.name || '',
    age: ageFrom(profile?.dob, today),
    sex: profile?.sex || '',
    weightKg, heightCm,
    bmi: weightKg && heightCm ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null,
    activity: h.activity || '',
    dietType: h.dietType || '',
    conditions: h.conditions || [],
    allergies: h.allergies || [],
    goals: h.goals || '',
    dislikes: h.dislikes || '',
    sleepHrs: h.sleepHrs ?? null,
    smoking: h.smoking || '',
    alcohol: h.alcohol || '',
    country: h.country || '',
    state: h.state || '',
    cuisine: h.cuisine || '',
  };
}

export function bmr(method, ctx) {
  const { weightKg: w, heightCm: h, age: a, sex } = ctx;
  if (!w || !h || a == null) return null;
  const offset = sex === 'Male' ? 5 : sex === 'Female' ? -161 : -78; // 'Other'/unknown: midpoint
  if (method === 'harris') {
    const male = 66.5 + 13.75 * w + 5.003 * h - 6.755 * a;
    const female = 655.1 + 9.563 * w + 1.85 * h - 4.676 * a;
    return sex === 'Male' ? male : sex === 'Female' ? female : (male + female) / 2;
  }
  return 10 * w + 6.25 * h - 5 * a + offset; // Mifflin-St Jeor
}

/** One condition against the context. A missing value never matches (except "is empty"/"is not"). */
export function testCondition(c, ctx) {
  const v = ctx[c.field];
  const want = c.value;
  switch (c.op) {
    case '>=': return v != null && v !== '' && Number(v) >= Number(want);
    case '>': return v != null && v !== '' && Number(v) > Number(want);
    case '<=': return v != null && v !== '' && Number(v) <= Number(want);
    case '<': return v != null && v !== '' && Number(v) < Number(want);
    case '=': return typeof v === 'number' || typeof want === 'number' ? v != null && Number(v) === Number(want) : lc(v) === lc(want);
    case '!=': return typeof v === 'number' ? Number(v) !== Number(want) : lc(v) !== lc(want);
    case 'in': return words(Array.isArray(want) ? want.join(',') : want).includes(lc(v));
    case 'contains': return lc(v).includes(lc(want));
    case 'not_contains': return !lc(v).includes(lc(want));
    case 'has': return (Array.isArray(v) ? v : []).some((x) => lc(x) === lc(want) || lc(x).includes(lc(want)));
    case 'not_has': return !(Array.isArray(v) ? v : []).some((x) => lc(x) === lc(want) || lc(x).includes(lc(want)));
    case 'any': return Array.isArray(v) && v.length > 0;
    case 'none': return !Array.isArray(v) || v.length === 0;
    default: return false;
  }
}

export const ruleMatches = (rule, ctx) => {
  if (!rule.conditions?.length) return true; // a rule with no conditions always applies
  const test = (c) => testCondition(c, ctx);
  return rule.match === 'any' ? rule.conditions.some(test) : rule.conditions.every(test);
};

function seeded(seed) {
  let s = Math.abs(Math.floor(Number(seed) || 1)) % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

/** Words to leave out of food names because of the patient's allergies, dislikes and rules. */
export function exclusionWords(ctx, studio, ruleWords = []) {
  const out = new Set(ruleWords);
  for (const w of words(ctx.dislikes)) out.add(w);
  for (const a of ctx.allergies.map(lc).filter(Boolean)) {
    let known = false;
    for (const al of studio.allergens || []) {
      if ((al.aliases || []).some((x) => a.includes(lc(x))) || a.includes(lc(al.name))) {
        known = true;
        for (const w of al.foodWords || []) out.add(lc(w));
      }
    }
    if (!known) out.add(a); // unknown allergy: use the text itself as a food word
  }
  return [...out].filter(Boolean);
}

const DIET_MAP = { Jain: 'Vegetarian' };

/**
 * generatePlan(ctx, studio, opts) -> { title, region, targets, meals, supplements, notes, flags, applied, warnings, excluded }
 * opts: { seed, today }
 */
export function generatePlan(ctx, studio, opts = {}) {
  const warnings = [];
  const flags = [];
  const applied = [];
  const notes = [];
  const supplements = [];
  const cal = studio.calories;
  const state = { kcalSteps: [], pct: 0, add: 0, set: null, min: cal.minKcal, max: cal.maxKcal, macros: { ...studio.macros }, waterPerKg: studio.water.perKg, waterAdd: 0, exclude: [], prefer: [] };

  // 1) Base calories
  let kcal;
  if (cal.method === 'fixed') kcal = cal.fixedKcal;
  else {
    const b = bmr(cal.method, ctx);
    if (b == null) {
      kcal = cal.fallbackKcal;
      warnings.push('Height, weight, age or sex is missing, so the fallback calorie target was used.');
    } else {
      const f = cal.activity?.[ctx.activity] ?? cal.defaultActivity;
      if (!cal.activity?.[ctx.activity]) warnings.push('Activity level was not recognised, so the default activity factor was used.');
      kcal = b * f;
    }
  }

  // 2) Rules, top to bottom. "kcal" in a condition means the calories worked out so far.
  const live = { ...ctx };
  const recompute = () => {
    let v = kcal * (1 + state.pct / 100) + state.add;
    if (state.set != null) v = state.set;
    live.kcal = Math.round(v);
  };
  recompute();
  for (const rule of studio.rules || []) {
    if (rule.enabled === false) continue;
    if (!ruleMatches(rule, live)) continue;
    applied.push({ id: rule.id, name: rule.name });
    for (const a of rule.actions || []) {
      const val = a.value;
      switch (a.type) {
        case 'kcal_pct': state.pct += Number(val) || 0; break;
        case 'kcal_add': state.add += Number(val) || 0; break;
        case 'kcal_set': state.set = Number(val) || null; break;
        case 'kcal_min': state.min = Math.max(state.min, Number(val) || 0); break;
        case 'kcal_max': state.max = Math.min(state.max, Number(val) || state.max); break;
        case 'macros_set': if (val && val.protein + val.carbs + val.fat > 0) state.macros = { protein: Number(val.protein), carbs: Number(val.carbs), fat: Number(val.fat) }; break;
        case 'water_add': state.waterAdd += Number(val) || 0; break;
        case 'water_per_kg': state.waterPerKg = Number(val) || state.waterPerKg; break;
        case 'exclude_words': state.exclude.push(...words(val)); break;
        case 'prefer_words': state.prefer.push(...words(val)); break;
        case 'supplement': if (val) supplements.push(String(val)); break;
        case 'note': if (val) notes.push(String(val)); break;
        case 'flag_review': flags.push({ rule: rule.name, reason: String(val || rule.name) }); break;
        default: break;
      }
    }
    recompute();
    if (rule.stop) break;
  }

  // 3) Targets
  let final = live.kcal;
  final = clamp(final, state.min, Math.max(state.min, state.max));
  final = roundTo(final, cal.roundTo || 1);
  const m = state.macros;
  const mt = m.protein + m.carbs + m.fat || 100;
  if (Math.abs(mt - 100) > 1) warnings.push(`Macro split adds up to ${mt}%, so it was scaled to 100%.`);
  const targets = {
    kcal: final,
    protein: Math.round((final * (m.protein / mt)) / 4),
    carbs: Math.round((final * (m.carbs / mt)) / 4),
    fat: Math.round((final * (m.fat / mt)) / 9),
    waterMl: ctx.weightKg
      ? clamp(roundTo(ctx.weightKg * state.waterPerKg + state.waterAdd, studio.water.roundTo || 1), studio.water.min, studio.water.max)
      : clamp(roundTo(2500 + state.waterAdd, studio.water.roundTo || 1), studio.water.min, studio.water.max),
  };

  // 4) Foods
  const rnd = seeded(opts.seed ?? 1);
  let diet = DIET_MAP[ctx.dietType] || ctx.dietType;
  if (!['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'].includes(diet)) {
    diet = 'Vegetarian';
    warnings.push('Diet type was missing, so vegetarian foods were used.');
  }
  const excluded = exclusionWords(ctx, studio, state.exclude);
  const prefer = state.prefer;
  const okFood = (f) => !excluded.some((w) => lc(f.name).includes(w));
  const prefScore = (f) => (prefer.some((w) => lc(f.name).includes(w)) ? 1 : 0);
  const used = new Set();
  const pickFrom = (pool) => {
    const fresh = pool.filter((f) => !used.has(f.name));
    const list = fresh.length ? fresh : pool;
    if (!list.length) return null;
    const pref = list.filter((f) => prefScore(f));
    const base = pref.length && rnd() < 0.7 ? pref : list.slice(0, Math.max(3, Math.ceil(list.length * 0.6)));
    const f = base[Math.floor(rnd() * base.length)];
    used.add(f.name);
    return f;
  };

  const shareTotal = (studio.slots || []).reduce((s, x) => s + x.share, 0) || 100;
  if (Math.abs(shareTotal - 100) > 1) warnings.push(`Meal shares add up to ${shareTotal}%, so they were scaled to 100%.`);
  const meals = [];
  for (const slot of studio.slots || []) {
    const budget = (targets.kcal * slot.share) / shareTotal;
    const pool = searchFoods({ country: ctx.country, state: ctx.state, cuisine: ctx.cuisine, meal: slot.meal, diet, limit: 300 }).filter(okFood);
    if (!pool.length) { warnings.push(`No suitable foods found for ${slot.name} with this patient's region, diet and exclusions.`); continue; }
    const items = [];
    let total = 0;
    const add = (f) => { if (f && items.length < slot.maxItems && total + f.kcal <= budget * 1.2) { items.push({ name: f.name, qty: f.qty, kcal: f.kcal, type: f.type }); total += f.kcal; } };
    if (slot.meal === 'L' || slot.meal === 'D') {
      for (const types of [['g'], ['d', 'p'], ['v']]) add(pickFrom(pool.filter((f) => types.includes(f.type))));
      for (let i = 0; i < 3 && total < budget * 0.85; i += 1) add(pickFrom(pool.filter((f) => ['g', 'v', 'x'].includes(f.type))));
    } else {
      for (let i = 0; i < slot.maxItems + 2 && total < budget * 0.85; i += 1) add(pickFrom(pool));
    }
    if (!items.length) { // budget too small for any single food: take the lightest one
      const f = [...pool].sort((a, b) => a.kcal - b.kcal)[0];
      items.push({ name: f.name, qty: f.qty, kcal: f.kcal, type: f.type });
      total = f.kcal;
    }
    // Fill a shortfall by enlarging the portion of one item (x1.5 or x2) instead of inventing foods.
    if (total < budget * 0.9) {
      const big = [...items].sort((a, b) => (['g', 'p', 'd'].includes(b.type) ? 1 : 0) - (['g', 'p', 'd'].includes(a.type) ? 1 : 0) || b.kcal - a.kcal)[0];
      const extra = clamp(Math.round(((budget - total) / big.kcal) * 2) / 2, 0, 1);
      if (extra > 0) { const mult = 1 + extra; total += big.kcal * extra; big.qty = `${mult} x ${big.qty}`; big.kcal = Math.round(big.kcal * mult); }
    }
    meals.push({ time: slot.time, name: slot.name, items: items.map(({ type: _t, ...rest }) => rest) });
  }
  if (!meals.length) return { error: 'No foods matched this patient. Widen the region or relax the food exclusions.', warnings, flags, applied };

  const got = meals.reduce((s, ml) => s + ml.items.reduce((a, i) => a + i.kcal, 0), 0);
  const gap = Math.abs(got - targets.kcal) / targets.kcal;
  if (gap > 0.12) warnings.push(`The chosen foods add up to ${got} kcal against a ${targets.kcal} kcal target. The dietitian should adjust portions.`);

  const title = String(studio.titleTemplate || '{{kcal}} kcal plan')
    .replace(/\{\{kcal\}\}/g, String(targets.kcal)).replace(/\{\{name\}\}/g, ctx.name.split(' ')[0] || '')
    .replace(/\{\{cuisine\}\}/g, ctx.cuisine || ctx.country || '').replace(/\s+/g, ' ').trim().slice(0, 120) || `${targets.kcal} kcal plan`;

  return {
    title,
    region: { country: ctx.country, state: ctx.state, cuisine: ctx.cuisine },
    targets, meals, gotKcal: got,
    supplements: supplements.join(' ').slice(0, 300),
    notes: [...new Set(notes)].join('\n').slice(0, 1000),
    flags, applied, warnings, excluded,
  };
}

/** Light structural check used when the Lead saves the studio. Returns a list of problems. */
export function validateStudio(s) {
  const e = [];
  const total = (s.slots || []).reduce((a, x) => a + Number(x.share || 0), 0);
  if (!s.slots?.length) e.push('Add at least one meal slot.');
  if (s.slots?.length && Math.abs(total - 100) > 0.5) e.push(`Meal shares must add up to 100% (now ${total}%).`);
  const m = s.macros;
  if (Math.abs(m.protein + m.carbs + m.fat - 100) > 0.5) e.push(`Default macro split must add up to 100% (now ${m.protein + m.carbs + m.fat}%).`);
  if (s.calories.minKcal > s.calories.maxKcal) e.push('Minimum calories cannot be above the maximum.');
  (s.rules || []).forEach((r, i) => {
    r.actions?.forEach((a) => {
      if (a.type === 'macros_set') {
        const t = a.value?.protein + a.value?.carbs + a.value?.fat;
        if (Math.abs(t - 100) > 0.5) e.push(`Rule "${r.name || i + 1}": macro split must add up to 100% (now ${t}%).`);
      }
    });
  });
  return e;
}
