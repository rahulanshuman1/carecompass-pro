// Makes MongoDB indexes match the schemas (drops stale/conflicting ones, creates missing ones). Safe to re-run.
import mongoose from 'mongoose';
import * as M from '../models/index.js';
import { connect } from './_common.js';

await connect();
for (const [name, model] of Object.entries(M)) {
  if (typeof model?.syncIndexes !== 'function') continue;
  const dropped = await model.syncIndexes();
  console.log(`${name}: ok${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
}
await mongoose.disconnect();
