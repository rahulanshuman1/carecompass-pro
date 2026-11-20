export const dateStr = (d, tz) => new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
export const todayStr = (tz) => dateStr(Date.now(), tz);
export const lastNDates = (n, tz) => Array.from({ length: n }, (_, i) => dateStr(Date.now() - i * 864e5, tz));
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
