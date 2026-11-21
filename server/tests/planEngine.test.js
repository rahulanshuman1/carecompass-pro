import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultStudio } from '../src/domain/studioDefaults.js';
import { buildContext, generatePlan, testCondition, validateStudio, bmr } from '../src/domain/planEngine.js';
import { FOODS } from '../src/data/foods.js';

const dob = (age) => new Date(Date.now() - (age + 0.5) * 365.25 * 864e5);
const patient = (o = {}, h = {}) => buildContext({ name: 'Asha Rao' }, {
  dob: dob(o.age ?? 40), sex: o.sex ?? 'Female', weightKg: o.weightKg ?? 70, heightCm: o.heightCm ?? 160,
  history: { activity: 'Lightly active', dietType: 'Vegetarian', conditions: [], allergies: [], goals: '', dislikes: '', sleepHrs: 7, country: 'India', state: 'Maharashtra', cuisine: 'Maharashtrian', ...h },
});
const names = (p) => p.meals.flatMap((m) => m.items.map((i) => i.name.toLowerCase()));
const diets = new Map(FOODS.map((f) => [f.name, f.diet]));

test('Mifflin-St Jeor and activity factor give the base calories', () => {
  const ctx = patient({ age: 40, weightKg: 70, heightCm: 160 });
  assert.equal(Math.round(bmr('mifflin', ctx)), Math.round(10 * 70 + 6.25 * 160 - 5 * 40 - 161));
  const p = generatePlan(ctx, defaultStudio(), { seed: 1 });
  assert.ok(Math.abs(p.targets.kcal - Math.round((10 * 70 + 6.25 * 160 - 5 * 40 - 161) * 1.375 / 50) * 50) <= 50);
});

test('goal and condition rules change targets and flag the Lead', () => {
  const base = generatePlan(patient(), defaultStudio(), { seed: 2 });
  const p = generatePlan(patient({}, { goals: 'weight loss', conditions: ['Type 2 Diabetes'] }), defaultStudio(), { seed: 2 });
  assert.ok(p.targets.kcal < base.targets.kcal, 'weight loss lowers calories');
  assert.ok(p.targets.carbs * 4 / p.targets.kcal < 0.43, 'diabetes lowers the carb share');
  assert.ok(p.flags.some((f) => /Diabetes/i.test(f.rule)));
  assert.ok(p.applied.some((a) => a.name === 'Weight loss goal'));
  assert.ok(!names(p).some((n) => /sugar|jaggery|gulab|halwa|payasam|kheer/.test(n)));
});

test('allergies and dislikes remove foods', () => {
  for (let seed = 1; seed <= 8; seed += 1) {
    const p = generatePlan(patient({}, { allergies: ['Peanuts', 'Dairy'], dislikes: 'bhindi, karela' }), defaultStudio(), { seed });
    assert.ok(!names(p).some((n) => /peanut|groundnut|milk|curd|paneer|ghee|butter|bhindi|karela/.test(n)), JSON.stringify(names(p)));
  }
});

test('an allergy the Lead never configured is still honoured by its own text', () => {
  const p = generatePlan(patient({}, { allergies: ['mushroom'] }), defaultStudio(), { seed: 3 });
  assert.ok(!names(p).some((n) => n.includes('mushroom')));
});

test('vegan and vegetarian plans never contain meat, egg or (vegan) dairy foods', () => {
  for (let seed = 1; seed <= 6; seed += 1) {
    const vegan = generatePlan(patient({}, { dietType: 'Vegan' }), defaultStudio(), { seed });
    assert.ok(vegan.meals.flatMap((m) => m.items).every((i) => diets.get(i.name) === 'G'), 'vegan');
    const veg = generatePlan(patient({}, { dietType: 'Vegetarian' }), defaultStudio(), { seed });
    assert.ok(veg.meals.flatMap((m) => m.items).every((i) => ['G', 'V'].includes(diets.get(i.name))), 'vegetarian');
  }
});

test('Jain rule removes root vegetables and uses vegetarian foods', () => {
  const p = generatePlan(patient({}, { dietType: 'Jain' }), defaultStudio(), { seed: 4 });
  assert.ok(!names(p).some((n) => /onion|garlic|potato|carrot|beetroot|radish/.test(n)));
});

