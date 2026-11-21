import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ShieldCheck, MessageCircle } from 'lucide-react';
import { api, post } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { startSubscriptionCheckout } from '../../lib/razorpay';
import { inr } from '../../lib/format';
import { Alert, Badge, Button, Card, CardTitle, Input, PageHeader, PageLoader, StatusBadge } from '../../components/ui';
import { useMe } from './Home';

export default function Plans() {
  const { data: me, isLoading } = useMe();
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => api('/plans', { auth: false }) });
  const qc = useQueryClient();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const [paying, setPaying] = useState(false);

  const request = useMutation({
    mutationFn: (b) => post('/me/request', b),
    onSuccess: () => { toast.success('Sent to the care team. They will reach out shortly.'); setMsg(''); qc.invalidateQueries({ queryKey: ['me'] }); },
    onError: toast.error,
  });

  async function pay() {
    setPaying(true);
    try {
      const s = await post('/me/subscription');
      const r = await startSubscriptionCheckout(s);
      if (r.mode === 'checkout') {
        const v = await post('/me/subscription/verify', r.response);
        toast.success(v.activated ? 'Payment successful. Your membership is active!' : 'Payment confirmed.');
      } else toast.success('Complete payment in the browser, then return here.');
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      if (e.message !== 'dismissed') toast.error(e);
      qc.invalidateQueries({ queryKey: ['me'] });
    } finally { setPaying(false); }
  }

  if (isLoading || !plans) return <PageLoader />;
  const m = me.membership;
  const st = m.status;
  const open = ['PENDING_ASSISTANCE', 'PLAN_SELECTED'].includes(st);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Membership" sub="Pick a plan, or let our care team guide you. Billed monthly via Razorpay." />

      {st === 'PLAN_SELECTED' && m.plan && (
        <Card className="mb-6 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2"><StatusBadge status={st} /><span className="text-xs text-slate-500">Confirmed by our care team</span></div>
              <h2 className="text-xl">{m.plan.name}</h2>
              <p className="text-sm text-slate-600">{inr(m.plan.priceInr)} per month for {m.plan.cycles} months. Cancel any time by contacting the care team.</p>
            </div>
            <Button size="lg" onClick={pay} loading={paying}>Subscribe · {inr(m.plan.priceInr)}/mo</Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" />Secure payment by Razorpay (UPI, cards, netbanking, e-mandate).</p>
        </Card>
      )}
      {!open && <Alert tone="info" className="mb-6">Your membership is <strong>{st.replace(/_/g, ' ').toLowerCase()}</strong>.</Alert>}

      <div className="grid gap-5 md:grid-cols-3">
        {plans.items.map((p, i) => {
          const featured = i === 1;
          const chosen = m.plan?.id === p.id || m.plan?._id === p.id;
          const requested = m.requestedPlan?.id === p.id;
          return (
            <Card key={p.id} className={`flex flex-col transition hover:-translate-y-1 ${featured ? 'border-brand-300 bg-gradient-to-b from-brand-50 to-white shadow-lift ring-2 ring-brand-300' : ''}`}>
              {featured && <Badge tone="brand" className="mb-2 self-start">Most popular</Badge>}
              <h2 className="text-xl">{p.name}</h2>
              <p className="mt-2"><span className="text-4xl font-extrabold tracking-tight text-ink-900">{inr(p.priceInr)}</span><span className="text-sm text-slate-500"> / month</span></p>
              <p className="text-xs text-slate-500">{p.cycles} monthly payments · {inr(p.priceInr * p.cycles)} total</p>
              <ul className="mb-5 mt-4 flex-1 space-y-2.5 text-sm text-slate-700">
                {p.features.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />{x}</li>)}
              </ul>
              {chosen ? <Badge tone="green" className="self-start">Selected</Badge>
                : requested ? <Badge tone="blue" className="self-start">Requested ✓</Badge>
                : <Button variant={featured ? 'primary' : 'secondary'} disabled={!open} loading={request.isPending && request.variables?.planId === p.id} onClick={() => request.mutate({ planId: p.id })}>Request this plan</Button>}
            </Card>
          );
        })}
      </div>

      {open && (
        <Card className="mt-6">
          <CardTitle icon={MessageCircle} title="Need help choosing?" sub="Our care team usually replies within a few hours." />
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); request.mutate({ message: msg }); }}>
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={500} placeholder="e.g. Which plan includes lab report review?" aria-label="Message to care team" />
            <Button type="submit" variant="soft" disabled={msg.trim().length < 3} loading={request.isPending && !request.variables?.planId}>Send</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
