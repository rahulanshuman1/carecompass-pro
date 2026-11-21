import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { config } from './config.js';
import { AppError } from './utils/errors.js';
import { errorHandler, notFound } from './middleware/index.js';
import { razorpayWebhook } from './routes/webhook.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import billingRoutes from './routes/billing.js';
import catalogRoutes from './routes/catalog.js';
import foodRoutes from './routes/foods.js';
import studioRoutes from './routes/studio.js';
import appointmentRoutes from './routes/appointments.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import staffRoutes from './routes/staff.js';
import dietRoutes from './routes/dietplans.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render terminates TLS in front of the app
  app.disable('x-powered-by');

  app.get('/', (_req, res) => res.json({ service: 'carecompass-api', ok: true }));
  app.get('/healthz', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.origins.includes(origin)) return cb(null, true);
        cb(new AppError(403, 'Origin not allowed', 'CORS'));
      },
      credentials: true,
      maxAge: 600,
    }),
  );
  // Log path only, never the query string (search terms can contain patient names)
  morgan.token('safe-path', (req) => (req.originalUrl || req.url).split('?')[0]);
  app.use(morgan(config.isProd ? ':remote-addr :method :safe-path :status :response-time ms' : ':method :safe-path :status :response-time ms', { skip: (req) => req.path === '/healthz' }));

  // Razorpay webhook needs the RAW body for HMAC verification, so it is mounted before express.json()
  app.post('/api/v1/webhooks/razorpay', express.raw({ type: '*/*', limit: '1mb' }), razorpayWebhook);

  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use('/api/v1', rateLimit({ windowMs: 15 * 60e3, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  const authLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { code: 'RATE_LIMIT', message: 'Too many attempts. Please wait a few minutes.' } } });

  const v1 = express.Router();
  v1.use('/auth', authLimiter, authRoutes);
  v1.use('/plans', catalogRoutes);
  v1.use('/foods', foodRoutes);
  v1.use('/studio', studioRoutes);
  v1.use('/appointments', appointmentRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/me', meRoutes);
  v1.use('/me', billingRoutes);
  v1.use('/admin', adminRoutes);
  v1.use(dietRoutes);
  v1.use(staffRoutes); // keep last: applies authentication to everything it declares
  v1.use(notFound);
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