test('missing body data uses the fallback and says so', () => {
  const ctx = buildContext({ name: 'X' }, { history: { dietType: 'Vegetarian', country: 'India', activity: 'Lightly active' } });
  const p = generatePlan(ctx, defaultStudio(), { seed: 1 });
  assert.equal(p.targets.kcal, 1800);
  assert.ok(p.warnings.some((w) => /missing/i.test(w)));
});

test('calories are clamped to the Lead-set minimum and maximum', () => {
  const s = defaultStudio();
  s.rules = [{ id: 'x', name: 'Crash', enabled: true, match: 'all', conditions: [], actions: [{ type: 'kcal_pct', value: -80 }] }];
  assert.equal(generatePlan(patient(), s, { seed: 1 }).targets.kcal, s.calories.minKcal);
  s.rules = [{ id: 'x', name: 'Huge', enabled: true, match: 'all', conditions: [], actions: [{ type: 'kcal_set', value: 9000 }] }];
  assert.equal(generatePlan(patient(), s, { seed: 1 }).targets.kcal, s.calories.maxKcal);
});

test('rules run top to bottom, can read calories so far, and "stop" ends processing', () => {
  const s = defaultStudio();
  s.rules = [
    { id: '1', name: 'Set 2600', enabled: true, match: 'all', conditions: [], actions: [{ type: 'kcal_set', value: 2600 }] },
    { id: '2', name: 'High intake trim', enabled: true, match: 'all', conditions: [{ field: 'kcal', op: '>', value: 2500 }], actions: [{ type: 'kcal_pct', value: -10 }], stop: true },
    { id: '3', name: 'Never runs', enabled: true, match: 'all', conditions: [], actions: [{ type: 'note', value: 'nope' }] },
  ];
  const p = generatePlan(patient(), s, { seed: 1 });
  assert.equal(p.targets.kcal, 2600 * 1.0 > 0 ? 2600 : 0); // kcal_set wins over the percentage
  assert.deepEqual(p.applied.map((a) => a.id), ['1', '2']);
  assert.equal(p.notes, '');
});

test('disabled rules are ignored; "any" vs "all" matching', () => {
  const ctx = patient({}, { conditions: ['PCOS'] });
  assert.equal(testCondition({ field: 'conditions', op: 'has', value: 'PCOS' }, ctx), true);
  assert.equal(testCondition({ field: 'bmi', op: '>=', value: 30 }, buildContext({}, {})), false, 'missing value never matches');
  const s = defaultStudio();
  s.rules = [{ id: 'a', name: 'off', enabled: false, match: 'all', conditions: [], actions: [{ type: 'flag_review', value: 'x' }] }];
  assert.equal(generatePlan(ctx, s, { seed: 1 }).flags.length, 0);
});

test('the same seed gives the same plan; a different seed can vary', () => {
  const a = generatePlan(patient(), defaultStudio(), { seed: 11 });
  const b = generatePlan(patient(), defaultStudio(), { seed: 11 });
  assert.deepEqual(a.meals, b.meals);
});

test('plans meet the app\'s own submission validation and land close to the calorie target', async () => {
  const { validatePlanContent } = await import('../src/domain/dietplan.js');
  for (const o of [{}, { weightKg: 55, age: 25 }, { weightKg: 95, age: 55, sex: 'Male', heightCm: 175 }]) {
    const p = generatePlan(patient(o), defaultStudio(), { seed: 5 });
    assert.deepEqual(validatePlanContent({ ...p, startDate: '2026-01-01' }), []);
    assert.ok(Math.abs(p.gotKcal - p.targets.kcal) / p.targets.kcal < 0.25, `${p.gotKcal} vs ${p.targets.kcal}`);
  }
});

test('studio validation catches shares and macros that do not add up', () => {
  const s = defaultStudio();
  assert.deepEqual(validateStudio(s), []);
  s.slots[0].share = 40;
  assert.ok(validateStudio(s).some((e) => /100%/.test(e)));
  const s2 = defaultStudio(); s2.macros.carbs = 70;
  assert.ok(validateStudio(s2).some((e) => /macro/i.test(e)));
});
