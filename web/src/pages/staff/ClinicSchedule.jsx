import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck2, CalendarClock, CalendarPlus, CalendarX, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, endsAt, fmtDayLong, fmtTime, todayKey, useNow, zonedToIso } from '../../lib/time';
import { Alert, Avatar, Badge, Button, Card, Input, Modal, PageHeader, PageLoader, cx } from '../../components/ui';
import { Counter, Pulse, Reveal } from '../../components/Motion';
import MeetingCard from '../../components/MeetingCard';
import ScheduleModal from '../../components/ScheduleModal';

const BLOCK = {
  SCHEDULED: 'bg-gradient-to-br from-brand-500 to-brand-700 text-white',
  COMPLETED: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white',
  NO_SHOW: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
  CANCELLED: 'bg-ink-50 text-slate-400 line-through ring-1 ring-inset ring-ink-200',
};
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
const zonedDayStart = (date) => Date.parse(zonedToIso(date, '00:00'));
const minOfDay = (iso, date) => (new Date(iso).getTime() - zonedDayStart(date)) / 60_000;

function Tile({ icon: Icon, label, value, tone, i }) {
  return (
    <Reveal i={i} className="tap flex items-center gap-3 rounded-3xl border border-ink-100 bg-white p-4 shadow-soft">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <div><p className="text-2xl font-extrabold leading-none text-ink-900"><Counter value={value} /></p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>
    </Reveal>
  );
}

