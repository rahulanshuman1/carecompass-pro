import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { Alert, Badge, Card, Chip, PageHeader, PageLoader } from '../../components/ui';

const FILTERS = ['', 'VIEW_PHI', 'MEMBERSHIP_TRANSITION', 'PAYMENT_CONFIRMED', 'PLAN_APPROVED', 'LOGIN_FAILED'];

export default function Audit() {
  const [action, setAction] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['audit', action], queryFn: () => api(`/admin/audit?limit=150${action ? `&action=${action}` : ''}`), placeholderData: (p) => p });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  return (
    <>
      <PageHeader title="Audit log" sub="Append-only record of access to patient data and changes" />
      <div className="scroll-hide -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">{FILTERS.map((f) => <Chip key={f} active={action === f} onClick={() => setAction(f)}>{f ? f.replace(/_/g, ' ').toLowerCase() : 'All'}</Chip>)}</div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{['When', 'Who', 'Action', 'Entity', 'Detail'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id}><td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">{fmtDateTime(a.createdAt)}</td><td className="px-4 py-2.5">{a.actor?.name || a.actorRole}</td><td className="px-4 py-2.5"><Badge>{a.action}</Badge></td><td className="px-4 py-2.5 text-xs text-slate-500">{a.entity} {a.entityId?.slice(-6)}</td><td className="px-4 py-2.5 text-xs text-slate-600">{a.detail}</td></tr>
              ))}
              {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No entries</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
