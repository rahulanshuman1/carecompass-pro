import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CreditCard, Salad, Users, Stethoscope, ShieldCheck, FileCheck2, LogOut, Home, UserCog, Inbox, Tags } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { Avatar, cx } from './ui';

const NAV = {
  PATIENT: [['/', 'Home', Home, true], ['/history', 'My History', ClipboardList], ['/plans', 'Membership', CreditCard], ['/my-plan', 'Diet Plan', Salad]],
  CARE_TEAM: [['/queue', 'Patients', Inbox], ['/plans-admin', 'Plans', Tags]],
  DIETITIAN: [['/patients', 'My Patients', Users]],
  LEAD_DOCTOR: [['/dashboard', 'Overview', LayoutDashboard], ['/queue', 'Patients', Users], ['/reviews', 'Reviews', FileCheck2], ['/team', 'Team', UserCog], ['/audit', 'Audit', ShieldCheck]],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = NAV[user.role];
  useLocation();
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex">
        <Brand />
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map(([to, text, Icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50')}>
              <Icon className="h-[18px] w-[18px]" />{text}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-2xl bg-slate-50 p-3">
          <NavLink to="/profile" className="flex items-center gap-3 rounded-xl p-1 hover:bg-white" title="Edit profile"><Avatar name={user.name} photo={user.photo} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{user.name}</p><p className="truncate text-xs text-slate-500">{user.title || ROLE_LABEL[user.role]}</p></div></NavLink>
          <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar (mobile) */}
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand compact />
          <div className="flex items-center gap-1"><NavLink to="/profile" aria-label="My profile"><Avatar name={user.name} photo={user.photo} /></NavLink><button onClick={logout} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100" aria-label="Sign out"><LogOut className="h-4 w-4" />Sign out</button></div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-10"><div className="animate-rise"><Outlet /></div></main>
      </div>

      {/* Bottom tabs (mobile) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden" aria-label="Main">
        {nav.map(([to, text, Icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-slate-500')}>
            {({ isActive }) => (<><span className={cx('rounded-full px-4 py-1 transition', isActive && 'bg-brand-50')}><Icon className="h-5 w-5" /></span>{text}</>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Brand({ compact }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-sm"><Stethoscope className="h-5 w-5" /></span>
      <span className={cx('font-extrabold tracking-tight text-slate-900', compact ? 'text-lg' : 'text-xl')}>Care<span className="text-brand-600">Compass</span></span>
    </div>
  );
}
