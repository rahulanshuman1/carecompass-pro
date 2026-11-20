import { useEffect, useId, useRef } from 'react';
import { Loader2, AlertCircle, Info, X, CheckCircle2 } from 'lucide-react';
import { STATUS_TONE, label, initials } from '../lib/format';

export const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, type = 'button', ...p }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50',
  }[variant];
  const s = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-6 text-base' }[size];
  return (
    <button type={type} disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', v, s, className)} {...p}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export const Card = ({ className, children, ...p }) => (
  <div className={cx('rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft', className)} {...p}>{children}</div>
);

export function CardTitle({ icon: Icon, title, action, sub }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-[18px] w-[18px]" /></span>}
        <div><h2 className="leading-tight">{title}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: 'bg-slate-100 text-slate-600', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
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
      <label htmlFor={child?.props?.id || id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {text}{required && <span className="text-rose-500"> *</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
      </label>
      {child}
      {error && <p className="mt-1 text-xs font-medium text-rose-600" role="alert">{error}</p>}
    </div>
  );
}

const base = 'w-full rounded-xl border bg-white px-3 text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-50';
export const Input = ({ className, invalid, ...p }) => <input className={cx(base, 'h-11', invalid ? 'border-rose-400' : 'border-slate-200', className)} {...p} />;
export const Select = ({ className, children, ...p }) => <select className={cx(base, 'h-11 pr-8', 'border-slate-200', className)} {...p}>{children}</select>;
export const Textarea = ({ className, ...p }) => <textarea className={cx(base, 'min-h-[96px] resize-y border-slate-200 py-2.5', className)} {...p} />;

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
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {Icon && <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="h-6 w-6" /></span>}
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
  const c = tone === 'warn' ? 'bg-amber-500' : tone === 'danger' ? 'bg-rose-500' : 'bg-brand-500';
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={l}><div className={cx('h-full rounded-full transition-all', c)} style={{ width: `${pct}%` }} /></div>;
}

export const Avatar = ({ name, photo, size = 'md' }) => {
  const dim = { md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-24 w-24 text-3xl' }[size];
  return photo
    ? <img src={photo} alt="" className={cx('shrink-0 rounded-full object-cover ring-1 ring-slate-200', dim)} />
    : <span className={cx('grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 font-bold text-brand-800', dim)} aria-hidden>{initials(name)}</span>;
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
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg animate-rise overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between"><h2>{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const Chip = ({ active, children, ...p }) => (
  <button type="button" aria-pressed={active} className={cx('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition', active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')} {...p}>{children}</button>
);
