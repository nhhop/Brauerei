// BrewControl/web/src/pages/SystemStatusPage.tsx
import { useEffect, useState } from 'preact/hooks';
import type { UpdateStatus, HeapDiag, NetworkStatus, Alert, TimeSettings } from '../types';
import { getUpdateStatus, getHeapDiag, getNetwork, getAlerts } from '../api';
import { alertText } from '../components/AlertCenter';
import { loadTimeSettings, formatDateTime } from '../time';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { Breadcrumb } from '../components/Breadcrumb';
import { SettingsGroup, SettingsCard } from '../components/SettingsCard';
import { Cpu, Package, RotateCcw, Clock, MemoryStick, TriangleAlert } from 'lucide-preact';

const RESET_LABELS: Record<UpdateStatus['resetReason'], string> = {
  power_on: 'Einschalten',
  external: 'Reset-Taste',
  sw: 'Neustart durch die Firmware (Update, Einstellungen)',
  panic: 'Absturz',
  int_wdt: 'Watchdog (Interrupt)',
  task_wdt: 'Watchdog — die Steuerung hing länger als 30 s',
  wdt: 'Watchdog',
  deep_sleep: 'Aufwachen aus dem Tiefschlaf',
  brownout: 'Spannungseinbruch',
  sdio: 'SDIO',
  unknown: 'unbekannt',
};

// Restarts nobody asked for: worth a red line, the device recovered on its own.
const UNEXPECTED_RESETS: UpdateStatus['resetReason'][] =
  ['panic', 'int_wdt', 'task_wdt', 'wdt', 'brownout'];

function formatUptime(uptimeS: number): string {
  const days = Math.floor(uptimeS / 86400);
  const hours = Math.floor((uptimeS % 86400) / 3600);
  const minutes = Math.floor((uptimeS % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} Tage`);
  if (days > 0 || hours > 0) parts.push(`${hours} Std.`);
  parts.push(`${minutes} Min.`);
  return parts.join(' ');
}

function formatBytes(n: number): string {
  return `${(n / 1024).toFixed(0)} KB`;
}

// Currently active device faults: the last 'fault' event per src wins — a
// later 'cleared' means the fault is over.
function activeFaults(alerts: Alert[]): Alert[] {
  const bySrc = new Map<string, Alert>();
  for (const a of [...alerts].sort((x, y) => x.seq - y.seq)) {
    if (a.kind !== 'fault') continue;
    bySrc.set(a.src, a);
  }
  return [...bySrc.values()].filter((a) => a.state === 'raised');
}

export function SystemStatusPage(_: { path?: string }) {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [heap, setHeap] = useState<HeapDiag | null>(null);
  const [net, setNet] = useState<NetworkStatus | null>(null);
  const [faults, setFaults] = useState<Alert[] | null>(null);
  const [time, setTime] = useState<TimeSettings>();

  useEffect(() => {
    getUpdateStatus().then(setSt).catch(() => {});
    getHeapDiag().then(setHeap).catch(() => {});
    getNetwork().then(setNet).catch(() => {});
    getAlerts(0).then((a) => setFaults(activeFaults(a))).catch(() => setFaults([]));
    loadTimeSettings().then(setTime);
  }, []);

  const header = (
    <header>
      <Breadcrumb trail={[{ label: 'Einstellungen', href: '/settings' }, { label: 'Systemstatus' }]} />
    </header>
  );

  if (!st || !heap || !net || !faults) {
    return <PageShell>{header}<div class="mt-6"><SkeletonList count={5} /></div></PageShell>;
  }

  return (
    <PageShell>
      {header}

      <div class="mt-6">
        <SettingsGroup>
          <SettingsCard title="Board" icon={Cpu}
            desc={<span class="font-mono">{st.variant} · {net.hostname}.local · {net.ip} · {net.mac}</span>} />

          <SettingsCard title="Version" icon={Package}
            control={<span class="text-sm tabular-nums font-mono">{st.currentVersion}</span>} />

          <SettingsCard title="Letzter Neustart" icon={RotateCcw}
            control={
              <span class={`text-sm ${UNEXPECTED_RESETS.includes(st.resetReason) ? 'text-critical' : ''}`}>
                {RESET_LABELS[st.resetReason] ?? st.resetReason}
              </span>
            } />

          <SettingsCard title="Betriebszeit" icon={Clock}
            control={<span class="text-sm tabular-nums">{formatUptime(heap.uptimeS)}</span>} />

          <SettingsCard title="Speicher" icon={MemoryStick}
            desc={<>
              <span class="block">Heap frei: {formatBytes(heap.internal.free)}</span>
              {heap.psram.size > 0 && <span class="block">PSRAM frei: {formatBytes(heap.psram.free)}</span>}
              {heap.storage && (
                <span class="block">
                  Flash: {formatBytes(heap.storage.used)} / {formatBytes(heap.storage.total)} belegt
                </span>
              )}
            </>} />

          <SettingsCard title="Aktive Störungen" icon={TriangleAlert}>
            {faults.length === 0 ? (
              <p class="text-sm text-muted">Keine aktiven Störungen.</p>
            ) : (
              <ul class="space-y-2">
                {faults.map((a) => {
                  const { title, body } = alertText(a);
                  return (
                    <li key={a.src} class="text-sm">
                      <span class="font-medium text-critical">{title}</span> — {body}
                      <span class="block text-xs text-faint">
                        {a.ts === 0 ? 'Zeit unbekannt' : formatDateTime(a.ts, time)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsCard>
        </SettingsGroup>
      </div>
    </PageShell>
  );
}
