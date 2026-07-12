import { useState, useEffect } from 'preact/hooks';
import type { DashboardConfig } from '../types';
import { btnPrimary, btnSecondary, linkDanger, dialogFrame, dialogFooter, dialogBtnRow, inp } from '../ui';

interface Props {
  open: boolean;
  initial?: DashboardConfig;   // present = edit (rename + delete), absent = create
  onSave: (name: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Dashboard-level meta: create / rename, plus delete when editing. Content
// (which sensors/charts/… are shown) lives in DashboardContentModal + card ×.
export function DashboardMetaModal({ open, initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');

  useEffect(() => { if (open) setName(initial?.name ?? ''); }, [open, initial]);

  if (!open) return null;

  function submit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} class={`w-full max-w-sm ${dialogFrame}`}>
        <div class="p-6">
          <h2 class="mb-4 text-base font-medium text-fg">
            {initial ? 'Dashboard bearbeiten' : 'Neues Dashboard'}
          </h2>
          <label class="block">
            <span class="text-xs text-muted">Name</span>
            <input class={`mt-1 ${inp}`} value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              placeholder="z.B. Maischen" autoFocus />
          </label>
        </div>

        <div class={`${dialogFooter} justify-between`}>
          {onDelete ? (
            <button type="button" onClick={onDelete} class={linkDanger}>Löschen</button>
          ) : <span />}
          <div class={dialogBtnRow}>
            <button type="button" onClick={onClose} class={btnSecondary}>Abbrechen</button>
            <button type="submit" disabled={!name.trim()} class={btnPrimary}>
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
