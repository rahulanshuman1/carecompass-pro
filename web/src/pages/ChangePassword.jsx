import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Alert, Button, Card, Field, Input } from '../components/ui';
import { Brand } from '../components/Layout';

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await changePassword(cur, next); toast.success('Password updated. Please sign in again.'); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center px-5 py-10">
      <Card className="w-full max-w-md p-7">
        <Brand />
        <h1 className="mt-6">Set a new password</h1>
        <p className="mt-1 text-sm text-slate-500">Hi {user.name.split(' ')[0]}, your account uses a temporary password. Choose your own to continue.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="Temporary password" required><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password" required hint="10+ characters, letters and numbers"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
        <button onClick={logout} className="mt-4 w-full text-center text-sm text-slate-500 hover:underline">Sign out</button>
      </Card>
    </div>
  );
}