export default function ClinicSchedule() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayKey();
  const now = useNow(30_000);
  const [book, setBook] = useState(null); // { slot, dietitianId }
  const [resched, setResched] = useState(null);
  const [detail, setDetail] = useState(null);
  const scroller = useRef(null);
  const go = (d) => setParams(d === todayKey() ? {} : { date: d }, { replace: true });

  const { data, isLoading, error } = useQuery({ queryKey: ['schedule', date], queryFn: () => api(`/appointments/schedule?date=${date}`), refetchInterval: 60_000, keepPreviousData: true });
  // jump the day view to "now" (today) or the first meeting
  useEffect(() => {
    const el = scroller.current;
    if (!el || !data) return;
    const first = data.dietitians.flatMap((d) => d.appointments).map((a) => minOfDay(a.startsAt, data.date)).sort((x, y) => x - y)[0];
    const target = data.date === todayKey() ? minOfDay(Date.now(), data.date) - 90 : (first ?? data.work.startMin) - 30;
    const startM = Math.min(data.work.startMin, Math.floor((first ?? data.work.startMin) / 60) * 60);
    el.scrollTo({ left: Math.max(0, ((target - startM) / 60) * 130), behavior: 'smooth' });
  }, [data?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const { dietitians, totals, work } = data;
  const all = dietitians.flatMap((d) => d.appointments);
  const startH = Math.min(Math.floor(work.startMin / 60), ...all.map((a) => Math.floor(minOfDay(a.startsAt, date) / 60)).filter((h) => h >= 0));
  const endH = Math.max(Math.ceil(work.endMin / 60), ...all.map((a) => Math.ceil(minOfDay(endsAt(a), date) / 60)).filter((h) => h <= 24));
  const span = (endH - startH) * 60;
  const pos = (m) => `${(Math.max(0, Math.min(span, m - startH * 60)) / span) * 100}%`;
  const isToday = date === todayKey();
  const nowM = minOfDay(now, date);
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const openTotal = dietitians.reduce((s, d) => s + d.openSlots.length, 0);
  const canBook = ['CARE_TEAM', 'LEAD_DOCTOR'].includes(user.role);
  const act = { onReschedule: (a) => { setDetail(null); setResched(a); } };

  return (
    <div className="space-y-6">
      <PageHeader title="Clinic schedule" sub="Every dietitian's consultations, reschedules and open slots for the day"
        action={canBook && <Button onClick={() => setBook({})}><CalendarPlus className="h-4 w-4" />Schedule a meeting</Button>} />

      {/* day navigator */}
      <Reveal className="flex flex-wrap items-center gap-2 rounded-3xl border border-ink-100 bg-white p-2.5 shadow-soft">
        <Button variant="ghost" size="sm" onClick={() => go(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="min-w-[9rem] flex-1 px-2 text-center"><p className="truncate text-base font-extrabold text-ink-900">{fmtDayLong(date)}</p>{isToday && <p className="text-xs font-bold text-brand-600">Today</p>}</div>
        <Button variant="ghost" size="sm" onClick={() => go(addDays(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button>
        {!isToday && <Button variant="soft" size="sm" onClick={() => go(todayKey())}>Today</Button>}
        <Input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} className="!h-9 !w-full sm:!w-44 order-last sm:order-none" aria-label="Pick a date" />
      </Reveal>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile i={0} icon={CalendarClock} label="Consultations" value={totals.meetings} tone="bg-brand-50 text-brand-600" />
        <Tile i={1} icon={CalendarCheck2} label="Completed" value={totals.completed} tone="bg-emerald-50 text-emerald-600" />
        <Tile i={2} icon={CalendarClock} label="Rescheduled" value={totals.rescheduled} tone="bg-amber-50 text-amber-600" />
        <Tile i={3} icon={CalendarX} label="Cancelled" value={totals.cancelled} tone="bg-rose-50 text-rose-600" />
      </div>

      {/* timeline grid */}
      <Reveal i={2} as={Card} className="overflow-hidden !p-0 md:!p-0">
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
          <div><h2>Day view</h2><p className="text-xs text-slate-500">{openTotal} open slot{openTotal === 1 ? '' : 's'} across the team. Tap an empty slot to book it.</p></div>
          <div className="hidden items-center gap-3 text-[11px] font-bold text-slate-500 sm:flex">{[['bg-brand-500', 'Scheduled'], ['bg-emerald-500', 'Completed'], ['bg-amber-400', 'No show'], ['bg-ink-200', 'Cancelled']].map(([c, l]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded ${c}`} />{l}</span>)}</div>
        </div>
        <div className="no-scrollbar overflow-x-auto" ref={scroller}>
          <div style={{ minWidth: 200 + (endH - startH) * 130 }}>
            <div className="flex border-b border-ink-100 bg-ink-50/50">
              <div className="sticky left-0 z-20 w-36 shrink-0 bg-ink-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 md:w-48">Dietitian</div>
              <div className="relative h-8 flex-1">{hours.map((h) => <span key={h} className="absolute top-2 -translate-x-1/2 text-[11px] font-bold text-slate-500" style={{ left: pos(h * 60) }}>{hourLabel(h)}</span>)}</div>
            </div>
            {dietitians.map((d, ri) => (
              <div key={d.id} className="flex border-b border-ink-50 last:border-0">
                <div className="sticky left-0 z-20 flex w-36 shrink-0 items-center gap-2.5 bg-white px-3 py-3 md:w-48 md:px-4">
                  <Avatar name={d.name} size="sm" />
                  <div className="min-w-0"><p className="truncate text-sm font-extrabold text-ink-900">{d.name}</p><p className="text-[11px] text-slate-500">{d.stats.total} meeting{d.stats.total === 1 ? '' : 's'}</p></div>
                </div>
                <div className="relative h-[4.5rem] flex-1">
                  {hours.slice(0, -1).map((h) => <span key={h} className="absolute inset-y-0 border-l border-ink-50" style={{ left: pos(h * 60) }} />)}
                  {d.openSlots.map((s) => {
                    const m = minOfDay(s, date);
                    return canBook ? (
                      <button key={s} onClick={() => setBook({ slot: s, dietitianId: d.id })} className="group absolute inset-y-2 rounded-lg border border-dashed border-transparent text-brand-600 transition hover:border-brand-300 hover:bg-brand-50" style={{ left: pos(m), width: `calc(${(work.slotMin / span) * 100}% - 2px)` }} aria-label={`Book ${d.name} at ${fmtTime(s)}`}><Plus className="mx-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></button>
                    ) : null;
                  })}
                  {d.appointments.map((a, k) => {
                    const m = minOfDay(a.startsAt, date);
                    return (
                      <button key={a.id} onClick={() => setDetail(a)} className={cx('absolute inset-y-2 animate-pop overflow-hidden rounded-xl px-2 py-1 text-left shadow-sm transition hover:z-10 hover:scale-[1.03] hover:shadow-lift', BLOCK[a.status])} style={{ left: pos(m), width: `calc(${(a.durationMin / span) * 100}% - 3px)`, animationDelay: `${(ri * 4 + k) * 60}ms` }} title={`${a.patient?.name} · ${fmtTime(a.startsAt)}`}>
                        <span className="block truncate text-[11px] font-extrabold leading-tight">{a.patient?.name?.split(' ')[0]}</span>
                        <span className="block truncate text-[10px] font-semibold opacity-90">{fmtTime(a.startsAt)}{a.rescheduleCount > 0 ? ' ↻' : ''}</span>
                      </button>
                    );
                  })}
                  {isToday && nowM >= startH * 60 && nowM <= endH * 60 && <span className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-brand-600" style={{ left: pos(nowM) }}><span className="absolute -top-1 left-1/2 -translate-x-1/2 text-brand-600"><span className="relative block h-2 w-2"><Pulse /><span className="block h-2 w-2 rounded-full bg-brand-600" /></span></span></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* per-dietitian agenda */}
      <section className="space-y-4">
        <h2>Agenda by dietitian</h2>
        <div className="grid gap-5 lg:grid-cols-2">
          {dietitians.map((d, i) => (
            <Reveal key={d.id} i={i} as={Card} className="!p-0 md:!p-0">
              <div className="flex items-center gap-3 border-b border-ink-100 p-4 md:p-5">
                <Avatar name={d.name} size="lg" />
                <div className="min-w-0 flex-1"><p className="truncate text-base font-extrabold text-ink-900">{d.name}</p><p className="truncate text-xs text-slate-500">{d.specialty || 'Dietitian'}</p></div>
                <div className="flex flex-wrap justify-end gap-1.5"><Badge tone="brand">{d.stats.total} meetings</Badge>{d.stats.rescheduled > 0 && <Badge tone="amber">{d.stats.rescheduled} rescheduled</Badge>}<Badge tone={d.openSlots.length ? 'green' : 'slate'}>{d.openSlots.length} open</Badge></div>
              </div>
              <div className="space-y-3 p-4 md:p-5">
                {d.appointments.length ? d.appointments.map((a) => <MeetingCard key={a.id} a={a} viewer="STAFF" now={now} {...(canBook ? act : {})} />) : <p className="rounded-2xl bg-ink-50 px-4 py-6 text-center text-sm text-slate-500">No consultations on this day.</p>}
                {d.openSlots.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Open slots</p>
                    <div className="flex flex-wrap gap-1.5">{d.openSlots.map((s) => canBook ? <button key={s} onClick={() => setBook({ slot: s, dietitianId: d.id })} className="tap rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100">{fmtTime(s)}</button> : <span key={s} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{fmtTime(s)}</span>)}</div>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Consultation">{detail && <MeetingCard a={detail} viewer="STAFF" now={now} {...(canBook ? act : {})} />}</Modal>
      <ScheduleModal open={!!book} onClose={() => setBook(null)} defaultSlot={book?.slot} dietitianId={book?.dietitianId} />
      <ScheduleModal open={!!resched} onClose={() => setResched(null)} appointment={resched} />
    </div>
  );
}
