import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { cx } from '../ui';

const move = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
export const moveItem = move;

/**
 * Drag-and-drop reordering for a list (mouse and trackpad), plus up/down buttons so it also works on
 * phones and with a keyboard. `render(item, index, handle)` draws one row; put `handle` where the grip should be.
 */
export function Sortable({ items, onChange, render, keyOf = (x) => x.id, className = '' }) {
  const [over, setOver] = useState(null);
  const from = useRef(null);
  return (
    <div className={className}>
      {items.map((item, i) => {
        const handle = (
          <span className="flex shrink-0 items-center gap-0.5 text-slate-400">
            <span
              draggable
              onDragStart={(e) => { from.current = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `reorder:${i}`); const row = e.currentTarget.closest('[data-row]'); if (row) e.dataTransfer.setDragImage(row, 16, 16); }}
              onDragEnd={() => { from.current = null; setOver(null); }}
              className="cursor-grab rounded p-1 hover:bg-slate-100 active:cursor-grabbing" title="Drag to reorder" aria-hidden><GripVertical className="h-5 w-5" /></span>
            <span className="flex flex-col">
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))} className="rounded hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onChange(move(items, i, i + 1))} className="rounded hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
            </span>
          </span>
        );
        return (
          <div
            key={keyOf(item)}
            data-row
            onDragOver={(e) => { if (from.current != null) { e.preventDefault(); setOver(i); } }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => { if (from.current == null) return; e.preventDefault(); onChange(move(items, from.current, i)); from.current = null; setOver(null); }}
            className={cx('rounded-2xl transition', over === i && from.current !== i && 'ring-2 ring-brand-400 ring-offset-2')}
          >
            {render(item, i, handle)}
          </div>
        );
      })}
    </div>
  );
}

/** A chip you can drag onto a drop zone, or tap to add to the active target. */
export function PaletteChip({ kind, id, children, onTap }) {
  return (
    <button
      type="button"
      draggable
      onClick={onTap}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('application/x-cc-block', JSON.stringify({ kind, id })); }}
      className="inline-flex cursor-grab items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5 text-slate-400" />{children}
    </button>
  );
}

/** Drop target for palette chips of one kind ("cond" or "act"). */
export function DropZone({ kind, onDrop, children, className = '' }) {
  const [hot, setHot] = useState(false);
  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-cc-block')) { e.preventDefault(); setHot(true); } }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        setHot(false);
        const raw = e.dataTransfer.getData('application/x-cc-block');
        if (!raw) return;
        e.preventDefault(); e.stopPropagation();
        try { const b = JSON.parse(raw); if (b.kind === kind) onDrop(b.id); } catch { /* ignore */ }
      }}
      className={cx('rounded-xl border-2 border-dashed p-2 transition', hot ? 'border-brand-500 bg-brand-50' : 'border-slate-200', className)}
    >
      {children}
    </div>
  );
}

/** Comma/enter separated tags. */
export function TagInput({ value, onChange, placeholder }) {
  const [t, setT] = useState('');
  const add = () => { const x = t.trim().toLowerCase(); if (x && !value.includes(x)) onChange([...value, x]); setT(''); };
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      {value.map((w) => (
        <span key={w} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{w}
          <button type="button" aria-label={`Remove ${w}`} onClick={() => onChange(value.filter((x) => x !== w))}><X className="h-3 w-3" /></button></span>
      ))}
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder={value.length ? '' : placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} className="min-w-[8rem] flex-1 border-0 bg-transparent p-1 text-sm outline-none" aria-label="Add a word" />
    </div>
  );
}

/** Pill switch */
export const Switch = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-slate-300')}>
    <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
  </button>
);
