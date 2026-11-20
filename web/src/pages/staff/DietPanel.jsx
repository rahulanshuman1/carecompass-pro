import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Salad } from 'lucide-react';
import { post, put } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { itemsKcal, planKcal } from '../../lib/format';
import { Alert, Badge, Button, Card, CardTitle, Field, Input, StatusBadge, Textarea } from '../../components/ui';

const blankItem = () => ({ name: '', qty: '', kcal: '' });
const toForm = (p) => ({
  title: p.title || '', startDate: p.startDate || '', targets: { ...p.targets }, supplements: p.supplements || '', notes: p.notes || '',
  meals: (p.meals || []).map((m) => ({ time: m.time, name: m.name, items: (m.items || []).map((i) => ({ name: i.name, qty: i.qty || '', kcal: i.kcal })) })),
});
const toBody = (f) => ({
  ...f,
  targets: Object.fromEntries(Object.entries(f.targets).map(([k, v]) => [k, Number(v) || 0])),
  meals: f.meals.map((m) => ({ ...m, items: m.items.filter((i) => i.name.trim() || i.kcal !== '').map((i) => ({ ...i, kcal: Number(i.kcal) || 0 })) })),
});

function PlanSummary({ p }) {
  const t = p.targets;
  const meals = [...p.meals].sort((a, b) => a.time.localeCompare(b.time));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">{[`${t.kcal} kcal`, `P ${t.protein} g`, `C ${t.carbs} g`, `F ${t.fat} g`, `${t.waterMl} ml water`].map((x) => <Badge key={x} tone="brand">{x}</Badge>)}<Badge>Meals total {planKcal(p)} kcal</Badge></div>
      <div className="space-y-2">
        {meals.map((m, i) => (
          <div key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
            <p className="font-semibold text-slate-900">{m.time} · {m.name} <span className="text-xs font-normal text-slate-400">{itemsKcal(m)} kcal</span></p>
            <ul className="mt-1 text-slate-600">{m.items.map((it, k) => <li key={k}>{it.name} <span className="text-slate-400">{it.qty} · {it.kcal} kcal</span></li>)}</ul>
          </div>
        ))}
      </div>
      {p.supplements && <p className="mt-3 text-sm"><strong>Supplements:</strong> {p.supplements}</p>}
      {p.notes && <p className="mt-1 text-sm"><strong>Notes:</strong> {p.notes}</p>}
      {p.reviewNote && <p className="mt-1 text-sm text-slate-600"><strong>Doctor's note:</strong> {p.reviewNote}</p>}
    </div>
  );
}

