import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';
import { isNative } from '../lib/native';

let played = false; // once per app launch

/**
 * Launch screen for the mobile app: the animated compass logo pops in with soft pulses, the name and tagline
 * rise in, a progress line fills, then the screen lifts away and the login (or home) screen animates in.
 * Not shown on the website.
 */
export default function NativeSplash() {
  const [phase, setPhase] = useState(() => (isNative() && !played ? 'in' : 'off'));

  useEffect(() => {
    if (phase === 'off') return undefined;
    played = true;
    const quick = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hold = quick ? 500 : 2300;
    const t1 = setTimeout(() => { document.documentElement.classList.remove('booting', 'boot-dark'); setPhase('out'); }, hold);
    const t2 = setTimeout(() => setPhase('off'), hold + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'off') return null;
  return (
    <div className={`splash pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 ${phase === 'out' ? 'out' : ''}`} role="status" aria-label="Opening CareCompass">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 animate-float rounded-full bg-brand-500/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 animate-float rounded-full bg-sun-400/15 blur-3xl" style={{ animationDelay: '1.6s' }} />

      <div className="relative grid h-44 w-44 place-items-center">
        <span aria-hidden className="absolute h-28 w-28 rounded-full bg-brand-400/40 animate-ping2" />
        <span aria-hidden className="absolute h-28 w-28 rounded-full bg-brand-400/30 animate-ping2" style={{ animationDelay: '.7s' }} />
        <div className="relative animate-pop drop-shadow-[0_18px_40px_rgba(236,58,113,.55)]"><LogoMark size={112} /></div>
      </div>

      <p className="splash-word mt-6 text-[2rem] font-extrabold tracking-tight text-white">Care<span className="text-brand-300">Compass</span></p>
      <p className="splash-tag mt-2 text-sm font-semibold text-ink-200">Eat well. Live well. Stay on track.</p>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 pb-12">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/15"><div className="splash-bar h-full origin-left rounded-full bg-gradient-to-r from-brand-300 to-brand-500" /></div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-ink-200/80">Preparing your day</p>
      </div>
    </div>
  );
}
