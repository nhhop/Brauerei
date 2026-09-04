import { useState, useEffect } from 'preact/hooks';
import type { ProfileCategory, ProfileConfig, ProgramStep } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';

type SaveCfg = Pick<ProfileConfig, 'name' | 'category' | 'steps'>;

interface Props {
  open: boolean;
  categories: ProfileCategory[];
  // Prefilled values. With editing=false this is a draft (e.g. "save this
  // program as a profile"), with editing=true the profile being edited.
  initial?: { name?: string; category?: string; steps?: ProgramStep[] };
  editing?: boolean;
  onSave: (cfg: SaveCfg) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

// Step row in edit form: values kept as strings so in-progress input survives
// re-renders; parsed on submit. Hold time is entered in minutes (decimals
// allowed → short values usable for testing) and stored as seconds. Same model
// as ProgramEditorModal — a profile is a program's steps without the controller
// and without any runtime state.
interface Row {
  name: string;
  setpoint: string;
  holdMin: string;
  confirm: boolean;
}

function toRow(s: ProgramStep): Row {
  return {
    name: s.name ?? '',
    setpoint: String(s.setpoint),
    holdMin: String(s.holdSec / 60),
    confirm: s.confirm ?? false,
  };
}

function emptyRow(): Row {
  return { name: '', setpoint: '', holdMin: '', confirm: false };
}

export function ProfileEditorModal({ open, categories, initial, editing, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCategory(initial?.category ?? '');
      setRows(initial?.steps?.length ? initial.steps.map(toRow) : [emptyRow()]);
      setPending(false);
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  function patchRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, j) => j !== i)); }
  function moveRow(i: number, dir: -1 | 1) {
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const steps: ProgramStep[] = rows
    .map((r) => ({
      name: r.name.trim(),
      setpoint: parseFloat(r.setpoint.replace(',', '.')),
      holdSec: Math.max(0, Math.round((parseFloat(r.holdMin.replace(',', '.')) || 0) * 60)),
      confirm: r.confirm,
    }))
    .filter((s) => isFinite(s.setpoint))
    .map((s) => (s.name ? s : { ...s, name: undefined }));

  const valid = name.trim() !== '' && category !== '' && steps.length > 0;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setErr(null);
    try {
      await onSave({ name: name.trim(), category, steps });
    } catch (e2) {
      setErr(String(e2));
      setPending(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-lg ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
        <h2 class="mb-4 text-base font-medium text-fg">
          {editing ? 'Profil bearbeiten' : 'Neues Profil'}
        </h2>

        <div class="mb-4 flex gap-3">
          <label class="block flex-1">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 ${inp}`}
              value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Pils-Maische" autoFocus />
          </label>
          <label class="block flex-1">
            <span class="text-xs text-muted">Kategorie</span>
            <select class={`mt-1 ${inp}`}
              value={category}
              onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
              <option value="">— wählen —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Schritte</div>
        <div class="space-y-2">
          {rows.map((r, i) => (
            <div key={i} class="rounded-md border border-border p-2">
              <div class="flex items-center gap-2">
                <span class="w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
                <input class={`${inp} min-w-0 flex-1`}
                  value={r.name} placeholder="Name (optional, z.B. Maltoserast)"
                  onInput={(e) => patchRow(i, { name: (e.target as HTMLInputElement).value })} />
                <div class="flex shrink-0 flex-col gap-0.5">
                  <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0}
                    class="text-xs leading-none text-faint hover:text-fg disabled:opacity-30" title="nach oben">▲</button>
                  <button type="button" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1}
                    class="text-xs leading-none text-faint hover:text-fg disabled:opacity-30" title="nach unten">▼</button>
                </div>
                <button type="button" onClick={() => removeRow(i)} disabled={rows.length === 1}
                  class="shrink-0 leading-none text-faint hover:text-critical disabled:opacity-30" title="Schritt entfernen">×</button>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-3 pl-7">
                <label class="flex items-center gap-1 text-xs text-muted">
                  Sollwert
                  <input type="text" inputMode="decimal"
                    class={`${inp} w-20 text-right`}
                    value={r.setpoint}
                    onInput={(e) => patchRow(i, { setpoint: (e.target as HTMLInputElement).value })} />
                </label>
                <label class="flex items-center gap-1 text-xs text-muted">
                  Haltezeit (min)
                  <input type="text" inputMode="decimal"
                    class={`${inp} w-20 text-right`}
                    value={r.holdMin}
                    onInput={(e) => patchRow(i, { holdMin: (e.target as HTMLInputElement).value })} />
                </label>
                <label class="flex cursor-pointer items-center gap-1.5 text-xs text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={r.confirm}
                    onChange={(e) => patchRow(i, { confirm: (e.target as HTMLInputElement).checked })} />
                  Freigabe abwarten
                </label>
              </div>
            </div>
          ))}
        </div>

        <button type="button" onClick={addRow}
          class="mt-2 text-xs text-faint hover:text-fg">
          + Schritt hinzufügen
        </button>

        {categories.length === 0 && (
          <p class="mt-3 text-xs text-muted">
            Noch keine Kategorie vorhanden — lege zuerst eine an.
          </p>
        )}
        {err && <p class="mt-3 text-xs text-critical">{err}</p>}

        </div>

        <div class={`${dialogFooter} justify-between`}>
          {onDelete ? (
            <button type="button" onClick={onDelete} class={linkDanger}>
              Löschen
            </button>
          ) : <span />}
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>
              Abbrechen
            </button>
            <button type="submit" disabled={!valid || pending} class={btnPrimary}>
              {pending ? 'Speichern…' : editing ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
