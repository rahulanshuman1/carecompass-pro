export const ROLES = ['PATIENT', 'CARE_TEAM', 'DIETITIAN', 'LEAD_DOCTOR'];

/**
 * Record-level access to a patient.
 * openAssignment: the patient's current assignment ({ dietitian }) or null.
 */
export function canViewPatient(actor, patientId, openAssignment) {
  if (actor.role === 'PATIENT') return String(actor.id) === String(patientId);
  if (actor.role === 'CARE_TEAM' || actor.role === 'LEAD_DOCTOR') return true;
  if (actor.role === 'DIETITIAN') return !!openAssignment && String(openAssignment.dietitian) === String(actor.id);
  return false;
}

/** Minimum-necessary: care team never sees medications or lab notes. */
export const canSeeClinical = (role) => role !== 'CARE_TEAM';

export function redactProfileFor(role, profile) {
  if (!profile) return profile;
  if (canSeeClinical(role)) return profile;
  const p = { ...profile, history: profile.history ? { ...profile.history } : profile.history };
  if (p.history) {
    delete p.history.medications;
    delete p.history.labNotes;
    p.history.clinicalRestricted = true;
  }
  return p;
}
