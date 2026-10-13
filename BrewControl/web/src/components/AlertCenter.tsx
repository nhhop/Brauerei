import { useState, useEffect } from 'preact/hooks';
import { Info, TriangleAlert, OctagonAlert, CircleCheck, X, Trash2, BellOff } from 'lucide-preact';
import type { Alert, Severity, TimeSettings } from '../types';
import { badgeAccent, badgeCaution, badgeCritical, badgeSuccess, btnSecondary, linkDanger, toastFrame, panelFrame } from '../ui';
import { formatDateTime, loadTimeSettings } from '../time';

// How long a non-critical toast stays up. Critical ones never auto-dismiss —
// an overheating kettle should not scroll away while nobody is looking.
const TOAST_MS = 6000;

// ── Severity presentation ────────────────────────────────────────────────────
// A cleared alert always reads as "resolved", whatever the rule's severity was.

function sevIcon(a: Alert) {
  if (a.state === 'cleared') return CircleCheck;
  if (a.sev === 'critical') return OctagonAlert;
  if (a.sev === 'warning') return TriangleAlert;
  return Info;
}

function sevBadge(a: Alert): string {
  if (a.state === 'cleared') return badgeSuccess;
  if (a.sev === 'critical') return badgeCritical;
  if (a.sev === 'warning') return badgeCaution;
  return badgeAccent;
}

// Left stroke of the toast, matching the badge hue.
function sevStroke(a: Alert): string {
  if (a.state === 'cleared') return 'border-l-success';
  if (a.sev === 'critical') return 'border-l-critical';
  if (a.sev === 'warning') return 'border-l-caution';
  return 'border-l-accent';
}

const SEV_LABEL: Record<Severity, string> = {
  info: 'Info',
  warning: 'Warnung',
  critical: 'Kritisch',
};

// ── Wording ──────────────────────────────────────────────────────────────────
// The firmware sends structured fields only; every German sentence is composed
// here, so there is exactly one place to change the phrasing.

function srcLabel(src: string): string {
  const slash = src.indexOf('/');
  return slash < 0 ? src : src.slice(slash + 1);
}

// The alert carries no channel resolution, so trim the raw float rather than
// print "22.4375" at the reader.
function fmtV(v: number): string {
  return String(Math.round(v * 100) / 100);
}

// `detail` of a `system` alert is the firmware's reset-reason name.
const RESET_TEXT: Record<string, string> = {
  panic: 'Absturz — das Gerät ist neu gestartet',
  int_wdt: 'Watchdog (Interrupt) — das Gerät ist neu gestartet',
  task_wdt: 'Watchdog — die Steuerung hing länger als 30 s, das Gerät ist neu gestartet',
  wdt: 'Watchdog — das Gerät ist neu gestartet',
  brownout: 'Spannungseinbruch — das Gerät ist neu gestartet',
};

export function alertText(a: Alert): { title: string; body: string } {
  const who = a.name || srcLabel(a.src);
  switch (a.kind) {
    case 'threshold':
      return a.state === 'cleared'
        ? { title: who, body: `Wieder im normalen Bereich${a.v !== undefined ? ` (${fmtV(a.v)})` : ''}` }
        : {
            title: who,
            body: `${srcLabel(a.src)}${a.detail ? ` ${a.detail}` : ''}` +
                  `${a.v !== undefined ? ` — aktuell ${fmtV(a.v)}` : ''}`,
          };
    case 'fault':
      return a.state === 'cleared'
        ? { title: who, body: 'Störung behoben' }
        : { title: who, body: `Störung: ${a.detail || 'unbekannt'}` };
    case 'program':
      return {
        title: who,
        body: a.detail === 'awaiting'
          ? 'Programm wartet auf Freigabe'
          : 'Programm abgeschlossen',
      };
    case 'autotune':
      return { title: who, body: 'AutoTune abgeschlossen' };
    case 'timer':
      return { title: who, body: 'Timer abgelaufen' };
    case 'system':
      return {
        title: 'Ungeplanter Neustart',
        body: RESET_TEXT[a.detail ?? ''] ?? 'Das Gerät ist neu gestartet',
      };
    default:
      return { title: who, body: '' };
  }
}

function stamp(a: Alert, time: TimeSettings | undefined): string {
  // ts === 0 means the alert predates the NTP sync — showing 1970 would be a lie.
  return a.ts === 0 ? 'Zeit unbekannt' : formatDateTime(a.ts, time);
}

