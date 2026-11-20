import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, UserRound, CreditCard, Flame } from 'lucide-react';
import { api } from '../../lib/api';
import { inr, label } from '../../lib/format';
import { Alert, Avatar, Card, CardTitle, PageLoader, ProgressBar, StatusBadge } from '../../components/ui';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api('/me') });

export default function PatientHome() {
  const { data, isLoading, error } = useMe();
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  const { user, profile, membership: m, dietitian, activePlan, adherence } = data;
  const st = m.status;
  const paidFlow = ['ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(st);
  const steps = [
    { t: 'Complete your health history', done: !!profile?.historySubmittedAt, to: '/history', cta: 'Open form' },
    { t: 'Choose a plan with our care team', done: ['PLAN_SELECTED', ...['ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED']].includes(st), to: '/plans', cta: 'View plans' },
    { t: st === 'PLAN_SELECTED' ? 'Complete your subscription payment' : 'Membership activated', done: paidFlow, to: '/plans', cta: 'Pay now', show: st === 'PLAN_SELECTED' },
    { t: 'Dietitian assigned', done: st === 'ASSIGNED' },
    { t: 'Your diet plan is ready', done: !!activePlan, to: '/my-plan', cta: 'Open plan' },
  ];
  const cur = steps.findIndex((s) => !s.done);

  return (
    <>
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-soft md:p-8">
        <p className="text-sm text-brand-100">Hello,</p>
        <h1 className="mt-0.5 text-3xl text-white">{user.name.split(' ')[0]} 👋</h1>
        <p className="mt-2 max-w-lg text-sm text-brand-100">
          {activePlan ? 'Your personalised plan is live. Keep logging your meals each day.' : cur >= 0 ? `Next up: ${steps[cur].t.toLowerCase()}.` : 'You are all set.'}
        </p>
      </div>
      {st === 'CANCELLED' && <Alert tone="error" className="mb-4">Your membership was cancelled. Contact the care team to restart.</Alert>}
      {m.paymentStatus === 'PAST_DUE' && <Alert tone="warn" className="mb-4">Your last subscription payment did not go through. Please update your payment method with Razorpay to keep your plan active.</Alert>}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle title="Your care journey" sub={`${steps.filter((s) => s.done).length} of ${steps.length} steps complete`} />
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-3.5 rounded-xl p-3 data-[cur=true]:bg-brand-50/60" data-cur={i === cur}>
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${s.done ? 'bg-emerald-500 text-white' : i === cur ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s.done ? <Check className="h-4 w-4" /> : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.done ? 'text-slate-500' : 'text-slate-900'}`}>{s.t}</p>
                  {i === cur && (s.to && s.show !== false ? <Link to={s.to} className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">{s.cta}<ArrowRight className="h-3.5 w-3.5" /></Link> : <p className="text-xs text-slate-500">Waiting on the care team</p>)}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardTitle icon={CreditCard} title="Membership" action={<StatusBadge status={st} />} />
            {m.plan ? (
              <div className="text-sm"><p className="font-semibold text-slate-900">{m.plan.name}</p><p className="text-slate-500">{inr(m.plan.priceInr)} / month · {m.plan.cycles} months</p><p className="mt-1 text-xs text-slate-500">Payment: {label(m.paymentStatus)}</p></div>
            ) : <p className="text-sm text-slate-500">No plan selected yet.</p>}
          </Card>
          <Card>
            <CardTitle icon={UserRound} title="Your dietitian" />
            {dietitian ? <div className="flex items-center gap-3"><Avatar name={dietitian.name} /><div><p className="text-sm font-semibold text-slate-900">{dietitian.name}</p><p className="text-xs text-slate-500">{dietitian.specialty}</p></div></div> : <p className="text-sm text-slate-500">Assigned once your membership is active.</p>}
          </Card>
          {activePlan && (
            <Card>
              <CardTitle icon={Flame} title="This week" />
              <p className="text-3xl font-extrabold text-brand-700">{adherence ?? 0}%</p>
              <p className="mb-2 text-xs text-slate-500">meal-plan adherence</p>
              <ProgressBar value={adherence ?? 0} tone={(adherence ?? 0) < 50 ? 'warn' : 'brand'} label="Adherence" />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
