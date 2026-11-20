import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),
  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  PHI_ENCRYPTION_KEY: z.string().min(32, 'PHI_ENCRYPTION_KEY must be at least 32 chars'),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  DEMO_DATA: z.string().optional(),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const e = parsed.data;

export const config = {
  env: e.NODE_ENV,
  isProd: e.NODE_ENV === 'production',
  port: e.PORT,
  mongoUri: e.MONGODB_URI,
  tz: e.APP_TIMEZONE,
  jwt: { access: e.JWT_ACCESS_SECRET, refresh: e.JWT_REFRESH_SECRET, accessTtl: '15m', refreshDays: 7 },
  phiKey: e.PHI_ENCRYPTION_KEY,
  origins: e.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  cookie: {
    sameSite: e.COOKIE_SAMESITE,
    domain: e.COOKIE_DOMAIN || undefined,
    secure: e.NODE_ENV === 'production' || e.COOKIE_SAMESITE === 'none',
  },
  razorpay: {
    keyId: e.RAZORPAY_KEY_ID,
    keySecret: e.RAZORPAY_KEY_SECRET,
    webhookSecret: e.RAZORPAY_WEBHOOK_SECRET,
    enabled: Boolean(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
  },
  demoData: (e.DEMO_DATA || '').trim().toLowerCase(),
  admin: { name: e.ADMIN_NAME, email: e.ADMIN_EMAIL, password: e.ADMIN_PASSWORD },
};
