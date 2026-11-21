import { useEffect, useState } from 'react';

/** All meeting times are shown in the clinic's time zone, the same one the server uses for "today". */
export const TZ = import.meta.env.VITE_TZ || 'Asia/Kolkata';

export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
export const fmtDayShort = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
export const fmtDayLong = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
export const todayKey = () => dayKey(Date.now());
export const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const endsAt = (a) => new Date(new Date(a.startsAt).getTime() + a.durationMin * 60_000);
export const hhmm = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
export const minutesUntil = (iso, now = Date.now()) => Math.round((new Date(iso).getTime() - now) / 60_000);

export function countdown(m) {
  if (m <= 0) return 'Starting now';
  if (m < 60) return `in ${m} min`;
  if (m < 1440) return `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  return `in ${Math.floor(m / 1440)} d`;
}

function offsetMin(ms) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(ms);
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000) / 60_000);
}
/** "2026-11-21" + "10:30" entered in the clinic time zone → ISO instant (UTC). */
export function zonedToIso(date, time) {
  const guess = Date.parse(`${date}T${time}:00Z`);
  const first = guess - offsetMin(guess) * 60_000;
  return new Date(guess - offsetMin(first) * 60_000).toISOString();
}

/** Re-renders every `every` ms so countdowns stay live. */
export function useNow(every = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

/** Can the person join now? From 15 minutes before the start until the planned end. */
export const joinWindow = (a, now) => a.status === 'SCHEDULED' && now >= new Date(a.startsAt).getTime() - 15 * 60_000 && now <= endsAt(a).getTime();
