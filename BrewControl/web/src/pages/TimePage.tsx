// BrewControl/web/src/pages/TimePage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { TimeSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { formatTime, formatDate } from '../time';

interface TzEntry {
  label: string;
  utcOffsetSec: number;
  dstOffsetSec: number;
}

const TIMEZONES: TzEntry[] = [
  { label: 'UTC (±0)',                    utcOffsetSec:       0, dstOffsetSec: 0 },
  { label: 'London (GMT/BST)',            utcOffsetSec:       0, dstOffsetSec: 3600 },
  { label: 'Lissabon (WET/WEST)',         utcOffsetSec:       0, dstOffsetSec: 3600 },
  { label: 'Berlin / Wien / Paris (CET)', utcOffsetSec:    3600, dstOffsetSec: 3600 },
  { label: 'Helsinki / Athen (EET)',      utcOffsetSec:    7200, dstOffsetSec: 3600 },
  { label: 'Moskau (MSK)',                utcOffsetSec:   10800, dstOffsetSec: 0 },
  { label: 'Dubai (GST)',                 utcOffsetSec:   14400, dstOffsetSec: 0 },
  { label: 'Karachi (PKT)',               utcOffsetSec:   18000, dstOffsetSec: 0 },
  { label: 'Neu-Delhi (IST)',             utcOffsetSec:   19800, dstOffsetSec: 0 },
  { label: 'Kathmandu (NPT)',             utcOffsetSec:   20700, dstOffsetSec: 0 },
  { label: 'Dhaka (BST)',                 utcOffsetSec:   21600, dstOffsetSec: 0 },
  { label: 'Bangkok / Jakarta (ICT/WIB)', utcOffsetSec:   25200, dstOffsetSec: 0 },
  { label: 'Singapur / Peking (SGT/CST)', utcOffsetSec:   28800, dstOffsetSec: 0 },
  { label: 'Tokio / Seoul (JST/KST)',     utcOffsetSec:   32400, dstOffsetSec: 0 },
  { label: 'Sydney (AEST)',               utcOffsetSec:   36000, dstOffsetSec: 3600 },
  { label: 'Auckland (NZST)',             utcOffsetSec:   43200, dstOffsetSec: 3600 },
  { label: 'Azoren (AZOT)',               utcOffsetSec:   -3600, dstOffsetSec: 3600 },
  { label: 'Kapverdische Inseln (CVT)',   utcOffsetSec:   -3600, dstOffsetSec: 0 },
  { label: 'New York (ET)',               utcOffsetSec:  -18000, dstOffsetSec: 3600 },
  { label: 'Chicago (CT)',                utcOffsetSec:  -21600, dstOffsetSec: 3600 },
  { label: 'Denver (MT)',                 utcOffsetSec:  -25200, dstOffsetSec: 3600 },
  { label: 'Los Angeles (PT)',            utcOffsetSec:  -28800, dstOffsetSec: 3600 },
  { label: 'Anchorage (AKT)',             utcOffsetSec:  -32400, dstOffsetSec: 3600 },
  { label: 'Honolulu (HST)',              utcOffsetSec:  -36000, dstOffsetSec: 0 },
  { label: 'São Paulo (BRT)',             utcOffsetSec:  -10800, dstOffsetSec: 0 },
];

const DEFAULT: TimeSettings = {
  ntpServer: 'pool.ntp.org',
  utcOffsetSec: 3600,
  dstOffsetSec: 3600,
  timeFormat: '24h',
  dateFormat: 'DD.MM.YYYY',
};

function findTzIndex(utcOff: number, dstOff: number): number {
  const i = TIMEZONES.findIndex(
    (z) => z.utcOffsetSec === utcOff && z.dstOffsetSec === dstOff,
  );
  return i >= 0 ? i : -1;
}

export function TimePage(_: { path?: string }) {
  const [settings, setSettings] = useState<TimeSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    getSettings().then((s) => { if (s.time) setSettings(s.time); }).catch(() => {});
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getSettings()
      .then((s) => { if (s.time) setSettings(s.time); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<TimeSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      updateSettings({ time: next }).catch(() => {});
      return next;
    });
  }

  function onTzChange(idx: number) {
    if (idx < 0 || idx >= TIMEZONES.length) return;
    const tz = TIMEZONES[idx];
    update({ utcOffsetSec: tz.utcOffsetSec, dstOffsetSec: tz.dstOffsetSec });
  }

  const tzIdx = findTzIndex(settings.utcOffsetSec, settings.dstOffsetSec);

  if (loading) return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <p class="text-sm text-muted">Laden…</p>
    </div>
  );

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="mb-6 flex items-center gap-3">
        <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Zeit &amp; Formate</h1>
      </header>

      <div class="mt-4 rounded-lg border border-border bg-surface px-4 py-3">
        <div class="text-2xl font-mono font-medium tabular-nums">{formatTime(now, settings)}</div>
        <div class="text-xs text-muted">{formatDate(now, settings)}</div>
      </div>

      <div class="space-y-5 rounded-lg border border-border bg-surface p-4">
        {/* Zeitzone */}
        <div>
          <div class="mb-2 text-xs text-muted">Zeitzone</div>
          <select
            value={tzIdx >= 0 ? tzIdx : ''}
            onChange={(e) => onTzChange(Number((e.target as HTMLSelectElement).value))}
            class="block w-full rounded border border-border bg-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-border"
          >
            {tzIdx < 0 && <option value="">— Benutzerdefiniert —</option>}
            {TIMEZONES.map((tz, i) => (
              <option key={i} value={i}>{tz.label}</option>
            ))}
          </select>
          <div class="mt-1 text-xs text-faint">
            UTC{settings.utcOffsetSec >= 0 ? '+' : ''}{settings.utcOffsetSec / 3600}
            {settings.dstOffsetSec > 0 ? `, Sommerzeit +${settings.dstOffsetSec / 3600}h` : ''}
          </div>
        </div>

        {/* Zeitformat */}
        <div>
          <div class="mb-2 text-xs text-muted">Zeitformat</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['24h', '12h'] as const).map((f) => (
              <button key={f} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.timeFormat === f ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ timeFormat: f })}>
                {f === '24h' ? '24 Stunden' : '12 Stunden'}
              </button>
            ))}
          </div>
        </div>

        {/* Datumsformat */}
        <div>
          <div class="mb-2 text-xs text-muted">Datumsformat</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const).map((f) => (
              <button key={f} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.dateFormat === f ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ dateFormat: f })}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* NTP-Server */}
        <div>
          <div class="mb-2 text-xs text-muted">NTP-Server</div>
          <input
            type="text"
            value={settings.ntpServer}
            onBlur={(e) => update({ ntpServer: (e.target as HTMLInputElement).value.trim() || 'pool.ntp.org' })}
            class="block w-full rounded border border-border bg-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-border"
          />
          <div class="mt-1 text-xs text-faint">Standard: pool.ntp.org</div>
        </div>
      </div>
    </div>
  );
}
