import { useId, useState } from 'react';
import { ChevronDown, Copy, Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Input, Select, cx } from '../ui';
import { DropZone, PaletteChip, Sortable, Switch } from './dnd';

export const uid = (p = 'r') => `${p}${Math.random().toString(36).slice(2, 9)}`;

const newCondition = (meta, field) => {
  const f = meta.fields[field];
  return { field, op: meta.ops[f.type][0][0], value: f.type === 'enum' ? f.options[0] : f.type === 'list' ? (f.options?.[0] || '') : '' };
};
const newAction = (type) => ({ type, value: type === 'macros_set' ? { protein: 25, carbs: 45, fat: 30 } : '' });

const opLabel = (meta, f, op) => (meta.ops[meta.fields[f]?.type] || []).find(([o]) => o === op)?.[1] || op;
function summary(r, meta) {
  const c = r.conditions.length
    ? r.conditions.map((x) => `${meta.fields[x.field]?.label || x.field} ${opLabel(meta, x.field, x.op)}${['any', 'none'].includes(x.op) ? '' : ` ${x.value}`}`).join(r.match === 'any' ? ' OR ' : ' AND ')
    : 'always';
  const a = r.actions.map((x) => {
    const L = meta.actions[x.type]?.label || x.type;
    return x.type === 'macros_set' ? `${L}: P${x.value.protein}/C${x.value.carbs}/F${x.value.fat}` : `${L}${x.value !== '' ? `: ${x.value}` : ''}`;
  }).join('; ');
  return `If ${c} → ${a || 'no actions yet'}`;
}

function CondRow({ c, meta, onChange, onRemove }) {
  const listId = useId();
  const f = meta.fields[c.field];
  const ops = meta.ops[f.type];
  const setField = (field) => onChange(newCondition(meta, field));
  const noValue = ['any', 'none'].includes(c.op);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
      <Select aria-label="Field" className="!h-10 w-auto min-w-[10rem] flex-1" value={c.field} onChange={(e) => setField(e.target.value)}>{Object.entries(meta.fields).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
      <Select aria-label="Operator" className="!h-10 w-auto min-w-[8rem]" value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value })}>{ops.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</Select>
      {!noValue && (f.type === 'enum' && c.op !== 'in' ? (
        <Select aria-label="Value" className="!h-10 w-auto min-w-[8rem] flex-1" value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value })}>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
      ) : (
        <>
          <Input aria-label="Value" className="!h-10 w-auto min-w-[8rem] flex-1" type={f.type === 'number' ? 'number' : 'text'} list={f.options ? listId : undefined} value={c.value} onChange={(e) => onChange({ ...c, value: f.type === 'number' ? e.target.value : e.target.value })} placeholder={c.op === 'in' ? 'a, b, c' : 'value'} />
          {f.options && <datalist id={listId}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>}
        </>
      ))}
      <button type="button" aria-label="Remove condition" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-rose-500"><X className="h-4 w-4" /></button>
    </div>
  );
}

function ActRow({ a, meta, onChange, onRemove }) {
  const def = meta.actions[a.type];
  const m = a.value;
  const total = a.type === 'macros_set' ? Number(m.protein) + Number(m.carbs) + Number(m.fat) : 0;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50/50 p-2">
      <Select aria-label="Action" className="!h-10 w-auto min-w-[12rem] flex-1" value={a.type} onChange={(e) => onChange(newAction(e.target.value))}>{Object.entries(meta.actions).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
      {def.input === 'number' && <Input aria-label="Amount" className="!h-10 w-32" type="number" value={a.value} placeholder={def.hint} onChange={(e) => onChange({ ...a, value: e.target.value })} />}
      {def.input === 'text' && <Input aria-label="Text" className="!h-10 min-w-[12rem] flex-1" value={a.value} placeholder={def.hint} maxLength={300} onChange={(e) => onChange({ ...a, value: e.target.value })} />}
      {def.input === 'macros' && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">
          {['protein', 'carbs', 'fat'].map((k) => (
            <label key={k} className="flex items-center gap-1">{k[0].toUpperCase()}<Input aria-label={`${k} percent`} className="!h-10 w-16" type="number" value={m[k]} onChange={(e) => onChange({ ...a, value: { ...m, [k]: e.target.value } })} />%</label>
          ))}
          <span className={total === 100 ? 'text-emerald-600' : 'text-rose-600'}>= {total}%</span>
        </div>
      )}
      <button type="button" aria-label="Remove action" onClick={onRemove} className="rounded p-1.5 text-slate-400 hover:bg-white hover:text-rose-500"><X className="h-4 w-4" /></button>
    </div>
  );
}

