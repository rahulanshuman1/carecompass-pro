/**
 * Regional food catalogue used by dietitians to build cuisine-, state- and country-aware plans.
 * Values are typical household-portion estimates, not lab-analysed data: the dietitian always
 * reviews and edits them before a plan is submitted.
 *
 * Line format: name;portion;kcal;meal;diet;type
 *   meal: B breakfast, S snack, L lunch, D dinner, LD lunch or dinner
 *   diet: G vegan, V vegetarian, E eggetarian, N non-vegetarian
 *   type: g grain/bread, d dal/legume, v vegetable, p protein (paneer/egg/meat/fish), x other
 */
const BLOCKS = [
  // ---------- India, pan-Indian and regional groups ----------
  ['India', '', 'Pan-Indian', `
Vegetable poha with peanuts;1 plate;250;B;G;x
Moong dal chilla;2 pieces;200;B;G;x
Vegetable oats upma;1 bowl;220;B;G;x
Besan chilla with mint chutney;2 pieces;220;B;G;x
Vegetable daliya (broken wheat);1 bowl;210;B;G;x
Boiled eggs;2 eggs;140;B;E;p
Egg bhurji;2 eggs;200;B;E;p
Phulka (whole wheat);2 pieces;160;LD;G;g
Brown rice;1 cup cooked;215;LD;G;g
Dal tadka;1 cup;180;LD;V;d
Plain moong dal;1 cup;150;LD;G;d
Rajma;1 cup;210;LD;G;d
Mixed vegetable sabzi;1 cup;110;LD;G;v
Palak sabzi;1 cup;100;LD;G;v
Lauki sabzi;1 cup;90;LD;G;v
Paneer bhurji;100 g;250;LD;V;p
Grilled paneer tikka;100 g;250;LD;V;p
Grilled chicken;120 g;200;LD;N;p
Chicken curry (home style);1 cup;250;LD;N;p
Fish curry;1 cup;200;LD;N;p
Curd;100 g;60;LD;V;x
Cucumber tomato salad;1 bowl;50;LD;G;v
Sprouts chaat;1 bowl;140;S;G;x
Roasted chana;30 g;110;S;G;x
Buttermilk (chaas);1 glass;40;S;V;x
Almonds;8 pieces;55;S;G;x
Apple;1 medium;80;S;G;x
Papaya;1 cup;60;S;G;x
Guava;1 medium;70;S;G;x
Roasted makhana;1 bowl;100;S;G;x
Green tea;1 cup;5;S;G;x
`],
  ['India', '', 'North Indian', `
Missi roti with curd;2 pieces + 100 g;300;B;V;g
Paneer paratha (light oil);1 piece;300;B;V;g
Aloo gobi;1 cup;150;LD;G;v
Baingan bharta;1 cup;150;LD;G;v
Chole;1 cup;240;LD;G;d
Kadhi with rice;1 cup + 1/2 cup;280;LD;V;d
Mattar paneer;1 cup;260;LD;V;p
Tandoori roti;2 pieces;200;LD;G;g
Bhindi masala;1 cup;120;LD;G;v
Sattu drink;1 glass;150;S;G;x
`],
  ['India', '', 'South Indian', `
Idli with sambar;3 idli + 1 cup;250;B;G;x
Plain dosa with sambar;1 dosa + 1 cup;200;B;G;x
Ragi dosa;2 pieces;200;B;G;x
Vegetable upma;1 bowl;220;B;G;x
Pesarattu;2 pieces;240;B;G;x
Sambar;1 cup;120;LD;G;d
Rasam;1 cup;60;LD;G;d
Curd rice;1 bowl;200;LD;V;g
Beans poriyal;1 cup;100;LD;G;v
Cabbage thoran;1 cup;110;LD;G;v
Sundal (chickpea);1 bowl;150;S;G;x
Filter coffee (little sugar);1 cup;60;S;V;x
`],
  ['India', '', 'Jain', `
Moong dal chilla (no onion, garlic);2 pieces;200;B;G;x
Methi thepla;2 pieces;200;B;G;g
Khichdi (no onion, garlic);1 bowl;250;LD;V;g
Dudhi sabzi (no onion, garlic);1 cup;90;LD;G;v
Paneer bhurji (no onion, garlic);100 g;250;LD;V;p
Moong dal (no onion, garlic);1 cup;150;LD;G;d
Khakhra;2 pieces;120;S;G;x
`],
  // ---------- Indian states ----------
  ['India', 'Maharashtra', 'Maharashtrian', `
Kanda poha;1 plate;250;B;G;x
Thalipeeth;2 pieces;300;B;G;g
Sabudana khichdi (small portion);1 small bowl;220;B;G;x
Misal (sprout curry) with 1 pav;1 plate;380;B;V;x
Jowar bhakri;2 pieces;200;LD;G;g
Bajra bhakri;2 pieces;220;LD;G;g
Pithla;1 cup;150;LD;G;d
Varan (dal) with rice;1 cup + 1/2 cup;280;LD;G;d
Matki usal;1 cup;160;LD;G;d
Amti;1 cup;120;LD;G;d
Bharli vangi (stuffed brinjal);1 cup;160;LD;G;v
Zunka;1 cup;150;LD;G;v
Chicken sukka;100 g;220;LD;N;p
Bombil or surmai fish curry;1 cup;200;LD;N;p
Sprouts bhel;1 bowl;140;S;G;x
Solkadhi;1 glass;60;S;G;x
`],
  ['India', 'Gujarat', 'Gujarati', `
Khaman dhokla;4 pieces;200;B;G;x
Methi thepla;2 pieces;200;B;G;g
Handvo;1 slice;180;B;G;x
Steamed muthia;4 pieces;180;B;G;x
Bajra rotla;2 pieces;220;LD;G;g
Rotli;2 pieces;160;LD;G;g
Gujarati dal;1 cup;150;LD;G;d
Sev tameta nu shaak;1 cup;170;LD;G;v
Undhiyu;1 cup;220;LD;G;v
Gujarati kadhi;1 cup;130;LD;V;d
Vaghareli khichdi;1 bowl;250;LD;V;g
Roasted makhana;1 bowl;100;S;G;x
Chaas;1 glass;40;S;V;x
`],
  ['India', 'Punjab', 'Punjabi', `
Besan chilla;2 pieces;220;B;G;x
Sarson ka saag with 1 makki roti;1 cup + 1 roti;330;LD;V;v
Dal makhani (light);1 cup;260;LD;V;d
Rajma masala;1 cup;210;LD;G;d
Palak paneer;1 cup;260;LD;V;p
Tandoori chicken;150 g;250;LD;N;p
Punjabi chicken curry;1 cup;280;LD;N;p
Egg curry;2 eggs + gravy;230;LD;E;p
Lassi (unsweetened);1 glass;130;S;V;x
`],
  ['India', 'Rajasthan', 'Rajasthani', `
Bajra khichdi;1 bowl;250;B;G;g
Moong dal cheela;2 pieces;200;B;G;x
Bajra roti;2 pieces;220;LD;G;g
Gatte ki sabzi;1 cup;250;LD;V;d
Ker sangri;1 cup;160;LD;G;v
Panchmel dal;1 cup;180;LD;V;d
Dal baati (1 baati + dal);1 serving;350;LD;V;d
Laal maas (lean);100 g;300;LD;N;p
Roasted papad;1 piece;50;S;G;x
`],
  ['India', 'Uttar Pradesh', 'Uttar Pradeshi', `
Vegetable daliya;1 bowl;200;B;G;x
Besan cheela;2 pieces;220;B;G;x
Arhar dal;1 cup;160;LD;G;d
Aloo tamatar sabzi;1 cup;150;LD;G;v
Bati with chokha;1 bati + chokha;280;LD;V;g
Kadhi chawal;1 cup + 1/2 cup;280;LD;V;d
Chicken seekh kebab;100 g;220;LD;N;p
Awadhi chicken korma (light);1 cup;300;LD;N;p
Sattu paratha;1 piece;280;B;G;g
`],
  ['India', 'Bihar', 'Bihari', `
Sattu paratha;1 piece;280;B;G;g
Chura (poha) with curd;1 bowl;250;B;V;x
Litti with chokha;2 litti + chokha;380;LD;V;g
Chana ghugni;1 cup;200;LD;G;d
Kadhi bari;1 cup;220;LD;V;d
Dal with 2 rotis;1 cup + 2 rotis;330;LD;G;d
Sattu sharbat;1 glass;150;S;G;x
`],
  ['India', 'West Bengal', 'Bengali', `
Muri (puffed rice) bhel;1 bowl;120;B;G;x
Chana ghugni;1 cup;200;B;G;d
Ruti with aloo dum;2 rotis + 1/2 cup;300;B;G;g
Machher jhol (fish curry);1 piece + 1 cup;220;LD;N;p
Dim er jhol (egg curry);2 eggs + gravy;230;LD;E;p
Shukto;1 cup;140;LD;V;v
Cholar dal;1 cup;170;LD;V;d
Alu posto;1 cup;200;LD;G;v
Lau ghonto;1 cup;100;LD;G;v
Doi (curd);100 g;70;S;V;x
`],
  ['India', 'Tamil Nadu', 'Tamil', `
Idli with sambar;3 idli + 1 cup;250;B;G;x
Ven pongal;1 bowl;250;B;V;x
Kambu koozh;1 glass;120;B;G;x
Keerai poriyal;1 cup;90;LD;G;v
Kootu;1 cup;130;LD;G;d
Sambar rice;1 bowl;280;LD;G;g
Chettinad chicken;100 g;230;LD;N;p
Fish kuzhambu;1 cup;200;LD;N;p
Sundal;1 bowl;150;S;G;x
Neer mor (spiced buttermilk);1 glass;35;S;V;x
`],
  ['India', 'Kerala', 'Kerala', `
Appam with vegetable stew;2 appam + 1 cup;300;B;G;x
Puttu with kadala curry;1 piece + 1/2 cup;330;B;G;x
Idiyappam with stew;3 pieces + 1 cup;300;B;G;x
Avial;1 cup;160;LD;G;v
Cabbage thoran;1 cup;110;LD;G;v
Parippu curry;1 cup;140;LD;G;d
Matta rice;1 cup cooked;170;LD;G;g
Meen curry (fish);1 piece + 1 cup;200;LD;N;p
Karimeen pollichathu;1 piece;250;LD;N;p
Kerala chicken stew;1 cup;260;LD;N;p
Egg roast;2 eggs;230;LD;E;p
Steamed nendran banana;1 medium;120;S;G;x
`],
  ['India', 'Karnataka', 'Kannadiga', `
Ragi dosa;2 pieces;200;B;G;x
Akki roti;2 pieces;260;B;G;g
Uppittu;1 bowl;220;B;G;x
Neer dosa;2 pieces;120;B;G;x
Ragi mudde;2 balls;250;LD;G;g
Jolada rotti;2 pieces;200;LD;G;g
Bisi bele bath;1 bowl;280;LD;V;g
Saaru;1 cup;70;LD;G;d
Bendekai palya;1 cup;110;LD;G;v
Mangalorean fish curry;1 cup;210;LD;N;p
Kosambari;1 bowl;100;S;G;x
Majjige (buttermilk);1 glass;40;S;V;x
`],
  ['India', 'Andhra Pradesh', 'Andhra', `
Pesarattu;2 pieces;240;B;G;x
Upma;1 bowl;220;B;G;x
Jonna roti;2 pieces;200;LD;G;g
Ragi sangati;2 balls;250;LD;G;g
Mudda pappu;1 cup;160;LD;G;d
Gutti vankaya;1 cup;200;LD;G;v
Perugu annam (curd rice);1 bowl;200;LD;V;g
Andhra chicken curry;1 cup;270;LD;N;p
Royyala vepudu (prawns);100 g;200;LD;N;p
`],
  ['India', 'Assam', 'Assamese', `
Jolpan (chira with curd);1 bowl;250;B;V;x
Aloo pitika;1 serving;130;LD;G;v
Xaak bhaji (greens);1 cup;80;LD;G;v
Masor tenga (sour fish curry);1 cup;190;LD;N;p
Assamese dali;1 cup;150;LD;G;d
Steamed rice;1 cup cooked;200;LD;G;g
`],
  // ---------- Other countries ----------
  ['United States', '', 'American', `
Scrambled eggs with whole wheat toast;2 eggs + 1 slice;280;B;E;p
Oatmeal with berries;1 bowl;220;B;G;x
Greek yogurt parfait;1 cup;200;B;V;x
Grilled chicken salad;1 large bowl;320;LD;N;p
Turkey sandwich (whole wheat);1 sandwich;380;LD;N;p
Veggie burger (no bun);1 patty + salad;250;LD;V;p
Grilled salmon;150 g;300;LD;N;p
Baked sweet potato;1 medium;110;LD;G;g
Steamed broccoli;1 cup;55;LD;G;v
Quinoa bowl with vegetables;1 bowl;350;LD;G;g
Apple with peanut butter;1 apple + 2 tbsp;250;S;G;x
`],
  ['United Kingdom', '', 'British', `
Porridge with milk;1 bowl;220;B;V;x
Poached eggs on wholemeal toast;2 eggs + 1 slice;250;B;E;p
Baked beans on toast;1 serving;300;B;G;x
Jacket potato with beans;1 medium;350;LD;G;g
Grilled fish with vegetables;150 g;280;LD;N;p
Chicken and vegetable soup;1 bowl;180;LD;N;p
Lean shepherd's pie;1 portion;350;LD;N;p
Vegetable soup;1 bowl;120;LD;G;v
Oatcakes with cottage cheese;3 + 50 g;200;S;V;x
`],
  ['United States', '', 'Mediterranean', `
Greek salad;1 bowl;200;LD;V;v
Whole wheat pita with tzatziki;1 pita + 50 g;220;B;V;g
Shakshuka;2 eggs;250;B;E;p
Hummus with vegetable sticks;50 g + veg;150;S;G;x
Grilled fish with lemon;150 g;250;LD;N;p
Lentil soup;1 bowl;200;LD;G;d
Baked falafel;4 pieces;220;LD;G;p
Tabbouleh;1 bowl;160;LD;G;v
Chicken souvlaki;2 skewers;280;LD;N;p
Olives;10 pieces;50;S;G;x
`],
  ['United Arab Emirates', '', 'Middle Eastern', `
Foul medames;1 bowl;250;B;G;d
Labneh with whole wheat pita;1 pita + 50 g;230;B;V;g
Chicken shawarma plate (no fries);1 plate;350;LD;N;p
Grilled hammour;150 g;240;LD;N;p
Shorbat adas (lentil soup);1 bowl;180;LD;G;d
Fattoush;1 bowl;160;LD;G;v
Chicken machboos;1 cup;300;LD;N;p
Mutabbal;50 g;80;S;G;x
Dates;3 pieces;70;S;G;x
`],
  ['United States', '', 'Mexican', `
Black bean bowl;1 bowl;320;LD;G;d
Bean and vegetable tacos (corn tortilla);2 tacos;300;LD;G;d
Chicken fajita (no tortilla);150 g;250;LD;N;p
Grilled fish tacos;2 tacos;330;LD;N;p
Egg and bean burrito bowl;1 bowl;350;B;E;p
Guacamole;50 g;80;S;G;x
Pico de gallo;1/2 cup;30;S;G;x
`],
  ['Singapore', '', 'Singaporean', `
Kaya toast with soft-boiled eggs;2 slices + 2 eggs;380;B;E;p
Steamed chicken rice (skin off);1 plate;450;LD;N;p
Fish soup with bee hoon;1 bowl;300;LD;N;p
Yong tau foo (clear soup);1 bowl;250;LD;N;p
Popiah (fresh spring roll);2 pieces;200;LD;G;x
Tofu and vegetable stir fry;1 plate;250;LD;G;p
Unsweetened soya milk;1 glass;90;S;G;x
`],
  ['Singapore', '', 'Chinese', `
Plain congee;1 bowl;150;B;G;g
Egg drop soup;1 bowl;90;LD;E;p
Steamed fish with ginger;150 g;220;LD;N;p
Steamed chicken with broccoli;1 plate;300;LD;N;p
Stir-fried tofu and vegetables;1 cup;200;LD;G;p
Hot and sour vegetable soup;1 bowl;100;LD;V;v
`],
  ['Australia', '', 'Australian', `
Avocado on sourdough with poached egg;1 slice + 1 egg;320;B;E;p
Vegemite on wholegrain toast;2 slices;180;B;G;x
Grilled barramundi with salad;150 g;280;LD;N;p
Lamb and vegetable skewers;2 skewers;300;LD;N;p
Lentil and vegetable soup;1 bowl;190;LD;G;d
Greek yogurt with fruit;1 cup;180;S;V;x
`],
  ['Nepal', '', 'Nepali', `
Dal bhat (small rice portion);1 cup dal + 3/4 cup rice;320;LD;G;d
Gundruk soup;1 bowl;70;LD;G;v
Saag (mustard greens);1 cup;90;LD;G;v
Tarkari (mixed vegetable curry);1 cup;120;LD;G;v
Steamed chicken momo;6 pieces;280;LD;N;p
Vegetable momo (steamed);6 pieces;240;LD;G;x
Sel roti (small);1 piece;150;B;V;g
`],
];