// ── Toasts ───────────────────────────────────────────────────────────────────

function Toast({ alert, onOpen, onDismiss }: {
  alert: Alert;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const Icon = sevIcon(alert);
  const { title, body } = alertText(alert);

  useEffect(() => {
    if (alert.sev === 'critical' && alert.state === 'raised') return;
    const t = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(t);
  }, [alert.seq]);

  return (
    <div class={`${toastFrame} ${sevStroke(alert)}`}>
      <span class={`${sevBadge(alert)} shrink-0`}><Icon size={14} /></span>
      <button type="button" onClick={onOpen} class="min-w-0 flex-1 text-left">
        <p class="truncate text-sm font-medium text-fg">{title}</p>
        <p class="mt-0.5 text-xs text-muted">{body}</p>
      </button>
      <button type="button" onClick={onDismiss} title="Schließen"
        class="shrink-0 rounded p-0.5 text-muted transition-colors hover:bg-subtle-hover hover:text-fg">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Center ───────────────────────────────────────────────────────────────────

interface Props {
  alerts: Alert[];        // newest first
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onClear: () => void;
  // Alerts that arrived over SSE since the last render pass — only these pop a
  // toast. The catch-up fetch after a reconnect must never toast, or every
  // reconnect would flood the screen.
  toasts: Alert[];
  onToastDone: (seq: number) => void;
}

export function AlertCenter({ alerts, open, onOpen, onClose, onClear, toasts, onToastDone }: Props) {
  const [time, setTime] = useState<TimeSettings>();
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all');

  useEffect(() => { loadTimeSettings().then(setTime).catch(() => {}); }, []);

  const shown = sevFilter === 'all' ? alerts : alerts.filter((a) => a.sev === sevFilter);

  return (
    <>
      {/* Toast stack — newest at the bottom, capped so a burst can't fill the screen. */}
      {toasts.length > 0 && (
        <div class="fixed bottom-[calc(1rem+var(--safe-b))] right-[calc(1rem+var(--safe-r))] z-40 flex flex-col-reverse gap-2">
          {toasts.slice(0, 3).map((a) => (
            <Toast key={a.seq} alert={a}
              onOpen={() => { onToastDone(a.seq); onOpen(); }}
              onDismiss={() => onToastDone(a.seq)} />
          ))}
        </div>
      )}

      {open && (
        <>
          <div class="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
          <aside class={panelFrame}>
            <header class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
              <h2 class="flex-1 text-base font-medium text-fg">Meldungen</h2>
              <button type="button" onClick={onClose} title="Schließen"
                class="rounded p-1 text-muted transition-colors hover:bg-subtle-hover hover:text-fg">
                <X size={18} />
              </button>
            </header>

            <div class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
              <select class="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
                value={sevFilter}
                onChange={(e) => setSevFilter((e.target as HTMLSelectElement).value as Severity | 'all')}>
                <option value="all">Alle</option>
                <option value="critical">Nur kritisch</option>
                <option value="warning">Nur Warnungen</option>
                <option value="info">Nur Info</option>
              </select>
              <span class="flex-1" />
              {alerts.length > 0 && (
                <button type="button" onClick={onClear} class={`${linkDanger} text-xs`}>
                  <Trash2 size={13} class="mr-1 inline" />Verlauf leeren
                </button>
              )}
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4">
              {shown.length === 0 ? (
                <div class="flex flex-col items-center gap-2 pt-10 text-muted">
                  <BellOff size={28} />
                  <p class="text-sm">
                    {alerts.length === 0 ? 'Keine Meldungen.' : 'Keine Meldungen dieser Stufe.'}
                  </p>
                </div>
              ) : (
                <ul class="space-y-2">
                  {shown.map((a) => {
                    const Icon = sevIcon(a);
                    const { title, body } = alertText(a);
                    return (
                      <li key={a.seq}
                        class="flex items-start gap-2.5 rounded-md border border-card-border bg-card p-3 shadow-elev-2">
                        <span class={`${sevBadge(a)} shrink-0`}><Icon size={14} /></span>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-fg">{title}</p>
                          <p class="mt-0.5 text-xs text-muted">{body}</p>
                          <p class="mt-1 text-[11px] text-faint">{stamp(a, time)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <footer class="shrink-0 border-t border-border px-4 py-3">
              <a href="/settings/alarms" onClick={onClose}
                class={`${btnSecondary} inline-flex w-full justify-center`}>
                Alarmregeln verwalten
              </a>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}

export { SEV_LABEL };
