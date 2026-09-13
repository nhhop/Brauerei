import { useState } from 'preact/hooks';
import type { TimerConfig, TimerAction, ProgramConfig, WidgetMode } from '../types';
import { controlTimer } from '../api';
import { badge, badgeAccent, badgeSuccess, widgetSizeClass } from '../ui';
import { fmtDuration } from '../format';
import { Pause, Pencil, Play, Repeat, Square, Timer as TimerIcon, Trash2, type LucideIcon } from 'lucide-preact';
import { CardModeButton } from './CardModeButton';
import { Gauge } from './Gauge';

interface Props {
  timer: TimerConfig;
  programs: ProgramConfig[];
  viewMode?: WidgetMode;
  onChanged: () => void;   // re-fetch timers after a control action
  onEdit?: () => void;
  onDelete?: () => void;
  onCycleMode?: () => void;
}

const TARGET_KIND_LABEL: Record<string, string> = {
  actuator: 'Aktor',
  controller: 'Regler',
  program: 'Programm',
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Bereit',
  running: 'Läuft',
  paused: 'Pausiert',
  done: 'Fertig',
};

function statusBadgeClass(status: string): string {
  if (status === 'running') return badgeSuccess;
  if (status === 'paused') return badgeAccent;
  return `${badge} bg-fg/10 text-muted`;
}

export function TimerCard({ timer, programs, viewMode = 'normal', onChanged, onEdit, onDelete, onCycleMode }: Props) {
  const { id, name, mode, timeOfDay, repeat, onExpire, durationSec, status, remainingSec } = timer;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: TimerAction) {
    setBusy(true);
    setErr(null);
    try {
      await controlTimer(id, action);
      onChanged();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const progressPct = durationSec > 0 ? Math.max(0, Math.min(1, 1 - remainingSec / durationSec)) : 0;

  function Btn({ action, label, icon: Icon, primary, iconOnly }: {
    action: TimerAction; label: string; icon: LucideIcon; primary?: boolean; iconOnly?: boolean;
  }) {
    return (
      <button type="button" disabled={busy} title={label}
        onClick={() => act(action)}
        class={`flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors disabled:opacity-40 ` +
          `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ` +
          (primary
            ? 'bg-accent text-accent-fg hover:bg-accent/90 active:bg-accent/80 focus-visible:ring-accent'
            : 'border border-border text-fg hover:bg-fg/5 active:bg-fg/10 focus-visible:ring-fg/30')}>
        <Icon size={16} class="shrink-0" />
        {!iconOnly && label}
      </button>
    );
  }

  const subtitle = mode === 'clock' ? `bis ${timeOfDay} Uhr` : `von ${fmtDuration(durationSec)}`;

  return (
    <div class={`${widgetSizeClass[viewMode]} rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8`}>
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <TimerIcon size={18} aria-hidden class="shrink-0 text-muted" />
          <h3 class="truncate font-medium text-fg">{name}</h3>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          {repeat && <Repeat size={14} aria-hidden title="Wiederholt sich" class="text-muted" />}
          <span class={statusBadgeClass(status)}>{STATUS_LABEL[status] ?? status}</span>
          {onCycleMode && (
            <CardModeButton mode={viewMode} onCycle={onCycleMode}
              class="rounded p-1 text-faint transition-colors hover:bg-fg/10 hover:text-fg" />
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="rounded p-1 text-faint transition-colors hover:bg-fg/10 hover:text-fg">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Aus Dashboard entfernen"
              class="rounded p-1 text-faint transition-colors hover:bg-critical/10 hover:text-critical">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {viewMode === 'compact' && (
        <>
          <div class="mt-2 text-center font-mono text-lg font-bold leading-none tabular-nums text-accent">
            {fmtDuration(remainingSec)}
          </div>
          <div class="mt-2 grid grid-flow-col auto-cols-fr gap-2">
            {(status === 'idle' || status === 'done') && (
              <Btn action="start" label="Start" icon={Play} primary iconOnly />
            )}
            {status === 'running' && <Btn action="pause" label="Pause" icon={Pause} iconOnly />}
            {status === 'paused' && <Btn action="resume" label="Fortsetzen" icon={Play} primary iconOnly />}
            {(status === 'running' || status === 'paused') && (
              <Btn action="stop" label="Stop" icon={Square} iconOnly />
            )}
          </div>
        </>
      )}

      {viewMode === 'gauge' && (
        <div class="mt-1 flex flex-col items-center">
          <Gauge value={durationSec - remainingSec} min={0} max={durationSec} size={220}>
            <div class="text-center">
              <div class="font-mono text-2xl font-bold leading-none tabular-nums text-accent">
                {fmtDuration(remainingSec)}
              </div>
              <div class="mt-1 text-[10px] uppercase tracking-wide text-faint">
                {subtitle}
              </div>
            </div>
          </Gauge>
        </div>
      )}

      {viewMode === 'normal' && (
        <>
          <div class="mt-3 text-center">
            <div class="font-mono text-3xl font-bold leading-none tabular-nums text-accent">
              {fmtDuration(remainingSec)}
            </div>
            <div class="mt-1 text-[10px] uppercase tracking-wide text-faint">
              {subtitle}
            </div>
          </div>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div class="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${Math.round(progressPct * 100)}%` }} />
          </div>
        </>
      )}

      {viewMode !== 'compact' && (
        <div class="mt-3 grid grid-flow-col auto-cols-fr gap-2">
          {(status === 'idle' || status === 'done') && (
            <Btn action="start" label="Start" icon={Play} primary />
          )}
          {status === 'running' && <Btn action="pause" label="Pause" icon={Pause} />}
          {status === 'paused' && <Btn action="resume" label="Fortsetzen" icon={Play} primary />}
          {(status === 'running' || status === 'paused') && (
            <Btn action="stop" label="Stop" icon={Square} />
          )}
        </div>
      )}

      {viewMode !== 'compact' && onExpire && (
        <p class="mt-2 truncate text-[11px] text-muted">
          → {onExpire.action === 'start' ? 'startet' : 'stoppt'} {TARGET_KIND_LABEL[onExpire.targetType]}{' '}
          {onExpire.targetType === 'program'
            ? (programs.find((p) => p.id === onExpire.targetId)?.name ?? onExpire.targetId)
            : onExpire.targetId}
        </p>
      )}

      {err && <p class="mt-2 text-xs text-critical">{err}</p>}
    </div>
  );
}
