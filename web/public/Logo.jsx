import { useId } from 'react';

/**
 * Animated CareCompass logo: a compass ring draws itself, the needle swings and settles
 * toward "better health", and the heart at its centre keeps a soft heartbeat.
 * Animations live in index.css (.cc-*) and switch off for prefers-reduced-motion.
 */
export function LogoMark({ size = 40, animated = true, className = '' }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="CareCompass logo" className={`${animated ? 'cc-anim' : ''} ${className}`}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f9628e" /><stop offset="1" stopColor="#8f1a40" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}c`}><rect width="64" height="64" rx="18" /></clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect width="64" height="64" fill={`url(#${id}g)`} />
        <rect className="cc-shine" x="-30" y="-10" width="22" height="84" fill={`url(#${id}s)`} transform="rotate(20 32 32)" />
      </g>
      <circle className="cc-ring" cx="32" cy="32" r="21.5" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="135" />
      {[0, 90, 180, 270].map((a) => <line key={a} className="cc-tick" x1="32" y1="6.5" x2="32" y2="10.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />)}
      <g className="cc-needle">
        <g className="cc-wobble">
          <path d="M32 12 L37.5 32 L32 52 L26.5 32Z" fill="#fff" fillOpacity=".25" />
          <path d="M32 12 L37.5 32 L26.5 32Z" fill="#fff" />
        </g>
      </g>
      <path className="cc-heart" d="M32 40 C24.5 35 25.5 28.2 29.6 28.2 C31 28.2 32 29.1 32 30.3 C32 29.1 33 28.2 34.4 28.2 C38.5 28.2 39.5 35 32 40Z" fill="#d42459" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = 40, animated = true, showText = true, compact = false, light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} animated={animated} />
      {showText && (
        <span className={`font-extrabold tracking-tight ${compact ? 'text-lg' : 'text-xl'} ${light ? 'text-white' : 'text-ink-900'}`} aria-hidden>
          <span className={animated ? 'cc-word cc-word-1' : ''}>Care</span><span className={`${animated ? 'cc-word cc-word-2' : ''} ${light ? 'text-brand-100' : 'text-brand-600'}`}>Compass</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
