// Demo data for testing the full flow. Refuses to run in production unless FORCE_DEMO=1.
import mongoose from 'mongoose';
import { config } from '../config.js';
import { connect } from './_common.js';
import { seedDemoData, DEMO_PASSWORD } from '../services/demoData.js';

if (config.isProd && process.env.FORCE_DEMO !== '1') {
  console.error('Refusing to seed demo data in production (set FORCE_DEMO=1 to override).');
  process.exit(1);
}
await connect();
await seedDemoData();
console.log(`Demo data ready. Password for every demo account: ${DEMO_PASSWORD}`);
await mongoose.disconnect();
