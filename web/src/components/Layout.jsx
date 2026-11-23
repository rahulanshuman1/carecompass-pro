import { useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CreditCard, Salad, Users, ShieldCheck, FileCheck2, LogOut, Home, UserCog, Inbox, Tags, CalendarDays, CalendarClock, Menu, X, Wand2, ChevronDown, UserRound } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, homeFor } from '../lib/format';
import { Avatar, cx } from './ui';
import NotificationBell from './NotificationBell';
import AppDownload from './AppDownload';

const NAV = {
  PATIENT: [['/', 'Home', Home, true], ['/my-plan', 'Diet Plan', Salad], ['/meetings', 'Meetings', CalendarClock], ['/history', 'My History', ClipboardList], ['/plans', 'Membership', CreditCard]],
  CARE_TEAM: [['/schedule', 'Schedule', CalendarDays], ['/queue', 'Patients', Inbox], ['/plans-admin', 'Plans', Tags]],
  DIETITIAN: [['/agenda', 'Agenda', CalendarDays], ['/patients', 'My Patients', Users]],
  LEAD_DOCTOR: [['/dashboard', 'Overview', LayoutDashboard], ['/schedule', 'Schedule', CalendarDays], ['/queue', 'Patients', Users], ['/reviews', 'Reviews', FileCheck2], ['/studio', 'Plan Studio', Wand2], ['/team', 'Team', UserCog], ['/audit', 'Audit', ShieldCheck]],
};

