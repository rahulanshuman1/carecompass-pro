/**
 * Plan Studio: the no-code configuration the Lead Doctor edits (drag and drop) and the engine reads.
 * These are STARTER defaults. They are editable, and every generated plan still goes to the Lead for approval.
 */
export const FIELDS = {
  age: { label: 'Age (years)', type: 'number' },
  sex: { label: 'Sex', type: 'enum', options: ['Female', 'Male', 'Other'] },
  bmi: { label: 'BMI', type: 'number' },
  weightKg: { label: 'Weight (kg)', type: 'number' },
  heightCm: { label: 'Height (cm)', type: 'number' },
  kcal: { label: 'Calories so far', type: 'number' },
  activity: { label: 'Activity level', type: 'enum', options: ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'] },
  dietType: { label: 'Diet type', type: 'enum', options: ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan', 'Jain'] },
  conditions: { label: 'Health conditions', type: 'list', options: ['Type 2 Diabetes', 'Hypertension', 'PCOS', 'Thyroid disorder', 'High cholesterol', 'Obesity', 'Kidney disease', 'IBS / gut issues'] },
  allergies: { label: 'Allergies', type: 'list' },
  goals: { label: 'Goals (text)', type: 'text' },
  dislikes: { label: 'Dislikes (text)', type: 'text' },
  sleepHrs: { label: 'Sleep (hours)', type: 'number' },
  smoking: { label: 'Smoking', type: 'enum', options: ['Never', 'Former', 'Occasionally', 'Daily'] },
  alcohol: { label: 'Alcohol', type: 'enum', options: ['Never', 'Occasionally', 'Weekly', 'Daily'] },
  country: { label: 'Country', type: 'text' },
  state: { label: 'State', type: 'text' },
  cuisine: { label: 'Cuisine', type: 'text' },
};

export const OPS = {
  number: [['>=', 'is at least'], ['>', 'is more than'], ['<=', 'is at most'], ['<', 'is less than'], ['=', 'equals'], ['!=', 'is not']],
  enum: [['=', 'is'], ['!=', 'is not'], ['in', 'is one of']],
  text: [['contains', 'contains'], ['not_contains', 'does not contain'], ['=', 'is'], ['!=', 'is not']],
  list: [['has', 'includes'], ['not_has', 'does not include'], ['any', 'has anything'], ['none', 'is empty']],
};

export const ACTIONS = {
  kcal_pct: { label: 'Change calories by %', input: 'number', hint: 'e.g. -15 or 10' },
  kcal_add: { label: 'Add or remove calories', input: 'number', hint: 'e.g. -200' },
  kcal_set: { label: 'Set calories to', input: 'number', hint: 'kcal per day' },
  kcal_min: { label: 'Never go below calories', input: 'number', hint: 'kcal per day' },
  kcal_max: { label: 'Never go above calories', input: 'number', hint: 'kcal per day' },
  macros_set: { label: 'Set macro split (% of calories)', input: 'macros' },
  water_add: { label: 'Add water (ml)', input: 'number', hint: 'e.g. 500' },
  water_per_kg: { label: 'Water per kg body weight (ml)', input: 'number', hint: 'e.g. 40' },
  exclude_words: { label: 'Leave out foods containing', input: 'text', hint: 'comma separated words' },
  prefer_words: { label: 'Prefer foods containing', input: 'text', hint: 'comma separated words' },
  supplement: { label: 'Add supplement advice', input: 'text', hint: 'text shown on the plan' },
  note: { label: 'Add a note to the plan', input: 'text', hint: 'text shown on the plan' },
  flag_review: { label: 'Flag for doctor attention', input: 'text', hint: 'why the Lead should look closely' },
};

let n = 0;
const id = (p) => `${p}${(n += 1)}`;
const rule = (name, match, conditions, actions, extra = {}) => ({ id: id('r'), name, enabled: true, match, conditions, actions, stop: false, ...extra });
const slot = (name, time, meal, share, maxItems) => ({ id: id('s'), name, time, meal, share, maxItems });

export function defaultStudio() {
  n = 0;
  return {
    calories: {
      method: 'mifflin', // mifflin | harris | fixed
      fixedKcal: 1800,
      fallbackKcal: 1800, // when height, weight, age or sex is missing
      activity: { Sedentary: 1.2, 'Lightly active': 1.375, 'Moderately active': 1.55, 'Very active': 1.725 },
      defaultActivity: 1.375,
      minKcal: 1200,
      maxKcal: 3500,
      roundTo: 50,
    },
    macros: { protein: 20, carbs: 50, fat: 30 },
    water: { perKg: 35, min: 1500, max: 4500, roundTo: 100 },
    titleTemplate: '{{kcal}} kcal {{cuisine}} plan',
    slots: [
      slot('Breakfast', '08:00', 'B', 25, 2),
      slot('Mid-morning snack', '11:00', 'S', 10, 1),
      slot('Lunch', '13:30', 'L', 30, 4),
      slot('Evening snack', '17:00', 'S', 10, 1),
      slot('Dinner', '20:00', 'D', 25, 4),
    ],
    allergens: [
      { id: id('a'), name: 'Peanuts', aliases: ['peanut', 'groundnut'], foodWords: ['peanut', 'groundnut'] },
      { id: id('a'), name: 'Tree nuts', aliases: ['tree nut', 'nuts', 'almond', 'cashew', 'walnut'], foodWords: ['almond', 'cashew', 'walnut', 'pistachio'] },
      { id: id('a'), name: 'Dairy', aliases: ['dairy', 'milk', 'lactose'], foodWords: ['milk', 'curd', 'paneer', 'ghee', 'butter', 'cheese', 'yogurt', 'lassi', 'chaas', 'raita', 'kheer'] },
      { id: id('a'), name: 'Gluten / wheat', aliases: ['gluten', 'wheat', 'celiac', 'coeliac'], foodWords: ['wheat', 'phulka', 'roti', 'chapati', 'paratha', 'daliya', 'oats', 'bread', 'rava', 'poori', 'upma'] },
      { id: id('a'), name: 'Egg', aliases: ['egg'], foodWords: ['egg', 'omelette'] },
      { id: id('a'), name: 'Soy', aliases: ['soy'], foodWords: ['soy', 'tofu'] },
      { id: id('a'), name: 'Fish', aliases: ['fish'], foodWords: ['fish'] },
      { id: id('a'), name: 'Shellfish', aliases: ['shellfish', 'prawn', 'shrimp', 'crab'], foodWords: ['prawn', 'shrimp', 'crab'] },
      { id: id('a'), name: 'Sesame', aliases: ['sesame', 'til'], foodWords: ['sesame', 'til '] },
    ],
    rules: [
      rule('Weight loss goal', 'any', [{ field: 'goals', op: 'contains', value: 'weight loss' }, { field: 'goals', op: 'contains', value: 'lose' }, { field: 'goals', op: 'contains', value: 'fat loss' }], [{ type: 'kcal_pct', value: -15 }]),
      rule('Muscle or weight gain goal', 'any', [{ field: 'goals', op: 'contains', value: 'gain' }, { field: 'goals', op: 'contains', value: 'muscle' }], [{ type: 'kcal_pct', value: 10 }]),
      rule('Underweight (BMI below 18.5)', 'all', [{ field: 'bmi', op: '<', value: 18.5 }], [{ type: 'kcal_pct', value: 10 }, { type: 'flag_review', value: 'Underweight: confirm a safe calorie target.' }]),
      rule('Obesity (BMI 30 or more)', 'all', [{ field: 'bmi', op: '>=', value: 30 }], [{ type: 'kcal_pct', value: -10 }, { type: 'water_add', value: 300 }]),
      rule('Type 2 Diabetes', 'all', [{ field: 'conditions', op: 'has', value: 'Type 2 Diabetes' }], [
        { type: 'macros_set', value: { protein: 25, carbs: 40, fat: 35 } },
        { type: 'exclude_words', value: 'sugar, jaggery, sweet, gulab, halwa, payasam, kheer' },
        { type: 'note', value: 'Diabetes: keep meal timings regular and avoid sugary drinks and sweets.' },
        { type: 'flag_review', value: 'Diabetes: check against medication and recent labs.' },
      ]),
      rule('Hypertension', 'all', [{ field: 'conditions', op: 'has', value: 'Hypertension' }], [
        { type: 'exclude_words', value: 'pickle, papad' },
        { type: 'note', value: 'High blood pressure: keep salt low and avoid pickles, papad and packaged snacks.' },
        { type: 'flag_review', value: 'Hypertension: check sodium advice with the doctor.' },
      ]),
      rule('PCOS', 'all', [{ field: 'conditions', op: 'has', value: 'PCOS' }], [{ type: 'macros_set', value: { protein: 25, carbs: 40, fat: 35 } }, { type: 'note', value: 'PCOS: prefer whole grains, protein with every meal, limit refined sugar.' }]),
      rule('High cholesterol', 'all', [{ field: 'conditions', op: 'has', value: 'High cholesterol' }], [{ type: 'exclude_words', value: 'fried, butter, ghee' }, { type: 'note', value: 'High cholesterol: limit fried food and saturated fat.' }]),
      rule('Thyroid disorder', 'all', [{ field: 'conditions', op: 'has', value: 'Thyroid disorder' }], [{ type: 'flag_review', value: 'Thyroid: confirm medication timing and iodine advice.' }]),
      rule('Kidney disease', 'all', [{ field: 'conditions', op: 'has', value: 'Kidney disease' }], [
        { type: 'macros_set', value: { protein: 15, carbs: 55, fat: 30 } },
        { type: 'flag_review', value: 'Kidney disease: protein, potassium and phosphorus need an individual doctor-set target.' },
      ]),
      rule('Under 18', 'all', [{ field: 'age', op: '<', value: 18 }], [{ type: 'kcal_min', value: 1600 }, { type: 'flag_review', value: 'Minor: confirm targets with a paediatric-aware doctor.' }]),
      rule('Age 60 and over', 'all', [{ field: 'age', op: '>=', value: 60 }], [{ type: 'macros_set', value: { protein: 25, carbs: 45, fat: 30 } }]),
      rule('Jain diet', 'all', [{ field: 'dietType', op: '=', value: 'Jain' }], [{ type: 'exclude_words', value: 'onion, garlic, potato, carrot, beetroot, radish' }, { type: 'note', value: 'Jain diet: no root vegetables.' }]),
      rule('Poor sleep', 'all', [{ field: 'sleepHrs', op: '<', value: 6 }], [{ type: 'note', value: 'Sleep under 6 hours can raise appetite. Aim for 7 to 8 hours.' }]),
    ],
  };
}
