import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Users, BadgeCheck, FileCheck2, Flame, IndianRupee } from 'lucide-react';
import { api } from '../../lib/api';
import { inr, label } from '../../lib/format';
import { Alert, Card, CardTitle, PageHeader, PageLoader, ProgressBar, Stat } from '../../components/ui';

const FUNNEL = ['PENDING_ASSISTANCE', 'PLAN_SELECTED', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'];

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['analytics'], queryFn: () => api('/admin/analytics'), refetchInterval: 60_000 });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  const { totals: t, funnel, dietitians } = data;
  const total = Object.values(funnel).reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <PageHeader title="Clinic overview" sub="Live view across patients, memberships and dietitians" />
      {t.plansInReview > 0 && <Alert tone="warn" className="mb-5">{t.plansInReview} diet plan{t.plansInReview > 1 ? 's' : ''} waiting for your review. <Link to="/reviews" className="font-semibold underline">Open reviews</Link></Alert>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={Users} label="Patients" value={t.patients} />
        <Stat icon={BadgeCheck} label="Active members" value={t.activeMemberships} />
        <Stat icon={FileCheck2} label="In review" value={t.plansInReview} />
        <Stat icon={Flame} label="Avg adherence" value={t.avgAdherence == null ? '—' : `${t.avgAdherence}%`} />
        <Stat icon={IndianRupee} label="Collected" value={inr(t.collectedInr)} sub="all time" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle title="Onboarding funnel" />
          <div className="space-y-4">
            {FUNNEL.map((s) => (
              <div key={s}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-600">{label(s)}</span><span className="font-semibold">{funnel[s] || 0}</span></div><ProgressBar value={((funnel[s] || 0) / total) * 100} label={label(s)} /></div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle title="Dietitian workload" />
          <div className="space-y-4">
            {dietitians.map((d) => {
              const r = d.load / d.maxLoad;
              return <div key={d.id}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-600">{d.name}</span><span className="font-semibold">{d.load}/{d.maxLoad}</span></div><ProgressBar value={r * 100} tone={r > 0.85 ? 'warn' : 'brand'} label={`${d.name} load`} /></div>;
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
