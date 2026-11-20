import mongoose from 'mongoose';
import { createCipher } from '../utils/cipher.js';
import { config } from '../config.js';
import { MEMBERSHIP_STATUSES, PAYMENT_STATUSES } from '../domain/membership.js';
import { ROLES } from '../domain/rbac.js';

const { Schema, model } = mongoose;
const phi = createCipher(config.phiKey);

// Consistent JSON: id instead of _id, getters on (decrypts PHI), strip secrets.
mongoose.set('toJSON', {
  getters: true,
  versionKey: false,
  transform(_doc, ret) {
    if (ret._id !== undefined) {
      ret.id = String(ret._id);
      delete ret._id;
    }
    delete ret.passwordHash;
    delete ret.refreshTokens;
    delete ret.failedLogins;
    delete ret.lockUntil;
    return ret;
  },
});

const encrypted = { type: String, get: (v) => phi.dec(v), set: (v) => phi.enc(v) };
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

/* ---------------- Users ---------------- */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    refreshTokens: { type: [{ hash: String, expiresAt: Date, createdAt: Date, _id: false }], select: false, default: [] },
    lastLoginAt: Date,
    // dietitian
    specialty: String,
    maxLoad: { type: Number, min: 1, max: 100 },
    // lead doctor
    title: String,
  },
  { timestamps: true },
);
export const User = model('User', userSchema);

/* ---------------- Patient profile & history ---------------- */
const profileSchema = new Schema(
  {
    user: ref('User', { required: true, unique: true }),
    dob: Date,
    sex: { type: String, enum: ['Female', 'Male', 'Other', ''] },
    phone: String,
    heightCm: Number,
    weightKg: Number,
    historySubmittedAt: Date,
    history: {
      conditions: [String],
      allergies: [String],
      medications: encrypted,
      labNotes: encrypted,
      activity: String,
      sleepHrs: Number,
      smoking: String,
      alcohol: String,
      dietType: String,
      dislikes: String,
      goals: String,
      consentAt: Date,
      consentVersion: String,
    },
  },
  { timestamps: true },
);
export const PatientProfile = model('PatientProfile', profileSchema);

/* ---------------- Membership plans & memberships ---------------- */
const planSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    priceInr: { type: Number, required: true, min: 1 }, // per billing cycle (month), rupees
    cycles: { type: Number, required: true, min: 1, max: 60 }, // number of monthly charges
    features: [String],
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    razorpayPlanId: String, // created lazily; Razorpay plans are immutable
  },
  { timestamps: true },
);
export const MembershipPlan = model('MembershipPlan', planSchema);

const membershipSchema = new Schema(
  {
    patient: ref('User', { required: true, unique: true }),
    plan: ref('MembershipPlan'),
    requestedPlan: ref('MembershipPlan'),
    status: { type: String, enum: MEMBERSHIP_STATUSES, default: 'PENDING_ASSISTANCE', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'UNPAID' },
    paymentMethod: { type: String, enum: ['RAZORPAY', 'OFFLINE', null], default: null },
    offlineReference: String,
    razorpay: {
      subscriptionId: { type: String, index: true, sparse: true },
      status: String,
      shortUrl: String,
      paymentId: String,
      paidCount: { type: Number, default: 0 },
      currentEnd: Date,
    },
    activatedAt: Date,
    events: [
      { from: String, to: String, by: ref('User'), actor: String, reason: String, at: { type: Date, default: Date.now }, _id: false },
    ],
  },
  { timestamps: true },
);
export const Membership = model('Membership', membershipSchema);

/* ---------------- Assignments ---------------- */
const assignmentSchema = new Schema(
  {
    patient: ref('User', { required: true }),
    dietitian: ref('User', { required: true, index: true }),
    assignedBy: ref('User', { required: true }),
    isOpen: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
    endedAt: Date,
  },
  { timestamps: true },
);
// At most one open assignment per patient (enforced by the database, not just code)
assignmentSchema.index({ patient: 1 }, { name: 'one_open_assignment_per_patient', unique: true, partialFilterExpression: { isOpen: true } });
export const Assignment = model('Assignment', assignmentSchema);

/* ---------------- Diet plans ---------------- */
const mealSchema = new Schema({
  time: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  items: [{ name: { type: String, required: true, trim: true }, qty: { type: String, default: '' }, kcal: { type: Number, required: true, min: 0 }, _id: false }],
});
const dietPlanSchema = new Schema(
  {
    patient: ref('User', { required: true }),
    dietitian: ref('User', { required: true, index: true }),
    version: { type: Number, required: true },
    status: { type: String, enum: ['DRAFT', 'IN_REVIEW', 'ACTIVE', 'ARCHIVED'], default: 'DRAFT', index: true },
    title: { type: String, default: '', maxlength: 120 },
    startDate: String, // YYYY-MM-DD
    targets: {
      kcal: { type: Number, default: 1800 },
      protein: { type: Number, default: 90 },
      carbs: { type: Number, default: 200 },
      fat: { type: Number, default: 60 },
      waterMl: { type: Number, default: 2500 },
    },
    supplements: { type: String, default: '' },
    notes: { type: String, default: '' },
    reviewNote: { type: String, default: '' },
    meals: [mealSchema],
    submittedAt: Date,
    approvedBy: ref('User'),
    approvedAt: Date,
  },
  { timestamps: true },
);
dietPlanSchema.index({ patient: 1, version: 1 }, { unique: true });
dietPlanSchema.index({ patient: 1 }, { name: 'one_active_plan_per_patient', unique: true, partialFilterExpression: { status: 'ACTIVE' } }); // one live plan per patient
export const DietPlan = model('DietPlan', dietPlanSchema);

/* ---------------- Adherence, notes, audit, webhooks ---------------- */
const adherenceSchema = new Schema(
  {
    patient: ref('User', { required: true }),
    date: { type: String, required: true }, // YYYY-MM-DD in APP_TIMEZONE
    mealsDone: [String],
    waterMl: { type: Number, default: 0, min: 0, max: 10000 },
    weightKg: Number,
  },
  { timestamps: true },
);
adherenceSchema.index({ patient: 1, date: 1 }, { unique: true });
export const AdherenceLog = model('AdherenceLog', adherenceSchema);

const noteSchema = new Schema(
  {
    patient: ref('User', { required: true, index: true }),
    author: ref('User', { required: true }),
    kind: { type: String, enum: ['CARE', 'CLINICAL', 'PATIENT_MESSAGE'], required: true },
    text: { ...encrypted, required: true }, // length is enforced by zod (validators would see ciphertext)
  },
  { timestamps: true },
);
export const CareNote = model('CareNote', noteSchema);

const auditSchema = new Schema(
  {
    actor: ref('User'),
    actorRole: String,
    action: { type: String, required: true, index: true },
    entity: String,
    entityId: String,
    detail: String,
    ip: String,
    ua: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ createdAt: -1 });
export const AuditLog = model('AuditLog', auditSchema);

const webhookSchema = new Schema(
  { eventId: { type: String, required: true, unique: true }, type: String, createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } },
  { versionKey: false },
);
export const WebhookEvent = model('WebhookEvent', webhookSchema);