function RuleCard({ r, i, handle, meta, open, onToggle, onChange, onRemove, onCopy }) {
  const up = (patch) => onChange({ ...r, ...patch });
  const addCond = (field) => up({ conditions: [...r.conditions, newCondition(meta, field)] });
  const addAct = (type) => up({ actions: [...r.actions, newAction(type)] });
  const flags = r.actions.filter((a) => a.type === 'flag_review').length;
  return (
    <div className={cx('rounded-2xl border bg-white shadow-sm', open ? 'border-brand-300' : 'border-slate-200', r.enabled === false && 'opacity-60')}>
      <div className="flex items-center gap-2 p-3">
        {handle}
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <p className="flex flex-wrap items-center gap-2 font-bold text-slate-900"><span className="text-xs font-semibold text-slate-400">{i + 1}</span>{r.name || 'Untitled rule'}{flags > 0 && <Badge tone="amber">flags doctor</Badge>}{r.stop && <Badge>stops here</Badge>}</p>
          <p className="truncate text-xs text-slate-500">{summary(r, meta)}</p>
        </button>
        <Switch checked={r.enabled !== false} onChange={(v) => up({ enabled: v })} label={`Rule ${r.name} on`} />
        <button type="button" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><ChevronDown className={cx('h-5 w-5 transition', open && 'rotate-180')} /></button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Rule name" className="!h-10 flex-1" value={r.name} maxLength={80} onChange={(e) => up({ name: e.target.value })} placeholder="Rule name" />
            <Button variant="ghost" size="sm" onClick={onCopy}><Copy className="h-4 w-4" />Duplicate</Button>
            <Button variant="danger" size="sm" onClick={onRemove}><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-700">IF
              <Select aria-label="Match mode" className="!h-9 w-auto" value={r.match} onChange={(e) => up({ match: e.target.value })}><option value="all">ALL of these are true</option><option value="any">ANY of these is true</option></Select>
            </div>
            <DropZone kind="cond" onDrop={addCond} className="space-y-2">
              {r.conditions.map((c, k) => <CondRow key={k} c={c} meta={meta} onChange={(n) => up({ conditions: r.conditions.map((x, j) => (j === k ? n : x)) })} onRemove={() => up({ conditions: r.conditions.filter((_, j) => j !== k) })} />)}
              <p className="px-1 text-xs text-slate-400">{r.conditions.length ? 'Drag another condition here.' : 'No conditions: this rule applies to every patient. Drag a condition here.'}</p>
            </DropZone>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">THEN</p>
            <DropZone kind="act" onDrop={addAct} className="space-y-2">
              {r.actions.map((a, k) => <ActRow key={k} a={a} meta={meta} onChange={(n) => up({ actions: r.actions.map((x, j) => (j === k ? n : x)) })} onRemove={() => up({ actions: r.actions.filter((_, j) => j !== k) })} />)}
              <p className="px-1 text-xs text-slate-400">{r.actions.length ? 'Drag another action here.' : 'Drag an action here.'}</p>
            </DropZone>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={!!r.stop} onChange={(e) => up({ stop: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />Stop: do not run the rules below this one</label>
        </div>
      )}
    </div>
  );
}

export default function RulesTab({ s, setS, meta }) {
  const [openId, setOpenId] = useState(null);
  const rules = s.rules;
  const setRules = (fn) => setS((x) => ({ ...x, rules: typeof fn === 'function' ? fn(x.rules) : fn }));
  const target = openId && rules.find((r) => r.id === openId) ? openId : null;
  const addRule = () => { const r = { id: uid(), name: 'New rule', enabled: true, match: 'all', conditions: [], actions: [], stop: false }; setRules((l) => [...l, r]); setOpenId(r.id); };
  const tap = (kind, id) => {
    const tgt = target || rules[0]?.id;
    if (!tgt) return;
    setOpenId(tgt);
    setRules((l) => l.map((r) => (r.id !== tgt ? r : kind === 'cond' ? { ...r, conditions: [...r.conditions, newCondition(meta, id)] } : { ...r, actions: [...r.actions, newAction(id)] })));
  };
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Rules run from top to bottom for every patient. Drag the grip to reorder, drag blocks from the palette into a rule, or open a rule and tap a block.</p>
        <Sortable items={rules} onChange={setRules} className="space-y-3" render={(r, i, handle) => (
          <RuleCard r={r} i={i} handle={handle} meta={meta} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onChange={(n) => setRules((l) => l.map((x) => (x.id === r.id ? n : x)))}
            onRemove={() => { if (window.confirm(`Delete the rule "${r.name}"?`)) setRules((l) => l.filter((x) => x.id !== r.id)); }}
            onCopy={() => { const c = { ...JSON.parse(JSON.stringify(r)), id: uid(), name: `${r.name} (copy)` }; setRules((l) => { const k = l.findIndex((x) => x.id === r.id); return [...l.slice(0, k + 1), c, ...l.slice(k + 1)]; }); setOpenId(c.id); }} />
        )} />
        <Button variant="secondary" onClick={addRule}><Plus className="h-4 w-4" />Add rule</Button>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="mb-2 text-sm">Conditions <span className="font-normal text-slate-400">(IF)</span></h3>
            <div className="flex flex-wrap gap-1.5">{Object.entries(meta.fields).map(([k, v]) => <PaletteChip key={k} kind="cond" id={k} onTap={() => tap('cond', k)}>{v.label}</PaletteChip>)}</div>
          </div>
          <div>
            <h3 className="mb-2 text-sm">Actions <span className="font-normal text-slate-400">(THEN)</span></h3>
            <div className="flex flex-wrap gap-1.5">{Object.entries(meta.actions).map(([k, v]) => <PaletteChip key={k} kind="act" id={k} onTap={() => tap('act', k)}>{v.label}</PaletteChip>)}</div>
          </div>
          <p className="text-xs text-slate-400">{target ? 'Tapping a block adds it to the open rule.' : 'Open a rule, then tap a block to add it. Or drag.'}</p>
        </div>
      </aside>
    </div>
  );
}
