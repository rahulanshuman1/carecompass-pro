import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Clock, Droplets, ImagePlus, MapPin, Salad, Scale, Trash2, Undo2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, put } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { mealPhotoToDataUrl } from '../../lib/image';
import { fmtDate, itemsKcal } from '../../lib/format';
import { Alert, Badge, Button, Card, CardTitle, EmptyState, Input, Modal, PageHeader, PageLoader, ProgressBar, Ring, cx } from '../../components/ui';

const mealId = (m) => m._id || m.id;

/** Bottom sheet shown when the patient marks a meal done: a photo of the meal is required. */
function MealDoneSheet({ meal, existing, onClose, onSave, saving }) {
  const toast = useToast();
  const input = useRef(null);
  const [photo, setPhoto] = useState(existing || '');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { setPhoto(await mealPhotoToDataUrl(file)); } catch (ex) { toast.error(ex); } finally { setBusy(false); }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={existing ? 'Update your meal photo' : 'Mark meal as done'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(photo)} loading={saving} disabled={busy || !photo}>
            <Check className="h-4 w-4" />{existing ? 'Save photo' : 'Save photo and mark done'}
          </Button>
        </>
      }
    >
      <p className="text-sm font-bold text-ink-900">{meal.time} · {meal.name}</p>
      <p className="mb-4 text-sm text-slate-500">{meal.items.map((i) => i.name).join(', ')}</p>

      <input ref={input} type="file" accept="image/*" className="sr-only" onChange={pick} aria-label="Choose meal photo" />
      {photo ? (
        <div className="relative overflow-hidden rounded-3xl border border-ink-100">
          <img src={photo} alt="Your meal" className="max-h-72 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-ink-900/60 to-transparent p-3">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={busy}><ImagePlus className="h-4 w-4" />Change</Button>
            <Button size="sm" variant="secondary" onClick={() => setPhoto('')}><Trash2 className="h-4 w-4" />Remove</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid w-full place-items-center gap-2 rounded-3xl border-2 border-dashed border-brand-200 bg-brand-50/60 px-4 py-9 text-center transition hover:bg-brand-50">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-brand-500 shadow-sm"><Camera className="h-7 w-7" /></span>
          <span className="font-bold text-ink-900">{busy ? 'Preparing photo…' : 'Add a photo of your meal'}</span>
          <span className="text-xs text-slate-500">Required to mark this meal done. Take a picture or choose one from your gallery. Your dietitian can see it in your food diary.</span>
        </button>
      )}
    </Modal>
  );
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DietPlan() {
  const qc = useQueryClient();
  const toast = useToast();
  const [kg, setKg] = useState('');
  const [sheet, setSheet] = useState(null); // { meal, existing }
  const [view, setView] = useState(null); // photo lightbox
  const { data, isLoading, error } = useQuery({ queryKey: ['diet'], queryFn: () => api('/me/diet-plan') });
  const log = useMutation({
    mutationFn: (b) => put('/me/adherence/today', b),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diet'] }),
    onError: toast.error,
  });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!data.plan) {
    return <><PageHeader title="My diet plan" /><EmptyState icon={Salad} title={data.inPreparation ? 'Your plan is being prepared' : 'No plan yet'}>{data.inPreparation ? 'Your dietitian is building it and it is in clinical review. It will appear here once approved.' : 'Your dietitian will build your plan after you are assigned.'}</EmptyState></>;
  }
  const { plan, today, week, adherence } = data;
  const t = plan.targets;
  const meals = [...plan.meals].sort((a, b) => a.time.localeCompare(b.time));
  const done = meals.filter((m) => today.mealsDone.includes(mealId(m))).length;
  const photoOf = (m) => today.photos?.find((p) => p.mealId === mealId(m))?.photo;
  const place = [plan.region?.state, plan.region?.country].filter(Boolean).join(', ');
  const planned = meals.reduce((s, m) => s + itemsKcal(m), 0);

  function save(photo) {
    if (!photo) { toast.error('Please add a photo of your meal first.'); return; }
    const m = sheet.meal;
    log.mutate({ markMealDone: { mealId: mealId(m), photo } }, {
      onSuccess: () => { setSheet(null); toast.success('Meal saved to your food diary'); },
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={plan.title || 'My diet plan'} sub={`Version ${plan.version} · by ${plan.dietitian?.name} · started ${fmtDate(plan.startDate)}`} />
      {(place || plan.region?.cuisine) && (
        <div className="-mt-3 flex flex-wrap gap-2">
          {plan.region?.cuisine && <Badge tone="brand" className="px-3 py-1 text-xs"><Salad className="mr-1 h-3.5 w-3.5" />{plan.region.cuisine} cuisine</Badge>}
          {place && <Badge tone="slate" className="px-3 py-1 text-xs"><MapPin className="mr-1 h-3.5 w-3.5" />{place}</Badge>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Calories', t.kcal, 'kcal', 'from-brand-500 to-brand-700'], ['Protein', t.protein, 'g', 'from-indigo-500 to-indigo-700'], ['Carbs', t.carbs, 'g', 'from-amber-400 to-amber-600'], ['Fat', t.fat, 'g', 'from-emerald-500 to-emerald-700']].map(([l, v, u, g]) => (
          <div key={l} className={`rounded-3xl bg-gradient-to-br ${g} p-4 text-white shadow-soft md:p-5`}><p className="text-xs font-bold uppercase tracking-wide text-white/80">{l}</p><p className="mt-1 text-3xl font-extrabold">{v}<span className="ml-1 text-sm font-bold text-white/80">{u}</span></p></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-end justify-between"><h2>Today's meals</h2><span className="text-sm font-bold text-slate-500">{done}/{meals.length} done · {planned} kcal planned</span></div>
          <ProgressBar value={meals.length ? (done / meals.length) * 100 : 0} label="Meals completed today" />
          {meals.map((m) => {
            const isDone = today.mealsDone.includes(mealId(m));
            const photo = photoOf(m);
            return (
              <div key={mealId(m)} className={cx('overflow-hidden rounded-3xl border bg-white shadow-soft transition', isDone ? 'border-emerald-200' : 'border-ink-100')}>
                <div className="flex gap-4 p-4 md:p-5">
                  <button type="button" onClick={() => (photo ? setView({ src: photo, title: `${m.time} ${m.name}` }) : setSheet({ meal: m, existing: '' }))} className={cx('grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border', photo ? 'border-ink-100' : 'border-dashed border-brand-200 bg-brand-50/60 hover:bg-brand-50')} aria-label={photo ? `View photo of ${m.name}` : `Add photo for ${m.name}`}>
                    {photo ? <img src={photo} alt={`${m.name}`} className="h-full w-full object-cover" /> : <span className="grid place-items-center gap-1 text-brand-500"><Camera className="h-6 w-6" /><span className="text-[11px] font-bold">Add photo</span></span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Clock className="h-3.5 w-3.5" />{m.time}{isDone && <Badge tone="green" className="ml-1"><Check className="mr-0.5 h-3 w-3" />Done</Badge>}</p>
                    <h3 className="mt-0.5">{m.name} <span className="text-xs font-semibold text-slate-400">{itemsKcal(m)} kcal</span></h3>
                    <ul className="mt-1.5 space-y-0.5 text-sm text-slate-700">
                      {m.items.map((i, k) => <li key={k} className="flex justify-between gap-3"><span className="min-w-0 truncate">{i.name}{i.qty && <span className="text-slate-400"> · {i.qty}</span>}</span><span className="shrink-0 text-slate-400">{i.kcal}</span></li>)}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-50 bg-ink-50/40 px-4 py-2.5 md:px-5">
                  {isDone ? (
                    <>
                      <Button size="sm" variant="ghost" disabled={log.isPending} onClick={() => log.mutate({ toggleMealId: mealId(m) })}><Undo2 className="h-4 w-4" />Undo</Button>
                      <Button size="sm" variant="secondary" onClick={() => setSheet({ meal: m, existing: photo || '' })}><Camera className="h-4 w-4" />{photo ? 'Change photo' : 'Add photo'}</Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={log.isPending} onClick={() => setSheet({ meal: m, existing: '' })}><Camera className="h-4 w-4" />Add photo & mark done</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardTitle title="Your week" action={<span className="text-sm font-extrabold text-brand-700">{adherence}%</span>} />
            <div className="flex justify-between gap-1">
              {week.map((d) => {
                const pct = meals.length ? Math.min(100, Math.round((d.mealsDone.length / meals.length) * 100)) : 0;
                const dow = new Date(`${d.date}T00:00:00`).getDay();
                return (
                  <div key={d.date} className="flex flex-col items-center gap-1.5">
                    <Ring value={pct} size={38} stroke={5} tone={pct >= 100 ? 'green' : 'brand'} label={d.date}>{pct >= 100 ? <Check className="h-4 w-4 text-emerald-500" /> : <span className="text-[10px] font-bold text-slate-500">{pct}</span>}</Ring>
                    <span className="text-[11px] font-bold text-slate-500">{DAYS[dow]}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <CardTitle icon={Droplets} title="Hydration" />
            <p className="mb-2 text-sm text-slate-600"><strong className="text-ink-900">{today.waterMl}</strong> / {t.waterMl} ml</p>
            <ProgressBar value={(today.waterMl / t.waterMl) * 100} label="Water" />
            <div className="mt-3 flex gap-2">{[250, 500].map((ml) => <Button key={ml} size="sm" variant="soft" disabled={log.isPending} onClick={() => log.mutate({ addWaterMl: ml })}>+{ml} ml</Button>)}</div>
          </Card>
          <Card>
            <CardTitle icon={Scale} title="Log weight" />
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const w = Number(kg); if (w >= 20 && w <= 400) { log.mutate({ weightKg: w }, { onSuccess: () => { toast.success('Weight saved'); setKg(''); } }); } else toast.error('Enter a weight between 20 and 400 kg'); }}>
              <Input type="number" inputMode="decimal" step="0.1" placeholder={today.weightKg ? `${today.weightKg} kg` : 'kg'} value={kg} onChange={(e) => setKg(e.target.value)} aria-label="Weight in kg" />
              <Button type="submit" variant="soft">Save</Button>
            </form>
          </Card>
          {(plan.supplements || plan.notes) && (
            <Card>
              {plan.supplements && <><h3>Supplements</h3><p className="mb-3 mt-1 text-sm text-slate-600">{plan.supplements}</p></>}
              {plan.notes && <><h3>Notes from your dietitian</h3><p className="mt-1 text-sm text-slate-600">{plan.notes}</p></>}
            </Card>
          )}
        </div>
      </div>

      {sheet && <MealDoneSheet meal={sheet.meal} existing={sheet.existing} saving={log.isPending} onClose={() => setSheet(null)} onSave={save} />}
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || 'Meal photo'}>{view && <img src={view.src} alt={view.title} className="w-full rounded-2xl" />}</Modal>
    </div>
  );
}
