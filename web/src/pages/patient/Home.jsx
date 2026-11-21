import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, CreditCard, Droplets, Flame, Utensils, Scale, Camera, MapPin, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { inr, label, itemsKcal } from '../../lib/format';
import { Alert, Avatar, Badge, Card, CardTitle, PageLoader, Ring, StatusBadge, cx } from '../../components/ui';

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api('/me') });

function Tile({ icon: Icon, title, children, sub }) {
  return (
    <Card className="flex items-center gap-4 p-4 md:p-5">
      {children}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Icon className="h-3.5 w-3.5 text-brand-500" />{title}</p>
        {sub}
      </div>
    </Card>
  );
}

export default function PatientHome() {
  const { data, isLoading, error } = useMe();
  const activeId = data?.activePlan?.id || data?.activePlan?._id;
  const diet = useQuery({ queryKey: ['diet'], queryFn: () => api('/me/diet-plan'), enabled: !!activeId });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  const { user, profile, membership: m, dietitian, activePlan, adherence } = data;
  const st = m.status;
  const paidFlow = ['ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(st);
  const steps = [
    { t: 'Complete your health history', done: !!profile?.historySubmittedAt, to: '/history', cta: 'Open form' },
    { t: 'Choose a plan with our care team', done: ['PLAN_SELECTED', 'ACTIVE', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'].includes(st), to: '/plans', cta: 'View plans' },
    { t: st === 'PLAN_SELECTED' ? 'Complete your subscription payment' : 'Membership activated', done: paidFlow, to: '/plans', cta: 'Pay now', show: st === 'PLAN_SELECTED' },
    { t: 'Dietitian assigned', done: st === 'ASSIGNED' },
    { t: 'Your diet plan is ready', done: !!activePlan, to: '/my-plan', cta: 'Open plan' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const cur = steps.findIndex((s) => !s.done);
  const h = profile?.history || {};
  const place = [h.state, h.country].filter(Boolean).join(', ');

  const d = diet.data;
  const meals = d?.plan ? [...d.plan.meals].sort((a, b) => a.time.localeCompare(b.time)) : [];
  const mid = (x) => x._id || x.id;
  const doneToday = d?.today ? meals.filter((x) => d.today.mealsDone.includes(mid(x))).length : 0;
  const photoOf = (x) => d?.today?.photos?.find((p) => p.mealId === mid(x))?.photo;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-500 via-brand-600 to-ink-800 p-6 text-white shadow-lift md:p-9">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-brand-100">Good to see you,</p>
            <h1 className="mt-0.5 text-3xl text-white md:text-4xl">{user.name.split(' ')[0]} 👋</h1>
            <p className="mt-3 text-base text-brand-50">
              {activePlan ? 'Your personalised plan is live. Snap a photo of each meal to build your food diary.' : cur >= 0 ? `Next up: ${steps[cur].t.toLowerCase()}.` : 'You are all set.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {activePlan ? (
                <Link to="/my-plan" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-brand-700 shadow-sm hover:bg-brand-50">Open today's plan<ArrowRight className="h-4 w-4" /></Link>
              ) : cur >= 0 && steps[cur].to && steps[cur].show !== false ? (
                <Link to={steps[cur].to} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-extrabold text-brand-700 shadow-sm hover:bg-brand-50">{steps[cur].cta}<ArrowRight className="h-4 w-4" /></Link>
              ) : null}
              {place && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-xs font-bold"><MapPin className="h-3.5 w-3.5" />{place}{h.cuisine ? ` · ${h.cuisine}` : ''}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-3xl bg-white/10 p-4 backdrop-blur">
            <Ring value={(doneCount / steps.length) * 100} size={96} stroke={10} tone="amber" label="Journey progress">
              <span className="text-xl font-extrabold text-white">{doneCount}/{steps.length}</span>
            </Ring>
            <div><p className="font-extrabold">Your journey</p><p className="text-sm text-brand-100">{doneCount === steps.length ? 'All steps done' : `${steps.length - doneCount} step${steps.length - doneCount > 1 ? 's' : ''} to go`}</p></div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      </section>

      {st === 'CANCELLED' && <Alert tone="error">Your membership was cancelled. Contact the care team to restart.</Alert>}
      {m.paymentStatus === 'PAST_DUE' && <Alert tone="warn">Your last subscription payment did not go through. Please update your payment method with Razorpay to keep your plan active.</Alert>}

      {/* Today at a glance */}
      {activePlan && d?.plan && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={Utensils} title="Meals today" sub={<p className="mt-0.5 text-sm text-slate-600"><strong className="text-xl text-ink-900">{doneToday}</strong> / {meals.length} done</p>}>
              <Ring value={meals.length ? (doneToday / meals.length) * 100 : 0} size={56} stroke={7} label="Meals today"><Check className="h-4 w-4 text-brand-500" /></Ring>
            </Tile>
            <Tile icon={Droplets} title="Water" sub={<p className="mt-0.5 text-sm text-slate-600"><strong className="text-xl text-ink-900">{d.today.waterMl}</strong> / {d.plan.targets.waterMl} ml</p>}>
              <Ring value={(d.today.waterMl / d.plan.targets.waterMl) * 100} size={56} stroke={7} tone="blue" label="Water"><Droplets className="h-4 w-4 text-indigo-500" /></Ring>
            </Tile>
            <Tile icon={Flame} title="Weekly adherence" sub={<p className="mt-0.5 text-sm text-slate-600"><strong className="text-xl text-ink-900">{adherence ?? 0}%</strong> this week</p>}>
              <Ring value={adherence ?? 0} size={56} stroke={7} tone={(adherence ?? 0) < 50 ? 'amber' : 'green'} label="Weekly adherence"><Flame className="h-4 w-4 text-emerald-500" /></Ring>
            </Tile>
            <Tile icon={Scale} title="Weight" sub={<p className="mt-0.5 text-sm text-slate-600"><strong className="text-xl text-ink-900">{d.today.weightKg || profile?.weightKg || '—'}</strong> kg</p>}>
              <span className="grid h-14 w-14 place-items-center rounded-full bg-sun-50 text-sun-500"><Scale className="h-6 w-6" /></span>
            </Tile>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between"><h2>Today's food diary</h2><Link to="/my-plan" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">See full plan<ArrowRight className="h-4 w-4" /></Link></div>
            <div className="scroll-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {meals.map((x) => {
                const isDone = d.today.mealsDone.includes(mid(x));
                const photo = photoOf(x);
                return (
                  <Link key={mid(x)} to="/my-plan" className={cx('w-44 shrink-0 overflow-hidden rounded-3xl border bg-white shadow-soft transition hover:-translate-y-0.5', isDone ? 'border-emerald-200' : 'border-ink-100')}>
                    <div className="relative grid h-28 place-items-center overflow-hidden bg-gradient-to-br from-brand-50 to-ink-50">
                      {photo ? <img src={photo} alt={`${x.name} photo`} className="h-full w-full object-cover" /> : <Camera className="h-7 w-7 text-brand-300" aria-hidden />}
                      {isDone && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></span>}
                    </div>
                    <div className="p-3"><p className="text-xs font-bold text-slate-500">{x.time}</p><p className="truncate font-bold text-ink-900">{x.name}</p><p className="text-xs text-slate-500">{itemsKcal(x)} kcal</p></div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle icon={Sparkles} title="Your care journey" sub={`${doneCount} of ${steps.length} steps complete`} />
          <ol className="space-y-1">
            {steps.map((s, i) => (
              <li key={s.t} className="flex gap-3.5 rounded-2xl p-3 data-[cur=true]:bg-brand-50/70" data-cur={i === cur}>
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${s.done ? 'bg-emerald-500 text-white' : i === cur ? 'bg-brand-600 text-white' : 'bg-ink-50 text-slate-400'}`}>{s.done ? <Check className="h-4 w-4" /> : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold ${s.done ? 'text-slate-500' : 'text-ink-900'}`}>{s.t}</p>
                  {i === cur && (s.to && s.show !== false ? <Link to={s.to} className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:underline">{s.cta}<ArrowRight className="h-3.5 w-3.5" /></Link> : <p className="text-xs text-slate-500">We will take it from here.</p>)}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardTitle title="Your dietitian" />
            {dietitian ? (
              <div className="flex items-center gap-3"><Avatar name={dietitian.name} photo={dietitian.photo} size="lg" /><div><p className="font-bold text-ink-900">{dietitian.name}</p><p className="text-sm text-slate-500">{dietitian.specialty || 'Registered dietitian'}</p>{h.cuisine && <Badge tone="brand" className="mt-1.5">Plans your {h.cuisine} diet</Badge>}</div></div>
            ) : <p className="text-sm text-slate-500">Assigned once your membership is active.</p>}
          </Card>
          <Card>
            <CardTitle icon={CreditCard} title="Membership" action={<StatusBadge status={st} />} />
            {m.plan ? (
              <div className="text-sm"><p className="font-bold text-ink-900">{m.plan.name}</p><p className="text-slate-500">{inr(m.plan.priceInr)} / month · {m.plan.cycles} months</p><p className="mt-1 text-xs text-slate-500">Payment: {label(m.paymentStatus)}</p></div>
            ) : <p className="text-sm text-slate-500">No plan selected yet.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
