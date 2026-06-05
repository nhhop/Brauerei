import type { TimeSettings } from './types';

const DEFAULT_SETTINGS: TimeSettings = {
  ntpServer: 'pool.ntp.org',
  utcOffsetSec: 3600,
  dstOffsetSec: 3600,
  timeFormat: '24h',
  dateFormat: 'DD.MM.YYYY',
};

export function formatTime(ts: number, settings: TimeSettings = DEFAULT_SETTINGS): string {
  const d = new Date(ts * 1000);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  if (settings.timeFormat === '12h') {
    const h12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    return `${h12}:${m}:${s} ${ampm}`;
  }
  return `${h.toString().padStart(2, '0')}:${m}:${s}`;
}

export function formatDate(ts: number, settings: TimeSettings = DEFAULT_SETTINGS): string {
  const d = new Date(ts * 1000);
  const day = d.getDate().toString().padStart(2, '0');
  const mon = (d.getMonth() + 1).toString().padStart(2, '0');
  const yr = d.getFullYear();
  switch (settings.dateFormat) {
    case 'MM/DD/YYYY': return `${mon}/${day}/${yr}`;
    case 'YYYY-MM-DD': return `${yr}-${mon}-${day}`;
    default:           return `${day}.${mon}.${yr}`;
  }
}

export function formatDateTime(ts: number, settings: TimeSettings = DEFAULT_SETTINGS): string {
  return `${formatDate(ts, settings)} ${formatTime(ts, settings)}`;
}
