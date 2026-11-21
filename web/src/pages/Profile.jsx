import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { fieldErrors } from '../lib/api';
import { photoToDataUrl } from '../lib/image';
import { ROLE_LABEL } from '../lib/format';
import { Alert, Avatar, Button, Card, Field, Input, PageHeader } from '../components/ui';
import AppDownload from '../components/AppDownload';

export default function Profile() {
  const { user, updateProfile, setPhoto } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title || '');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState({});
  const staff = user.role !== 'PATIENT';

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setFe({});
    try { await updateProfile({ name, ...(staff ? { title } : {}) }); toast.success('Profile updated'); }
    catch (ex) { setErr(ex.message); setFe(fieldErrors(ex)); } finally { setBusy(false); }
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try { await setPhoto(await photoToDataUrl(file)); toast.success('Photo updated'); }
    catch (ex) { toast.error(ex); } finally { setPhotoBusy(false); }
  }
  async function remove() {
    setPhotoBusy(true);
    try { await setPhoto(null); toast.success('Photo removed'); } catch (ex) { toast.error(ex); } finally { setPhotoBusy(false); }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="My profile" sub={ROLE_LABEL[user.role]} />
      <Card>
        <div className="mb-6 flex flex-wrap items-center gap-5">
          <Avatar name={user.name} photo={user.photo} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-slate-900">{user.name}</p>
            {staff && user.title && <p className="text-sm text-slate-500">{user.title}</p>}
            <p className="mb-3 text-xs text-slate-400">{user.email}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} aria-label="Choose profile photo" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="soft" loading={photoBusy} onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" />{user.photo ? 'Change photo' : 'Upload photo'}</Button>
              {user.photo && <Button size="sm" variant="ghost" disabled={photoBusy} onClick={remove}><Trash2 className="h-4 w-4" />Remove</Button>}
            </div>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4 border-t border-slate-100 pt-5" noValidate>
          {err && <Alert tone="error">{err}</Alert>}
          <Field label="Display name" required error={fe.name}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></Field>
          {staff && <Field label="Professional title" hint="shown under your name" error={fe.title}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Senior Clinical Nutritionist | Registered Dietitian" /></Field>}
          <Button type="submit" loading={busy}>Save changes</Button>
        </form>
      </Card>
      <Card className="mt-5"><AppDownload /></Card>
    </div>
  );
}
