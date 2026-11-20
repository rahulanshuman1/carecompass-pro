import { useState } from 'react';
import { HeartPulse, ShieldCheck, Salad, Stethoscope } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { fieldErrors } from '../lib/api';
import { Alert, Button, Field, Input } from '../components/ui';
import { Brand } from '../components/Layout';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState({});
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setFe({});
    try {
      if (mode === 'login') await login(f.email, f.password);
      else await register(f.name, f.email, f.password);
    } catch (ex) { setErr(ex.message); setFe(fieldErrors(ex)); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 text-xl font-extrabold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Stethoscope className="h-5 w-5" /></span>CareCompass</div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight text-white">Personalised nutrition,<br />guided by your care team.</h1>
          <ul className="mt-8 space-y-4 text-brand-100">
            {[[HeartPulse, 'Share your health history once, securely'], [Salad, 'Get a diet plan built by your own dietitian'], [ShieldCheck, 'Every plan reviewed by a lead doctor']].map(([I, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10"><I className="h-[18px] w-[18px]" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-brand-200">Your health information is encrypted and visible only to your care team.</p>
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-white/5" />
      </div>

      <div className="flex items-center justify-center px-5 py-10 pt-safe">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === 'login' ? 'Sign in to continue to your portal.' : 'Start your care journey in a few minutes.'}</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {err && <Alert tone="error">{err}</Alert>}
            {mode === 'register' && <Field label="Full name" required error={fe.name}><Input value={f.name} onChange={set('name')} autoComplete="name" /></Field>}
            <Field label="Email" required error={fe.email}><Input type="email" value={f.email} onChange={set('email')} autoComplete="email" inputMode="email" /></Field>
            <Field label="Password" required error={fe.password} hint={mode === 'register' ? '10+ characters, letters and numbers' : ''}>
              <Input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? 'New patient?' : 'Already registered?'}{' '}
            <button className="font-semibold text-brand-700 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setFe({}); }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
          <p className="mt-8 text-center text-xs text-slate-400">Staff accounts are created by your hospital administrator.</p>
        </div>
      </div>
    </div>
  );
}
