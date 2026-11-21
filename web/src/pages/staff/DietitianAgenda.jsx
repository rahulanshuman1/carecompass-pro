import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CalendarCheck2, CalendarClock, CalendarPlus, CheckCircle2, Clock, Users, Video } from 'lucide-react';
import { api, patch } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { addDays, countdown, dayKey, endsAt, fmtDayLong, fmtTime, minutesUntil, todayKey, useNow } from '../../lib/time';
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageLoader, Select } from '../../components/ui';
import { Counter, Pulse, Reveal } from '../../components/Motion';
import MeetingCard from '../../components/MeetingCard';
import ScheduleModal from '../../components/ScheduleModal';

function Tile({ icon: Icon, label, value, sub, tone, i }) {
  return (
    <Reveal i={i} className="tap rounded-3xl border border-ink-100 bg-white p-4 shadow-soft md:p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></span>
      <p className="mt-3 text-3xl font-extrabold text-ink-900"><Counter value={value} /></p>
      <p className="text-sm font-bold text-ink-800">{label}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </Reveal>
  );
}

export default function DietitianAgenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow(30_000);
  const [book, setBook] = useState(false);
  const [resched, setResched] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [close, setClose] = useState(null);
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState({ status: 'COMPLETED', notes: '' });

  const { data, isLoading, error } = useQuery({ queryKey: ['appts', 'mine'], queryFn: () => api('/appointments/mine'), refetchInterval: 60_000 });
  const past = useQuery({ queryKey: ['appts', 'past'], queryFn: () => api('/appointments/mine?scope=past') });
  const done = (msg) => { ['appts', 'schedule', 'notifications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success(msg); };
  const cancelM = useMutation({ mutationFn: () => patch(`/appointments/${cancel.id}/cancel`, { reason }), onSuccess: () => { done('Meeting cancelled. The patient was notified.'); setCancel(null); setReason(''); }, onError: toast.error });
  const closeM = useMutation({ mutationFn: () => patch(`/appointments/${close.id}/complete`, outcome), onSuccess: () => { done('Meeting closed'); setClose(null); setOutcome({ status: 'COMPLETED', notes: '' }); }, onError: toast.error });

  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const items = data.items;
  const today = todayKey();
  const todays = items.filter((a) => dayKey(a.startsAt) === today).sort((x, y) => new Date(x.startsAt) - new Date(y.startsAt));
  const liveToday = todays.filter((a) => a.status !== 'CANCELLED');
  const doneToday = todays.filter((a) => a.status === 'COMPLETED').length;
  const next = items.find((a) => a.status === 'SCHEDULED' && endsAt(a).getTime() > now);
  const week = items.filter((a) => a.status === 'SCHEDULED' && dayKey(a.startsAt) > today && dayKey(a.startsAt) <= addDays(today, 7));
  const patients = new Set(items.filter((a) => a.status !== 'CANCELLED').map((a) => a.patient?.id)).size;
  const mins = next ? minutesUntil(next.startsAt, now) : 0;
  const inProgress = next && mins <= 0;
  const later = items.filter((a) => dayKey(a.startsAt) > today);
  const groups = [...new Set(later.map((a) => dayKey(a.startsAt)))].slice(0, 7);
  const hour = Number(new Date(now).toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const act = { onReschedule: setResched, onCancel: setCancel, onComplete: setClose };

  // where the "now" marker goes in today's timeline
  const nowIdx = todays.findIndex((a) => endsAt(a).getTime() > now);

  return (
    <div className="space-y-6">
      {/* Hero: next consultation */}
      <Reveal as="section" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 p-6 text-white shadow-lift md:p-9">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-brand-200">{greet}, {user.name.split(' ')[0]}</p>
            <h1 className="mt-1 text-3xl text-white md:text-4xl">{liveToday.length ? `You have ${liveToday.length} consultation${liveToday.length > 1 ? 's' : ''} today` : 'No consultations today'}</h1>
            <p className="mt-1 text-sm text-ink-200">{fmtDayLong(today)}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="!bg-white !from-white !to-white !text-brand-700 !shadow-sm" onClick={() => setBook(true)}><CalendarPlus className="h-4 w-4" />Schedule a meeting</Button>
              <Link to="/patients" className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10"><Users className="h-4 w-4" />My patients</Link>
            </div>
          </div>
          <div className="w-full rounded-3xl bg-white/10 p-5 backdrop-blur sm:w-[22rem]">
            {next ? (
              <>
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand-200"><span className="relative grid h-2.5 w-2.5 place-items-center text-brand-300"><Pulse /><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /></span>{inProgress ? 'In progress' : 'Next consultation'}</p>
                <p className="mt-2 text-2xl font-extrabold">{next.patient?.name}</p>
                <p className="text-sm text-ink-200">{next.topic}</p>
                <p className="mt-3 flex items-center gap-2 text-sm font-bold"><Clock className="h-4 w-4 text-brand-300" />{fmtTime(next.startsAt)} · {inProgress ? 'started' : countdown(mins)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {next.meetingLink && <a href={next.meetingLink} target="_blank" rel="noopener noreferrer" className="tap inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-extrabold text-brand-700"><Video className="h-4 w-4" />Join call</a>}
                  <Link to={`/patient/${next.patient?.id}`} className="inline-flex h-10 items-center rounded-full border border-white/25 px-4 text-sm font-bold hover:bg-white/10">Open patient</Link>
                </div>
              </>
            ) : (
              <div className="py-3 text-center"><CalendarCheck2 className="mx-auto h-9 w-9 text-brand-300" /><p className="mt-2 font-extrabold">All caught up</p><p className="text-sm text-ink-200">No upcoming consultations.</p></div>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 animate-float rounded-full bg-brand-500/25 blur-3xl" />
      </Reveal>

      <Alert tone="info"><span className="inline-flex items-center gap-1.5"><Bell className="h-4 w-4" />You get a reminder 30 minutes before every consultation, plus a daily agenda note. Turn on desktop alerts from the bell above.</span></Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile i={0} icon={CalendarClock} label="Today" value={liveToday.length} sub="consultations" tone="bg-brand-50 text-brand-600" />
        <Tile i={1} icon={CheckCircle2} label="Completed" value={doneToday} sub="so far today" tone="bg-emerald-50 text-emerald-600" />
        <Tile i={2} icon={CalendarCheck2} label="Next 7 days" value={week.length} sub="upcoming" tone="bg-indigo-50 text-indigo-600" />
        <Tile i={3} icon={Users} label="Patients" value={patients} sub="with meetings booked" tone="bg-amber-50 text-amber-600" />
      </div>

      {/* Today's agenda */}
      <section>
        <h2 className="mb-3">Today's agenda</h2>
        {!todays.length ? (
          <EmptyState icon={CalendarCheck2} title="Nothing scheduled today">Enjoy the quiet, or book a follow-up for one of your patients.</EmptyState>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-dashed border-brand-200 pl-5 md:pl-7">
            {todays.map((a, idx) => (
              <li key={a.id} className="relative">
                {idx === nowIdx && (
                  <div className="-ml-[1.65rem] mb-3 flex items-center gap-2 md:-ml-[2.1rem]"><span className="relative grid h-3.5 w-3.5 place-items-center text-brand-600"><Pulse /><span className="h-3.5 w-3.5 rounded-full bg-brand-600" /></span><span className="rounded-full bg-brand-600 px-3 py-0.5 text-[11px] font-extrabold text-white">Now · {fmtTime(now)}</span><span className="h-px flex-1 bg-brand-300" /></div>
                )}
                <span className={`absolute -left-[1.62rem] top-6 h-3 w-3 rounded-full ring-4 ring-[#fbf9fd] md:-left-[2.07rem] ${a.status === 'COMPLETED' ? 'bg-emerald-500' : a.status === 'CANCELLED' ? 'bg-slate-300' : 'bg-brand-500'}`} />
                <Reveal i={idx}><MeetingCard a={a} viewer="DIETITIAN" now={now} {...act} /></Reveal>
              </li>
            ))}
            {nowIdx === -1 && <li className="-ml-[1.65rem] flex items-center gap-2 md:-ml-[2.1rem]"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500" /><span className="rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-extrabold text-emerald-700">Day complete · {fmtTime(now)}</span></li>}
          </ol>
        )}
      </section>

      {/* Coming up */}
      <section>
        <h2 className="mb-3">Coming up</h2>
        {!groups.length ? <Card><p className="text-sm text-slate-500">No consultations booked beyond today.</p></Card> : (
          <div className="space-y-5">
            {groups.map((g, gi) => (
              <div key={g}>
                <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink-800">{g === addDays(today, 1) ? 'Tomorrow' : fmtDayLong(g).split(',')[0]}<span className="text-xs font-semibold text-slate-500">{fmtDayLong(g).split(',')[1]?.trim().replace(/ \d{4}$/, '')}</span><span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">{later.filter((a) => dayKey(a.startsAt) === g && a.status !== 'CANCELLED').length}</span></p>
                <div className="space-y-3">{later.filter((a) => dayKey(a.startsAt) === g).map((a, k) => <Reveal key={a.id} i={gi + k}><MeetingCard a={a} viewer="DIETITIAN" now={now} {...act} /></Reveal>)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {past.data?.items?.length > 0 && (
        <section>
          <h2 className="mb-3">Recently completed</h2>
          <div className="space-y-3">{past.data.items.slice(0, 4).map((a) => <MeetingCard key={a.id} a={a} viewer="DIETITIAN" now={now} showDate />)}</div>
        </section>
      )}

      <ScheduleModal open={book} onClose={() => setBook(false)} />
      <ScheduleModal open={!!resched} onClose={() => setResched(null)} appointment={resched} />

      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Cancel this meeting?" footer={<><Button variant="ghost" onClick={() => setCancel(null)}>Keep it</Button><Button variant="danger" loading={cancelM.isPending} disabled={reason.trim().length < 3} onClick={() => cancelM.mutate()}>Cancel meeting</Button></>}>
        <p className="mb-3 text-sm text-slate-600">{cancel?.patient?.name} will be notified, and the care team will see the freed slot.</p>
        <Field label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Dietitian unavailable" /></Field>
      </Modal>

      <Modal open={!!close} onClose={() => setClose(null)} title="Close meeting" footer={<><Button variant="ghost" onClick={() => setClose(null)}>Not yet</Button><Button loading={closeM.isPending} onClick={() => closeM.mutate()}><CheckCircle2 className="h-4 w-4" />Save</Button></>}>
        <div className="space-y-4">
          <Field label="Outcome"><Select value={outcome.status} onChange={(e) => setOutcome((o) => ({ ...o, status: e.target.value }))}><option value="COMPLETED">Completed</option><option value="NO_SHOW">Patient did not attend</option></Select></Field>
          <Field label="Consultation notes" hint="Only you and the lead doctor can read these"><Input value={outcome.notes} onChange={(e) => setOutcome((o) => ({ ...o, notes: e.target.value }))} maxLength={1000} placeholder="Key points, advice given, follow-up" /></Field>
        </div>
      </Modal>
    </div>
  );
}
