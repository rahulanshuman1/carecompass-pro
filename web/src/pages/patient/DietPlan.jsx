import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Droplets, Scale, Clock } from 'lucide-react';
import { useState } from 'react';
import { api, put } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { fmtDate, itemsKcal } from '../../lib/format';
import { Alert, Button, Card, CardTitle, EmptyState, Input, PageHeader, PageLoader, ProgressBar } from '../../components/ui';
import { Salad } from 'lucide-react';

export default function DietPlan() {
  const qc = useQueryClient();
  const toast = useToast();
  const [kg, setKg] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['diet'], queryFn: () => api('/me/diet-plan') });
  const log = useMutation({
    mutationFn: (b) => put('/me/adherence/today', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diet'] }),
    onError: toast.error,
  });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!data.plan) {
    return <><PageHeader title="My diet plan" /><EmptyState icon={Salad} title={data.inPreparation ? 'Your plan is being prepared' : 'No plan yet'}>{data.inPreparation ? 'Your dietitian is building it and it is in clinical review. It will appear here once approved.' : 'It appears here after your membership is active and a dietitian is assigned.'}</EmptyState></>;
  }
  const { plan, today, week, adherence } = data;
  const t = plan.targets;
  const meals = [...plan.meals].sort((a, b) => a.time.localeCompare(b.time));
  const done = meals.filter((m) => today.mealsDone.includes(m._id || m.id)).length;
  const mealId = (m) => m._id || m.id;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={plan.title} sub={`Version ${plan.version} · by ${plan.dietitian?.name} · started ${fmtDate(plan.startDate)}`} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Calories', t.kcal, 'kcal'], ['Protein', t.protein, 'g'], ['Carbs', t.carbs, 'g'], ['Fat', t.fat, 'g']].map(([l, v, u]) => (
          <Card key={l} className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold text-brand-700">{v}<span className="ml-1 text-sm font-semibold text-slate-400">{u}</span></p></Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="flex items-center justify-between"><h2>Today</h2><span className="text-sm font-semibold text-slate-500">{done}/{meals.length} meals</span></div>
          <ProgressBar value={(done / meals.length) * 100} label="Meals completed today" />
          {meals.map((m) => {
            const isDone = today.mealsDone.includes(mealId(m));
            return (
              <Card key={mealId(m)} className={`p-4 transition ${isDone ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" />{m.time}</p>
                    <h3 className="mt-0.5">{m.name} <span className="text-xs font-medium text-slate-400">{itemsKcal(m)} kcal</span></h3>
                  </div>
                  <Button size="sm" variant={isDone ? 'primary' : 'secondary'} aria-pressed={isDone} disabled={log.isPending} onClick={() => log.mutate({ toggleMealId: mealId(m) })}>
                    {isDone ? <><Check className="h-4 w-4" />Done</> : 'Mark done'}
                  </Button>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {m.items.map((i, k) => <li key={k} className="flex justify-between gap-3"><span>{i.name}{i.qty && <span className="text-slate-400"> · {i.qty}</span>}</span><span className="text-slate-400">{i.kcal} kcal</span></li>)}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardTitle icon={Droplets} title="Hydration" />
            <p className="mb-2 text-sm text-slate-600"><strong className="text-slate-900">{today.waterMl}</strong> / {t.waterMl} ml</p>
            <ProgressBar value={(today.waterMl / t.waterMl) * 100} label="Water" />
            <div className="mt-3 flex gap-2">{[250, 500].map((ml) => <Button key={ml} size="sm" variant="soft" disabled={log.isPending} onClick={() => log.mutate({ addWaterMl: ml })}>+{ml} ml</Button>)}</div>
          </Card>
          <Card>
            <CardTitle icon={Scale} title="Log weight" />
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const w = Number(kg); if (w >= 20 && w <= 400) { log.mutate({ weightKg: w }, { onSuccess: () => { toast.success('Weight saved'); setKg(''); } }); } else toast.error('Enter a weight between 20 and 400 kg.'); }}>
              <Input type="number" inputMode="decimal" step="0.1" placeholder={today.weightKg ? `${today.weightKg} kg` : 'kg'} value={kg} onChange={(e) => setKg(e.target.value)} aria-label="Weight in kg" />
              <Button type="submit" variant="soft">Save</Button>
            </form>
          </Card>
          <Card>
            <CardTitle title="Last 7 days" action={<span className="text-sm font-bold text-brand-700">{adherence}%</span>} />
            <div className="flex h-20 items-end gap-1.5">
              {week.map((d) => {
                const pct = Math.min(100, Math.round((d.mealsDone.length / meals.length) * 100));
                return <div key={d.date} className="flex flex-1 flex-col items-center gap-1"><div className="flex h-16 w-full items-end rounded-md bg-slate-100"><div className="w-full rounded-md bg-brand-500" style={{ height: `${pct}%` }} /></div><span className="text-[10px] font-medium text-slate-400">{new Date(`${d.date}T00:00`).toLocaleDateString('en', { weekday: 'narrow' })}</span></div>;
              })}
            </div>
          </Card>
          {(plan.supplements || plan.notes) && (
            <Card>
              {plan.supplements && <><h3>Supplements</h3><p className="mb-3 mt-1 text-sm text-slate-600">{plan.supplements}</p></>}
              {plan.notes && <><h3>Notes from your dietitian</h3><p className="mt-1 text-sm text-slate-600">{plan.notes}</p></>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
