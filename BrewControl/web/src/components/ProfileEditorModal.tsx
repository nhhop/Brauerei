import { useState, useEffect } from 'preact/hooks';
import type { ProfileCategory, ProfileConfig, ProgramStep, Snapshot } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';
import {
  ProgramStepsEditor, draftFromSteps, stepsFromDraft, draftProblem, type StepsDraft,
} from './ProgramStepsEditor';

type SaveCfg = Pick<ProfileConfig, 'name' | 'category' | 'steps'>;

interface Props {
  open: boolean;
  categories: ProfileCategory[];
  // Live snapshot for the column and sensor-trigger dropdowns and the units.
  snap?: Snapshot | null;
  // Prefilled values. With editing=false this is a draft (e.g. "save this
  // program as a profile"), with editing=true the profile being edited.
  initial?: { name?: string; category?: string; steps?: ProgramStep[] };
  editing?: boolean;
  onSave: (cfg: SaveCfg) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}

// Same step editor as ProgramEditorModal — a profile is a complete template of
// a program's steps, target ids included, without any runtime state. Unlike a
// program it may name items this device doesn't have (requireExisting=false).
export function ProfileEditorModal({ open, categories, snap, initial, editing, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [draft, setDraft] = useState<StepsDraft>(() => draftFromSteps(undefined));
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setCategory(initial?.category ?? '');
      setDraft(draftFromSteps(initial?.steps));
      setPending(false);
      setErr(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const problem = draftProblem(draft, snap ?? null, /*requireExisting=*/false);
  const valid = name.trim() !== '' && category !== '' && problem === null;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setErr(null);
    try {
      await onSave({ name: name.trim(), category, steps: stepsFromDraft(draft) });
    } catch (e2) {
      setErr(String(e2));
      setPending(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
        <h2 class="mb-4 text-base font-medium text-fg">
          {editing ? 'Profil bearbeiten' : 'Neues Profil'}
        </h2>

        <div class="mb-4 flex gap-3">
          <label class="block flex-1">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 w-full ${inp}`}
              value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Pils-Maische" autoFocus />
          </label>
          <label class="block flex-1">
            <span class="text-xs text-muted">Kategorie</span>
            <select class={`mt-1 w-full ${inp}`}
              value={category}
              onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
              <option value="">— wählen —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <ProgramStepsEditor snap={snap ?? null} draft={draft} onChange={setDraft} />

        {categories.length === 0 && (
          <p class="mt-3 text-xs text-muted">
            Noch keine Kategorie vorhanden — lege zuerst eine an.
          </p>
        )}
        {problem && <p class="mt-3 text-xs text-muted">{problem}</p>}
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
