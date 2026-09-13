// "4:05", "1:30:00", and from a day on "5 d 03:00" — seconds stop mattering
// once a duration runs for days.
export function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = Math.floor(sec / 86400);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} d ${pad(Math.floor((sec % 86400) / 3600))}:${pad(m)}`;
  const h = Math.floor(sec / 3600);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
