import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, patch, post, fieldErrors } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { inr } from '../../lib/format';
import { Alert, Badge, Button, Card, Field, Input, Modal, PageHeader, PageLoader, Textarea } from '../../components/ui';

export default function PlansAdmin() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ['plans-all'], queryFn: () => api('/plans/all') });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', priceInr: '', cycles: 3, features: '' });
  const [fe, setFe] = useState({});
  const refresh = () => { qc.invalidateQueries({ queryKey: ['plans-all'] }); qc.invalidateQueries({ queryKey: ['plans'] }); };

  const create = useMutation({
    mutationFn: () => post('/plans', { ...f, features: f.features.split('\n').map((s) => s.trim()).filter(Boolean) }),
    onSuccess: () => { toast.success('Plan created'); setOpen(false); setF({ name: '', priceInr: '', cycles: 3, features: '' }); refresh(); },
    onError: (e) => { setFe(fieldErrors(e)); toast.error(e); },
  });
  const toggle = useMutation({ mutationFn: (p) => patch(`/plans/${p.id}`, { isActive: !p.isActive }), onSuccess: refresh, onError: toast.error });

  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <PageHeader title="Membership plans" sub="Prices are monthly. A plan's price and length are locked once created; add a new plan to change them." action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New plan</Button>} />
      <div className="grid gap-4 md:grid-cols-3">
        {data.items.map((p) => (
          <Card key={p.id} className={p.isActive ? '' : 'opacity-70'}>
            <div className="flex items-start justify-between"><h2>{p.name}</h2><Badge tone={p.isActive ? 'green' : 'slate'}>{p.isActive ? 'Visible' : 'Hidden'}</Badge></div>
            <p className="mt-2 text-2xl font-extrabold">{inr(p.priceInr)}<span className="text-sm font-medium text-slate-400"> / month × {p.cycles}</span></p>
            <ul className="my-3 list-disc space-y-1 pl-5 text-sm text-slate-600">{p.features.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="text-xs text-slate-500">{p.members} member{p.members === 1 ? '' : 's'} · {p.synced ? 'Synced with Razorpay' : 'Syncs on first checkout'}</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => toggle.mutate(p)}>{p.isActive ? 'Hide from patients' : 'Show to patients'}</Button>
          </Card>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New membership plan" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => { setFe({}); create.mutate(); }}>Create plan</Button></>}>
        <div className="space-y-4">
          <Field label="Name" required error={fe.name}><Input value={f.name} onChange={set('name')} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price per month (₹)" required error={fe.priceInr}><Input type="number" inputMode="numeric" min="1" value={f.priceInr} onChange={set('priceInr')} /></Field>
            <Field label="Months" required error={fe.cycles}><Input type="number" inputMode="numeric" min="1" max="60" value={f.cycles} onChange={set('cycles')} /></Field>
          </div>
          <Field label="Features" hint="one per line"><Textarea value={f.features} onChange={set('features')} /></Field>
        </div>
      </Modal>
    </>
  );
}
