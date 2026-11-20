import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../../lib/api';
import { Alert, Avatar, Button, Card, EmptyState, PageHeader, PageLoader, ProgressBar, StatusBadge, Badge } from '../../components/ui';

export default function MyPatients() {
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['my-patients'], queryFn: () => api('/my/patients') });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  return (
    <>
      <PageHeader title="My patients" sub={`${data.items.length} assigned`} />
      {data.items.length === 0 ? <EmptyState icon={Users} title="No assigned patients yet">New assignments from the care team will appear here.</EmptyState> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.items.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1"><h3 className="truncate">{p.name}</h3><p className="line-clamp-2 text-sm text-slate-500">{p.goals || 'No goals recorded'}</p></div>
                {p.planStatus ? <StatusBadge status={p.planStatus} /> : <Badge tone="amber">No plan</Badge>}
              </div>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">7-day adherence</span><span className="font-semibold text-slate-700">{p.adherence == null ? '—' : `${p.adherence}%`}</span></div><ProgressBar value={p.adherence ?? 0} tone={(p.adherence ?? 100) < 50 ? 'warn' : 'brand'} label="Adherence" /></div>
              <Button className="mt-4 w-full" variant="soft" onClick={() => nav(`/patient/${p.id}`)}>Open patient</Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
