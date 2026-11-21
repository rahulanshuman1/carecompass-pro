import { useEffect, useState } from 'react';
import Logo from './Logo';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CreditCard, Salad, Users, ShieldCheck, FileCheck2, LogOut, Home, UserCog, Inbox, Tags, CalendarDays, CalendarClock, Menu, X, Wand2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { Avatar, cx } from './ui';
import NotificationBell from './NotificationBell';
import AppDownload from './AppDownload';

const NAV = {
  PATIENT: [['/', 'Home', Home, true], ['/my-plan', 'Diet Plan', Salad], ['/meetings', 'Meetings', CalendarClock], ['/history', 'My History', ClipboardList], ['/plans', 'Membership', CreditCard]],
  CARE_TEAM: [['/schedule', 'Schedule', CalendarDays], ['/queue', 'Patients', Inbox], ['/plans-admin', 'Plans', Tags]],
  DIETITIAN: [['/agenda', 'Agenda', CalendarDays], ['/patients', 'My Patients', Users]],
  LEAD_DOCTOR: [['/dashboard', 'Overview', LayoutDashboard], ['/schedule', 'Schedule', CalendarDays], ['/queue', 'Patients', Users], ['/reviews', 'Reviews', FileCheck2], ['/studio', 'Plan Studio', Wand2], ['/team', 'Team', UserCog], ['/audit', 'Audit', ShieldCheck]],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = NAV[user.role];
  const loc = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [loc.pathname]);
  // phones: first four destinations as tabs, the rest (and the app downloads) under "More"
  const tabs = nav.length > 4 ? nav.slice(0, 4) : nav;
  const rest = nav.length > 4 ? nav.slice(4) : [];
  const moreActive = rest.some(([to]) => loc.pathname.startsWith(to));
  return (
    <div className="min-h-screen">
      {/* Top navigation */}
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
          <Brand compact />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map(([to, text, Icon, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition lg:px-4', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50')}>
                <Icon className="h-[17px] w-[17px]" />{text}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <NavLink to="/profile" className="flex shrink-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-1 hover:bg-ink-50 xl:pr-3" title="Edit profile" aria-label="My profile">
              <Avatar name={user.name} photo={user.photo} />
              <span className="hidden min-w-0 leading-tight xl:block"><span className="block max-w-[140px] truncate text-sm font-bold text-ink-900">{user.name}</span><span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span></span>
            </NavLink>
            <button onClick={logout} className="hidden h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-ink-200 px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 md:flex" aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden xl:inline">Sign out</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-14 md:pt-10"><div className="animate-rise"><Outlet /></div></main>

      {/* Bottom tabs (phones) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 backdrop-blur md:hidden" aria-label="Main">
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
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={() => setMore(false)} aria-label="Close menu" />
          <div className="pb-safe absolute inset-x-0 bottom-0 max-h-[85vh] animate-slideUp overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl">
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
