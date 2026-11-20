import { AuditLog } from '../models/index.js';

/** Append an audit entry. Never throws: auditing must not break the request. */
export async function audit(req, action, entity, entityId, detail = '') {
  try {
    await AuditLog.create({
      actor: req?.user?.id,
      actorRole: req?.user?.role || 'SYSTEM',
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      detail: String(detail).slice(0, 500),
      ip: req?.ip,
      ua: req?.get ? String(req.get('user-agent') || '').slice(0, 200) : undefined,
    });
  } catch (e) {
    console.error('audit write failed', e.message);
  }
}
