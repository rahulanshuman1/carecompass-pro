import { AppError } from './errors.js';

/**
 * Origins used by the Capacitor mobile apps (Android serves the app from https://localhost, iOS from capacitor://localhost).
 * The apps send a bearer token and never cookies, so these origins are allowed WITHOUT credentials.
 * That keeps the browser-cookie session of the website unreachable from any page running on localhost.
 */
export const NATIVE_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

/** cors() options per request: the website origins from CLIENT_ORIGINS get credentials, the mobile apps do not. */
export function corsDelegate(allowed) {
  return (req, cb) => {
    const origin = req.header('Origin');
    const base = { maxAge: 600 };
    if (!origin || allowed.includes(origin)) return cb(null, { ...base, origin: true, credentials: true });
    if (NATIVE_ORIGINS.includes(origin)) return cb(null, { ...base, origin: true, credentials: false });
    return cb(new AppError(403, 'Origin not allowed', 'CORS'));
  };
}
