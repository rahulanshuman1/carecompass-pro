import { Link } from 'react-router-dom';
import { CalendarClock, CalendarX, CheckCircle2, MapPin, Phone, Video, XCircle } from 'lucide-react';
import { Badge, Button, cx } from './ui';
import { Pulse } from './Motion';
import { countdown, dayKey, endsAt, fmtDayShort, fmtTime, joinWindow, minutesUntil } from '../lib/time';

const MODE = { VIDEO: [Video, 'Video call'], PHONE: [Phone, 'Phone call'], IN_PERSON: [MapPin, 'In person'] };
const STATUS = { COMPLETED: ['green', 'Completed', CheckCircle2], CANCELLED: ['rose', 'Cancelled', CalendarX], NO_SHOW: ['amber', 'No show', XCircle] };

/**
 * One consultation. viewer: PATIENT | DIETITIAN | STAFF (care team and lead doctor).
 * Action callbacks are optional; buttons only show when the handler is passed and the meeting is still upcoming.
 */
export default function MeetingCard({ a, viewer, now, showDate = false, onReschedule, onCancel, onComplete, className = '' }) {
  const [ModeIcon, modeLabel] = MODE[a.mode] || MODE.VIDEO;
  const st = STATUS[a.status];
  const StIcon = st?.[2];
  const mins = minutesUntil(a.startsAt, now);
  const live = a.status === 'SCHEDULED' && now >= new Date(a.startsAt).getTime() && now <= endsAt(a).getTime();
  const soon = a.status === 'SCHEDULED' && mins > 0 && mins <= 60;
  const open = joinWindow(a, now);
  const last = a.history?.[a.history.length - 1];
  const patientName = a.patient?.name || 'Patient';
  const dietName = a.dietitian?.name || 'Dietitian';
  const who = viewer === 'PATIENT' ? `with ${dietName}` : viewer === 'DIETITIAN' ? patientName : `${patientName} · with ${dietName}`;
  const upcoming = a.status === 'SCHEDULED';

  return (
    <div className={cx('group relative flex gap-4 rounded-3xl border bg-white p-4 shadow-soft transition hover:shadow-lift', live ? 'border-brand-300 ring-2 ring-brand-200' : 'border-ink-100', a.status === 'CANCELLED' && 'opacity-70', className)}>
      <div className={cx('flex w-[4.6rem] shrink-0 flex-col items-center justify-center rounded-2xl px-1 py-2 text-center', live ? 'bg-brand-600 text-white' : upcoming ? 'bg-brand-50 text-brand-700' : 'bg-ink-50 text-slate-500')}>
        {showDate && <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{fmtDayShort(a.startsAt).split(',')[0]}</span>}
        <span className="text-[15px] font-extrabold leading-tight">{fmtTime(a.startsAt).replace(' ', '\u00A0')}</span>
        <span className="mt-0.5 text-[11px] font-semibold opacity-80">{a.durationMin} min</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className={cx('truncate', a.status === 'CANCELLED' && 'line-through')}>{a.topic}</h3>
          {st && <Badge tone={st[0]}><StIcon className="mr-1 h-3 w-3" />{st[1]}</Badge>}
          {live && <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white"><span className="relative grid h-2 w-2 place-items-center text-white"><Pulse /><span className="h-2 w-2 rounded-full bg-white" /></span>Live now</span>}
          {soon && !live && <Badge tone="brand">Starts {countdown(mins)}</Badge>}
        </div>
        <p className="mt-0.5 text-sm text-slate-600">
          {viewer === 'DIETITIAN' ? <Link to={`/patient/${a.patient?.id}`} className="font-semibold text-ink-800 hover:text-brand-700 hover:underline">{who}</Link> : who}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><ModeIcon className="h-3.5 w-3.5" />{modeLabel}</span>
          <span>{fmtTime(a.startsAt)} – {fmtTime(endsAt(a))}</span>
          {a.rescheduleCount > 0 && last && (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title={last.reason || 'Rescheduled'}><CalendarClock className="h-3.5 w-3.5" />Rescheduled from {dayKey(last.from) === dayKey(a.startsAt) ? fmtTime(last.from) : `${fmtDayShort(last.from)}, ${fmtTime(last.from)}`}{a.rescheduleCount > 1 ? ` (×${a.rescheduleCount})` : ''}</span>
          )}
        </div>
        {a.status === 'CANCELLED' && a.cancelReason && <p className="mt-1 text-xs text-rose-600">Reason: {a.cancelReason}</p>}
        {a.outcomeNotes && viewer !== 'PATIENT' && <p className="mt-1.5 rounded-xl bg-ink-50 px-3 py-2 text-xs text-slate-600">{a.outcomeNotes}</p>}

        {upcoming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {a.mode === 'VIDEO' && a.meetingLink && (
              <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className={cx('tap inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-bold', open ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lift' : 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50')}><Video className="h-4 w-4" />{open ? 'Join now' : 'Meeting link'}</a>
            )}
            {onComplete && (live || mins <= 15) && <Button size="sm" variant="soft" onClick={() => onComplete(a)}><CheckCircle2 className="h-4 w-4" />Close meeting</Button>}
            {onReschedule && <Button size="sm" variant="secondary" onClick={() => onReschedule(a)}><CalendarClock className="h-4 w-4" />Reschedule</Button>}
            {onCancel && <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => onCancel(a)}>Cancel</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
