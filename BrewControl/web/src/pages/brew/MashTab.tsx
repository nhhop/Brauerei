import { useEffect, useState } from 'preact/hooks';
import { createProgram, controlProgram, deleteProgram, getPrograms } from '../../api';
import { deviation, mashAcidSuggestion, measuredEfficiency, type BrewInputs, type BrewTargets } from '../../brewDay';
import { isRegulated, mashTimerProgram, type TimerSensors } from '../../brewPrograms';
import { MEASUREMENTS, type MeasureKey } from '../../brewhouse';
import { setMeasurement, setRestTemp, type Brew, type MeasureId } from '../../brews';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { unitOfEntry } from '../../ingredientSource';
import type { MashRow } from '../../mashPlan';
import { MASH_KIND_LABEL, type Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import type { ProgramConfig, Snapshot } from '../../types';
import { badgeCaution, badgeSuccess, btnPrimary, btnSecondary, inp } from '../../ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ProgramCard } from '../../components/ProgramCard';
import { Card, Field } from '../recipe/fields';
import { AmountInput, num, rowAmountChange } from './amounts';
import { MeasureRow, fmtNum } from './MeasureRow';
import type { Patch } from './PrepTab';

const labelOf = (key: MeasureId) => (key === 'mashPhAcid' ? 'pH nach der Säure' : MEASUREMENTS.find((m) => m.key === key)!.label);

// Tab "Maischen": the mash pH with its acid in three steps, the first wort and,
// for a mash heated by hand, the rests with their timer on the device.
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
  const row = (key: MeasureId, sub?: string) => (
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

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Mengen und der Timer lassen sich ab dem Brautag-Start eintragen.</p>}
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
          <p class="text-sm text-muted">Die Maische wird geregelt; den Verlauf aus dem Gerätelog zeigt der Tab mit Etappe 5b-4.</p>
        ) : (
          <>
            {mash.rows.filter((r) => r.step.kind !== 'strike').map((r) => (
              <MeasureRow key={r.step.id} id="mashTemp" label={r.step.name || MASH_KIND_LABEL[r.step.kind]}
                sub={`${r.holdMin > 0 ? `${num(r.holdMin)} min` : 'ohne Rast'} · ${r.transition.text}`}
                soll={r.tempC} value={brew.restTemps?.[r.step.id]} sensor={sensorOf('mashTemp')} disabled={!editable}
                onSave={(x) => patch((b) => setRestTemp(b, r.step.id, x))} />
            ))}
            <RestTimer brew={brew} rows={mash.rows} sensors={{ strike: liveSensor(inputs, snap, 'strikeTemp'), mash: liveSensor(inputs, snap, 'mashTemp') }}
              snap={snap} editable={editable} patch={patch} />
          </>
        )}
      </Card>

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

// The rest timer: a program on the device that belongs to the brew. The card is
// the dashboard's; this adds starting it and taking it away.
function RestTimer({ brew, rows, sensors, snap, editable, patch }: {
  brew: Brew; rows: MashRow[]; sensors: TimerSensors; snap: Snapshot | null; editable: boolean; patch: Patch;
}) {
  const id = brew.mashProgramId;
  const [program, setProgram] = useState<ProgramConfig | null | undefined>(undefined);  // null = gone from the device
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const refresh = () => {
    if (id) getPrograms().then((l) => setProgram(l.find((p) => p.id === id) ?? null)).catch(() => {});
  };
  useEffect(() => {
    setProgram(undefined);
    if (!id) return;
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, [id]);

  async function run(what: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try { await what(); } catch { setError(failure); }
    setBusy(false);
  }

  const start = () => run(async () => {
    if (id) await deleteProgram(id).catch(() => {});
    const created = await createProgram(mashTimerProgram(brew.number, rows, sensors));
    await controlProgram(created, 'start');
    await patch((b) => ({ ...b, mashProgramId: created }));
  }, 'Timer konnte nicht gestartet werden.');

  const remove = () => run(async () => {
    setAsking(false);
    if (id) await deleteProgram(id).catch(() => {});
    await patch((b) => {
      const { mashProgramId: _, ...rest } = b;
      return rest;
    });
  }, 'Timer konnte nicht entfernt werden.');

  const active = program && ['running', 'awaiting', 'paused'].includes(program.status);
  return (
    <div class="mt-4">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Timer</h3>
      {!id || program === null ? (
        <>
          <p class="mb-2 text-sm text-muted">
            {program === null ? 'Das Programm gibt es auf dem Gerät nicht mehr. ' : ''}
            Ein Programm auf dem Gerät führt durch die Rasten und meldet sich auch bei geschlossener Seite:
            Heizen und Zugaben bestätigst du mit „Weiter“{sensors.mash || sensors.strike ? ', ein verknüpfter Fühler beendet das Heizen von selbst' : ''}.
          </p>
          <button type="button" class={btnPrimary} disabled={!editable || busy} onClick={start}>Maischen starten</button>
        </>
      ) : program === undefined ? (
        <p class="text-sm text-muted">Lädt …</p>
      ) : (
        <>
          <ProgramCard program={program} snap={snap} onChanged={refresh} />
          <button type="button" class={`${btnSecondary} mt-2`} disabled={!editable || busy}
            onClick={() => (active ? setAsking(true) : remove())}>
            {active ? 'Timer abbrechen' : 'Timer entfernen'}
          </button>
        </>
      )}
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}
      <ConfirmModal open={asking} title="Timer abbrechen?" confirmLabel="Timer abbrechen" cancelLabel="Weiterlaufen lassen" destructive pending={busy}
        onConfirm={remove} onCancel={() => setAsking(false)}>
        Das Programm „{program?.name}“ wird auf dem Gerät gelöscht.
      </ConfirmModal>
    </div>
  );
}
