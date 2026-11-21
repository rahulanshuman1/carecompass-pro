import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../middleware/index.js';
import { REGIONS, REGION_STATE_CUISINES, searchFoods, suggestDay } from '../data/foods.js';

const r = Router();
r.use(authenticate);

// Country → states and cuisines (used by the patient history form and the dietitian's plan builder)
r.get('/regions', (_req, res) => res.json({ regions: REGIONS, stateCuisines: REGION_STATE_CUISINES }));

const staff = requireRole('DIETITIAN', 'LEAD_DOCTOR');
const DIETS = ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'];
const str = z.string().trim().max(60).optional().default('');

r.get('/search', staff, (req, res) => {
  const q = z.object({ country: str, state: str, cuisine: str, meal: z.enum(['B', 'S', 'L', 'D', '']).optional().default(''), diet: z.enum([...DIETS, '']).optional().default(''), q: str }).parse(req.query);
  res.json({ items: searchFoods(q) });
});

// Starter day built from the region's foods and scaled to the calorie target. The dietitian edits it afterwards.
r.post(
  '/suggest',
  staff,
  validate(z.object({ country: str, state: str, cuisine: str, diet: z.enum([...DIETS, '']).optional().default(''), kcal: z.coerce.number().int().min(800).max(5000).default(1800), seed: z.coerce.number().int().min(1).max(1_000_000).default(1) })),
  (req, res) => res.json({ meals: suggestDay(req.body) }),
);

export default r;
