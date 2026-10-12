import { useState } from 'preact/hooks';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { fieldsOf, getField, missingFields, setField } from '../../ingredientFields';
import { btnPrimary, btnSecondary, inp } from '../../ui';
import { Field } from '../recipe/fields';
import { Dialog } from './Dialog';
import { FieldInput } from './FieldInput';

// Create or edit an own ingredient. The kind is fixed by the tab it was opened from.
export function IngredientForm({ initial, onSave, onClose }: {
  initial: CatalogIngredient;
  onSave: (c: CatalogIngredient) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CatalogIngredient>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = missingFields(draft);
  const ready = draft.name.trim() !== '' && missing.length === 0;
  const text = (key: 'name' | 'manufacturer' | 'origin' | 'notes', value: string) =>
    setDraft(setField(draft, key, key === 'name' ? value : value.trim() || undefined));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } catch {
      setError('Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <Dialog title={initial.name ? 'Eigene Zutat bearbeiten' : 'Eigene Zutat anlegen'} onClose={onClose}
      footer={<>
        <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
        <button type="button" class={btnPrimary} disabled={!ready || busy} onClick={save}>Speichern</button>
      </>}>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field label="Name *">
          <input class={`${inp} w-full`} value={draft.name} onInput={(e) => text('name', e.currentTarget.value)} />
        </Field>
        <Field label="Hersteller">
          <input class={`${inp} w-full`} value={draft.manufacturer ?? ''} onInput={(e) => text('manufacturer', e.currentTarget.value)} />
        </Field>
        <Field label="Herkunft">
          <input class={`${inp} w-full`} value={draft.origin ?? ''} onInput={(e) => text('origin', e.currentTarget.value)} />
        </Field>
        {fieldsOf(draft).map((f) => (
          <FieldInput key={`${f.key}|${f.label}`} def={f} value={getField(draft, f.key)}
            onChange={(v) => setDraft(setField(draft, f.key, v))} />
        ))}
      </div>
      <div class="mt-3">
        <Field label="Notizen">
          <textarea class={`${inp} w-full`} rows={2} value={draft.notes ?? ''}
            onInput={(e) => text('notes', e.currentTarget.value)} />
        </Field>
      </div>
      {missing.length > 0 && (
        <p class="mt-3 text-xs text-muted">Noch nötig: {missing.map((f) => f.label).join(', ')}</p>
      )}
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
    </Dialog>
  );
}
