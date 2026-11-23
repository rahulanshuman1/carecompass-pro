import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Play, RotateCcw, Rows3, Save, ShieldAlert, SlidersHorizontal, Undo2, Wand2 } from 'lucide-react';
import { api, post, put } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { Alert, Button, PageHeader, PageLoader, cx } from '../../components/ui';
import RulesTab from '../../components/studio/RulesTab';
import { AllergensTab, FormulasTab, SlotsTab } from '../../components/studio/OtherTabs';
import TestTab from '../../components/studio/TestTab';

const TABS = [['rules', 'Rules', ListChecks], ['meals', 'Meals', Rows3], ['formulas', 'Formulas', SlidersHorizontal], ['allergies', 'Allergies', ShieldAlert], ['test', 'Test', Play]];

/** No-code diet plan studio for the Lead Doctor. Everything the plan generator does is set up here. */
export default function Studio() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ['studio'], queryFn: () => api('/studio'), refetchOnWindowFocus: false });
  const [s, setS] = useState(null);
  const [tab, setTab] = useState('rules');
  const saved = useRef('');
  useEffect(() => { if (data) { setS(data.studio); saved.current = JSON.stringify(data.studio); } }, [data]);
  const dirty = !!s && JSON.stringify(s) !== saved.current;
  useEffect(() => {
    if (!dirty) return undefined;
    const f = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => put('/studio', s),
    onSuccess: (r) => { qc.setQueryData(['studio'], (d) => ({ ...d, studio: r.studio, version: r.version })); setS(r.studio); saved.current = JSON.stringify(r.studio); toast.success(`Saved as version ${r.version}. New plans use it from now on.`); },
    onError: toast.error,
  });
  const restore = () => { if (window.confirm('Replace everything with the starter rules? Your own rules will be lost.')) reset.mutate(); };
  const reset = useMutation({
    mutationFn: () => post('/studio/reset'),
    onSuccess: (r) => { qc.setQueryData(['studio'], (d) => ({ ...d, studio: r.studio, version: r.version })); setS(r.studio); saved.current = JSON.stringify(r.studio); toast.success('Starter rules restored'); },
    onError: toast.error,
  });
  const backfill = useMutation({
    mutationFn: () => post('/studio/generate-missing'),
    onSuccess: (r) => { toast.success(`${r.created} plan${r.created === 1 ? '' : 's'} generated and waiting in Reviews${r.skipped ? ` (${r.skipped} skipped)` : ''}`); qc.invalidateQueries({ queryKey: ['reviews'] }); },
    onError: toast.error,
  });

  const meta = data?.meta;
  const counts = useMemo(() => ({ rules: s?.rules.length ?? 0, meals: s?.slots.length ?? 0, allergies: s?.allergens.length ?? 0 }), [s]);
  if (isLoading || !s) return error ? <Alert tone="error">{error.message}</Alert> : <PageLoader />;

  return (
    <>
      <PageHeader title="Plan Studio" sub={`No-code rules that build every patient's diet plan · saved version ${data.version}`}
        action={<Button variant="secondary" loading={backfill.isPending} onClick={() => { if (window.confirm('Generate plans from the saved rules for every assigned patient who has no plan yet? They will appear in Reviews.')) backfill.mutate(); }}><Wand2 className="h-4 w-4" />Generate for patients without a plan</Button>} />
      <Alert tone="info" className="mb-5">When a dietitian is assigned, the system builds the first plan from these rules and puts it in <strong>Reviews</strong> for your one-click approval. Starter rules are a starting point: check them against your own clinical standards.</Alert>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1" role="tablist">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition', tab === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')}>
            <Icon className="h-4 w-4" />{l}{counts[k] != null && <span className="rounded-full bg-slate-200/70 px-1.5 text-[11px]">{counts[k]}</span>}
          </button>
        ))}
      </div>

      <div className="pb-52 lg:pb-28">
        {tab === 'rules' && <RulesTab s={s} setS={setS} meta={meta} />}
        {tab === 'meals' && <SlotsTab s={s} setS={setS} />}
        {tab === 'formulas' && <FormulasTab s={s} setS={setS} />}
        {tab === 'allergies' && <AllergensTab s={s} setS={setS} />}
        {tab === 'test' && <TestTab s={s} meta={meta} />}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 border-t border-ink-100 bg-white shadow-[0_-12px_30px_-20px_rgba(43,29,66,.45)] lg:bottom-0">
        <div className="mx-auto max-w-6xl space-y-2.5 px-4 py-3 md:flex md:items-center md:justify-between md:space-y-0 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <p className={cx('flex items-center gap-2 text-sm font-bold', dirty ? 'text-amber-700' : 'text-slate-500')}>
              <span aria-hidden className={cx('h-2 w-2 rounded-full', dirty ? 'animate-pulse bg-amber-500' : 'bg-emerald-500')} />
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </p>
            <button type="button" onClick={restore} disabled={reset.isPending} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold text-slate-500 hover:text-rose-600 disabled:opacity-50 md:hidden"><RotateCcw className="h-3.5 w-3.5" />Restore starter rules</button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden whitespace-nowrap md:inline-flex" loading={reset.isPending} onClick={restore}><RotateCcw className="h-4 w-4" />Restore starter rules</Button>
            <Button variant="secondary" className="flex-1 whitespace-nowrap md:flex-none" disabled={!dirty} onClick={() => setS(JSON.parse(saved.current))}><Undo2 className="h-4 w-4" />Discard</Button>
            <Button className="flex-[2] whitespace-nowrap md:flex-none" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" />Save changes</Button>
          </div>
        </div>
      </div>
    </>
  );
}
