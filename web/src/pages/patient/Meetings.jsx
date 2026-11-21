import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CalendarCheck2, CalendarX, Clock, MapPin, Phone, Video } from 'lucide-react';
import { api, patch } from '../../lib/api';
import { useToast } from '../../lib/toast';
import { addDays, countdown, dayKey, endsAt, fmtDayLong, fmtTime, minutesUntil, todayKey, useNow } from '../../lib/time';
import { Alert, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoader } from '../../components/ui';
import { Pulse, Reveal } from '../../components/Motion';
import MeetingCard from '../../components/MeetingCard';

const MODE_ICON = { VIDEO: Video, PHONE: Phone, IN_PERSON: MapPin };

/** Next consultation as a hero card with a live countdown. Also used on the patient Home. */
export function NextMeeting({ a, now }) {
  const mins = minutesUntil(a.startsAt, now);
  const live = mins <= 0;
  const Icon = MODE_ICON[a.mode] || Video;
  const canJoin = a.mode === 'VIDEO' && a.meetingLink && mins <= 15;
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-ink-900 via-ink-800 to-brand-800 p-6 text-white shadow-lift md:p-8">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand-200"><span className="relative grid h-2.5 w-2.5 place-items-center text-brand-300"><Pulse /><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /></span>{live ? 'Happening now' : 'Your next consultation'}</p>
          <h2 className="mt-2 text-2xl text-white md:text-3xl">{a.topic}</h2>
          <p className="mt-1 text-ink-200">with {a.dietitian?.name}{a.dietitian?.specialty ? ` · ${a.dietitian.specialty}` : ''}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-300" />{new Date(a.startsAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}, {fmtTime(a.startsAt)}</span>
            <span className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-300" />{a.mode === 'VIDEO' ? 'Video call' : a.mode === 'PHONE' ? 'Phone call' : 'In person'} · {a.durationMin} min</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/10 px-7 py-5 text-center backdrop-blur">
          <p className="text-3xl font-extrabold">{live ? 'Now' : countdown(mins).replace('in ', '')}</p>
          <p className="-mt-2 text-xs font-semibold text-ink-200">{live ? 'Join your dietitian' : 'until it starts'}</p>
          {a.mode === 'VIDEO' && a.meetingLink && (
            <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className={`tap inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-extrabold ${canJoin ? 'bg-white text-brand-700 shadow-lift' : 'border border-white/30 text-white hover:bg-white/10'}`}><Video className="h-4 w-4" />{canJoin ? 'Join now' : 'Meeting link'}</a>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 animate-float rounded-full bg-brand-500/25 blur-3xl" />
    </div>
  );
}

export default function Meetings() {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow(30_000);
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['appts', 'mine'], queryFn: () => api('/appointments/mine'), refetchInterval: 60_000 });
  const past = useQuery({ queryKey: ['appts', 'past'], queryFn: () => api('/appointments/mine?scope=past') });
  const cancelM = useMutation({
    mutationFn: () => patch(`/appointments/${cancel.id}/cancel`, { reason }),
    onSuccess: () => { ['appts', 'notifications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success('Meeting cancelled. Your dietitian was notified.'); setCancel(null); setReason(''); },
    onError: toast.error,
  });
  if (isLoading) return <PageLoader />;
  if (error) return <Alert tone="error">{error.message}</Alert>;

  const items = data.items;
  const today = todayKey();
  const next = items.find((a) => a.status === 'SCHEDULED' && endsAt(a).getTime() > now);
  const todays = items.filter((a) => dayKey(a.startsAt) === today);
  const later = items.filter((a) => dayKey(a.startsAt) > today);
  const groups = [...new Set(later.map((a) => dayKey(a.startsAt)))];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="My consultations" sub="Meetings with your dietitian, with reminders so you never miss one" />
      {next ? <Reveal><NextMeeting a={next} now={now} /></Reveal> : <EmptyState icon={CalendarCheck2} title="No consultation booked">Your care team will schedule your next consultation. You will get a notification as soon as it is booked.</EmptyState>}
      <Alert tone="info"><span className="inline-flex items-center gap-1.5"><Bell className="h-4 w-4" />We remind you 30 minutes before each consultation. Turn on alerts from the bell at the top so reminders reach you even in another tab.</span></Alert>

      {todays.length > 0 && (
        <section>
          <h2 className="mb-3">Today</h2>
          <div className="space-y-3">{todays.map((a, i) => <Reveal key={a.id} i={i}><MeetingCard a={a} viewer="PATIENT" now={now} onCancel={setCancel} /></Reveal>)}</div>
        </section>
      )}

      {groups.length > 0 && (
        <section>
          <h2 className="mb-3">Upcoming</h2>
          <div className="space-y-5">
            {groups.map((g, gi) => (
              <div key={g}>
                <p className="mb-2 text-sm font-extrabold text-ink-800">{g === addDays(today, 1) ? 'Tomorrow' : fmtDayLong(g).replace(/ \d{4}$/, '')}</p>
                <div className="space-y-3">{later.filter((a) => dayKey(a.startsAt) === g).map((a, k) => <Reveal key={a.id} i={gi + k}><MeetingCard a={a} viewer="PATIENT" now={now} onCancel={setCancel} /></Reveal>)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.data?.items?.length > 0 && (
        <section>
          <h2 className="mb-3">Past consultations</h2>
          <div className="space-y-3">{past.data.items.slice(0, 5).map((a) => <MeetingCard key={a.id} a={a} viewer="PATIENT" now={now} showDate />)}</div>
        </section>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3"><div><h3>Want to talk to your dietitian?</h3><p className="text-sm text-slate-500">Check today's plan, then message the care team to book a slot.</p></div><Link to="/my-plan" className="inline-flex h-11 items-center rounded-full bg-brand-50 px-5 text-sm font-extrabold text-brand-700 hover:bg-brand-100">View my diet plan</Link></Card>

      <Modal open={!!cancel} onClose={() => setCancel(null)} title="Cancel this consultation?" footer={<><Button variant="ghost" onClick={() => setCancel(null)}>Keep it</Button><Button variant="danger" loading={cancelM.isPending} disabled={reason.trim().length < 3} onClick={() => cancelM.mutate()}><CalendarX className="h-4 w-4" />Cancel meeting</Button></>}>
        <Field label="Reason" required><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. I am travelling" /></Field>
      </Modal>
    </div>
  );
}