function Builder({ plan, onDone }) {
  const toast = useToast();
  const [f, setF] = useState(() => toForm(plan));
  const [errs, setErrs] = useState([]);
  useEffect(() => setF(toForm(plan)), [plan._id, plan.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const planId = plan.id || plan._id;
  const save = useMutation({ mutationFn: () => put(`/diet-plans/${planId}`, toBody(f)) });
  const submit = useMutation({ mutationFn: () => post(`/diet-plans/${planId}/submit`) });

  const setT = (k) => (e) => setF((s) => ({ ...s, targets: { ...s.targets, [k]: e.target.value } }));
  const upMeal = (i, patch) => setF((s) => ({ ...s, meals: s.meals.map((m, k) => (k === i ? { ...m, ...patch } : m)) }));
  const upItem = (i, j, patch) => setF((s) => ({ ...s, meals: s.meals.map((m, k) => (k === i ? { ...m, items: m.items.map((it, n) => (n === j ? { ...it, ...patch } : it)) } : m)) }));
  const body = toBody(f);
  const total = body.meals.reduce((s, m) => s + m.items.reduce((a, it) => a + it.kcal, 0), 0);
  const target = Number(f.targets.kcal) || 0;
  const off = target && Math.abs(total - target) > target * 0.15;

  async function go(andSubmit) {
    setErrs([]);
    try {
      await save.mutateAsync();
      if (andSubmit) { await submit.mutateAsync(); toast.success('Submitted for doctor review'); } else toast.success(off ? `Draft saved. Meals total ${total} kcal vs target ${target}.` : 'Draft saved');
      onDone();
    } catch (e) { setErrs(e.details?.map?.((d) => (typeof d === 'string' ? d : d.message)) || [e.message]); }
  }

  return (
    <div className="space-y-4">
      {plan.reviewNote && <Alert tone="warn"><strong>Doctor requested changes:</strong> {plan.reviewNote}</Alert>}
      {errs.length > 0 && <Alert tone="error"><ul className="list-disc pl-4">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul></Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan title" required><Input value={f.title} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Start date" required><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['kcal', 'Calories'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'], ['waterMl', 'Water (ml)']].map(([k, l]) => <Field key={k} label={l}><Input type="number" inputMode="numeric" value={f.targets[k]} onChange={setT(k)} /></Field>)}
      </div>

      <div className="flex items-center justify-between"><h3>Meals</h3><span className={`text-xs font-semibold ${off ? 'text-amber-600' : 'text-slate-500'}`}>Total {total} / {target} kcal</span></div>
      {f.meals.map((m, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 p-4">
          <div className="grid grid-cols-[110px_1fr_auto] items-end gap-3">
            <Field label="Time"><Input type="time" value={m.time} onChange={(e) => upMeal(i, { time: e.target.value })} /></Field>
            <Field label="Meal name"><Input value={m.name} maxLength={40} onChange={(e) => upMeal(i, { name: e.target.value })} placeholder="Breakfast" /></Field>
            <Button variant="ghost" size="sm" aria-label="Remove meal" onClick={() => setF((s) => ({ ...s, meals: s.meals.filter((_, k) => k !== i) }))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {m.items.map((it, j) => (
              <div key={j} className="grid grid-cols-[1fr_88px_72px_auto] gap-2">
                <Input aria-label="Food" placeholder="Food" value={it.name} onChange={(e) => upItem(i, j, { name: e.target.value })} />
                <Input aria-label="Quantity" placeholder="Qty" value={it.qty} onChange={(e) => upItem(i, j, { qty: e.target.value })} />
                <Input aria-label="Calories" type="number" inputMode="numeric" placeholder="kcal" value={it.kcal} onChange={(e) => upItem(i, j, { kcal: e.target.value })} />
                <button type="button" aria-label="Remove food" className="px-1 text-slate-400 hover:text-rose-500" onClick={() => upMeal(i, { items: m.items.filter((_, n) => n !== j) })}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="soft" size="sm" onClick={() => upMeal(i, { items: [...m.items, blankItem()] })}><Plus className="h-4 w-4" />Add food</Button>
          </div>
        </div>
      ))}
      <Button variant="secondary" onClick={() => setF((s) => ({ ...s, meals: [...s.meals, { time: '12:00', name: '', items: [blankItem()] }] }))}><Plus className="h-4 w-4" />Add meal</Button>

      <Field label="Supplements"><Input value={f.supplements} maxLength={300} onChange={(e) => setF({ ...f, supplements: e.target.value })} /></Field>
      <Field label="Notes & follow-up"><Textarea value={f.notes} maxLength={1000} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" loading={save.isPending && !submit.isPending} onClick={() => go(false)}>Save draft</Button>
        <Button loading={submit.isPending} onClick={() => go(true)}>Submit for review</Button>
      </div>
    </div>
  );
}

export default function DietPanel({ data, patientId, role, userId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['case', patientId] }); qc.invalidateQueries({ queryKey: ['reviews'] }); qc.invalidateQueries({ queryKey: ['my-patients'] }); };
  const plans = data.dietPlans || [];
  const work = plans.find((p) => ['DRAFT', 'IN_REVIEW'].includes(p.status));
  const active = plans.find((p) => p.status === 'ACTIVE');
  const archived = plans.filter((p) => p.status === 'ARCHIVED');
  const mine = role === 'DIETITIAN' && data.assignment?.dietitian?.id === userId;

  const create = useMutation({ mutationFn: () => post(`/patients/${patientId}/diet-plans`), onSuccess: refresh, onError: toast.error });
  const review = useMutation({
    mutationFn: ({ id, decision }) => post(`/diet-plans/${id}/review`, { decision, note }),
    onSuccess: (_r, v) => { toast.success(v.decision === 'approve' ? 'Plan approved and live for the patient' : 'Changes requested'); setNote(''); refresh(); },
    onError: toast.error,
  });

  return (
    <Card>
      <CardTitle icon={Salad} title="Diet plan" />
      {work ? (
        <>
          <div className="mb-3 flex items-center justify-between"><h3>Working plan v{work.version}</h3><StatusBadge status={work.status} /></div>
          {work.status === 'DRAFT' && mine ? <Builder plan={work} onDone={refresh} /> : (
            <>
              <PlanSummary p={work} />
              {work.status === 'IN_REVIEW' && role === 'LEAD_DOCTOR' && (
                <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                  <Field label="Review note" hint="required when requesting changes"><Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[72px]" /></Field>
                  <div className="flex flex-wrap gap-2">
                    <Button loading={review.isPending && review.variables?.decision === 'approve'} onClick={() => review.mutate({ id: work.id, decision: 'approve' })}>Approve & publish to patient</Button>
                    <Button variant="danger" loading={review.isPending && review.variables?.decision === 'changes'} onClick={() => review.mutate({ id: work.id, decision: 'changes' })}>Request changes</Button>
                  </div>
                </div>
              )}
              {work.status === 'IN_REVIEW' && role === 'DIETITIAN' && <p className="mt-3 text-sm text-slate-500">Awaiting lead doctor review.</p>}
              {work.status === 'DRAFT' && !mine && <p className="mt-3 text-sm text-slate-500">The assigned dietitian is still editing this draft.</p>}
            </>
          )}
        </>
      ) : mine && data.membership.status === 'ASSIGNED' ? (
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{active ? 'Need to adjust the live plan? Create a revision. It goes through review again.' : 'No diet plan yet.'}</p><Button onClick={() => create.mutate()} loading={create.isPending}>{active ? 'Create revision' : 'Create diet plan'}</Button></div>
      ) : !active && <p className="text-sm text-slate-500">No diet plan yet.</p>}

      {active && <div className="mt-6"><div className="mb-3 flex items-center gap-2"><h3>Active plan v{active.version}</h3><Badge tone="green">Live for patient</Badge></div><PlanSummary p={active} /></div>}
      {archived.length > 0 && <p className="mt-4 text-xs text-slate-500">Archived versions: {archived.map((p) => `v${p.version}`).join(', ')}</p>}
    </Card>
  );
}
