import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Wallet, Wand2 } from 'lucide-react';
import { api, post } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fmtDate, fmtDateTime, inr, label } from '../../lib/format';
import { Alert, Button, Card, CardTitle, Field, Input, Modal, Select, StatusBadge } from '../../components/ui';

/** Care team / lead doctor controls for the membership state machine. */
export default function MembershipPanel({ data, patientId }) {
  const { membership: m, assignment, profile } = data;
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['case', patientId] }); qc.invalidateQueries({ queryKey: ['queue'] }); };
  const run = (fn, ok) => useMutation({ mutationFn: fn, onSuccess: (r) => { if (ok) toast.success(typeof ok === 'function' ? ok(r) : ok); refresh(); }, onError: toast.error });

  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => api('/plans', { auth: false }) });
  const { data: dts } = useQuery({ queryKey: ['dietitians'], queryFn: () => api('/dietitians'), enabled: ['PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(m.status) });
  const [planId, setPlanId] = useState(m.requestedPlan?.id || '');
  const [dt, setDt] = useState('');
  const [ref, setRef] = useState('');
  const [offline, setOffline] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');

  const selectPlan = run(() => post(`/memberships/${patientId}/select-plan`, { planId: planId || plans?.items?.[0]?.id }), 'Plan confirmed');
  const link = run(() => post(`/memberships/${patientId}/payment-link`), null);
  const offlinePay = run(() => post(`/memberships/${patientId}/offline-payment`, { reference: ref }), 'Payment recorded. Membership activated.');
  const assign = run((b) => post(`/memberships/${patientId}/assign`, b), (r) => `Assigned to ${r.dietitian.name}`);
  const back = run(() => post(`/memberships/${patientId}/transition`, { to: 'PENDING_ASSISTANCE', reason: 'Returned for assistance' }), 'Returned to assistance');
  const cancelM = run(() => post(`/memberships/${patientId}/transition`, { to: 'CANCELLED', reason }), 'Membership cancelled');

  const st = m.status;
  const historyOk = !!profile?.historySubmittedAt;
  const selectedPlanId = planId || plans?.items?.[0]?.id || '';
  const events = [...(m.events || [])].reverse();

  return (
    <Card>
      <CardTitle icon={Wallet} title="Membership" action={<StatusBadge status={st} />} sub={m.plan ? `${m.plan.name} · ${inr(m.plan.priceInr)}/mo × ${m.plan.cycles}` : 'No plan selected'} />
      <div className="mb-4 flex flex-wrap gap-2 text-xs"><StatusBadge status={m.paymentStatus} />{m.paymentMethod && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{m.paymentMethod === 'RAZORPAY' ? 'Razorpay subscription' : `Offline · ${m.offlineReference}`}</span>}</div>

      {st === 'PENDING_ASSISTANCE' && (
        <div className="space-y-3">
          {m.requestedPlan && <Alert tone="info">Patient requested <strong>{m.requestedPlan.name}</strong>.</Alert>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Confirm plan for patient" className="flex-1"><Select value={selectedPlanId} onChange={(e) => setPlanId(e.target.value)}>{plans?.items.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.priceInr)}/mo × {p.cycles}</option>)}</Select></Field>
            <Button onClick={() => selectPlan.mutate()} loading={selectPlan.isPending} disabled={!plans}>Confirm plan</Button>
          </div>
        </div>
      )}

      {st === 'PLAN_SELECTED' && (
        <div className="space-y-3">
          {m.paymentStatus === 'PAID' ? <Alert tone="success">Payment received. Activating…</Alert> : (
            <Alert tone="info">Ask the patient to subscribe from their Membership page, share a payment link, or record an offline payment. The membership activates automatically once payment is confirmed.</Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={async () => { try { const r = await link.mutateAsync(); await navigator.clipboard?.writeText(r.shortUrl); toast.success('Payment link copied. Send it to the patient.'); } catch { /* toast shown */ } }} loading={link.isPending}><Link2 className="h-4 w-4" />Copy payment link</Button>
            <Button variant="secondary" onClick={() => setOffline(true)}>Record offline payment</Button>
            <Button variant="ghost" onClick={() => back.mutate()} loading={back.isPending}>Back to assistance</Button>
          </div>
          {m.razorpay?.subscriptionId && <p className="text-xs text-slate-500">Razorpay subscription {m.razorpay.subscriptionId} · {label(m.razorpay.status || 'created')}</p>}
        </div>
      )}

      {['PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(st) && (
        <div className="space-y-3">
          {assignment && <p className="text-sm">Dietitian: <strong>{assignment.dietitian?.name}</strong> <span className="text-slate-500">since {fmtDate(assignment.assignedAt)}</span></p>}
          {!historyOk && <Alert tone="warn">Patient history is missing. Assignment is blocked until it is submitted.</Alert>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label={assignment ? 'Reassign to' : 'Assign dietitian'} className="flex-1">
              <Select value={dt} onChange={(e) => setDt(e.target.value)}>
                <option value="">Choose…</option>
                {dts?.items.map((d) => <option key={d.id} value={d.id} disabled={d.load >= d.maxLoad || assignment?.dietitian?.id === d.id}>{d.name} · {d.load}/{d.maxLoad} · {d.specialty}</option>)}
              </Select>
            </Field>
            <Button disabled={!dt || !historyOk} loading={assign.isPending} onClick={() => assign.mutate({ dietitianId: dt })}>{assignment ? 'Reassign' : 'Assign'}</Button>
            {!assignment && <Button variant="soft" disabled={!historyOk} onClick={() => assign.mutate({ auto: true })}><Wand2 className="h-4 w-4" />Auto</Button>}
          </div>
        </div>
      )}

      {!['CANCELLED', 'EXPIRED'].includes(st) && <div className="mt-5"><Button variant="danger" size="sm" onClick={() => setCancel(true)}>Cancel membership</Button></div>}

      <h3 className="mb-2 mt-6 text-sm">Status history</h3>
      <ol className="space-y-2 border-l-2 border-slate-100 pl-4 text-sm">
        {events.map((e, i) => (
          <li key={i}><span className="font-semibold text-slate-800">{label(e.to)}</span> <span className="text-slate-500">← {label(e.from)} · {fmtDateTime(e.at)} · {e.by?.name || e.actor}{e.reason ? ` · ${e.reason}` : ''}</span></li>
        ))}
        <li className="text-slate-500">Created · {fmtDateTime(m.createdAt)}</li>
      </ol>

      <Modal open={offline} onClose={() => setOffline(false)} title="Record offline payment" footer={<><Button variant="ghost" onClick={() => setOffline(false)}>Cancel</Button><Button loading={offlinePay.isPending} disabled={ref.trim().length < 3} onClick={() => offlinePay.mutate(undefined, { onSuccess: () => setOffline(false) })}>Confirm payment</Button></>}>
        <p className="mb-3 text-sm text-slate-600">Use this for cash, bank transfer or UPI received outside Razorpay. The membership will be activated immediately.</p>
        <Field label="Receipt / UPI reference" required><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      </Modal>
      <Modal open={cancel} onClose={() => setCancel(false)} title="Cancel this membership?" footer={<><Button variant="ghost" onClick={() => setCancel(false)}>Keep</Button><Button variant="danger" loading={cancelM.isPending} onClick={() => cancelM.mutate(undefined, { onSuccess: () => setCancel(false) })}>Cancel membership</Button></>}>
        <p className="mb-3 text-sm text-slate-600">This cannot be undone. Any Razorpay subscription will be stopped.</p>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
      </Modal>
    </Card>
  );
}
