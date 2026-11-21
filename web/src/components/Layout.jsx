import Logo from './Logo';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, CreditCard, Salad, Users, ShieldCheck, FileCheck2, LogOut, Home, UserCog, Inbox, Tags } from 'lucide-react';
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
    <div className="min-h-screen">
      {/* Top navigation */}
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
          <Brand compact />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map(([to, text, Icon, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition lg:px-4', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50')}>
                <Icon className="h-[17px] w-[17px]" />{text}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <NavLink to="/profile" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-ink-50" title="Edit profile" aria-label="My profile">
              <Avatar name={user.name} photo={user.photo} />
              <span className="hidden min-w-0 leading-tight lg:block"><span className="block max-w-[140px] truncate text-sm font-bold text-ink-900">{user.name}</span><span className="block text-xs text-slate-500">{ROLE_LABEL[user.role]}</span></span>
            </NavLink>
            <button onClick={logout} className="flex h-10 items-center gap-1.5 rounded-full border border-ink-200 px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50" aria-label="Sign out"><LogOut className="h-4 w-4" /><span className="hidden lg:inline">Sign out</span></button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-14 md:pt-10"><div className="animate-rise"><Outlet /></div></main>

      {/* Bottom tabs (mobile) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 backdrop-blur md:hidden" aria-label="Main">
        {nav.map(([to, text, Icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold', isActive ? 'text-brand-700' : 'text-slate-500')}>
            {({ isActive }) => (<><span className={cx('rounded-full px-4 py-1 transition', isActive && 'bg-brand-50')}><Icon className="h-5 w-5" /></span>{text}</>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Brand({ compact }) {
  return <Logo compact={compact} size={compact ? 34 : 40} />;
}
