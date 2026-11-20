import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api, patch, post, fieldErrors } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { ROLE_LABEL } from '../../lib/format';
import { Alert, Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, PageLoader, ProgressBar, Select } from '../../components/ui';

export default function Team() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const staff = useQuery({ queryKey: ['staff'], queryFn: () => api('/admin/staff') });
  const stats = useQuery({ queryKey: ['analytics'], queryFn: () => api('/admin/analytics') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', role: 'DIETITIAN', specialty: '', maxLoad: 8 });
  const [fe, setFe] = useState({});
  const [temp, setTemp] = useState(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['staff'] }); qc.invalidateQueries({ queryKey: ['analytics'] }); qc.invalidateQueries({ queryKey: ['dietitians'] }); };

  const create = useMutation({
    mutationFn: () => post('/admin/staff', { ...f, maxLoad: f.role === 'DIETITIAN' ? Number(f.maxLoad) : undefined, specialty: f.specialty || undefined }),
    onSuccess: (r) => { setOpen(false); setTemp({ email: r.user.email, pw: r.temporaryPassword }); setF({ name: '', email: '', role: 'DIETITIAN', specialty: '', maxLoad: 8 }); refresh(); },
    onError: (e) => { setFe(fieldErrors(e)); toast.error(e); },
  });
  const toggle = useMutation({ mutationFn: (u) => patch(`/admin/staff/${u.id}`, { isActive: !u.isActive }), onSuccess: refresh, onError: toast.error });

  if (staff.isLoading || stats.isLoading) return <PageLoader />;
  if (staff.error) return <Alert tone="error">{staff.error.message}</Alert>;
  const load = Object.fromEntries((stats.data?.dietitians || []).map((d) => [d.id, d]));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <>
      <PageHeader title="Team" sub="Dietitians, care team and doctors" action={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />Add staff</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        {staff.data.items.map((u) => {
          const l = load[u.id];
          return (
            <Card key={u.id} className={u.isActive ? '' : 'opacity-60'}>
              <div className="flex items-start gap-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1"><h3 className="truncate">{u.name}</h3><p className="truncate text-xs text-slate-500">{u.email}</p></div>
                <Badge tone={u.role === 'LEAD_DOCTOR' ? 'brand' : 'slate'}>{ROLE_LABEL[u.role]}</Badge>
              </div>
              {u.role === 'DIETITIAN' && l && (
                <div className="mt-4"><p className="mb-1 text-xs text-slate-500">{u.specialty}</p>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Patients</span><span className="font-semibold">{l.load}/{l.maxLoad}{l.avgAdherence != null && ` · ${l.avgAdherence}% adherence`}</span></div>
                  <ProgressBar value={(l.load / l.maxLoad) * 100} tone={l.load / l.maxLoad > 0.85 ? 'warn' : 'brand'} label="Load" /></div>
              )}
              {u.id !== user.id && <Button className="mt-4" size="sm" variant="secondary" onClick={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Reactivate'}</Button>}
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add staff member" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => { setFe({}); create.mutate(); }}>Create account</Button></>}>
        <div className="space-y-4">
          <Field label="Full name" required error={fe.name}><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="Email" required error={fe.email}><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Role"><Select value={f.role} onChange={set('role')}><option value="DIETITIAN">Dietitian</option><option value="CARE_TEAM">Care Team</option><option value="LEAD_DOCTOR">Lead Doctor</option></Select></Field>
          {f.role === 'DIETITIAN' && <div className="grid grid-cols-2 gap-3"><Field label="Specialty"><Input value={f.specialty} onChange={set('specialty')} /></Field><Field label="Max patients" error={fe.maxLoad}><Input type="number" min="1" max="100" value={f.maxLoad} onChange={set('maxLoad')} /></Field></div>}
        </div>
      </Modal>
      <Modal open={!!temp} onClose={() => setTemp(null)} title="Account created" footer={<Button onClick={() => setTemp(null)}>Done</Button>}>
        <p className="text-sm text-slate-600">Share this temporary password with <strong>{temp?.email}</strong> securely. It is shown only once, and they must change it at first sign-in.</p>
        <code className="mt-3 block select-all rounded-xl bg-slate-100 p-3 text-center text-base font-semibold tracking-wide">{temp?.pw}</code>
      </Modal>
    </>
  );
}
