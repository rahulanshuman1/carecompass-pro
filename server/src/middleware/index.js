import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { config } from '../config.js';
import { User } from '../models/index.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { canViewPatient } from '../domain/rbac.js';
import { Assignment } from '../models/index.js';

function makeAuth(allowPending) {
  return asyncHandler(async (req, _res, next) => {
    const h = req.get('authorization') || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.access);
    } catch {
      throw new AppError(401, 'Session expired', 'TOKEN_EXPIRED');
    }
    const u = await User.findById(payload.sub);
    if (!u || !u.isActive) throw new AppError(401, 'Account unavailable', 'UNAUTHENTICATED');
    req.user = { id: String(u._id), role: u.role, name: u.name, email: u.email, mustChangePassword: u.mustChangePassword };
    if (u.mustChangePassword && !allowPending)
      throw new AppError(403, 'Please change your temporary password to continue.', 'PASSWORD_CHANGE_REQUIRED');
    next();
  });
}
export const authenticate = makeAuth(false);
export const authenticateAllowPending = makeAuth(true);

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new AppError(403, 'You do not have access to this resource.', 'FORBIDDEN'));

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[source]);
  if (!r.success) {
    const fields = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return next(new AppError(400, fields.map((f) => f.message).join(' '), 'VALIDATION', fields));
  }
  req[source] = r.data;
  next();
};

export const validObjectId = (req, _res, next) => {
  for (const k of Object.keys(req.params)) {
    if (/id$/i.test(k) || k === 'patientId') {
      if (!mongoose.isValidObjectId(req.params[k])) return next(new AppError(400, 'Invalid id', 'VALIDATION'));
    }
  }
  next();
};

/** Loads the patient's open assignment and enforces record-level access. Sets req.assignment. */
export const requirePatientAccess = (param = 'patientId') =>
  asyncHandler(async (req, _res, next) => {
    const pid = req.params[param];
    const assignment = await Assignment.findOne({ patient: pid, isOpen: true });
    if (!canViewPatient(req.user, pid, assignment)) throw new AppError(403, 'You do not have access to this patient.', 'FORBIDDEN');
    req.assignment = assignment;
    next();
  });

export function notFound(_req, _res, next) {
  next(new AppError(404, 'Route not found', 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid input' } });
  if (err?.name === 'ValidationError') return res.status(400).json({ error: { code: 'VALIDATION', message: err.message } });
  if (err?.name === 'CastError') return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid id' } });
  if (err?.code === 11000) return res.status(409).json({ error: { code: 'CONFLICT', message: 'That record already exists.' } });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON' } });
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}
