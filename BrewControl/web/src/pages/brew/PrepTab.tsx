import type { BrewInputs, BrewTargets } from '../../brewDay';
import { MEASUREMENTS, type MeasureKey } from '../../brewhouse';
import { setChecked, setMeasurement, type Brew, type HeadField } from '../../brews';
import { lotTarget } from '../../brewStart';
import type { StockLot } from '../../ingredientCatalog';
import { unitOfEntry } from '../../ingredientSource';
import { isTreatmentRow, type ColumnDose } from '../../recipeTreatment';
import { fmtL } from '../../recipeWater';
import { KINDS, TIMING_LABEL, type Ingredient, type Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import type { Snapshot } from '../../types';
import { inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { AmountInput, num, rowAmountChange } from './amounts';
import { MeasureRow } from './MeasureRow';

// `fresh`: head fields the change sets, taken over into the page's draft too.
export type Patch = (change: (b: Brew) => Brew | Promise<Brew>, fresh?: HeadField[]) => Promise<void>;

const labelOf = (key: MeasureKey) => MEASUREMENTS.find((m) => m.key === key)!.label;

// Rows of one ingredient and stock lot, as they are weighed out.
interface Group { key: string; name: string; unit: string; lotId?: string; rows: Ingredient[] }

function groupsOf(recipe: Recipe, inputs: BrewInputs): { kind: (typeof KINDS)[number]; groups: Group[] }[] {
  const rows = recipe.ingredients.filter((i) => !isTreatmentRow(i, inputs.entries));
  return KINDS.map((kind) => {
    const groups: Group[] = [];
    for (const i of rows.filter((r) => r.kind === kind.id)) {
      const key = `${i.ingredientId ?? i.name}|${i.stockLotId ?? ''}`;
      const known = groups.find((g) => g.key === key);
      if (known) { known.rows.push(i); continue; }
      groups.push({ key, name: i.name || 'Ohne Namen', unit: unitOfEntry(i.kind, entryOf(i, inputs.entries)), lotId: i.stockLotId, rows: [i] });
    }
    return { kind, groups };
  }).filter((k) => k.groups.length > 0);
}

const whenOf = (i: Ingredient) =>
  i.timing === 'boil' && i.timeMin !== undefined ?`Kochen ${i.timeMin} min` : TIMING_LABEL[i.timing];

// Tab "Vorbereitung": water with its treatment, then the ingredients to weigh out.
export function PrepTab({ brew, recipe, inputs, targets, stock, snap, editable, patch, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  targets: BrewTargets;
  stock: StockLot[] | null;    // today's lots; null = not loaded
  snap: Snapshot | null;
  editable: boolean;           // measured values once the brew day started
  patch: Patch;
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const { water, values } = targets;
  const checked = new Set(brew.checked ?? []);
  const sensorOf = (key: MeasureKey) => {
    const id = inputs.bh?.measurements[key];
    return id ? snap?.sensors.find((s) => s.id === id) : undefined;
  };
  const row = (key: MeasureKey, sub?: string) => (
    <MeasureRow key={key} id={key} label={labelOf(key)} sub={sub} soll={values[key]} value={brew.measurements?.[key]}
      sensor={sensorOf(key)} disabled={!editable} onSave={(m) => patch((b) => setMeasurement(b, key, m))} />
  );
  const tick = (key: string, on: boolean) => patch((b) => setChecked(b, key, on));

  const saveAmount = (rowId: string, lotId: string | undefined, amount: number | undefined) =>
    patch(rowAmountChange(recipe, rowId, lotId, amount));

  const col = (k: string) => targets.columns.find((c) => c.key === k);
  const doses = (list: ColumnDose[] | undefined, colKey: string, where?: string) => (list ?? []).map((d) => {
    const key = `dose:${colKey}:${d.ingredient.id}`;
    const unit = d.agent?.unit ?? unitOfEntry(d.ingredient.kind, entryOf(d.ingredient, inputs.entries));
    return (
      <label key={key} class="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={checked.has(key)} disabled={!editable} onChange={(e) => tick(key, e.currentTarget.checked)} />
        <span>{num(d.amount)} {unit} {d.ingredient.name}</span>
        {(d.share || where) && <span class="text-xs text-muted">{d.share ? 'Anteil Brauwasser' : where}</span>}
      </label>
    );
  });

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Haken und Mengen lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Wasser">
        {!water ? (
          <p class="text-sm text-muted">{targets.notes[0] ?? 'Ohne Sudhaus keine Wassermengen.'}</p>
        ) : (
          <>
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">Hauptguss</h3>
            {row('strikeVolume', `davon in die Maische ${fmtL(water.strikeL)}`)}
            {row('strikeTemp')}
            {row('strikePh')}
            <div class="mt-1">
              {doses(col('strike')?.doses, 'strike')}
              {doses(col('mash')?.doses.filter((d) => d.ingredient.timing === 'mash'), 'mash', 'in die Maische')}
            </div>
            {water.sparge && (
              <>
                <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Nachguss</h3>
                {row('spargeVolume', `davon zum Läutern ${fmtL(water.spargeL)}`)}
                {row('spargeTemp')}
                {row('spargePh')}
                <div class="mt-1">{doses(col('sparge')?.doses, 'sparge')}</div>
              </>
            )}
          </>
        )}
      </Card>

      <Card title="Zutaten">
        {groupsOf(recipe, inputs).map(({ kind, groups }) => (
          <div key={kind.id} class="mb-3 last:mb-0">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{kind.label}</h3>
            {groups.map((g) => {
              const key = `row:${g.key}`;
              const soll = g.rows.reduce((s, i) => s + i.amount, 0);
              const lot = g.lotId ? stock?.find((l) => l.id === g.lotId) : undefined;
              const booking = g.lotId ? brew.booked?.find((b) => b.lotId === g.lotId) : undefined;
              const need = g.lotId ? lotTarget(recipe, brew.rowAmounts, g.lotId) : 0;
              const warn = !g.lotId ? undefined
                : brew.status === 'planned'
                  ? stock && !lot ? 'Lagerposten fehlt' : lot && lot.amount < soll - 1e-9 ? `Bestand ${num(lot.amount)} ${g.unit} reicht nicht` : undefined
                  : !booking ? 'beim Start nicht abgebucht'
                    : booking.amount < need - 1e-9 ? `nur ${num(booking.amount)} ${g.unit} abgebucht` : undefined;
              const amountInput = (i: Ingredient) => (
                <AmountInput value={brew.rowAmounts?.[i.id]} placeholder={num(i.amount)} unit={g.unit} disabled={!editable}
                  label={`${g.name} Ist`} onSave={(n) => saveAmount(i.id, i.stockLotId, n)} />
              );
              return (
                <div key={g.key} class="border-b border-border py-2 last:border-b-0">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label class="flex min-w-[10rem] flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" checked={checked.has(key)} disabled={!editable}
                        onChange={(e) => tick(key, e.currentTarget.checked)} />
                      <span>
                        {g.name}
                        {g.lotId && <span class="ml-1 text-xs text-muted">{`Lager${lot?.cropYear ? ` ${lot.cropYear}` : ''}${lot ? `, Bestand ${num(lot.amount)} ${g.unit}` : ''}`}</span>}
                      </span>
                    </label>
                    <span class="w-24 text-sm text-muted" title="Soll">{num(soll)} {g.unit}</span>
                    {g.rows.length === 1 ? amountInput(g.rows[0]) : <span class="w-32" />}
                  </div>
                  {warn && <p class="mt-1 text-xs text-caution">{warn}</p>}
                  {g.rows.length > 1 && g.rows.map((i) => (
                    <div key={i.id} class="ml-6 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="min-w-[8rem] flex-1 text-xs text-muted">{whenOf(i)}</span>
                      <span class="w-24 text-xs text-muted">{num(i.amount)} {g.unit}</span>
                      {amountInput(i)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      <Card title="Notizen zur Vorbereitung">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}
