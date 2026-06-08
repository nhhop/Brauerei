import { useState } from 'preact/hooks';
import type { ProgramConfig, ProgramAction } from '../types';
import { controlProgram } from '../api';

interface Props {
  program: ProgramConfig;
  controllerExists: boolean;
  onChanged: () => void;   // re-fetch programs after a control action
  onEdit?: () => void;
  onDelete?: () => void;
}

function fmtDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Bereit',
  running: 'Läuft',
  awaiting: 'Freigabe erforderlich',
  paused: 'Pausiert',
  done: 'Fertig',
};

export function ProgramCard({ program, controllerExists, onChanged, onEdit, onDelete }: Props) {
  const { name, controller, steps, status, currentStep } = program;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: ProgramAction) {
    setBusy(true);
    setErr(null);
    try {
      await controlProgram(program.id, action);
      onChanged();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const active = status === 'running' || status === 'awaiting' || status === 'paused';
  const remaining = program.stepRemainingSec;

  function Btn({ action, label, primary, title }: {
    action: ProgramAction; label: string; primary?: boolean; title?: string;
  }) {
    return (
      <button type="button" disabled={busy || !controllerExists} title={title}
        onClick={() => act(action)}
        class={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${
          primary
            ? 'bg-accent text-accent-fg hover:opacity-90'
            : 'border border-border text-fg hover:bg-fg/5'
        }`}>
        {label}
      </button>
    );
  }

  return (
    <div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="truncate font-medium text-fg">{name}</h3>
          <div class="text-xs text-muted">
            Regler: <span class="font-mono text-fg">{controller}</span>
            {!controllerExists && <span class="ml-1 text-red-600">(fehlt)</span>}
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <span class={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            status === 'running' ? 'bg-emerald-500/15 text-emerald-600'
            : status === 'awaiting' ? 'bg-amber-500/15 text-amber-600'
            : status === 'paused' ? 'bg-sky-500/15 text-sky-600'
            : 'bg-fg/10 text-muted'
          }`}>{STATUS_LABEL[status] ?? status}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Aus Dashboard entfernen"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>

      <ol class="mt-3 space-y-1">
        {steps.map((s, i) => {
          const done = active && i < currentStep;
          const cur = active && i === currentStep;
          return (
            <li key={i} class={`flex items-baseline justify-between gap-2 rounded px-2 py-1 text-sm ${
              cur ? 'bg-accent/10 font-medium text-fg'
              : done ? 'text-faint line-through'
              : 'text-muted'
            }`}>
              <span class="min-w-0 truncate">
                {s.name || `Schritt ${i + 1}`}
                {s.confirm && <span class="ml-1 text-[10px] text-amber-600" title="Freigabe abwarten">✋</span>}
              </span>
              <span class="shrink-0 font-mono text-xs">
                {s.setpoint}° · {fmtDuration(s.holdSec)}
                {cur && remaining != null && status === 'running' && (
                  <span class="ml-2 text-accent">noch {fmtDuration(remaining)}</span>
                )}
                {cur && status === 'awaiting' && (
                  <span class="ml-2 text-amber-600">↳ Freigabe</span>
                )}
                {cur && status === 'paused' && (
                  <span class="ml-2 text-sky-600">pausiert</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div class="mt-3 flex flex-wrap gap-1.5">
        {(status === 'idle' || status === 'done') && (
          <Btn action="start" label="▶ Start" primary />
        )}
        {status === 'running' && <Btn action="pause" label="⏸ Pause" />}
        {status === 'paused' && <Btn action="resume" label="▶ Fortsetzen" primary />}
        {active && <Btn action="prev" label="◀ Zurück" title="vorigen Schritt" />}
        {active && (
          <Btn action="next" label="Weiter ▶" primary={status === 'awaiting'}
            title="nächsten Schritt / Freigabe" />
        )}
        {active && <Btn action="stop" label="■ Stop" />}
      </div>

      {!controllerExists && (
        <p class="mt-2 text-xs text-red-600">Regler „{controller}" existiert nicht — Steuerung deaktiviert.</p>
      )}
      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
