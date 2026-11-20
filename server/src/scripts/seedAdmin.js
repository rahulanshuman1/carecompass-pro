// Creates the first Lead Doctor (from ADMIN_* env vars) and the default membership plans. Safe to re-run.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { connect, seedPlans } from './_common.js';

const { name = 'Lead Doctor', email, password } = config.admin;
if (!email || !password || password.length < 10) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 chars) in the environment.');
  process.exit(1);
}
await connect();
const existing = await User.findOne({ email: email.toLowerCase() });
if (existing) console.log('Admin already exists:', email);
else {
  await User.create({ name, email: email.toLowerCase(), role: 'LEAD_DOCTOR', title: 'Lead Physician', passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true });
  console.log('Created lead doctor:', email, '(password change required at first login)');
}
const plans = await seedPlans();
console.log('Plans ready:', plans.map((p) => p.name).join(', '));
await mongoose.disconnect();
