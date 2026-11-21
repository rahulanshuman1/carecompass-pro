import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Flag, Play, Sparkles } from 'lucide-react';
import { api, post } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Alert, Badge, Button, Card, CardTitle, Field, Input, Select } from '../ui';
import { TagInput } from './dnd';

const SAMPLE = { age: 38, sex: 'Female', weightKg: 78, heightCm: 160, activity: 'Lightly active', dietType: 'Vegetarian', conditions: [], allergies: [], goals: 'weight loss', dislikes: '', sleepHrs: 7, country: 'India', state: 'Maharashtra', cuisine: 'Maharashtrian' };

function Result({ r }) {
  if (r.error) return <Alert tone="error">{r.error}</Alert>;
  const t = r.targets;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">{[`${t.kcal} kcal`, `P ${t.protein} g`, `C ${t.carbs} g`, `F ${t.fat} g`, `${t.waterMl} ml water`].map((x) => <Badge key={x} tone="brand">{x}</Badge>)}<Badge>Foods total {r.gotKcal} kcal</Badge></div>
      <p className="text-sm font-semibold text-slate-800">{r.title}</p>
      <div className="space-y-2">{r.meals.map((m, i) => (
        <div key={i} className="rounded-xl border border-slate-100 p-3 text-sm"><p className="font-semibold">{m.time} · {m.name}</p>
          <ul className="mt-1 text-slate-600">{m.items.map((it, k) => <li key={k}>{it.name} <span className="text-slate-400">{it.qty} · {it.kcal} kcal</span></li>)}</ul></div>))}</div>
      <div className="text-sm"><p className="font-bold text-slate-700">Rules that applied</p>{r.applied.length ? <ol className="ml-5 list-decimal text-slate-600">{r.applied.map((a) => <li key={a.id}>{a.name}</li>)}</ol> : <p className="text-slate-500">None. Only the base formula was used.</p>}</div>
      {r.flags.map((f, i) => <p key={i} className="flex gap-1.5 text-sm font-semibold text-amber-700"><Flag className="mt-0.5 h-4 w-4 shrink-0" />{f.rule}: {f.reason}</p>)}
      {r.warnings.map((w, i) => <Alert key={i} tone="warn">{w}</Alert>)}
      {r.excluded?.length > 0 && <p className="text-xs text-slate-500">Foods containing these words were left out: {r.excluded.join(', ')}</p>}
      {r.notes && <p className="whitespace-pre-line text-sm text-slate-600"><strong>Notes on plan:</strong> {r.notes}</p>}
    </div>
  );
}

/** Dry-run the CURRENT (even unsaved) rules on a real patient or a made-up one. Nothing is saved. */
export default function TestTab({ s, meta }) {
  const toast = useToast();
  const pats = useQuery({ queryKey: ['studio-patients'], queryFn: () => api('/studio/patients') });
  const [pid, setPid] = useState('');
  const [f, setF] = useState(SAMPLE);
  const [out, setOut] = useState(null);
  const run = useMutation({ mutationFn: () => post('/studio/preview', { studio: s, ...(pid ? { patientId: pid } : { sample: f }) }), onSuccess: setOut, onError: toast.error });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fm = meta.fields;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardTitle icon={Play} title="Try your rules" sub="Uses what is on screen, saved or not" />
        <div className="space-y-3">
          <Field label="Test on"><Select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">A sample patient (edit below)</option>{(pats.data?.items || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          {!pid && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age"><Input type="number" value={f.age} onChange={set('age')} /></Field>
                <Field label="Sex"><Select value={f.sex} onChange={set('sex')}>{fm.sex.options.map((o) => <option key={o}>{o}</option>)}</Select></Field>
                <Field label="Weight (kg)"><Input type="number" value={f.weightKg} onChange={set('weightKg')} /></Field>
                <Field label="Height (cm)"><Input type="number" value={f.heightCm} onChange={set('heightCm')} /></Field>
                <Field label="Activity"><Select value={f.activity} onChange={set('activity')}>{fm.activity.options.map((o) => <option key={o}>{o}</option>)}</Select></Field>
                <Field label="Diet"><Select value={f.dietType} onChange={set('dietType')}>{fm.dietType.options.map((o) => <option key={o}>{o}</option>)}</Select></Field>
              </div>
              <Field label="Conditions">
                <div className="flex flex-wrap gap-1.5">{fm.conditions.options.map((c) => { const on = f.conditions.includes(c); return <button key={c} type="button" aria-pressed={on} onClick={() => setF((x) => ({ ...x, conditions: on ? x.conditions.filter((y) => y !== c) : [...x.conditions, c] }))} className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 text-slate-600'}`}>{c}</button>; })}</div>
              </Field>
              <Field label="Allergies"><TagInput value={f.allergies} onChange={(v) => setF((x) => ({ ...x, allergies: v }))} placeholder="peanuts, dairy…" /></Field>
              <Field label="Goals"><Input value={f.goals} onChange={set('goals')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Sleep (hours)"><Input type="number" value={f.sleepHrs} onChange={set('sleepHrs')} /></Field>
                <Field label="State"><Input value={f.state} onChange={set('state')} /></Field>
              </div>
            </>
          )}
          <Button className="w-full" loading={run.isPending} onClick={() => run.mutate()}><Sparkles className="h-4 w-4" />Generate test plan</Button>
          {pid && <p className="text-xs text-slate-400">Viewing a real patient's data for this test is recorded in the audit log.</p>}
        </div>
      </Card>
      <Card>{out ? <Result r={out} /> : <p className="text-sm text-slate-500">Run a test to see the targets, meals, which rules fired and what would be flagged. Nothing is saved.</p>}</Card>
    </div>
  );
}
