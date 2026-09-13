import { useState, useEffect } from 'preact/hooks';
import type { TimerConfig } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';

type SaveCfg = { name: string; durationSec: number };

interface Props {
  open: boolean;
  initial?: TimerConfig;   // present = edit, absent = create
  onSave: (cfg: SaveCfg) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

// Create/edit a single timer. Kept as its own modal (not an inline form in
// DashboardContentModal) so it has room to grow further settings later.
export function TimerEditorModal({ open, initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('10');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setMinutes(initial ? String(initial.durationSec / 60) : '10');
      setBusy(false);
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const parsedMinutes = parseFloat(minutes.replace(',', '.'));
  const valid = name.trim() !== '' && isFinite(parsedMinutes) && parsedMinutes > 0;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({ name: name.trim(), durationSec: Math.round(parsedMinutes * 60) });
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`w-full max-w-sm ${dialogFrame}`}>
        <div class="p-6">
          <h2 class="mb-4 text-base font-medium text-fg">{initial ? 'Timer bearbeiten' : 'Neuer Timer'}</h2>
          <label class="block">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 w-full ${inp}`} value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Hopfengabe 1" autoFocus />
          </label>
          <label class="mt-3 block">
            <span class="text-xs text-muted">Minuten</span>
            <input type="number" min="0.1" step="0.1" class={`mt-1 w-full ${inp}`}
              value={minutes} onInput={(e) => setMinutes((e.target as HTMLInputElement).value)} />
          </label>
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
