import { useEffect, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Number that counts up to `value` when it appears (and whenever the value changes). */
export function Counter({ value = 0, duration = 900, className, suffix = '' }) {
  const [n, setN] = useState(reduced() ? value : 0);
  useEffect(() => {
    if (reduced()) { setN(value); return undefined; }
    let raf, t0;
    const tick = (t) => {
      t0 ??= t;
      const p = Math.min(1, (t - t0) / duration);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{n}{suffix}</span>;
}

/** Fades and lifts its children in; `i` staggers siblings. */
export function Reveal({ i = 0, as: Tag = 'div', className = '', children, ...p }) {
  return <Tag className={`reveal ${className}`} style={{ '--i': i }} {...p}>{children}</Tag>;
}

/** Soft pulsing ring behind live elements (the next meeting, "now"). */
export const Pulse = ({ className = '' }) => (
  <span className={`pointer-events-none absolute inset-0 rounded-full bg-current opacity-40 animate-ping2 ${className}`} aria-hidden />
);
