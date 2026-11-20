import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { fmtDateTime, label } from '../../lib/format';
import { Alert, Avatar, Badge, Card, Chip, EmptyState, Input, PageHeader, PageLoader, StatusBadge } from '../../components/ui';
import { useAuth } from '../../lib/auth';

const FILTERS = ['ALL', 'PENDING_ASSISTANCE', 'PLAN_SELECTED', 'PENDING_DIETITIAN_ASSIGNMENT', 'ASSIGNED'];

export default function Queue() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['queue', status, q],
    queryFn: () => api(`/memberships?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
    placeholderData: (p) => p,
    refetchInterval: 30_000,
  });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  const counts = data.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const needs = (counts.PENDING_ASSISTANCE || 0) + (counts.PENDING_DIETITIAN_ASSIGNMENT || 0);

  return (
    <>
      <PageHeader title={user.role === 'LEAD_DOCTOR' ? 'All patients' : 'Patient queue'} sub={needs ? `${needs} patient${needs > 1 ? 's' : ''} need action` : 'Everything is up to date'} />
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><Input className="pl-10" placeholder="Search by patient name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" /></div>
        <div className="scroll-hide -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTERS.map((f) => <Chip key={f} active={status === f} onClick={() => setStatus(f)}>{f === 'ALL' ? 'All' : label(f)} <span className="opacity-70">{f === 'ALL' ? total : counts[f] || 0}</span></Chip>)}
        </div>
      </div>

      {data.items.length === 0 ? <EmptyState icon={Users} title="No patients found">Try another filter or search.</EmptyState> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {data.items.map((m) => (
              <button key={m.id} onClick={() => nav(`/patient/${m.patient.id}`)} className="w-full text-left">
                <Card className="p-4 active:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.patient.name} />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{m.patient.name}</p><p className="text-xs text-slate-500">{m.plan?.name || (m.requestedPlan ? `Requested ${m.requestedPlan.name}` : 'No plan yet')}</p></div>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5"><StatusBadge status={m.status} /><StatusBadge status={m.paymentStatus} />{!m.historySubmitted && <Badge tone="amber">History missing</Badge>}</div>
                </Card>
              </button>
            ))}
          </div>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{['Patient', 'History', 'Plan', 'Payment', 'Status', 'Updated'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((m) => (
                  <tr key={m.id} tabIndex={0} role="link" onClick={() => nav(`/patient/${m.patient.id}`)} onKeyDown={(e) => e.key === 'Enter' && nav(`/patient/${m.patient.id}`)} className="cursor-pointer hover:bg-brand-50/40">
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={m.patient.name} /><div><p className="font-semibold text-slate-900">{m.patient.name}</p>{m.requestedPlan && m.status === 'PENDING_ASSISTANCE' && <p className="text-xs text-slate-500">Requested {m.requestedPlan.name}</p>}</div></div></td>
                    <td className="px-4 py-3">{m.historySubmitted ? <Badge tone="green">Submitted</Badge> : <Badge tone="amber">Missing</Badge>}</td>
                    <td className="px-4 py-3 text-slate-600">{m.plan?.name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.paymentStatus} /></td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDateTime(m.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
