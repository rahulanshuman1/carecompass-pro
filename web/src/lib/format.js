export const label = (s) => String(s ?? '').replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const initials = (name = '') => name.split(' ').filter((w) => !/^Dr\.?$/i.test(w)).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const ageFrom = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : null);
export const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const todayLocal = () => new Date().toLocaleDateString('en-CA');
export const itemsKcal = (meal) => (meal.items || []).reduce((s, i) => s + (Number(i.kcal) || 0), 0);
export const planKcal = (p) => (p.meals || []).reduce((s, m) => s + itemsKcal(m), 0);

export const STATUS_TONE = {
  PENDING_ASSISTANCE: 'amber', PLAN_SELECTED: 'blue', ACTIVE: 'green', PENDING_DIETITIAN_ASSIGNMENT: 'amber',
  ASSIGNED: 'green', EXPIRED: 'slate', CANCELLED: 'rose',
  DRAFT: 'slate', IN_REVIEW: 'amber', ARCHIVED: 'slate',
  PAID: 'green', UNPAID: 'amber', PAST_DUE: 'rose', REFUNDED: 'slate',
};

export const ROLE_LABEL = { PATIENT: 'Patient', CARE_TEAM: 'Care Team', DIETITIAN: 'Dietitian', LEAD_DOCTOR: 'Lead Doctor' };
export const homeFor = (role) => ({ PATIENT: '/', CARE_TEAM: '/queue', DIETITIAN: '/agenda', LEAD_DOCTOR: '/dashboard' }[role] || '/');
