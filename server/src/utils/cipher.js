import crypto from 'node:crypto';

/**
 * AES-256-GCM field encryption for PHI stored in MongoDB.
 * Output format: enc1:<iv>:<tag>:<ciphertext> (base64 parts).
 * For production, source the key from a KMS / secret manager and plan key rotation.
 */
export function createCipher(secret) {
  const key = crypto.createHash('sha256').update(String(secret)).digest();
  return {
    enc(value) {
      if (value === null || value === undefined || value === '') return value;
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([c.update(String(value), 'utf8'), c.final()]);
      return ['enc1', iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
    },
    dec(value) {
      if (typeof value !== 'string' || !value.startsWith('enc1:')) return value;
      try {
        const [, iv, tag, ct] = value.split(':');
        const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
        d.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
      } catch {
        return '[unreadable]';
      }
    },
  };
}
