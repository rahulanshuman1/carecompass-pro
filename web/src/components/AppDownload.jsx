import { useEffect, useState } from 'react';
import { Apple, Download, Smartphone } from 'lucide-react';
import { APP_LINKS } from '../lib/appLinks';
import { cx } from './ui';
import { isNative } from '../lib/native';

let deferred = null; // the browser fires beforeinstallprompt once, keep it for later
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event('cc-installable')); });

function useInstall() {
  const [can, setCan] = useState(!!deferred);
  useEffect(() => { const f = () => setCan(true); window.addEventListener('cc-installable', f); return () => window.removeEventListener('cc-installable', f); }, []);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone);
  return { can: can && !standalone, install: async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; setCan(false); } };
}

const Btn = ({ href, icon: Icon, small, top, bottom, light }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={cx('tap flex items-center gap-3 rounded-2xl border text-left', small ? 'px-3.5 py-2' : 'px-4 py-3', light ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-ink-200 bg-white text-ink-900 hover:border-brand-300')}>
    <Icon className={small ? 'h-5 w-5' : 'h-6 w-6'} />
    <span className="leading-tight"><span className={cx('block font-semibold', small ? 'text-[10px]' : 'text-[11px]', light ? 'text-white/70' : 'text-slate-500')}>{top}</span><span className={cx('block font-extrabold', small ? 'text-sm' : 'text-base')}>{bottom}</span></span>
  </a>
);

/** Download buttons for the Android APK and the iOS app, plus "Install web app" when the browser allows it. */
export default function AppDownload({ variant = 'card', light = false, className = '' }) {
  const { can, install } = useInstall();
  const small = variant === 'inline';
  if (isNative()) return null; // already inside the app
  return (
    <div className={className}>
      {variant === 'card' && (
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Smartphone className="h-5 w-5" /></span>
          <div><h3>Get the CareCompass app</h3><p className="text-xs text-slate-500">Meeting reminders and your daily plan, right on your phone.</p></div>
        </div>
      )}
      <div className={cx('flex flex-wrap gap-2.5', small && 'justify-center')}>
        <Btn href={APP_LINKS.android} icon={Smartphone} top="Download for" bottom="Android (APK)" small={small} light={light} />
        <Btn href={APP_LINKS.ios} icon={Apple} top="Download for" bottom="iPhone (iOS)" small={small} light={light} />
        {can && (
          <button onClick={install} className={cx('tap flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm font-bold', light ? 'border-white/40 text-white' : 'border-brand-300 text-brand-700 hover:bg-brand-50')}><Download className="h-4 w-4" />Install web app</button>
        )}
      </div>
      {variant === 'card' && <p className="mt-2.5 text-[11px] text-slate-400">Android downloads the APK directly. iPhone: until the App Store version is live, open this page in Safari and use Share, then Add to Home Screen.</p>}
    </div>
  );
}
