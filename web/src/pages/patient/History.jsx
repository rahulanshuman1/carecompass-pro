import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { put, fieldErrors } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { isoDate, todayLocal } from '../../lib/format';
import { Alert, Button, Card, CardTitle, Chip, Field, Input, PageHeader, PageLoader, Select, Textarea } from '../../components/ui';
import { useMe } from './Home';
import { Activity, HeartPulse, UserRound, Utensils } from 'lucide-react';

const CONDS = ['Type 2 Diabetes', 'Hypertension', 'PCOS', 'Thyroid disorder', 'High cholesterol', 'Obesity', 'Kidney disease', 'IBS / gut issues'];
const csv = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function History() {
  const { data, isLoading } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [fe, setFe] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data || f) return;
    const p = data.profile || {}, h = p.history || {};
    setF({
      dob: isoDate(p.dob), sex: p.sex || '', phone: p.phone || '', heightCm: p.heightCm ?? '', weightKg: p.weightKg ?? '',
      conditions: (h.conditions || []).filter((c) => CONDS.includes(c)), otherConditions: (h.conditions || []).filter((c) => !CONDS.includes(c)).join(', '),
      allergies: (h.allergies || []).join(', '), medications: h.medications || '', labNotes: h.labNotes || '',
      activity: h.activity || 'Lightly active', sleepHrs: h.sleepHrs ?? 7, smoking: h.smoking || 'Never', alcohol: h.alcohol || 'Never',
      dietType: h.dietType || 'Vegetarian', dislikes: h.dislikes || '', goals: h.goals || '', consent: !!h.consentAt,
    });
  }, [data, f]);

  const save = useMutation({
    mutationFn: (b) => put('/me/history', b),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); toast.success(data.profile?.historySubmittedAt ? 'History updated' : 'History submitted. Our care team has been notified.'); nav('/'); },
    onError: (e) => { setErr(e.message); setFe(fieldErrors(e)); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  });

  if (isLoading || !f) return <PageLoader />;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const toggle = (c) => setF((s) => ({ ...s, conditions: s.conditions.includes(c) ? s.conditions.filter((x) => x !== c) : [...s.conditions, c] }));

  function submit(e) {
    e.preventDefault(); setErr(''); setFe({});
    save.mutate({
      dob: f.dob, sex: f.sex, phone: f.phone, heightCm: f.heightCm, weightKg: f.weightKg,
      conditions: [...f.conditions, ...csv(f.otherConditions)], allergies: csv(f.allergies), medications: f.medications, labNotes: f.labNotes,
      activity: f.activity, sleepHrs: f.sleepHrs, smoking: f.smoking, alcohol: f.alcohol, dietType: f.dietType, dislikes: f.dislikes, goals: f.goals, consent: f.consent,
    });
  }
  const submitted = !!data.profile?.historySubmittedAt;

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="My health history" sub={submitted ? 'You can update this any time.' : 'This helps your dietitian build a plan that fits you. It is visible only to your care team.'} />
      {err && <Alert tone="error">{err}</Alert>}

      <Card>
        <CardTitle icon={UserRound} title="About you" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" required error={fe.dob}><Input type="date" max={todayLocal()} value={f.dob} onChange={set('dob')} autoComplete="bday" /></Field>
          <Field label="Sex" required error={fe.sex}><Select value={f.sex} onChange={set('sex')}><option value="">Select…</option><option>Female</option><option>Male</option><option>Other</option></Select></Field>
          <Field label="Phone" required error={fe.phone}><Input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91 98765 43210" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height (cm)" required error={fe.heightCm}><Input type="number" inputMode="decimal" min="80" max="250" step="0.1" value={f.heightCm} onChange={set('heightCm')} /></Field>
            <Field label="Weight (kg)" required error={fe.weightKg}><Input type="number" inputMode="decimal" min="20" max="400" step="0.1" value={f.weightKg} onChange={set('weightKg')} /></Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle icon={HeartPulse} title="Medical" />
        <p className="mb-2 text-sm font-medium text-slate-700">Conditions</p>
        <div className="mb-4 flex flex-wrap gap-2">{CONDS.map((c) => <Chip key={c} active={f.conditions.includes(c)} onClick={() => toggle(c)}>{c}</Chip>)}</div>
        <div className="grid gap-4">
          <Field label="Other conditions" hint="comma separated"><Input value={f.otherConditions} onChange={set('otherConditions')} /></Field>
          <Field label="Allergies / intolerances" hint="comma separated" error={fe['allergies']}><Input value={f.allergies} onChange={set('allergies')} /></Field>
          <Field label="Current medications" error={fe.medications}><Textarea value={f.medications} onChange={set('medications')} /></Field>
          <Field label="Lab report notes" hint="e.g. HbA1c, cholesterol, TSH" error={fe.labNotes}><Textarea value={f.labNotes} onChange={set('labNotes')} /></Field>
        </div>
      </Card>

      <Card>
        <CardTitle icon={Activity} title="Lifestyle" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Activity level"><Select value={f.activity} onChange={set('activity')}>{['Sedentary', 'Lightly active', 'Moderately active', 'Very active'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Sleep (hours)" error={fe.sleepHrs}><Input type="number" inputMode="decimal" min="2" max="14" step="0.5" value={f.sleepHrs} onChange={set('sleepHrs')} /></Field>
          <Field label="Smoking"><Select value={f.smoking} onChange={set('smoking')}>{['Never', 'Former', 'Current'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Alcohol"><Select value={f.alcohol} onChange={set('alcohol')}>{['Never', 'Occasionally', 'Weekly', 'Daily'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        </div>
      </Card>

      <Card>
        <CardTitle icon={Utensils} title="Diet & goals" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Diet type"><Select value={f.dietType} onChange={set('dietType')}>{['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Foods you dislike"><Input value={f.dislikes} onChange={set('dislikes')} /></Field>
          <Field label="Health goals" required error={fe.goals} className="sm:col-span-2"><Textarea value={f.goals} onChange={set('goals')} placeholder="e.g. Lower HbA1c below 7% and lose 6 kg in 4 months" /></Field>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600" checked={f.consent} onChange={(e) => setF((s) => ({ ...s, consent: e.target.checked }))} />
          <span>I consent to my health information being used by my care team (care team, dietitian and lead doctor) to plan my diet.</span>
        </label>
        {fe.consent && <p className="mt-1 text-xs font-medium text-rose-600" role="alert">{fe.consent}</p>}
      </Card>

      <div className="flex justify-end"><Button type="submit" size="lg" loading={save.isPending}>{submitted ? 'Update history' : 'Submit history'}</Button></div>
    </form>
  );
}
