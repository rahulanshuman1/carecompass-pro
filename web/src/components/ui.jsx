import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, AlertCircle, Info, X, CheckCircle2 } from 'lucide-react';
import { STATUS_TONE, label, initials } from '../lib/format';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...p }) {
  const v = {
    primary: 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lift hover:from-brand-600 hover:to-brand-700',
    secondary: 'bg-white text-ink-800 border border-ink-200 hover:bg-ink-50',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'text-ink-700 hover:bg-ink-50',
    danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50',
  }[variant];
  const s = { sm: 'h-9 px-4 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-7 text-base' }[size];
  return (
    <button type={type} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-full font-bold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none', v, s, className)} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Card = ({ className, children, ...p }) => (
  <div className={cx('rounded-3xl border border-ink-100 bg-white p-5 shadow-soft md:p-6', className)} {...p}>{children}</div>
);

export function CardTitle({ icon: Icon, title, action, sub }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Icon className="h-[18px] w-[18px]" /></span>}
        <div><h2 className="leading-tight">{title}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: 'bg-ink-50 text-ink-700', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700', rose: 'bg-rose-50 text-rose-700', blue: 'bg-blue-50 text-blue-700',
};
export const Badge = ({ tone = 'slate', children, className }) => (
  <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>{children}</span>
);
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{label(status)}</Badge>;

export function Field({ label: text, error, hint, required, children, className }) {
  const id = useId();
  const child = children && typeof children === 'object' && 'props' in children ? { ...children, props: { ...children.props, id: children.props.id || id, 'aria-invalid': error ? true : undefined } } : children;
  return (
    <div className={className}>
      <label htmlFor={child?.props?.id || id} className="mb-1.5 block text-sm font-semibold text-ink-800">
        {text}{required && <span className="text-rose-500"> *</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
      </label>
      {child}
      {error && <p className="mt-1 text-xs font-medium text-rose-600" role="alert">{error}</p>}
    </div>
  );
}

const base = 'w-full rounded-2xl border bg-white px-4 text-ink-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:bg-ink-50';
export const Input = ({ className, invalid, ...p }) => <input className={cx(base, 'h-11', invalid ? 'border-rose-400' : 'border-ink-200', className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx(base, 'h-11 pr-8', 'border-ink-200', className)} {...p}>{children}</select>;
export const Textarea = ({ className, ...p }) => <textarea className={cx(base, 'min-h-[96px] resize-y border-ink-200 py-3', className)} {...p} />;

export const Spinner = ({ className }) => <Loader2 className={cx('h-5 w-5 animate-spin text-brand-600', className)} aria-label="Loading" />;
export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-xl bg-slate-200/70', className)} />;
export function PageLoader() {
  return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>;
}

export function Alert({ tone = 'info', children, className }) {
  const t = { info: ['bg-blue-50 text-blue-800', Info], warn: ['bg-amber-50 text-amber-800', AlertCircle], error: ['bg-rose-50 text-rose-800', AlertCircle], success: ['bg-emerald-50 text-emerald-800', CheckCircle2] }[tone];
  const Icon = t[1];
  return <div className={cx('flex gap-2.5 rounded-xl px-4 py-3 text-sm', t[0], className)} role={tone === 'error' ? 'alert' : undefined}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div></div>;
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-ink-200 bg-white/70 px-6 py-12 text-center">
      {Icon && <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500"><Icon className="h-6 w-6" /></span>}
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Stat({ label: l, value, sub, icon: Icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>{Icon && <Icon className="h-4 w-4 text-brand-500" />}</div>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function ProgressBar({ value = 0, tone = 'brand', label: l }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const c = tone === 'warn' ? 'bg-amber-500' : tone === 'danger' ? 'bg-rose-500' : 'bg-gradient-to-r from-brand-400 to-brand-600';
  return <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={l}><div className={cx('h-full rounded-full transition-all', c)} style={{ width: `${pct}%` }} /></div>;
}

export const Avatar = ({ name, photo, size = 'md' }) => {
  const dim = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-3xl' }[size];
  return photo
    ? <img src={photo} alt="" className={cx('shrink-0 rounded-full object-cover ring-1 ring-slate-200', dim)} />
    : <span className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-300 font-bold text-brand-800', dim)} aria-hidden>{initials(name)}</span>;
};

export function PageHeader({ title, sub, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1>{title}</h1>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}</div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  // Rendered in a portal on <body>: inside the page, an animated (transformed) ancestor
  // becomes the containing block of `position: fixed`, which is what clipped the popup.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-900/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg animate-rise flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem]">
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-6"><h2>{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        {!footer && <div className="h-4 shrink-0" />}
      </div>
    </div>,
    document.body,
  );
}

export const Chip = ({ active, children, ...p }) => (
  <button type="button" aria-pressed={active} className={cx('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50')} {...p}>{children}</button>
);

/** Circular progress ring (value 0-100) with centred content. */
export function Ring({ value = 0, size = 88, stroke = 9, tone = 'brand', children, label: l }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = { brand: '#ec3a71', green: '#10b981', blue: '#6366f1', amber: '#f59e0b' }[tone] || '#ec3a71';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={l ? `${l}: ${Math.round(pct)}%` : undefined}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1ecf7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
