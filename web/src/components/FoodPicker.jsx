import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Button, Chip, Input, Modal, Spinner } from './ui';

const MEALS = [['', 'All'], ['B', 'Breakfast'], ['S', 'Snack'], ['L', 'Lunch'], ['D', 'Dinner']];
export const guessMeal = (name = '') => (/snack|tea|evening|mid/i.test(name) ? 'S' : /break/i.test(name) ? 'B' : /lunch/i.test(name) ? 'L' : /dinner|supper/i.test(name) ? 'D' : '');

/** Searchable catalogue of regional foods. `region` = { country, state, cuisine }; `diet` = patient's diet type. */
export default function FoodPicker({ open, onClose, region, diet, mealName, onAdd }) {
  const [q, setQ] = useState('');
  const [meal, setMeal] = useState(() => guessMeal(mealName));
  const [added, setAdded] = useState([]);
  const params = new URLSearchParams({ country: region.country || '', state: region.state || '', cuisine: region.cuisine || '', diet: diet || '', meal, q }).toString();
  const { data, isFetching } = useQuery({ queryKey: ['foods', params], queryFn: () => api(`/foods/search?${params}`), enabled: open, keepPreviousData: true });
  const where = [region.cuisine, region.state, region.country].filter(Boolean).join(' · ') || 'All regions';

  return (
    <Modal open={open} onClose={onClose} title="Add from food catalogue" footer={<Button onClick={onClose}>Done{added.length ? ` (${added.length} added)` : ''}</Button>}>
      <p className="mb-3 text-xs text-slate-500">Showing <strong>{where}</strong>{diet ? ` · ${diet}` : ''}. Portions and calories are typical estimates, so check them before submitting.</p>
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><Input className="pl-10" placeholder="Search foods…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" /></div>
      <div className="scroll-hide mb-3 flex gap-2 overflow-x-auto pb-1">{MEALS.map(([k, l]) => <Chip key={k} active={meal === k} onClick={() => setMeal(k)}>{l}</Chip>)}</div>
      <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
        {isFetching && !data && <div className="grid place-items-center py-8"><Spinner /></div>}
        {data?.items?.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No foods match. Try another meal type or clear the search.</p>}
        {data?.items?.map((f) => {
          const key = `${f.name}|${f.cuisine}`;
          return (
            <div key={key} className="flex items-center gap-3 rounded-2xl border border-ink-100 p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{f.name}</p><p className="text-xs text-slate-500">{f.qty} · {f.kcal} kcal</p></div>
              <Badge tone="slate" className="hidden sm:inline-flex">{f.state || f.cuisine}</Badge>
              <Button size="sm" variant={added.includes(key) ? 'soft' : 'secondary'} onClick={() => { onAdd({ name: f.name, qty: f.qty, kcal: f.kcal }); setAdded((a) => [...a, key]); }} aria-label={`Add ${f.name}`}><Plus className="h-4 w-4" />{added.includes(key) ? 'Add again' : 'Add'}</Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
