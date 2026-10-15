import { useEffect, useRef, useState } from 'preact/hooks';
import { controlProgram } from '../../api';
import { measuredFermenterPct, measuredValues, type BrewInputs, type BrewTargets } from '../../brewDay';
import { boilAdditions, dryHops, fermentControlOf, fermentationProgram, pitchedAtOf } from '../../brewPrograms';
import { MEASUREMENTS, type MeasureKey } from '../../brewhouse';
import {
  occupancyOverlaps, pitchBrew, setMeasurement, summaryOf, type Brew, type BrewSummary, type MeasureId,
} from '../../brews';
import type { Fermenter } from '../../cellar';
import { fermentationSchedule, fermenterHints } from '../../fermentation';
import { unitOfEntry } from '../../ingredientSource';
import type { Ingredient, Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import type { ProgramConfig, Snapshot } from '../../types';
import { badgeAccent, btnPrimary, inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { AdditionRow } from './AdditionRow';
import { num } from './amounts';
import { BrewTimer, isActive } from './BrewTimer';
import { DryHopList } from './DryHopList';
import { FermentCourse } from './FermentCourse';
import { formatIsoDate, toLocalInput } from './format';
import { EffRow, MeasureRow } from './MeasureRow';
import type { Patch } from './PrepTab';
import { Readings, useReadings } from './Readings';

const LABEL: Partial<Record<MeasureId, string>> = { pitchGravity: 'Stammwürze' };
const labelOf = (key: MeasureId) => LABEL[key] ?? MEASUREMENTS.find((m) => m.key === key)!.label;

const date = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

// "#12 Pils (20.10.2026–03.11.2026)"
const brewText = (o: BrewSummary) =>
  `#${o.number} ${o.name}${o.occupiedFrom && o.occupiedUntil ? ` (${formatIsoDate(o.occupiedFrom)}–${formatIsoDate(o.occupiedUntil)})` : ''}`;

// Tab "Gärung": the fermenter (chosen in the head until the start, here after
// it), the fermentation program at it, the pitching with its values and
// additions, and the recipe's phases on the clock from the pitching.
export function FermentTab({ brew, recipe, inputs, targets, snap, editable, patch, fermenters, all, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  targets: BrewTargets;
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
  fermenters: Fermenter[] | null;
  all: BrewSummary[];
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const { values } = targets;
  const sensorOf = (key: MeasureId) => {
    const id = inputs.bh?.measurements[key as MeasureKey];
    return id ? snap?.sensors.find((s) => s.id === id) : undefined;
  };
  const row = (key: MeasureId, sub?: string) => (
    <MeasureRow key={key} id={key} label={labelOf(key)} sub={sub} soll={values[key]} value={brew.measurements?.[key]}
      sensor={sensorOf(key)} disabled={!editable} onSave={(m) => patch((b) => setMeasurement(b, key, m))} />
  );

  // ── Fermenter ──
  const active = brew.status === 'active';
  const current = inputs.fermenter;
  const choose = (id: string) => {
    const f = fermenters?.find((x) => x.id === id);
    return patch((b) => {
      const { fermenterId: _, ...rest } = b;
      const frozen = b.frozen && { ...b.frozen, fermenter: f };
      return f ? { ...rest, fermenterId: f.id, frozen } : { ...rest, frozen };
    }, ['fermenterId']);
  };
  const optionText = (f: Fermenter) => {
    const taken = occupancyOverlaps({ ...summaryOf(brew), fermenterId: f.id }, all);
    return `${f.name} · ${num(f.volumeL)} l · ${taken.length > 0 ? `belegt: ${taken.map(brewText).join(', ')}` : 'frei'}`;
  };
  const hints = current ? fermenterHints(current, recipe, values.batchVolume) : [];

  // ── Program ──
  const control = fermentControlOf(current, snap);
  const controllerName = control && (snap?.controllers.find((c) => c.id === control.controller)?.label ?? control.controller);
  const hops = dryHops(recipe, inputs.entries, brew.rowAmounts);
  // Pressure only with "Unter Druck vergären".
  const phases = recipe.pressureFermentation ? recipe.fermentation : recipe.fermentation.map(({ pressureBar: _, ...p }) => p);
  const generated = fermentationProgram(brew.number, phases, hops, control);
  const [seen, setSeen] = useState<ProgramConfig>();
  const program = brew.fermentProgramId && seen?.id === brew.fermentProgramId ? seen : undefined;
  const running = !!program && isActive(program);
  const first = phases.find((p) => p.duration > 0);

  // ── Pitching ──
  const pitchedAt = brew.phaseStartedAt?.fermentation;
  const [time, setTime] = useState('');
  useEffect(() => setTime(pitchedAt === undefined ? '' : toLocalInput(pitchedAt)), [pitchedAt]);
  const pitched = (ms: number | undefined) => patch((b) => pitchBrew(b, ms), ['occupiedFrom', 'occupiedUntil']);
  // The program's pitching is taken once per program, so a time the brewer
  // took away again stays away.
  const suggested = program && pitchedAtOf(program);
  const taken = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (pitchedAt !== undefined || suggested === undefined || !editable || taken.current === brew.fermentProgramId) return;
    taken.current = brew.fermentProgramId;
    void pitched(suggested);
  }, [pitchedAt, suggested]);
  // With the program waiting in its pitching step, "Angestellt" is its "Weiter".
  const pitchNow = () => (running && program.currentStep === 0
    ? controlProgram(program.id, 'next').then(() => {}) : pitched(Date.now()));
  const toPitch = recipe.ingredients.filter((i) => i.timing === 'pitch')
    .map((r) => ({ row: r, amount: brew.rowAmounts?.[r.id] ?? r.amount, unit: unitOfEntry(r.kind, entryOf(r, inputs.entries)) }));
  const dips = boilAdditions(recipe, inputs.entries, brew.rowAmounts).filter((a) => a.group === 'dip');
  const dilutedHere = targets.water?.dilution.at === 'fermenter' && targets.water.dilution.volumeL > 0;
  const overall = measuredFermenterPct(measuredValues(brew), targets);

  // ── Readings by hand ──
  const [readings, setReadings] = useReadings(brew.id);
  const og = brew.measurements?.pitchGravity?.v ?? values.pitchGravity;

  const group = (title: string, rows: { row: Ingredient; amount: number; unit: string }[]) => rows.length > 0 && (
    <div class="mt-3">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {rows.map((a) => (
        <AdditionRow key={a.row.id} brew={brew} recipe={recipe} row={a.row} amount={a.amount} unit={a.unit}
          editable={editable} patch={patch} />
      ))}
    </div>
  );

  // A running program knows the phase it is in; -1 before the first and after the last.
  const schedule = fermentationSchedule(recipe.fermentation, pitchedAt, Date.now());
  const programPhase = running ? (generated.phaseOf[program.currentStep] ?? -1) : undefined;
  const stateOf = (i: number) => {
    if (programPhase === undefined) return schedule[i].state;
    if (programPhase >= 0) return i < programPhase ? 'done' : i === programPhase ? 'current' : 'next';
    return program!.currentStep === 0 ? 'next' : 'done';
  };

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Haken und Mengen lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Gärplatz">
        {active ? (
          <Field label="Gärplatz">
            <select class={`${inp} w-full`} value={brew.fermenterId ?? ''} disabled={running} onChange={(e) => choose(e.currentTarget.value)}>
              <option value="">–</option>
              {fermenters?.map((f) => <option key={f.id} value={f.id}>{optionText(f)}</option>)}
              {brew.fermenterId && fermenters && !fermenters.some((f) => f.id === brew.fermenterId) && (
                <option value={brew.fermenterId}>{current?.name ?? 'fehlt'} (gelöscht)</option>
              )}
            </select>
          </Field>
        ) : (
          <p class="text-sm">
            {current ? current.name : 'Kein Gärplatz gewählt.'}{' '}
            <span class="text-xs text-muted">{brew.status === 'planned' ? 'Bis zum Start im Kopf wählen.' : '(Stand Abschluss)'}</span>
          </p>
        )}
        {running && <p class="mt-2 text-xs text-muted">Gesperrt, solange das Gärprogramm läuft.</p>}
        {hints.map((h) => <p key={h} class="mt-2 text-sm text-caution">{h}</p>)}
      </Card>

      <Card title="Gärprogramm">
        <BrewTimer brew={brew} field="fermentProgramId" startLabel="Gärprogramm starten" snap={snap} editable={editable && active} patch={patch}
          build={() => ({ name: generated.name, steps: generated.steps })} watch={setSeen}
          canStart={!!first}
          confirmStart={control && first
            ? `Der Regler „${controllerName}“ geht sofort an und regelt auf ${num(first.tempC)} °C. Der erste Schritt wartet auf „Weiter“, sobald die Hefe drin ist.` : undefined}
          intro={control
            ? `Ein Programm auf dem Gerät führt die Gärung, auch bei geschlossener Seite: Zuerst wartet es auf das Anstellen („Weiter“ oder „Angestellt“), dann stellt es dem Regler „${controllerName}“ die Temperaturen der Phasen, mit Rampen, und meldet die Stopfgaben. Am Ende hält es die letzte Temperatur, bis „Weiter“ den Regler ausschaltet.`
            : 'Ohne Regler am Gärplatz ist das Programm ein Timer: Nach dem Anstellen meldet es, wann du welche Temperatur stellst und wann du stopfst oder den Hopfen entnimmst.'} />
      </Card>

      <Card title="Anstellen">
        {row('batchVolume', dilutedHere ? 'mit dem Verschnitt' : undefined)}
        {row('pitchGravity', dilutedHere ? 'nach dem Verschnitt' : undefined)}
        {row('pitchTemp', recipe.fermentation[0] ? `erste Phase: ${recipe.fermentation[0].name}` : undefined)}
        <EffRow label="Gesamteffizienz" soll={targets.efficiency?.fermenterPct} ist={overall} sub="aus Anstellwürze, Stammwürze und Speise" />
        {group('Anstellen', toPitch)}
        {group('Dip Hopping', dips)}
        <div class="mt-3">
          {pitchedAt === undefined ? (
            <>
              <p class="mb-2 text-sm text-muted">
                „Angestellt“ startet die Gärführung und belegt den Gärplatz ab heute.
                {running && program.currentStep === 0 ? ' Das Gärprogramm geht dabei weiter.' : ''}
              </p>
              <button type="button" class={btnPrimary} disabled={!editable} onClick={() => void pitchNow()}>Angestellt</button>
            </>
          ) : (
            <div class="max-w-[14rem]">
              <Field label="Angestellt um">
                <input type="datetime-local" class={`${inp} w-full`} value={time} disabled={!editable}
                  onInput={(e) => setTime(e.currentTarget.value)}
                  onBlur={(e) => {
                    const value = e.currentTarget.value;
                    const t = Date.parse(value);
                    if (value !== toLocalInput(pitchedAt)) void pitched(Number.isNaN(t) ? undefined : t);
                  }} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card title="Gärführung">
        {schedule.length === 0 && <p class="text-sm text-muted">Das Rezept hat keine Gärphasen.</p>}
        {schedule.map((s, i) => (
          <div key={s.phase.id}
            class={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-1 py-2 text-sm last:border-b-0 ${stateOf(i) === 'current' ? 'bg-accent/10' : stateOf(i) === 'done' ? 'text-muted' : ''}`}>
            <span class="min-w-[8rem] flex-1 font-semibold">
              {s.phase.name || 'Phase'}
              {stateOf(i) === 'current' && <span class={`${badgeAccent} ml-2`}>aktuell</span>}
            </span>
            <span class="w-28">
              {num(s.phase.tempC)} °C{s.phase.rampDays ? <span class="text-xs text-muted"> · Rampe {num(s.phase.rampDays)} d</span> : null}
            </span>
            <span class="w-16">{num(s.phase.duration)} d</span>
            <span class="w-32 text-muted">
              {s.fromAt !== undefined ? `${date(s.fromAt)}–${date(s.toAt!)}` : `Tag ${num(s.fromDay)}–${num(s.toDay)}`}
            </span>
          </div>
        ))}
        {pitchedAt === undefined && schedule.length > 0 && (
          <p class="mt-2 text-xs text-muted">Die Daten folgen aus der Anstellzeit.</p>
        )}
        {running && <p class="mt-2 text-xs text-muted">Die aktuelle Phase kommt vom Gärprogramm; eine Pause verschiebt sie gegenüber den Daten.</p>}
        <DryHopList brew={brew} recipe={recipe} title="Stopfen" hops={hops.filter((h) => h.row.timing === 'primary')}
          pitchedAt={pitchedAt} editable={editable} patch={patch} />
      </Card>

      <FermentCourse brew={brew} fermenter={current} phases={recipe.fermentation} snap={snap} editable={editable} patch={patch}
        readings={readings} og={og} />

      <Readings doc={readings} onDoc={setReadings} og={og} editable={editable} />

      <Card title="Notizen zur Gärung">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}
