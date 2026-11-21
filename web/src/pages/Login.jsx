import Logo from '../components/Logo';
import { useState } from 'react';
import { HeartPulse, ShieldCheck, Salad, Camera } from 'lucide-react';
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
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10"><Logo size={52} light /></div>
        <div className="relative z-10">
          <p className="mb-3 inline-flex rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-200">Diet and care programs</p>
          <h1 className="text-5xl font-extrabold leading-[1.1] text-white">Eat the food you love.<br /><span className="text-brand-300">Reach the goals you set.</span></h1>
          <p className="mt-5 max-w-md text-lg text-ink-200">Diet plans built around your cuisine, your state and your health, by a dietitian who knows you.</p>
          <h2 className="mb-4 mt-10 text-sm font-bold uppercase tracking-wider text-brand-200">Getting started is easy</h2>
          <ol className="space-y-3">
            {[[HeartPulse, 'Share your health history', 'Once, securely, in a few minutes'], [Salad, 'Get your own dietitian', 'A plan in your cuisine, reviewed by a lead doctor'], [Camera, 'Track with photos', 'Snap each meal and build your food diary']].map(([I, t, d], i) => (
              <li key={t} className="flex items-center gap-4 rounded-2xl bg-white/[.06] p-3.5 backdrop-blur"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600"><I className="h-5 w-5" /></span><div><p className="font-bold text-white">Step {i + 1}: {t}</p><p className="text-sm text-ink-200">{d}</p></div></li>
            ))}
          </ol>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-ink-200"><ShieldCheck className="h-4 w-4" />Your health information is encrypted and visible only to your care team.</p>
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-sun-400/10 blur-3xl" />
      </div>

      <div className="flex items-center justify-center px-5 py-10 pt-safe">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <div className="rounded-[2rem] border border-ink-100 bg-white p-7 shadow-soft md:p-9">
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
              <button className="font-bold text-brand-700 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setFe({}); }}>
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">Staff accounts are created by your hospital administrator.</p>
        </div>
      </div>
    </div>
  );
}
