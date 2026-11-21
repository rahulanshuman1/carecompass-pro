import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import { api, fieldErrors, post, patch } from '../lib/api';
import { useToast } from '../lib/toast';
import { hhmm, dayKey, todayKey, zonedToIso } from '../lib/time';
import { Alert, Button, Field, Input, Modal, Select } from './ui';

const DURATIONS = [15, 30, 45, 60];

/**
 * Book a new consultation, or reschedule `appointment`.
 * `defaultSlot` (ISO) pre-fills the date and time, `dietitianId` limits the patient list (used from an open slot).
 */
export default function ScheduleModal({ open, onClose, appointment, defaultSlot, dietitianId }) {
  const qc = useQueryClient();
  const toast = useToast();
  const resched = !!appointment;
  const seed = appointment?.startsAt || defaultSlot;
  const blank = () => ({ patientId: '', date: seed ? dayKey(seed) : todayKey(), time: seed ? hhmm(seed) : '10:00', durationMin: appointment?.durationMin || 30, mode: appointment?.mode || 'VIDEO', meetingLink: appointment?.meetingLink || '', topic: appointment?.topic || 'Diet consultation', reason: '' });
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState({});
  useEffect(() => { if (open) { setF(blank()); setErr(''); setFe({}); } }, [open, appointment?.id, defaultSlot]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const people = useQuery({ queryKey: ['assignable'], queryFn: () => api('/appointments/assignable'), enabled: open && !resched });
  const items = (people.data?.items || []).filter((p) => !dietitianId || p.dietitianId === dietitianId);

  const save = useMutation({
    mutationFn: () => {
      const startsAt = zonedToIso(f.date, f.time);
      if (resched) return patch(`/appointments/${appointment.id}/reschedule`, { startsAt, durationMin: Number(f.durationMin), reason: f.reason });
      return post('/appointments', { patientId: f.patientId, startsAt, durationMin: Number(f.durationMin), mode: f.mode, meetingLink: f.mode === 'VIDEO' ? f.meetingLink : '', topic: f.topic });
    },
    onSuccess: () => {
      ['appts', 'schedule', 'notifications'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(resched ? 'Meeting rescheduled. Everyone involved was notified.' : 'Meeting scheduled. The patient and dietitian were notified.');
      onClose();
    },
    onError: (e) => { setErr(e.message); setFe(fieldErrors(e)); },
  });

  const submit = () => {
    if (!resched && !f.patientId) return setErr('Choose a patient.');
    if (!f.date || !f.time) return setErr('Choose a date and time.');
    setErr('');
    save.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={resched ? 'Reschedule meeting' : 'Schedule a meeting'} footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button loading={save.isPending} onClick={submit}>{resched ? <CalendarClock className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}{resched ? 'Save new time' : 'Schedule'}</Button></>}>
      <div className="space-y-4">
        {err && <Alert tone="error">{err}</Alert>}
        {resched ? (
          <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-800"><strong>{appointment.patient?.name}</strong> with {appointment.dietitian?.name}</p>
        ) : (
          <Field label="Patient" required error={fe.patientId}>
            <Select value={f.patientId} onChange={set('patientId')}>
              <option value="">{people.isLoading ? 'Loading…' : items.length ? 'Choose patient…' : 'No patients with a dietitian yet'}</option>
              {items.map((p) => <option key={p.patientId} value={p.patientId}>{p.patient} · {p.dietitian}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required error={fe.startsAt}><Input type="date" min={todayKey()} value={f.date} onChange={set('date')} /></Field>
          <Field label="Time" required><Input type="time" step="300" value={f.time} onChange={set('time')} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length"><Select value={f.durationMin} onChange={set('durationMin')}>{DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}</Select></Field>
          {!resched && <Field label="How"><Select value={f.mode} onChange={set('mode')}><option value="VIDEO">Video call</option><option value="PHONE">Phone call</option><option value="IN_PERSON">In person</option></Select></Field>}
        </div>
        {!resched && f.mode === 'VIDEO' && <Field label="Meeting link" required error={fe.meetingLink} hint="Google Meet, Zoom or Teams link"><Input type="url" placeholder="https://meet.google.com/…" value={f.meetingLink} onChange={set('meetingLink')} /></Field>}
        {!resched && <Field label="Topic" error={fe.topic}><Input value={f.topic} onChange={set('topic')} maxLength={120} /></Field>}
        {resched && <Field label="Reason (shared with the patient)"><Input value={f.reason} onChange={set('reason')} maxLength={200} placeholder="Optional" /></Field>}
      </div>
    </Modal>
  );
}
