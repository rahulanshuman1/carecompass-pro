import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { User, PatientProfile, Membership } from '../models/index.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { authenticate, authenticateAllowPending, validate } from '../middleware/index.js';
import { audit } from '../services/audit.js';

const r = Router();
const COOKIE = 'cc_rt';
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // constant-time-ish response for unknown emails

const password = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password must include letters and numbers.');

const cookieOpts = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  domain: config.cookie.domain,
  path: '/api/v1/auth',
  maxAge: config.jwt.refreshDays * 864e5,
});

const publicUser = (u) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role,
  mustChangePassword: !!u.mustChangePassword, specialty: u.specialty, title: u.title,
});
const signAccess = (u) => jwt.sign({ sub: String(u._id), role: u.role }, config.jwt.access, { expiresIn: config.jwt.accessTtl });

async function startSession(user, res) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const live = (user.refreshTokens || []).filter((t) => t.expiresAt > new Date()).slice(-4);
  live.push({ hash: hash(raw), expiresAt: new Date(Date.now() + config.jwt.refreshDays * 864e5), createdAt: new Date() });
  await User.updateOne({ _id: user._id }, { $set: { refreshTokens: live, lastLoginAt: new Date() } });
  res.cookie(COOKIE, `${user._id}.${raw}`, cookieOpts());
  return { accessToken: signAccess(user), user: publicUser(user) };
}

r.post(
  '/register',
  validate(z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email(), password })),
  asyncHandler(async (req, res) => {
    const { name, email, password: pw } = req.body;
    if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
    const user = await User.create({ name, email, role: 'PATIENT', passwordHash: await bcrypt.hash(pw, 12) });
    await PatientProfile.create({ user: user._id });
    await Membership.create({ patient: user._id });
    req.user = { id: String(user._id), role: 'PATIENT' };
    await audit(req, 'SIGNUP', 'User', user._id);
    const u = await User.findById(user._id).select('+refreshTokens');
    res.status(201).json(await startSession(u, res));
  }),
);

r.post(
  '/login',
  validate(z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) })),
  asyncHandler(async (req, res) => {
    const u = await User.findOne({ email: req.body.email }).select('+passwordHash +failedLogins +lockUntil +refreshTokens');
    const generic = new AppError(401, 'Incorrect email or password.', 'BAD_CREDENTIALS');
    if (!u || !u.isActive) {
      await bcrypt.compare(req.body.password, DUMMY_HASH);
      throw generic;
    }
    if (u.lockUntil && u.lockUntil > new Date())
      throw new AppError(429, 'Too many failed attempts. Try again in a few minutes.', 'LOCKED');
    const ok = await bcrypt.compare(req.body.password, u.passwordHash);
    if (!ok) {
      const failed = (u.failedLogins || 0) + 1;
      await User.updateOne({ _id: u._id }, { $set: failed >= 5 ? { failedLogins: 0, lockUntil: new Date(Date.now() + 15 * 60e3) } : { failedLogins: failed } });
      await audit({ ip: req.ip, get: req.get.bind(req), user: { id: u.id, role: u.role } }, 'LOGIN_FAILED', 'User', u._id);
      throw generic;
    }
    await User.updateOne({ _id: u._id }, { $set: { failedLogins: 0 }, $unset: { lockUntil: 1 } });
    req.user = { id: String(u._id), role: u.role };
    await audit(req, 'LOGIN', 'User', u._id);
    res.json(await startSession(u, res));
  }),
);

r.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[COOKIE];
    const [uid, token] = String(raw || '').split(/\.(.+)/);
    if (!uid || !token || !/^[a-f\d]{24}$/i.test(uid)) throw new AppError(401, 'Signed out', 'UNAUTHENTICATED');
    const u = await User.findById(uid).select('+refreshTokens');
    if (!u || !u.isActive) throw new AppError(401, 'Signed out', 'UNAUTHENTICATED');
    const h = hash(token);
    const found = (u.refreshTokens || []).find((t) => t.hash === h);
    if (!found || found.expiresAt < new Date()) {
      if (!found) await User.updateOne({ _id: u._id }, { $set: { refreshTokens: [] } }); // reuse detected → revoke everything
      res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
      throw new AppError(401, 'Session expired', 'UNAUTHENTICATED');
    }
    u.refreshTokens = u.refreshTokens.filter((t) => t.hash !== h); // rotate
    res.json(await startSession(u, res));
  }),
);

r.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const [uid, token] = String(req.cookies?.[COOKIE] || '').split(/\.(.+)/);
    if (uid && token && /^[a-f\d]{24}$/i.test(uid)) {
      await User.updateOne({ _id: uid }, { $pull: { refreshTokens: { hash: hash(token) } } });
    }
    res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
    res.json({ ok: true });
  }),
);

r.get('/me', authenticateAllowPending, asyncHandler(async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ user: publicUser(u) });
}));

r.post(
  '/change-password',
  authenticateAllowPending,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: password })),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user.id).select('+passwordHash');
    if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw new AppError(401, 'Current password is incorrect.', 'BAD_CREDENTIALS');
    if (req.body.currentPassword === req.body.newPassword) throw new AppError(422, 'Choose a different password.', 'VALIDATION');
    await User.updateOne({ _id: u._id }, { $set: { passwordHash: await bcrypt.hash(req.body.newPassword, 12), mustChangePassword: false, refreshTokens: [] } });
    await audit(req, 'PASSWORD_CHANGED', 'User', u._id);
    res.clearCookie(COOKIE, { ...cookieOpts(), maxAge: undefined });
    res.json({ ok: true, message: 'Password updated. Please sign in again.' });
  }),
);

export default r;
export { authenticate };