/** Avatar button with a small menu: profile and sign out. Replaces a separate Sign out button that could get cut off. */
function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className={cx('flex items-center gap-2.5 rounded-full border py-1 pl-1 pr-1 transition hover:bg-ink-50 sm:pr-2.5', open ? 'border-ink-200 bg-ink-50' : 'border-transparent')}>
        <Avatar name={user.name} photo={user.photo} />
        <span className="hidden min-w-0 text-left leading-tight md:block"><span className="block max-w-[130px] truncate text-sm font-bold text-ink-900">{user.name}</span><span className="block text-[11px] font-semibold text-slate-500">{ROLE_LABEL[user.role]}</span></span>
        <ChevronDown className={cx('hidden h-4 w-4 text-slate-400 transition-transform duration-200 sm:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+.6rem)] z-50 w-72 origin-top-right animate-pop overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-gradient-to-br from-brand-50 to-ink-50 p-4">
            <Avatar name={user.name} photo={user.photo} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-extrabold text-ink-900">{user.name}</p>
              {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
              <span className="mt-1.5 inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-brand-700 shadow-sm">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
          <div className="space-y-0.5 p-2">
            <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-ink-800 hover:bg-ink-50"><UserRound className="h-[18px] w-[18px] text-slate-500" />My profile</Link>
            <button role="menuitem" onClick={logout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-rose-600 hover:bg-rose-50"><LogOut className="h-[18px] w-[18px]" />Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = NAV[user.role];
  const crowded = nav.length > 5; // lead doctor: seven destinations, so the phone layout lasts until lg
  const loc = useLocation();
  const [more, setMore] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 4);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => { setMore(false); }, [loc.pathname]);
  // phones: first four destinations as tabs, the rest (and the app downloads) under "More"
  const tabs = nav.length > 4 ? nav.slice(0, 4) : nav;
  const rest = nav.length > 4 ? nav.slice(4) : [];
  const moreActive = rest.some(([to]) => loc.pathname.startsWith(to));
  return (
    <div className="min-h-screen">
      {/* Top navigation */}
      <header className="pt-safe sticky top-0 z-30 bg-white">
        <div aria-hidden className="h-[3px] bg-gradient-to-r from-brand-400 via-brand-600 to-ink-800" />
        <div className={cx('border-b bg-white transition-shadow duration-300', scrolled ? 'border-ink-100 shadow-[0_12px_32px_-18px_rgba(43,29,66,.5)]' : 'border-ink-100/70')}>
          {/* top bar: logo (goes home), notifications, account */}
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:h-14 md:px-8">
            <Link to={homeFor(user.role)} aria-label="CareCompass, go to home" className="-ml-1.5 rounded-2xl p-1.5 outline-none transition hover:bg-ink-50 focus-visible:ring-4 focus-visible:ring-brand-500/20 active:scale-[.98]">
              <Brand compact />
            </Link>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <NotificationBell />
              <UserMenu user={user} logout={logout} />
            </div>
          </div>
          {/* tab bar: every destination shows its name; the active one gets an underline that slides in */}
          <nav className={cx('mx-auto hidden max-w-6xl px-4 md:px-8', crowded ? 'lg:block' : 'md:block')} aria-label="Main">
            <ul className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
              {nav.map(([to, text, Icon, end]) => (
                <li key={to} className="shrink-0">
                  <NavLink to={to} end={end} className={({ isActive }) => cx('group relative inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-3 text-sm font-bold outline-none transition-colors focus-visible:text-brand-700', isActive ? 'text-brand-700' : 'text-slate-600 hover:text-ink-900')}>
                    {({ isActive }) => (
                      <>
                        <Icon className={cx('h-[17px] w-[17px] shrink-0 transition duration-200 group-hover:scale-110', isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-500')} />
                        {text}
                        <span aria-hidden className={cx('absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition duration-300', isActive ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0 group-hover:scale-x-75 group-hover:opacity-40')} />
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className={cx('mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pt-10', crowded ? 'lg:pb-14' : 'md:pb-14')}><div className="animate-rise"><Outlet /></div></main>

      {/* Bottom tabs (phones) */}
      <nav className={cx('pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white', crowded ? 'lg:hidden' : 'md:hidden')} aria-label="Main">
        {tabs.map(([to, text, Icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold', isActive ? 'text-brand-700' : 'text-slate-500')}>
            {({ isActive }) => (<><span className={cx('rounded-full px-4 py-1 transition', isActive && 'bg-brand-50')}><Icon className="h-5 w-5" /></span><span className="max-w-full truncate px-0.5">{text}</span></>)}
          </NavLink>
        ))}
        {(
          <button onClick={() => setMore(true)} className={cx('flex min-h-[60px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold', moreActive ? 'text-brand-700' : 'text-slate-500')} aria-label="More">
            <span className={cx('rounded-full px-4 py-1', moreActive && 'bg-brand-50')}><Menu className="h-5 w-5" /></span>More
          </button>
        )}
      </nav>

      {/* "More" sheet (phones) */}
      {more && (
        <div className={cx('fixed inset-0 z-40', crowded ? 'lg:hidden' : 'md:hidden')} role="dialog" aria-modal="true" aria-label="More">
          <button className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setMore(false)} aria-label="Close menu" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-slideUp overflow-y-auto rounded-t-[2rem] bg-white px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><h2>More</h2><button onClick={() => setMore(false)} className="rounded-full p-2 text-slate-400 hover:bg-ink-50" aria-label="Close"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-3 gap-2.5">
              {rest.map(([to, text, Icon]) => (
                <NavLink key={to} to={to} className={({ isActive }) => cx('tap flex flex-col items-center gap-1.5 rounded-2xl border p-3.5 text-center text-xs font-bold', isActive ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-800')}><Icon className="h-5 w-5" />{text}</NavLink>
              ))}
              <NavLink to="/profile" className="tap flex flex-col items-center gap-1.5 rounded-2xl border border-ink-100 p-3.5 text-center text-xs font-bold text-ink-800"><Avatar name={user.name} photo={user.photo} size="sm" />Profile</NavLink>
            </div>
            <div className="mt-5 rounded-3xl bg-ink-50/70 p-4"><AppDownload variant="inline" /></div>
            <button onClick={logout} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-ink-200 text-sm font-bold text-ink-800"><LogOut className="h-4 w-4" />Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Brand({ compact }) {
  return <div className="shrink-0 whitespace-nowrap"><Logo compact={compact} size={compact ? 34 : 40} /></div>;
}
