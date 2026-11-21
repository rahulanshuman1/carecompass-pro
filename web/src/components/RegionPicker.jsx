import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Field, Select } from './ui';

export const useRegions = () => useQuery({ queryKey: ['regions'], queryFn: () => api('/foods/regions'), staleTime: Infinity });

/** Country → State → Cuisine selects. `value` is { country, state, cuisine }. */
export default function RegionPicker({ value, onChange, className = 'grid gap-4 sm:grid-cols-3' }) {
  const { data } = useRegions();
  const regions = data?.regions || {};
  const country = regions[value.country];
  const states = country?.states || [];
  const cuisines = value.state && data?.stateCuisines?.[value.state]
    ? [...new Set([...data.stateCuisines[value.state], 'Pan-Indian', 'Jain'])]
    : country?.cuisines || [];
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className={className}>
      <Field label="Country">
        <Select value={value.country} onChange={(e) => set({ country: e.target.value, state: '', cuisine: '' })}>
          <option value="">Select country…</option>
          {Object.keys(regions).map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="State" hint={states.length ? '' : '(not needed)'}>
        <Select value={value.state} disabled={!states.length} onChange={(e) => set({ state: e.target.value, cuisine: '' })}>
          <option value="">{states.length ? 'Any state' : '—'}</option>
          {states.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label="Cuisine">
        <Select value={value.cuisine} disabled={!country} onChange={(e) => set({ cuisine: e.target.value })}>
          <option value="">{country ? 'Typical for this region' : '—'}</option>
          {cuisines.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
    </div>
  );
}
