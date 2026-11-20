import mongoose from 'mongoose';
import { config } from '../config.js';
import { MembershipPlan } from '../models/index.js';

export async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
}

export const DEFAULT_PLANS = [
  { name: 'Essential', priceInr: 1499, cycles: 3, sortOrder: 0, features: ['Personalised diet plan', 'Monthly dietitian check-in', 'In-app meal tracking'] },
  { name: 'Advanced', priceInr: 2999, cycles: 3, sortOrder: 1, features: ['Everything in Essential', 'Weekly dietitian check-ins', 'Plan revisions on request', 'Lab report review'] },
  { name: 'Clinical Premium', priceInr: 4999, cycles: 6, sortOrder: 2, features: ['Everything in Advanced', 'Lead doctor plan review', 'Priority messaging', 'Quarterly clinical summary'] },
];

export async function seedPlans() {
  const out = [];
  for (const p of DEFAULT_PLANS) {
    out.push(await MembershipPlan.findOneAndUpdate({ name: p.name }, { $setOnInsert: p }, { upsert: true, new: true }));
  }
  return out;
}
