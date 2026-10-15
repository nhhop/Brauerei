import { boilingPointC } from '../../brewMath';
import { measuredEfficiency, measuredValues, type BrewInputs, type BrewTargets } from '../../brewDay';
import { BOIL_GROUPS, boilAdditions, boilProgress, boilTimerProgram, type BoilAddition, type BoilGroup } from '../../brewPrograms';
import { MEASUREMENTS, type MeasureKey, type StepKey } from '../../brewhouse';
import { setChecked, setMeasurement, type Brew, type MeasureId } from '../../brews';
import { fmtDuration } from '../../format';
import { unitOfEntry } from '../../ingredientSource';
import type { ColumnKey } from '../../recipeTreatment';
import { TIMING_LABEL, type Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import type { ProgramConfig, Snapshot } from '../../types';
import { inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { AdditionRow } from './AdditionRow';
import { num } from './amounts';
import { BrewTimer } from './BrewTimer';
import { DeviceList } from './DeviceList';
import { EffRow, MeasureRow, fmtNum } from './MeasureRow';
import type { Patch } from './PrepTab';

const LABEL: Partial<Record<MeasureId, string>> = {
  preBoilGravity: 'Stammwürze', postBoilGravity: 'Stammwürze', preBoilPh: 'pH Würze', postBoilPh: 'pH Würze',
  speiseVolume: 'Speise', dipWortVolume: 'Würze für Dip Hopping',
};
const labelOf = (key: MeasureId) => LABEL[key] ?? MEASUREMENTS.find((m) => m.key === key)!.label;

const GROUP_LABEL: Record<BoilGroup, string> = { ...TIMING_LABEL, dip: 'Dip Hopping' };

// Lautering and sparging lie between the tabs; their devices are in both.
const DEVICE_STEPS: StepKey[] = ['sparge', 'lauter', 'boil', 'whirlpool', 'hopback', 'chill'];

// The line above the running timer: how long the boil still runs and what goes in next.
function timerLine(p: ProgramConfig): string | undefined {
  if (p.status === 'awaiting') return `Wartet auf „Weiter“: ${p.steps[p.currentStep]?.name ?? ''}`;
  const g = boilProgress(p);
  if (!g) return undefined;
  const head = `${g.phase === 'boil' ? 'Kochende' : 'Whirlpool-Ende'} in ${fmtDuration(g.remainingSec)}`;
  // The step's name says when it is due ("Noch 10 min: …"); here the countdown does.
  return g.next && g.next.inSec < g.remainingSec
    ? `${head} · in ${fmtDuration(g.next.inSec)}: ${g.next.name.replace(/^Noch [\d,]+ min: /, '')}` : head;
}

// Tab "Würzekochen": the boil timer with its additions, the values before and
// after the boil with the efficiencies they give, and the wort drawn off.
export function BoilTab({ brew, recipe, inputs, targets, snap, editable, patch, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  targets: BrewTargets;
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const { values } = targets;
  const checked = new Set(brew.checked ?? []);
  const sensorOf = (key: MeasureId) => {
    const id = inputs.bh?.measurements[key as MeasureKey];
    return id ? snap?.sensors.find((s) => s.id === id) : undefined;
  };
  const row = (key: MeasureId, sub?: string) => (
    <MeasureRow key={key} id={key} label={labelOf(key)} sub={sub} soll={values[key]} value={brew.measurements?.[key]}
      sensor={sensorOf(key)} disabled={!editable} onSave={(m) => patch((b) => setMeasurement(b, key, m))} />
  );

  // The box is read at once: the save runs later, on a fresh copy of the brew.
  const tick = (key: string, on: boolean) => patch((b) => setChecked(b, key, on));

  // Acids and salts that go into the wort, to tick off.
  const doses = (colKey: ColumnKey) => (targets.columns.find((c) => c.key === colKey)?.doses ?? []).map((d) => {
    const key = `dose:${colKey}:${d.ingredient.id}`;
    const unit = d.agent?.unit ?? unitOfEntry(d.ingredient.kind, entryOf(d.ingredient, inputs.entries));
    return (
      <label key={key} class="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={checked.has(key)} disabled={!editable}
          onChange={(e) => tick(key, e.currentTarget.checked)} />
        <span>{num(d.amount)} {unit} {d.ingredient.name}</span>
      </label>
    );
  });

  const eff = targets.ctx ? measuredEfficiency(measuredValues(brew), targets.ctx) : {};
  const from = eff.from === 'preBoil' ? 'aus Pfannevoll und Stammwürze vor dem Kochen'
    : eff.from === 'postBoil' ? 'aus Ausschlagmenge und Stammwürze nach dem Kochen' : undefined;

  const pressure = brew.measurements?.airPressure?.v;
  const boilPoint = pressure !== undefined && pressure > 0
    ? `Siedepunkt ${fmtNum(boilingPointC(pressure), 1)} °C, laut Höhe ${fmtNum(targets.boilC, 1)} °C`
    : `Siedepunkt laut Höhe ${fmtNum(targets.boilC, 1)} °C`;

  const additions = boilAdditions(recipe, inputs.entries);
  const whenOf = (a: BoilAddition) => (a.group === 'boil' ? `${num(a.atMin!)} min`
    : a.group === 'whirlpool' ? `${num(recipe.boil.whirlpoolTempC)} °C · ${num(recipe.boil.whirlpoolMin)} min` : '');

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Haken, Mengen und der Timer lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Kochtimer">
        <BrewTimer brew={brew} field="boilProgramId" startLabel="Kochen starten" summary={timerLine}
          build={() => boilTimerProgram(brew.number, recipe.boil, boilAdditions(recipe, inputs.entries, brew.rowAmounts))}
          snap={snap} editable={editable} patch={patch}
          intro="Ein Programm auf dem Gerät zählt die Kochzeit und meldet jede Gabe, auch bei geschlossener Seite. Starte es beim Anheizen: Vorderwürzehopfen, Kochbeginn und Kochende bestätigst du mit „Weiter“." />
      </Card>

      <Card title="Vor dem Kochen">
        {row('preBoilPh')}
        {row('preBoilVolume')}
        {row('preBoilGravity')}
        {doses('preBoil')}
        <EffRow label="Maischeeffizienz" soll={targets.efficiency?.mashPct} ist={eff.mashPct} sub={from} />
      </Card>

      <Card title="Nach dem Kochen">
        {row('postBoilPh')}
        {row('postBoilVolume', targets.dilutionInKettle ? 'vor dem Verschnitt' : undefined)}
        {row('postBoilGravity', targets.dilutionInKettle ? 'vor dem Verschnitt' : undefined)}
        {row('airPressure', boilPoint)}
        {doses('knockOut')}
        <EffRow label="Sudhausausbeute" soll={targets.efficiency?.yieldPct} ist={eff.yieldPct} sub={from} />
      </Card>

      <Card title="Gaben">
        {additions.length === 0 && <p class="text-sm text-muted">Das Rezept sieht keine Gaben beim Kochen vor.</p>}
        {BOIL_GROUPS.map((group) => {
          const rows = additions.filter((a) => a.group === group);
          if (rows.length === 0) return null;
          return (
            <div key={group} class="mb-3 last:mb-0">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{GROUP_LABEL[group]}</h3>
              {rows.map((a) => (
                <AdditionRow key={a.row.id} brew={brew} recipe={recipe} row={a.row} amount={a.amount} unit={a.unit}
                  when={whenOf(a)} editable={editable} patch={patch} />
              ))}
            </div>
          );
        })}
      </Card>

      <Card title="Würze abzweigen">
        {row('speiseVolume', 'beim Ausschlagen, einfrieren')}
        {row('dipWortVolume', 'beim Ausschlagen')}
      </Card>

      <DeviceList bh={inputs.bh} steps={DEVICE_STEPS} snap={snap} active={brew.status === 'active'} />

      <Card title="Notizen zum Würzekochen">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}
