import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Flag, Wand2 } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, PageLoader } from '../../components/ui';

export default function Reviews() {
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['reviews'], queryFn: () => api('/diet-plans/review-queue'), refetchInterval: 30_000 });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  return (
    <>
      <PageHeader title="Plan reviews" sub="Diet plans submitted by dietitians, oldest first" />
      {data.items.length === 0 ? <EmptyState icon={FileCheck2} title="Nothing waiting">New submissions will appear here.</EmptyState> : (
        <div className="space-y-3">
          {data.items.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="flex flex-wrap items-center gap-2">{p.patient?.name} · v{p.version}{p.auto?.generated && <Badge tone="brand"><Wand2 className="mr-1 h-3 w-3" />Auto</Badge>}{p.auto?.flags?.length > 0 && <Badge tone="amber"><Flag className="mr-1 h-3 w-3" />{p.auto.flags.length} flagged</Badge>}</h3><p className="text-sm text-slate-500">{p.title} · by {p.dietitian?.name} · submitted {fmtDateTime(p.submittedAt)}</p></div>
              <Button onClick={() => nav(`/patient/${p.patient?.id}`)}>Review</Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
