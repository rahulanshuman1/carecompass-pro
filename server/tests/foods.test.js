import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOODS, REGIONS, searchFoods, suggestDay } from '../src/data/foods.js';

test('catalogue entries are well formed', () => {
  assert.ok(FOODS.length > 200);
  for (const f of FOODS) {
    assert.ok(f.name && f.qty, `name/portion missing: ${JSON.stringify(f)}`);
    assert.ok(Number.isFinite(f.kcal) && f.kcal >= 0 && f.kcal < 1000, `bad kcal: ${f.name}`);
    assert.ok(['B', 'S', 'L', 'D', 'LD'].includes(f.meal), `bad meal: ${f.name}`);
    assert.ok(['G', 'V', 'E', 'N'].includes(f.diet), `bad diet: ${f.name}`);
  }
});

test('every region cuisine has foods', () => {
  for (const [country, { cuisines }] of Object.entries(REGIONS)) {
    for (const c of cuisines) assert.ok(FOODS.some((f) => f.cuisine === c), `${country}: no foods for ${c}`);
  }
});

test('state search ranks state dishes first', () => {
  const r = searchFoods({ country: 'India', state: 'Kerala', diet: 'Vegetarian' });
  assert.ok(r.length > 5);
  assert.equal(r[0].state, 'Kerala');
});

test('diet filter never leaks meat or egg to vegetarians and vegans', () => {
  for (const diet of ['Vegetarian', 'Vegan']) {
    const r = searchFoods({ country: 'India', diet, limit: 500 });
    assert.ok(r.every((f) => ['G', 'V'].includes(f.diet)));
  }
  assert.ok(searchFoods({ country: 'India', diet: 'Vegan', limit: 500 }).every((f) => f.diet === 'G'));
  assert.ok(searchFoods({ country: 'India', diet: 'Vegetarian', limit: 500 }).every((f) => f.diet !== 'E' && f.diet !== 'N'));
});

test('suggested day respects diet and region and stays near the calorie target', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const day = suggestDay({ country: 'India', state: 'Gujarat', diet: 'Vegetarian', kcal: 1800, seed });
    assert.ok(day.length >= 4);
    const names = new Set(day.flatMap((m) => m.items.map((i) => i.name)));
    for (const n of names) assert.ok(['G', 'V'].includes(FOODS.find((f) => f.name === n).diet), `${n} not vegetarian`);
    const total = day.reduce((s, m) => s + m.items.reduce((a, i) => a + i.kcal, 0), 0);
    assert.ok(total > 900 && total < 2300, `total ${total} too far from 1800`);
  }
});
