import { useState } from 'preact/hooks';
import type { CatalogIngredient, HopPackaging, StockLot } from '../../ingredientCatalog';
import { HOP_PACKAGING_LABEL, fieldsOf, getField, isLotField, setField } from '../../ingredientFields';
import { recipeKindOf, unitOfEntry } from '../../ingredientSource';
import { HOP_FORMS } from '../../recipes';
import { btnPrimary, btnSecondary, inp, linkDanger } from '../../ui';
import { Field, NumInput, OptNum } from '../recipe/fields';
import { Dialog } from './Dialog';
import { FieldInput } from './FieldInput';

// Create or edit a stock lot of `entry`. Its own values (from the lot's data
// sheet) override the ingredient's; an empty field keeps the ingredient's,
// which shows as the placeholder.
export function StockLotForm({ initial, entry, onSave, onDelete, onClose }: {
  initial: StockLot;
  entry: CatalogIngredient;
  onSave: (lot: StockLot) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [lot, setLot] = useState<StockLot>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nothing is required here: an empty field keeps the ingredient's value.
  const overridable = fieldsOf(entry).filter(isLotField).map((f) => ({ ...f, required: false }));
  const patch = (key: string, v: unknown) => setLot(setField(lot, key, v));

  async function save() {
    setBusy(true);
    setError(null);
    const overrides = lot.overrides && Object.keys(lot.overrides).length > 0 ? lot.overrides : undefined;
    try {
      await onSave(setField(lot, 'overrides', overrides));
    } catch {
      setError('Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <Dialog title={`${entry.name}${entry.manufacturer ? ` · ${entry.manufacturer}` : ''}`} onClose={onClose}
      footer={<div class="flex w-full items-center justify-between gap-2">
        {onDelete ? <button type="button" class={linkDanger} onClick={onDelete}>Löschen</button> : <span />}
        <div class="flex gap-2">
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={busy} onClick={save}>Speichern</button>
        </div>
      </div>}>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field label={`Menge (${unitOfEntry(recipeKindOf(entry.kind), entry)})`}>
          <NumInput value={lot.amount} onChange={(n) => patch('amount', n)} />
        </Field>
        <Field label="Jahrgang">
          <OptNum value={lot.cropYear} onChange={(n) => patch('cropYear', n)} placeholder={String(new Date().getFullYear())} />
        </Field>
        {entry.kind === 'hop' && (
          <Field label="Form">
            <select class={`${inp} w-full`} value={lot.form ?? ''} onChange={(e) => patch('form', e.currentTarget.value || undefined)}>
              <option value="">–</option>
              {HOP_FORMS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
        )}
        {entry.kind === 'hop' && (
          <>
            <Field label="Lagertemperatur (°C)">
              <OptNum value={lot.storageTempC} onChange={(n) => patch('storageTempC', n)} />
            </Field>
            <Field label="Verpackung">
              <select class={`${inp} w-full`} value={lot.packaging ?? ''}
                onChange={(e) => patch('packaging', (e.currentTarget.value || undefined) as HopPackaging | undefined)}>
                <option value="">–</option>
                {Object.entries(HOP_PACKAGING_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Mindestens haltbar bis">
          <input type="date" class={`${inp} w-full`} value={lot.bestBefore ?? ''}
            onInput={(e) => patch('bestBefore', e.currentTarget.value || undefined)} />
        </Field>
      </div>

      {overridable.length > 0 && (
        <>
          <h3 class="mb-1 mt-5 text-sm font-semibold">Eigene Werte</h3>
          <p class="mb-3 text-xs text-muted">Aus dem Datenblatt dieser Charge. Leer gelassen gilt der Wert der Zutat.</p>
          {entry.kind === 'hop' && (
            <div class="mb-3">
              <Field label="Alpha-Wert vom (Analyse- oder Abpackdatum)">
                <input type="date" class={inp} value={lot.valuesDate ?? ''}
                  onInput={(e) => patch('valuesDate', e.currentTarget.value || undefined)} />
              </Field>
              <p class="mt-1 text-xs text-muted">Ab hier zählt später die Alterung. Leer: Schätzung aus dem Erntejahr.</p>
            </div>
          )}
          <div class="grid gap-3 sm:grid-cols-2">
            {overridable.map((f) => (
              <FieldInput key={f.key} def={f} value={getField(lot.overrides, f.key)} placeholder={getField(entry, f.key)}
                onChange={(v) => setLot({ ...lot, overrides: setField(lot.overrides ?? {}, f.key, v) })} />
            ))}
          </div>
          <div class="mt-3">
            <Field label="Quelle der Werte">
              <input class={`${inp} w-full`} value={lot.source?.name ?? ''} placeholder="z. B. Datenblatt des Händlers"
                onInput={(e) => { const name = e.currentTarget.value.trim(); patch('source', name ? { name } : undefined); }} />
            </Field>
          </div>
        </>
      )}

      <div class="mt-3">
        <Field label="Notizen">
          <textarea class={`${inp} w-full`} rows={2} value={lot.notes ?? ''}
            onInput={(e) => patch('notes', e.currentTarget.value.trim() ? e.currentTarget.value : undefined)} />
        </Field>
      </div>
      {error && <p class="mt-3 text-sm text-critical">{error}</p>}
    </Dialog>
  );
}
