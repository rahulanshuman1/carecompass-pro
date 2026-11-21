import { Router } from 'express';
import { z } from 'zod';
import { Notification } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, validate } from '../middleware/index.js';
import { ensureDueReminders } from '../services/notifications.js';

const r = Router();
r.use(authenticate);

// The bell polls this; due meeting reminders are created here, so they appear while the app is open.
r.get('/', asyncHandler(async (req, res) => {
  await ensureDueReminders(req.user);
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user.id, readAt: { $exists: false } }),
  ]);
  res.json({ items, unread });
}));

r.post('/read', validate(z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(50).optional(), all: z.boolean().optional() })), asyncHandler(async (req, res) => {
  const q = { user: req.user.id, readAt: { $exists: false }, ...(req.body.all ? {} : { _id: { $in: req.body.ids || [] } }) };
  await Notification.updateMany(q, { readAt: new Date() });
  res.json({ ok: true });
}));

export default r;
