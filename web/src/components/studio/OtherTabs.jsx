import { Plus, Trash2 } from 'lucide-react';
import { Alert, Button, Card, CardTitle, Field, Input, Select, cx } from '../ui';
import { Sortable, TagInput } from './dnd';
import { uid } from './RulesTab';

const MEAL_TYPES = [['B', 'Breakfast foods'], ['S', 'Snack foods'], ['L', 'Lunch foods'], ['D', 'Dinner foods']];
const COLORS = ['bg-brand-500', 'bg-amber-400', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-400', 'bg-teal-500', 'bg-orange-400', 'bg-indigo-500', 'bg-lime-500'];

export function SlotsTab({ s, setS }) {
  const slots = s.slots;
  const total = slots.reduce((a, x) => a + Number(x.share || 0), 0);
  const set = (fn) => setS((x) => ({ ...x, slots: fn(x.slots) }));
  const up = (id, patch) => set((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const even = () => set((l) => { const n = l.length; const base = Math.floor(100 / n); return l.map((x, i) => ({ ...x, share: i === n - 1 ? 100 - base * (n - 1) : base })); });
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">The day's meals. Drag to reorder, set the time, and what share of the daily calories each meal gets.</p>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {slots.map((x, i) => <div key={x.id} className={cx(COLORS[i % COLORS.length], 'transition-all')} style={{ width: `${(Number(x.share) / Math.max(total, 100)) * 100}%` }} title={`${x.name} ${x.share}%`} />)}
      </div>
      <div className="flex items-center justify-between text-sm"><span className={cx('font-bold', Math.abs(total - 100) < 0.5 ? 'text-emerald-600' : 'text-rose-600')}>Total {total}% {Math.abs(total - 100) < 0.5 ? '' : '(must be 100%)'}</span><Button variant="ghost" size="sm" onClick={even}>Share evenly</Button></div>
      <Sortable items={slots} onChange={(l) => set(() => l)} className="space-y-3" render={(x, i, handle) => (
        <Card className="!p-3">
          <div className="flex flex-wrap items-end gap-3">
            {handle}<span className={cx('mb-3 h-3 w-3 rounded-full', COLORS[i % COLORS.length])} />
            <Field label="Meal name" className="min-w-[10rem] flex-1"><Input value={x.name} maxLength={40} onChange={(e) => up(x.id, { name: e.target.value })} /></Field>
            <Field label="Time"><Input type="time" className="min-w-[8.5rem]" value={x.time} onChange={(e) => up(x.id, { time: e.target.value })} /></Field>
            <Field label="Foods from"><Select value={x.meal} onChange={(e) => up(x.id, { meal: e.target.value })}>{MEAL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            <Field label="Calorie share %"><Input type="number" className="w-24" min="1" max="100" value={x.share} onChange={(e) => up(x.id, { share: e.target.value })} /></Field>
            <Field label="Max items"><Input type="number" className="w-20" min="1" max="8" value={x.maxItems} onChange={(e) => up(x.id, { maxItems: e.target.value })} /></Field>
            <Button variant="ghost" size="sm" aria-label="Remove meal" className="mb-0.5" onClick={() => set((l) => l.filter((y) => y.id !== x.id))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
          </div>
        </Card>
      )} />
      <Button variant="secondary" disabled={slots.length >= 10} onClick={() => set((l) => [...l, { id: uid('s'), name: 'New meal', time: '12:00', meal: 'S', share: 10, maxItems: 2 }])}><Plus className="h-4 w-4" />Add meal</Button>
    </div>
  );
}

const pct = (m) => Number(m.protein) + Number(m.carbs) + Number(m.fat);
const N = ({ v, set, ...p }) => <Input type="number" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} {...p} />;

export function FormulasTab({ s, setS }) {
  const c = s.calories, m = s.macros, w = s.water;
  const upC = (patch) => setS((x) => ({ ...x, calories: { ...x.calories, ...patch } }));
  const upM = (k, v) => setS((x) => ({ ...x, macros: { ...x.macros, [k]: v } }));
  const upW = (k, v) => setS((x) => ({ ...x, water: { ...x.water, [k]: v } }));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardTitle title="Daily calories" sub="Starting point before your rules adjust it" />
        <div className="space-y-4">
          <Field label="Formula"><Select value={c.method} onChange={(e) => upC({ method: e.target.value })}>
            <option value="mifflin">Mifflin-St Jeor × activity factor (recommended)</option><option value="harris">Harris-Benedict × activity factor</option><option value="fixed">Same fixed calories for everyone</option></Select></Field>
          {c.method === 'fixed' && <Field label="Fixed calories"><N v={c.fixedKcal} set={(v) => upC({ fixedKcal: v })} /></Field>}
          <Field label="If height, weight, age or sex is missing, use" hint="kcal"><N v={c.fallbackKcal} set={(v) => upC({ fallbackKcal: v })} /></Field>
          {c.method !== 'fixed' && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Activity factor (multiplies resting calories)</p>
              <div className="space-y-2">{Object.entries(c.activity).map(([k, v]) => <div key={k} className="flex items-center gap-3"><span className="flex-1 text-sm text-slate-700">{k}</span><N v={v} step="0.025" set={(n) => upC({ activity: { ...c.activity, [k]: n } })} className="!w-28" /></div>)}</div>
              <Field label="Unknown activity level uses" className="mt-3"><N v={c.defaultActivity} step="0.025" set={(v) => upC({ defaultActivity: v })} /></Field>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Never below"><N v={c.minKcal} set={(v) => upC({ minKcal: v })} /></Field>
            <Field label="Never above"><N v={c.maxKcal} set={(v) => upC({ maxKcal: v })} /></Field>
            <Field label="Round to"><N v={c.roundTo} set={(v) => upC({ roundTo: v })} /></Field>
          </div>
        </div>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardTitle title="Default macro split" sub="Share of calories. Rules can override it." />
          <div className="grid grid-cols-3 gap-3">
            {[['protein', 'Protein %'], ['carbs', 'Carbs %'], ['fat', 'Fat %']].map(([k, l]) => <Field key={k} label={l}><N v={m[k]} set={(v) => upM(k, v)} /></Field>)}
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>{['protein', 'carbs', 'fat'].map((k, i) => <div key={k} className={COLORS[[0, 1, 2][i]]} style={{ width: `${(Number(m[k]) / Math.max(pct(m), 100)) * 100}%` }} />)}</div>
          <p className={cx('mt-2 text-sm font-bold', Math.abs(pct(m) - 100) < 0.5 ? 'text-emerald-600' : 'text-rose-600')}>Total {pct(m)}% {Math.abs(pct(m) - 100) < 0.5 ? '' : '(must be 100%)'}</p>
        </Card>
        <Card>
          <CardTitle title="Water" sub="Daily target from body weight" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="ml per kg"><N v={w.perKg} set={(v) => upW('perKg', v)} /></Field>
            <Field label="Min ml"><N v={w.min} set={(v) => upW('min', v)} /></Field>
            <Field label="Max ml"><N v={w.max} set={(v) => upW('max', v)} /></Field>
            <Field label="Round to"><N v={w.roundTo} set={(v) => upW('roundTo', v)} /></Field>
          </div>
        </Card>
        <Card>
          <CardTitle title="Plan title" />
          <Field label="Template" hint="{{kcal}} {{name}} {{cuisine}}"><Input value={s.titleTemplate} maxLength={80} onChange={(e) => setS((x) => ({ ...x, titleTemplate: e.target.value }))} /></Field>
        </Card>
      </div>
    </div>
  );
}

export function AllergensTab({ s, setS }) {
  const set = (fn) => setS((x) => ({ ...x, allergens: fn(x.allergens) }));
  const up = (id, patch) => set((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-4">
      <Alert tone="info">When a patient lists an allergy, any food whose name contains one of the "Leave out foods containing" words is never chosen. An allergy that is not listed here is matched by its own text.</Alert>
      {s.allergens.map((a) => (
        <Card key={a.id} className="!p-4">
          <div className="grid gap-3 md:grid-cols-[200px_1fr_1fr_auto] md:items-start">
            <Field label="Allergy"><Input value={a.name} maxLength={40} onChange={(e) => up(a.id, { name: e.target.value })} /></Field>
            <Field label="Patient writes (matches)"><TagInput value={a.aliases} onChange={(v) => up(a.id, { aliases: v })} placeholder="peanut, groundnut…" /></Field>
            <Field label="Leave out foods containing"><TagInput value={a.foodWords} onChange={(v) => up(a.id, { foodWords: v })} placeholder="milk, curd…" /></Field>
            <Button variant="ghost" size="sm" aria-label="Remove allergy" className="md:mt-7" onClick={() => set((l) => l.filter((x) => x.id !== a.id))}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => set((l) => [...l, { id: uid('a'), name: 'New allergy', aliases: [], foodWords: [] }])}><Plus className="h-4 w-4" />Add allergy</Button>
    </div>
  );
}