export const REGION_STATE_CUISINES = {
  Maharashtra: ['Maharashtrian'], Gujarat: ['Gujarati'], Punjab: ['Punjabi', 'North Indian'], Rajasthan: ['Rajasthani', 'North Indian'],
  'Uttar Pradesh': ['Uttar Pradeshi', 'North Indian'], Bihar: ['Bihari', 'North Indian'], 'West Bengal': ['Bengali'],
  'Tamil Nadu': ['Tamil', 'South Indian'], Kerala: ['Kerala', 'South Indian'], Karnataka: ['Kannadiga', 'South Indian'],
  'Andhra Pradesh': ['Andhra', 'South Indian'], Assam: ['Assamese'],
};

export const REGIONS = {
  India: { states: Object.keys(REGION_STATE_CUISINES).sort(), cuisines: ['Pan-Indian', 'North Indian', 'South Indian', 'Jain', ...Object.values(REGION_STATE_CUISINES).map((c) => c[0])] },
  'United States': { states: [], cuisines: ['American', 'Mediterranean', 'Mexican'] },
  'United Kingdom': { states: [], cuisines: ['British', 'Mediterranean'] },
  'United Arab Emirates': { states: [], cuisines: ['Middle Eastern', 'Mediterranean', 'Pan-Indian'] },
  Singapore: { states: [], cuisines: ['Singaporean', 'Chinese', 'Pan-Indian'] },
  Australia: { states: [], cuisines: ['Australian', 'Mediterranean'] },
  Nepal: { states: [], cuisines: ['Nepali', 'Pan-Indian'] },
};

