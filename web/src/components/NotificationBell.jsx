import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CalendarClock, CalendarX, CalendarCheck, Check } from 'lucide-react';
import { api, post } from '../lib/api';
import { useToast } from '../lib/toast';
import { cx } from './ui';

const ICON = { REMINDER: BellRing, AGENDA: CalendarClock, BOOKED: CalendarCheck, RESCHEDULED: CalendarClock, CANCELLED: CalendarX };
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Bell in the header. Polls every minute; reminders for upcoming meetings arrive here (and as a desktop alert if allowed). */
export default function NotificationBell() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const seen = useRef(null);
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api('/notifications'), refetchInterval: 60_000, refetchOnWindowFocus: true });
  const read = useMutation({ mutationFn: (b) => post('/notifications/read', b), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  // announce notifications that arrive while the app is open
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.items.map((n) => n.id));
    if (seen.current) {
      for (const n of data.items.filter((x) => !seen.current.has(x.id) && !x.readAt)) {
        toast.success(`${n.title}. ${n.body}`);
        if ('Notification' in window && Notification.permission === 'granted') { try { new Notification(n.title, { body: n.body, tag: n.id }); } catch { /* some browsers only allow this from a service worker */ } }
      }
    }
    seen.current = ids;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const unread = data?.unread || 0;
  const canAlert = 'Notification' in window && Notification.permission === 'default';

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-10 w-10 place-items-center rounded-full border border-ink-200 text-ink-700 hover:bg-ink-50" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-extrabold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 max-h-[75vh] overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[24rem]" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-extrabold text-ink-900">Notifications</p>
            {unread > 0 && <button onClick={() => read.mutate({ all: true })} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"><Check className="h-3.5 w-3.5" />Mark all read</button>}
          </div>
          {canAlert && (
            <button onClick={() => Notification.requestPermission().then(() => setOpen(false))} className="flex w-full items-center gap-2 bg-brand-50 px-4 py-2.5 text-left text-xs font-bold text-brand-700 hover:bg-brand-100"><BellRing className="h-4 w-4" />Turn on desktop alerts for meeting reminders</button>
          )}
          <ul className="max-h-[55vh] divide-y divide-ink-50 overflow-y-auto">
            {!data?.items?.length && <li className="px-4 py-10 text-center text-sm text-slate-500">You are all caught up.</li>}
            {data?.items?.map((n) => {
              const Icon = ICON[n.kind] || Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => { if (!n.readAt) read.mutate({ ids: [n.id] }); setOpen(false); if (n.link) nav(n.link); }} className={cx('flex w-full gap-3 px-4 py-3 text-left hover:bg-ink-50', !n.readAt && 'bg-brand-50/50')}>
                    <span className={cx('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl', n.kind === 'REMINDER' ? 'bg-brand-600 text-white' : n.kind === 'CANCELLED' ? 'bg-rose-50 text-rose-600' : 'bg-ink-50 text-ink-700')}><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink-900">{n.title}</span><span className="block text-xs text-slate-600">{n.body}</span><span className="mt-0.5 block text-[11px] font-semibold text-slate-400">{ago(n.createdAt)}</span></span>
                    {!n.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
