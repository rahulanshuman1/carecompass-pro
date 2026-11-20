const BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

let accessToken = null;
let refreshing = null;
let onAuthLost = () => {};

export const setOnAuthLost = (fn) => { onAuthLost = fn; };
export const setAccessToken = (t) => { accessToken = t; };

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error || {};
    throw new ApiError(res.status, e.code || 'ERROR', e.message || 'Something went wrong.', e.details);
  }
  return data;
}

/** Exchanges the httpOnly refresh cookie for a new access token (single flight). */
export function refreshSession() {
  refreshing ??= request('/auth/refresh', { method: 'POST', auth: false })
    .then((d) => { accessToken = d.accessToken; return d; })
    .catch(() => { accessToken = null; return null; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api(path, opts) {
  try {
    return await request(path, opts);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && opts?.auth !== false && e.code !== 'BAD_CREDENTIALS') {
      const d = await refreshSession();
      if (d) return request(path, opts);
      onAuthLost();
    }
    throw e;
  }
}

export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

/** { 'heightCm': 'Height must be…' } from a validation error */
export function fieldErrors(err) {
  const out = {};
  for (const d of err?.details || []) if (d?.path && !out[d.path]) out[d.path] = d.message;
  return out;
}

export { request as rawRequest };
