import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Lock, MessageSquare, Activity } from 'lucide-react';
import { api, post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { ageFrom, fmtDate, fmtDateTime, label } from '../../lib/format';
import { Alert, Avatar, Badge, Button, Card, CardTitle, Input, PageLoader, ProgressBar, StatusBadge } from '../../components/ui';
import MembershipPanel from './MembershipPanel';
import DietPanel from './DietPanel';

const Row = ({ k, children }) => (
  <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm last:border-0 sm:grid-cols-[150px_1fr]"><dt className="text-slate-500">{k}</dt><dd className="text-slate-900">{children || <span className="text-slate-400">—</span>}</dd></div>
);

function History({ p }) {
  const h = p.profile?.history;
  if (!h) return <Card><CardTitle icon={ClipboardList} title="Patient history" /><p className="text-sm text-slate-500">Not submitted yet.</p></Card>;
  const pr = p.profile;
  const bmi = pr.heightCm && pr.weightKg ? (pr.weightKg / (pr.heightCm / 100) ** 2).toFixed(1) : null;
  return (
    <Card>
      <CardTitle icon={ClipboardList} title="Patient history" sub={`Submitted ${fmtDate(pr.historySubmittedAt)}`} />
      <dl>
        <Row k="Age / sex">{ageFrom(pr.dob)} · {pr.sex}</Row>
        <Row k="Height / weight">{pr.heightCm} cm · {pr.weightKg} kg{bmi && ` (BMI ${bmi})`}</Row>
        <Row k="Phone">{pr.phone}</Row>
        <Row k="Conditions">{h.conditions?.length ? <span className="flex flex-wrap gap-1.5">{h.conditions.map((c) => <Badge key={c} tone="blue">{c}</Badge>)}</span> : null}</Row>
        <Row k="Allergies">{h.allergies?.length ? <span className="flex flex-wrap gap-1.5">{h.allergies.map((c) => <Badge key={c} tone="rose">{c}</Badge>)}</span> : null}</Row>
        {h.clinicalRestricted ? <Row k="Medications / labs"><span className="inline-flex items-center gap-1.5 text-slate-500"><Lock className="h-3.5 w-3.5" />Restricted to clinical staff</span></Row> : <><Row k="Medications">{h.medications}</Row><Row k="Lab notes">{h.labNotes}</Row></>}
        <Row k="Lifestyle">{h.activity} · sleep {h.sleepHrs} h · smoking: {h.smoking} · alcohol: {h.alcohol}</Row>
        <Row k="Diet">{h.dietType}{h.dislikes ? ` · dislikes: ${h.dislikes}` : ''}</Row>
        <Row k="Goals">{h.goals}</Row>
      </dl>
    </Card>
  );
}

function Notes({ p, id, role }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [t, setT] = useState('');
  const add = useMutation({ mutationFn: () => post(`/patients/${id}/notes`, { text: t }), onSuccess: () => { setT(''); qc.invalidateQueries({ queryKey: ['case', id] }); }, onError: toast.error });
  const tone = { CARE: 'border-brand-500', CLINICAL: 'border-blue-500', PATIENT_MESSAGE: 'border-amber-500' };
  return (
    <Card>
      <CardTitle icon={MessageSquare} title="Notes" />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
        <Input value={t} onChange={(e) => setT(e.target.value)} maxLength={1000} placeholder={`Add a ${role === 'CARE_TEAM' ? 'care-team' : 'clinical'} note`} aria-label="New note" />
        <Button type="submit" variant="soft" disabled={t.trim().length < 3} loading={add.isPending}>Add</Button>
      </form>
      <div className="space-y-2">
        {p.notes.length === 0 && <p className="text-sm text-slate-500">No notes yet.</p>}
        {p.notes.map((n) => (
          <div key={n.id} className={`rounded-r-xl border-l-4 bg-slate-50 px-3 py-2 text-sm ${tone[n.kind]}`}>
            <p className="text-xs text-slate-500">{n.author?.name} · {label(n.kind)} · {fmtDateTime(n.createdAt)}</p>
            <p className="mt-0.5 text-slate-800">{n.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Adherence({ a }) {
  if (!a || a.pct == null) return null;
  return (
    <Card>
      <CardTitle icon={Activity} title="Adherence (7 days)" action={<span className="text-xl font-extrabold text-brand-700">{a.pct}%</span>} />
      <ProgressBar value={a.pct} tone={a.pct < 50 ? 'warn' : 'brand'} label="Adherence" />
      <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1.5">Date</th><th>Meals</th><th>Water</th><th>Weight</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{[...a.days].sort((x, y) => y.date.localeCompare(x.date)).map((d) => <tr key={d.date}><td className="py-1.5">{fmtDate(d.date)}</td><td>{d.meals}</td><td>{d.waterMl} ml</td><td>{d.weightKg ? `${d.weightKg} kg` : '—'}</td></tr>)}</tbody></table></div>
    </Card>
  );
}

export default function PatientCase() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['case', id], queryFn: () => api(`/patients/${id}`) });
  if (isLoading) return <PageLoader />;
  if (error) return <><Button variant="ghost" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" />Back</Button><Alert tone="error" className="mt-3">{error.message}</Alert></>;
  const { patient, profile, membership: m, assignment } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" />Back</Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4"><Avatar name={patient.name} photo={patient.photo} size="lg" /><div><h1>{patient.name}</h1><p className="text-sm text-slate-500">{profile?.dob ? `${ageFrom(profile.dob)} yrs · ${profile.sex} · ` : ''}{assignment ? `Dietitian: ${assignment.dietitian?.name}` : 'No dietitian assigned'}</p></div></div>
        <StatusBadge status={m.status} />
      </div>
      <Alert tone="info" className="text-xs">You are viewing protected health information. This access is recorded in the audit log.</Alert>

      {user.role !== 'DIETITIAN' && <MembershipPanel data={data} patientId={id} />}
      {user.role !== 'CARE_TEAM' && <DietPanel data={data} patientId={id} role={user.role} userId={user.id} />}
      <History p={data} />
      {user.role !== 'CARE_TEAM' && <Adherence a={data.adherence} />}
      <Notes p={data} id={id} role={user.role} />
    </div>
  );
}
