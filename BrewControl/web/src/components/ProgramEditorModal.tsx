import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, ProgramConfig, ProgramStep, ProfileLibrary } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';
import { ConfirmModal } from './ConfirmModal';
import {
  ProgramStepsEditor, draftFromSteps, stepsFromDraft, draftHasContent, draftProblem,
  type StepsDraft,
} from './ProgramStepsEditor';

type SaveCfg = Pick<ProgramConfig, 'name' | 'steps'>;

interface Props {
  open: boolean;
  snap: Snapshot | null;
  initial?: ProgramConfig;
  // Profile library, for filling the steps from a saved template and for
  // saving the current steps back as one. Both optional — without them the
  // dialog behaves exactly as before.
  library?: ProfileLibrary;
  onSaveAsProfile?: (draft: { name: string; steps: ProgramStep[] }) => void;
  onSave: (cfg: SaveCfg) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ProgramEditorModal({ open, snap, initial, library, onSaveAsProfile, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<StepsDraft>(() => draftFromSteps(undefined));
  // Profile whose steps are waiting for a replace confirmation.
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDraft(draftFromSteps(initial?.steps));
      setPendingProfile(null);
    }
  }, [open, initial]);

  if (!open) return null;

  // Applying a profile copies its steps, target ids included — the program
  // stays independent of the library afterwards. Replaces what's there, after
  // asking if anything is.
  function applyProfile(id: string) {
    const p = library?.profiles.find((x) => x.id === id);
    if (!p) return;
    setDraft(draftFromSteps(p.steps));
  }

  function pickProfile(id: string) {
    if (!id) return;
    if (draftHasContent(draft)) setPendingProfile(id);
    else applyProfile(id);
  }

  const steps = stepsFromDraft(draft);
  const problem = draftProblem(draft, snap, /*requireExisting=*/true);
  const valid = name.trim() !== '' && problem === null;

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!valid) return;
    onSave({ name: name.trim(), steps });
  }

  const profileSelect = library && library.profiles.length > 0 && (
    <label class="flex items-center gap-1.5 text-xs text-muted">
      Aus Profil befüllen
      <select class={`${inp} w-48`} value=""
        onChange={(e) => {
          const sel = e.target as HTMLSelectElement;
          pickProfile(sel.value);
          sel.value = '';
        }}>
        <option value="">— wählen —</option>
        {library.categories.map((c) => {
          const inCat = library.profiles.filter((p) => p.category === c.id);
          if (inCat.length === 0) return null;
          return (
            <optgroup key={c.id} label={c.name}>
              {inCat.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          );
        })}
      </select>
    </label>
  );

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame}`}>
        <div class="min-h-0 overflow-y-auto p-6">
        <h2 class="mb-4 text-base font-medium text-fg">
          {initial ? 'Programm bearbeiten' : 'Neues Programm'}
        </h2>

        <label class="mb-4 block">
          <span class="text-xs text-muted">Name</span>
          <input class={`mt-1 w-full ${inp}`}
            value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="z.B. Pils-Maische" autoFocus />
        </label>

        <ProgramStepsEditor snap={snap} draft={draft} onChange={setDraft}
          stepsHeaderExtra={profileSelect} />

        {problem && <p class="mt-3 text-xs text-muted">{problem}</p>}

        </div>

        <div class={`${dialogFooter} justify-between`}>
          <div class="flex items-center gap-4">
            {onDelete && (
              <button type="button" onClick={onDelete} class={linkDanger}>
                Löschen
              </button>
            )}
            {onSaveAsProfile && (
              <button type="button" disabled={steps.length === 0}
                onClick={() => onSaveAsProfile({ name: name.trim(), steps })}
                class="text-sm text-muted transition-colors hover:text-fg disabled:opacity-40">
                Als Profil speichern
              </button>
            )}
          </div>
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>
              Abbrechen
            </button>
            <button type="submit" disabled={!valid} class={btnPrimary}>
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={pendingProfile !== null}
        title="Schritte ersetzen?"
        confirmLabel="Ersetzen"
        onConfirm={() => { if (pendingProfile) applyProfile(pendingProfile); setPendingProfile(null); }}
        onCancel={() => setPendingProfile(null)}>
        Die vorhandenen Schritte werden durch die des Profils ersetzt.
      </ConfirmModal>
    </div>
  );
}
