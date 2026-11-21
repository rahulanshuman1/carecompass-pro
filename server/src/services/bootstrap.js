import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { User, MembershipPlan, Assignment, DietPlan, Appointment, Notification } from '../models/index.js';
import { seedPlans } from '../scripts/_common.js';
import { seedDemoData, seedDemoAppointments, purgeDemoData, DEMO_PASSWORD } from './demoData.js';

/**
 * Runs at every startup (no Shell access needed, e.g. on Render's free plan). Idempotent:
 *  - repairs indexes on the two collections that enforce one-open-assignment / one-active-plan
 *  - creates the first lead doctor from ADMIN_* env vars if no user with that email exists
 *  - creates the default membership plans if the catalog is empty
 */
export async function bootstrap() {
  for (const [name, model] of [['Assignment', Assignment], ['DietPlan', DietPlan], ['Appointment', Appointment], ['Notification', Notification]]) {
    try { await model.syncIndexes(); } catch (e) { console.error(`Index sync failed for ${name}:`, e.message); }
  }

  const { name, email, password } = config.admin;
  if (email && password && password.length >= 10) {
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      console.error(`Bootstrap: ADMIN_EMAIL "${mail}" is not a valid email address. Fix it in the environment settings.`);
    } else if (!(await User.exists({ email: mail }))) {
      await User.create({ name: name || 'Lead Doctor', email: mail, role: 'LEAD_DOCTOR', title: 'Lead Physician', passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true });
      console.log(`Bootstrap: created lead doctor ${mail} (password change required at first login)`);
    }
  } else {
    console.log('Bootstrap: ADMIN_EMAIL / ADMIN_PASSWORD (min 10 chars) not set, skipping admin creation');
  }

  if ((await MembershipPlan.countDocuments()) === 0) {
    const plans = await seedPlans();
    console.log('Bootstrap: created default plans:', plans.map((p) => p.name).join(', '));
  }

  // Demo data on hosts without a shell: set DEMO_DATA=seed (load) or DEMO_DATA=purge (remove), then redeploy.
  if (config.demoData === 'seed') {
    try {
      await seedDemoData();
      console.log(`Bootstrap: demo data ready. All demo accounts use password ${DEMO_PASSWORD} (emails end with @demo.com)`);
      const n = await seedDemoAppointments();
      if (n) console.log(`Bootstrap: created ${n} demo consultations`);
    } catch (e) { console.error('Bootstrap: demo seeding failed:', e.message); }
  } else if (config.demoData === 'purge') {
    console.log(`Bootstrap: removed ${await purgeDemoData()} demo users and their records`);
  }
}
