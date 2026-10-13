import { deviation, mashAcidSuggestion, measuredEfficiency, type BrewInputs, type BrewTargets } from '../../brewDay';
import { isRegulated, mashTimerProgram } from '../../brewPrograms';
import { MEASUREMENTS, type MeasureKey, type StepKey } from '../../brewhouse';
import { setMeasurement, setRestTemp, type Brew } from '../../brews';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { unitOfEntry } from '../../ingredientSource';
import { MASH_KIND_LABEL, type Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import type { Snapshot } from '../../types';
import { badgeCaution, badgeSuccess, btnSecondary, inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { AmountInput, num, rowAmountChange } from './amounts';
import { BrewTimer } from './BrewTimer';
import { DeviceList } from './DeviceList';
import { MashCourse } from './MashCourse';
import { MeasureRow, fmtNum } from './MeasureRow';
import type { Patch } from './PrepTab';

const labelOf = (key: MeasureKey | 'mashPhAcid') => (key === 'mashPhAcid' ? 'pH nach der Säure' : MEASUREMENTS.find((m) => m.key === key)!.label);

// Lautering and sparging lie between the tabs; their devices are in both.
const DEVICE_STEPS: StepKey[] = ['strike', 'mash', 'lauter', 'sparge'];

// Tab "Maischen": the course of the mash against the device log, the mash pH
// with its acid in three steps, the first wort, for a mash heated by hand the
// rests with their timer on the device, and the brewhouse's devices.
export function MashTab({ brew, recipe, inputs, targets, liveEntries, snap, editable, patch, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  targets: BrewTargets;
  liveEntries: CatalogIngredient[] | null;  // today's catalog: a suggested acid may not be in the brew's copies
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const { values, mash } = targets;
  const sensorOf = (key: MeasureKey) => {
    const id = inputs.bh?.measurements[key];
    return id ? snap?.sensors.find((s) => s.id === id) : undefined;
  };
  const row = (key: MeasureKey | 'mashPhAcid', sub?: string) => (
    <MeasureRow key={key} id={key} label={labelOf(key)} sub={sub} soll={values[key]} value={brew.measurements?.[key]}
      sensor={key === 'mashPhAcid' ? sensorOf('mashPh') : sensorOf(key)} disabled={!editable}
      onSave={(m) => patch((b) => setMeasurement(b, key, m))} />
  );
  const saveAmount = (rowId: string, lotId: string | undefined, amount: number | undefined) =>
    patch(rowAmountChange(recipe, rowId, lotId, amount));

  // Acid: the recipe's additions after the pH measurement, a suggestion from the measurement.
  const entries = liveEntries ?? inputs.entries;
  const measured = brew.measurements?.mashPh?.v;
  const suggestion = measured === undefined ? undefined : mashAcidSuggestion(targets, measured, entries);
  const doses = targets.columns.find((c) => c.key === 'mash')?.doses.filter((d) => d.ingredient.timing === 'mashPh') ?? [];
  // One the recipe does not have keeps its amount under `mashPh:<entry id>`, without stock.
  const extras = new Set(Object.keys(brew.rowAmounts ?? {}).filter((k) => k.startsWith('mashPh:')));
  if (suggestion && !suggestion.rowId && suggestion.entryId) extras.add(`mashPh:${suggestion.entryId}`);
  const extraName = (key: string) => entries?.find((e) => e.id === key.slice('mashPh:'.length))?.name ?? 'Säure/Base';
  const suggestionKey = suggestion && (suggestion.rowId ?? `mashPh:${suggestion.entryId}`);
  const takeSuggestion = () => suggestion && saveAmount(suggestionKey!,
    recipe.ingredients.find((i) => i.id === suggestion.rowId)?.stockLotId, Math.round(suggestion.amount * 10) / 10);

  // First wort: the conversion it gives.
  const m = Object.fromEntries(Object.entries(brew.measurements ?? {}).map(([k, x]) => [k, x!.v]));
  const conversion = targets.ctx ? measuredEfficiency(m, targets.ctx).conversionPct : undefined;
  const conversionSoll = targets.efficiency?.conversionPct;
  const conversionDev = deviation('efficiency', conversionSoll, conversion);
  const sensors = { strike: liveSensor(inputs, snap, 'strikeTemp'), mash: liveSensor(inputs, snap, 'mashTemp') };

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Mengen und der Timer lassen sich ab dem Brautag-Start eintragen.</p>}
      {mash && inputs.bh && <MashCourse brew={brew} rows={mash.rows} bh={inputs.bh} snap={snap} editable={editable} patch={patch} />}
      <Card title="pH und Säure">
        {row('mashPh', 'nach dem Einmaischen')}
        <div class="border-b border-border py-2">
          <div class="text-sm">Säure nach der pH-Messung</div>
          {doses.length === 0 && extras.size === 0 && <p class="text-xs text-muted">Das Rezept sieht keine vor.</p>}
          {doses.map((d) => {
            const unit = d.agent?.unit ?? unitOfEntry(d.ingredient.kind, entryOf(d.ingredient, inputs.entries));
            return (
              <div key={d.ingredient.id} class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="min-w-[9rem] flex-1 text-sm">{d.ingredient.name}</span>
                <span class="w-24 text-sm text-muted" title="Rezept">{num(d.amount)} {unit}</span>
                <AmountInput value={brew.rowAmounts?.[d.ingredient.id]} placeholder={num(d.amount)} unit={unit}
                  label={`${d.ingredient.name} Ist`} disabled={!editable}
                  onSave={(n) => saveAmount(d.ingredient.id, d.ingredient.stockLotId, n)} />
              </div>
            );
          })}
          {[...extras].map((key) => {
            const unit = suggestion && key === suggestionKey ? suggestion.unit : '';
            return (
              <div key={key} class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="min-w-[9rem] flex-1 text-sm">{extraName(key)}</span>
                <span class="w-24 text-xs text-muted">nicht im Rezept</span>
                <AmountInput value={brew.rowAmounts?.[key]} placeholder="—" unit={unit} label={`${extraName(key)} Ist`}
                  disabled={!editable} onSave={(n) => saveAmount(key, undefined, n)} />
              </div>
            );
          })}
          <p class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {measured === undefined ? 'Der Vorschlag kommt mit dem gemessenen pH.'
              : !suggestion ? 'Kein Vorschlag: Es fehlen Schüttung, Wassermengen oder Milchsäure/Natron im Katalog.'
              : suggestion.amount < 0.05 ? `Für pH ${fmtNum(values.mashPhAcid!, 2)} braucht es nichts.`
              : (
                <>
                  <span>
                    Vorschlag für pH {fmtNum(values.mashPhAcid!, 2)}: {num(Math.round(suggestion.amount * 10) / 10)} {suggestion.unit} {suggestion.name}
                    {suggestion.base && ' (Base)'}
                  </span>
                  <button type="button" class={`${btnSecondary} px-2 py-0.5 text-xs`} disabled={!editable} onClick={takeSuggestion}>
                    übernehmen
                  </button>
                </>
              )}
          </p>
        </div>
        {row('mashPhAcid')}
      </Card>

      <Card title="Vorderwürze">
        {row('firstWortGravity', 'erste Würze beim Läutern')}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
          <span class="min-w-[9rem] flex-1">Konversion</span>
          <span class="w-24 text-muted" title="Soll">{conversionSoll === undefined ? '—' : `${fmtNum(conversionSoll, 1)} %`}</span>
          <span class="w-20">{conversion === undefined ? '—' : `${fmtNum(conversion, 1)} %`}</span>
          <span class="w-28">
            {conversionDev && <span class={conversionDev.level === 'ok' ? badgeSuccess : badgeCaution}>{conversionDev.text}</span>}
          </span>
        </div>
      </Card>

      <Card title="Rasten">
        {!mash ? (
          <p class="text-sm text-muted">{targets.notes[0] ?? 'Ohne Sudhaus kein Maischeplan.'}</p>
        ) : isRegulated(inputs.bh) ? (
          <p class="text-sm text-muted">Die Maische wird geregelt: Die Rasten stellst du am Regler, den Verlauf zeigt das Diagramm oben.</p>
        ) : (
          <>
            {mash.rows.filter((r) => r.step.kind !== 'strike').map((r) => (
              <MeasureRow key={r.step.id} id="mashTemp" label={r.step.name || MASH_KIND_LABEL[r.step.kind]}
                sub={`${r.holdMin > 0 ? `${num(r.holdMin)} min` : 'ohne Rast'} · ${r.transition.text}`}
                soll={r.tempC} value={brew.restTemps?.[r.step.id]} sensor={sensorOf('mashTemp')} disabled={!editable}
                onSave={(x) => patch((b) => setRestTemp(b, r.step.id, x))} />
            ))}
            <div class="mt-4">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Timer</h3>
              <BrewTimer brew={brew} field="mashProgramId" build={() => mashTimerProgram(brew.number, mash.rows, sensors)}
                startLabel="Maischen starten" snap={snap} editable={editable} patch={patch}
                intro={`Ein Programm auf dem Gerät führt durch die Rasten und meldet sich auch bei geschlossener Seite: Heizen und Zugaben bestätigst du mit „Weiter“${sensors.mash || sensors.strike ? ', ein verknüpfter Fühler beendet das Heizen von selbst' : ''}.`} />
            </div>
          </>
        )}
      </Card>

      <DeviceList bh={inputs.bh} steps={DEVICE_STEPS} snap={snap} active={brew.status === 'active'} />

      <Card title="Notizen zum Maischen">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}

// A step that waits for a sensor that is not in the registry would never end.
function liveSensor(inputs: BrewInputs, snap: Snapshot | null, key: MeasureKey): string | undefined {
  const id = inputs.bh?.measurements[key];
  return id && snap?.sensors.some((s) => s.id === id) ? id : undefined;
}