export const FOODS = BLOCKS.flatMap(([country, state, cuisine, text]) =>
  text.trim().split('\n').map((line) => {
    const [name, qty, kcal, meal, diet, type] = line.split(';');
    return { name, qty, kcal: Number(kcal), meal, diet, type, country, state, cuisine };
  }),
);

const DIET_ALLOWED = {
  Vegan: ['G'],
  Vegetarian: ['G', 'V'],
  Eggetarian: ['G', 'V', 'E'],
  'Non-vegetarian': ['G', 'V', 'E', 'N'],
};
const ALL_DIETS = DIET_ALLOWED['Non-vegetarian'];

const mealMatches = (food, meal) => !meal || food.meal === meal || (food.meal === 'LD' && (meal === 'L' || meal === 'D'));

function cuisinesFor({ country, state, cuisine }) {
  if (cuisine) return [cuisine];
  if (country === 'India' && state && REGION_STATE_CUISINES[state]) return [...REGION_STATE_CUISINES[state], 'Pan-Indian'];
  if (country && REGIONS[country]) return REGIONS[country].cuisines;
  return null; // everything
}

/** Search the catalogue. Most specific region matches (state, then cuisine) rank first. */
export function searchFoods({ country, state, cuisine, meal, diet, q, limit = 60 }) {
  const allowed = cuisinesFor({ country, state, cuisine });
  const diets = DIET_ALLOWED[diet] || ALL_DIETS;
  const needle = (q || '').trim().toLowerCase();
  const primary = cuisine || (state && REGION_STATE_CUISINES[state]?.[0]) || null;
  return FOODS
    .filter((f) => (!allowed || allowed.includes(f.cuisine)) && (!country || f.country === country || (REGIONS[country]?.cuisines || []).includes(f.cuisine)))
    .filter((f) => diets.includes(f.diet) && mealMatches(f, meal) && (!needle || f.name.toLowerCase().includes(needle)))
    .map((f) => ({ f, score: (state && f.state === state ? 3 : 0) + (primary && f.cuisine === primary ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name))
    .slice(0, limit)
    .map(({ f }) => f);
}

const SLOTS = [
  { name: 'Breakfast', time: '08:00', meal: 'B', share: 0.25, max: 2 },
  { name: 'Mid-morning snack', time: '11:00', meal: 'S', share: 0.1, max: 1 },
  { name: 'Lunch', time: '13:30', meal: 'L', share: 0.3, max: 4 },
  { name: 'Evening snack', time: '17:00', meal: 'S', share: 0.1, max: 1 },
  { name: 'Dinner', time: '20:00', meal: 'D', share: 0.25, max: 4 },
];

function seeded(seed) {
  let s = (Number(seed) || 1) % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

/** Builds a starter day (five meals) from the region's foods, scaled to the calorie target. */
export function suggestDay({ country, state, cuisine, diet, kcal = 1800, seed = 1 }) {
  const rnd = seeded(seed);
  const used = new Set();
  const pick = (pool) => {
    const fresh = pool.filter((f) => !used.has(f.name));
    const list = fresh.length ? fresh : pool;
    if (!list.length) return null;
    // keep the most region-specific foods near the top but vary the choice between suggestions
    const top = list.slice(0, Math.max(3, Math.ceil(list.length * 0.6)));
    const f = top[Math.floor(rnd() * top.length)];
    used.add(f.name);
    return f;
  };
  return SLOTS.map((slot) => {
    const budget = kcal * slot.share;
    const pool = searchFoods({ country, state, cuisine, meal: slot.meal, diet, limit: 200 });
    const items = [];
    let total = 0;
    const add = (f) => { if (f && items.length < slot.max && total + f.kcal <= budget * 1.2) { items.push(f); total += f.kcal; } };
    if (slot.meal === 'L' || slot.meal === 'D') {
      for (const types of [['g'], ['d', 'p'], ['v']]) add(pick(pool.filter((f) => types.includes(f.type))));
      for (let i = 0; i < 3 && total < budget * 0.85; i += 1) add(pick(pool.filter((f) => ['g', 'v', 'x'].includes(f.type))));
    } else {
      for (let i = 0; i < slot.max + 2 && total < budget * 0.85; i += 1) add(pick(pool));
    }
    return { time: slot.time, name: slot.name, items: items.map((f) => ({ name: f.name, qty: f.qty, kcal: f.kcal })) };
  }).filter((m) => m.items.length);
}
