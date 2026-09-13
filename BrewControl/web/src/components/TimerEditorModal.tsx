import { useState, useEffect } from 'preact/hooks';
import type {
  TimerConfig, TimerMode, TimerTargetKind, TimerTargetAction, TimerExpireAction, Snapshot, ProgramConfig,
} from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';
import { Segmented } from './Segmented';

type SaveCfg = Pick<TimerConfig, 'name' | 'mode' | 'durationSec' | 'timeOfDay' | 'repeat' | 'onExpire'>;

interface Props {
  open: boolean;
  initial?: TimerConfig;   // present = edit, absent = create
  snap: Snapshot | null;
  programs: ProgramConfig[];
  onSave: (cfg: SaveCfg) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

const MODES: { value: TimerMode; label: string }[] = [
  { value: 'duration', label: 'Dauer' },
  { value: 'clock', label: 'Uhrzeit' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Create/edit a single timer: Dauer- oder Uhrzeit-Countdown, optional
// wiederholend, optional mit einer Start/Stop-Aktion auf einen Aktor, Regler
// oder ein Programm bei Ablauf.
export function TimerEditorModal({ open, initial, snap, programs, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TimerMode>('duration');
  const [minutes, setMinutes] = useState('10');
  const [timeOfDay, setTimeOfDay] = useState('06:00');
  const [repeat, setRepeat] = useState(false);
  const [hasAction, setHasAction] = useState(false);
  const [targetKind, setTargetKind] = useState<TimerTargetKind>('actuator');
  const [targetId, setTargetId] = useState('');
  const [targetAction, setTargetAction] = useState<TimerTargetAction>('start');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setMode(initial?.mode ?? 'duration');
      setMinutes(initial && initial.mode === 'duration' ? String(initial.durationSec / 60) : '10');
      setTimeOfDay(initial?.timeOfDay ?? '06:00');
      setRepeat(initial?.repeat ?? false);
      const oe = initial?.onExpire;
      setHasAction(!!oe);
      setTargetKind(oe?.targetType ?? 'actuator');
      setTargetId(oe?.targetId ?? '');
      setTargetAction(oe?.action ?? 'start');
      setBusy(false);
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const parsedMinutes = parseFloat(minutes.replace(',', '.'));
  const modeValid = mode === 'duration' ? isFinite(parsedMinutes) && parsedMinutes > 0 : TIME_RE.test(timeOfDay);
  const actionValid = !hasAction || targetId !== '';
  const valid = name.trim() !== '' && modeValid && actionValid;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr(null);
    const onExpire: TimerExpireAction | undefined = hasAction
      ? { targetType: targetKind, targetId, action: targetAction }
      : undefined;
    try {
      await onSave({
        name: name.trim(),
        mode,
        durationSec: mode === 'duration' ? Math.round(parsedMinutes * 60) : 0,
        timeOfDay: mode === 'clock' ? timeOfDay : undefined,
        repeat,
        onExpire,
      });
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  }

  const actuatorIds = (snap?.actuators ?? []).map((a) => a.id);
  const controllerIds = (snap?.controllers ?? []).map((c) => c.id);

  function changeTargetKind(v: TimerTargetKind) {
    setTargetKind(v);
    setTargetId('');
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-sm ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
          <h2 class="mb-4 text-base font-medium text-fg">{initial ? 'Timer bearbeiten' : 'Neuer Timer'}</h2>
          <label class="block">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 w-full ${inp}`} value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Hopfengabe 1" autoFocus />
          </label>

          <div class="mt-3">
            <span class="text-xs text-muted">Modus</span>
            <div class="mt-1">
              <Segmented value={mode} options={MODES} onChange={setMode} />
            </div>
          </div>

          {mode === 'duration' ? (
            <label class="mt-3 block">
              <span class="text-xs text-muted">Minuten</span>
              <input type="number" min="0.1" step="0.1" class={`mt-1 w-full ${inp}`}
                value={minutes} onInput={(e) => setMinutes((e.target as HTMLInputElement).value)} />
            </label>
          ) : (
            <label class="mt-3 block">
              <span class="text-xs text-muted">Uhrzeit</span>
              <input type="time" step="60" class={`mt-1 w-full ${inp}`}
                value={timeOfDay} onInput={(e) => setTimeOfDay((e.target as HTMLInputElement).value)} />
            </label>
          )}

          <label class="mt-3 flex cursor-pointer items-center gap-1.5 text-sm text-fg">
            <input type="checkbox" class="accent-accent" checked={repeat}
              onChange={(e) => setRepeat((e.target as HTMLInputElement).checked)} />
            Wiederholen
            {repeat && (
              <span class="text-xs text-muted">
                {mode === 'clock' ? `(täglich um ${timeOfDay} Uhr)` : `(alle ${minutes || '?'} Min.)`}
              </span>
            )}
          </label>

          <div class="mt-4 rounded-md border border-border p-3">
            <label class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
              <input type="checkbox" class="accent-accent" checked={hasAction}
                onChange={(e) => setHasAction((e.target as HTMLInputElement).checked)} />
              Aktion bei Ablauf
            </label>
            {hasAction && (
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <select class={`${inp} w-28!`} value={targetKind}
                  onChange={(e) => changeTargetKind((e.target as HTMLSelectElement).value as TimerTargetKind)}>
                  <option value="actuator">Aktor</option>
                  <option value="controller">Regler</option>
                  <option value="program">Programm</option>
                </select>
                <select class={`${inp} min-w-0 flex-1`} value={targetId}
                  onChange={(e) => setTargetId((e.target as HTMLSelectElement).value)}>
                  <option value="">— wählen —</option>
                  {targetKind === 'actuator' && actuatorIds.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                  {targetKind === 'controller' && controllerIds.map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                  {targetKind === 'program' && programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select class={`${inp} w-24!`} value={targetAction}
                  onChange={(e) => setTargetAction((e.target as HTMLSelectElement).value as TimerTargetAction)}>
                  <option value="start">Start</option>
                  <option value="stop">Stop</option>
                </select>
              </div>
            )}
          </div>

          {err && <p class="mt-3 text-xs text-critical">{err}</p>}
        </div>

        <div class={`${dialogFooter} justify-between`}>
          {onDelete ? (
            <button type="button" onClick={onDelete} class={linkDanger}>Löschen</button>
          ) : <span />}
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>Abbrechen</button>
            <button type="submit" disabled={!valid || busy} class={btnPrimary}>
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
