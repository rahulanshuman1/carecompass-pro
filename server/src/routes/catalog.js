import { Router } from 'express';
import { z } from 'zod';
import { MembershipPlan, Membership } from '../models/index.js';
import { asyncHandler, need } from '../utils/errors.js';
import { authenticate, requireRole, validate, validObjectId } from '../middleware/index.js';
import { audit } from '../services/audit.js';

const r = Router();

// Public pricing
r.get('/', asyncHandler(async (_req, res) => {
  res.json({ items: await MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, priceInr: 1 }).select('-razorpayPlanId') });
}));

const staff = [authenticate, requireRole('CARE_TEAM', 'LEAD_DOCTOR')];

r.get('/all', ...staff, asyncHandler(async (_req, res) => {
  const [items, counts] = await Promise.all([
    MembershipPlan.find().sort({ sortOrder: 1, priceInr: 1 }),
    Membership.aggregate([{ $match: { plan: { $ne: null } } }, { $group: { _id: '$plan', n: { $sum: 1 } } }]),
  ]);
  const c = new Map(counts.map((x) => [String(x._id), x.n]));
  res.json({ items: items.map((p) => ({ ...p.toJSON(), members: c.get(String(p._id)) || 0, synced: !!p.razorpayPlanId })) });
}));

const feature = z.string().trim().min(1).max(100);
r.post(
  '/', ...staff,
  validate(z.object({ name: z.string().trim().min(2).max(60), priceInr: z.coerce.number().int().min(1).max(1000000), cycles: z.coerce.number().int().min(1).max(60), features: z.array(feature).max(10).default([]) })),
  asyncHandler(async (req, res) => {
    const sortOrder = await MembershipPlan.countDocuments();
    const plan = await MembershipPlan.create({ ...req.body, sortOrder });
    await audit(req, 'PLAN_CATALOG_CREATED', 'MembershipPlan', plan._id, plan.name);
    res.status(201).json({ plan });
  }),
);

// Price/cycles are immutable once created (Razorpay plans cannot be edited): create a new plan instead.
r.patch(
  '/:id', validObjectId, ...staff,
  validate(z.object({ name: z.string().trim().min(2).max(60).optional(), features: z.array(feature).max(10).optional(), isActive: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const plan = await MembershipPlan.findById(req.params.id);
    need(plan, 404, 'Plan not found', 'NOT_FOUND');
    Object.assign(plan, req.body);
    await plan.save();
    await audit(req, 'PLAN_CATALOG_UPDATED', 'MembershipPlan', plan._id, JSON.stringify(Object.keys(req.body)));
    res.json({ plan });
  }),
);

export default r;
