import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ListChecks, Play, Rows3, Save, ShieldAlert, SlidersHorizontal, Undo2, Wand2 } from 'lucide-react';
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

      <div className="pb-28">
        {tab === 'rules' && <RulesTab s={s} setS={setS} meta={meta} />}
        {tab === 'meals' && <SlotsTab s={s} setS={setS} />}
        {tab === 'formulas' && <FormulasTab s={s} setS={setS} />}
        {tab === 'allergies' && <AllergensTab s={s} setS={setS} />}
        {tab === 'test' && <TestTab s={s} meta={meta} />}
      </div>

      <div className="pb-safe fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 border-t border-slate-200 bg-white/95 backdrop-blur xl:bottom-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-8">
          <p className={cx('text-sm font-semibold', dirty ? 'text-amber-700' : 'text-slate-500')}>{dirty ? 'You have unsaved changes' : 'All changes saved'}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" loading={reset.isPending} onClick={() => { if (window.confirm('Replace everything with the starter rules? Your own rules will be lost.')) reset.mutate(); }}>Restore starter rules</Button>
            <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => setS(JSON.parse(saved.current))}><Undo2 className="h-4 w-4" />Discard</Button>
            <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" />Save changes</Button>
          </div>
        </div>
      </div>
    </>
  );
}
