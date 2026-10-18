import { useEffect, useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { beerNow, carbonationNow, carbonationPlan, containerLiters, containerPlan, containerRows } from '../../bottlingDay';
import {
  actualBeer, measuredEfficiency, measuredFermenterPct, measuredValues, plannedBeer, type BrewInputs, type BrewTargets,
} from '../../brewDay';
import { bottleBrew, setContainerCount, type Brew, type MeasureId } from '../../brews';
import { containerLabel } from '../../cellar';
import { unitOfEntry } from '../../ingredientSource';
import type { Recipe } from '../../recipes';
import { entryOf } from '../../stockLots';
import { btnPrimary, inp, linkDanger } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { AdditionRow } from './AdditionRow';
import { AmountInput } from './amounts';
import { FinishRow, finalGravitySuggestion } from './FinishRow';
import { toLocalInput } from './format';
import { EffRow, ResultRow, fmtNum } from './MeasureRow';
import type { Patch } from './PrepTab';
import { useReadings } from './Readings';

const H3 = 'mt-3 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0';

// Tab "Abfüllung": the values after the fermentation, the carbonation counted
// again with them, the containers filled and "Abgefüllt", and the balance of the
// brew from the pitched wort to the beer in the containers.
export function BottlingTab({ brew, recipe, inputs, targets, editable, patch, og, notes, onNotes }: {
  brew: Brew;                  // as saved; the page keeps the head's draft
  recipe: Recipe;
  inputs: BrewInputs;
  targets: BrewTargets;
  editable: boolean;
  patch: Patch;
  og: number | undefined;      // gravity of the pitched wort, °P: what a refractometer reading is set against
  notes: string | undefined;
  onNotes: (text: string | undefined) => void;
}) {
  const { values, bottling } = targets;
  const m = measuredValues(brew);
  const [readings] = useReadings(brew.id);

  // ── Containers ──
  const containers = inputs.containers ?? null;
  const planCounts = containerPlan(bottling);
  const counts = brew.containerCounts ?? planCounts;
  const rows = containerRows(counts, containers);
  const liters = containerLiters(rows);
  const addable = (containers ?? []).filter((c) => !(c.id in counts));
  const toFill = recipe.ingredients.filter((i) => i.timing === 'bottling')
    .map((r) => ({ row: r, amount: brew.rowAmounts?.[r.id] ?? r.amount, unit: unitOfEntry(r.kind, entryOf(r, inputs.entries)) }));

  // ── Bottling time ──
  const bottledAt = brew.phaseStartedAt?.bottling;
  const [time, setTime] = useState('');
  useEffect(() => setTime(bottledAt === undefined ? '' : toLocalInput(bottledAt)), [bottledAt]);
  const bottled = (ms: number | undefined) => patch((b) => bottleBrew(b, ms), ['occupiedUntil']);

  // ── Carbonation ──
  const c = recipe.carbonation;
  const plan = carbonationPlan(recipe, targets);
  const now = carbonationNow(recipe, targets, m, inputs.entries);
  const beer = beerNow(targets, m);

  // ── Balance ──
  const eff = targets.ctx ? measuredEfficiency(m, targets.ctx) : {};
  const overall = measuredFermenterPct(m, targets);
  const plannedBeerValues = plannedBeer(targets);
  const actualBeerValues = actualBeer(m, targets);
  const speiseShown = (bottling?.speiseL ?? 0) > 0 || m.speiseVolume !== undefined;
  const kegShown = (bottling?.kegL ?? 0) > 0;

  const result = (label: string, soll: number | undefined, ist: number | undefined, unit: string, digits?: number, devKey?: MeasureId, sub?: string) =>
    <ResultRow label={label} soll={soll} ist={ist} unit={unit} digits={digits} devKey={devKey} sub={sub} />;

  return (
    <>
      {!editable && <p class="mb-3 text-sm text-muted">Ist-Werte, Haken und Mengen lassen sich ab dem Brautag-Start eintragen.</p>}
      <Card title="Messwerte">
        <FinishRow id="finalGravity" brew={brew} targets={targets} editable={editable} patch={patch}
          suggest={finalGravitySuggestion(readings, og)} />
        <FinishRow id="maxTempAfter" brew={brew} targets={targets} editable={editable} patch={patch} />
        {kegShown && <FinishRow id="dilutionVolume" brew={brew} targets={targets} editable={editable} patch={patch} />}
        <FinishRow id="bottledVolume" brew={brew} targets={targets} editable={editable} patch={patch}
          suggest={liters === undefined ? undefined : { v: Math.round(liters * 100) / 100, text: `Gebinde zusammen: ${fmtNum(liters, 1)} l` }} />
      </Card>

      <Card title="Karbonisierung">
        {!c ? <p class="text-sm text-muted">Das Rezept plant keine Karbonisierung.</p>
          : !plan || !now?.result ? <p class="text-sm text-muted">Die Karbonisierung braucht die Abfüllmenge (Sudhaus und Katalog).</p> : (
            <>
              <div class="flex gap-x-3 text-xs text-muted">
                <span class="min-w-[9rem] flex-1" />
                <span class="w-24">Rezept</span>
                <span class="w-[6.75rem]">Jetzt</span>
                <span class="w-28" />
              </div>
              <ResultRow label="Bier zum Abfüllen" soll={bottling!.beerL} ist={now.beerL} unit="l" sollTitle="Rezept"
                sub={beer?.measured ? 'mit der gemessenen Anstellwürze' : 'noch mit der geplanten Anstellwürze'} />
              {c.method !== 'forced' && (
                <ResultRow label="Restkohlensäure" soll={plan.residualVol} ist={now.result.residualVol} unit="vol" digits={2} sollTitle="Rezept"
                  sub={now.result.residualTempC === undefined ? undefined : `bei ${fmtNum(now.result.residualTempC, 1)} °C`} />
              )}
              {c.method === 'sugar' && (
                <ResultRow label="Zucker" soll={plan.sugarG} ist={now.result.sugarG} unit="g" digits={0} sollTitle="Rezept" />
              )}
              {c.method === 'speise' && (
                <ResultRow label="Speise" soll={plan.speiseL} ist={now.speise?.needL} unit="l" sollTitle="Rezept" />
              )}
              {c.method === 'krausen' && (
                <ResultRow label="Schlauchen bei" soll={plan.rackingPlato} ist={now.result.rackingPlato} unit="°P" sollTitle="Rezept"
                  sub="scheinbarer Extrakt" />
              )}
              {c.method === 'forced' && (
                <ResultRow label="Druck" soll={plan.pressureBar} ist={now.result.pressureBar} unit="bar" digits={2} sollTitle="Rezept"
                  sub={now.result.storageTempC === undefined ? undefined : `bei ${fmtNum(now.result.storageTempC, 1)} °C`} />
              )}
              {now.speise && (
                <p class={`mt-2 text-sm ${now.speise.enough ? 'text-success' : 'text-caution'}`}>
                  Abgezweigt: {fmtNum(now.speise.haveL, 1)} l –{' '}
                  {now.speise.enough ? 'reicht.' : `es fehlen ${fmtNum(now.speise.needL - now.speise.haveL, 1)} l.`}
                </p>
              )}
              {now.result.notes.map((n) => <p key={n} class="mt-2 text-xs text-muted">{n}</p>)}
            </>
          )}
      </Card>

      <Card title="Abfüllen">
        <h3 class={H3}>Gebinde</h3>
        {rows.length === 0 && <p class="py-2 text-sm text-muted">Noch keine Gebinde.</p>}
        {rows.map((r) => (
          <div key={r.containerId} class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 text-sm last:border-b-0">
            <span class="min-w-[9rem] flex-1">
              {r.container ? containerLabel(r.container) : <span class="text-caution">Gebinde fehlt</span>}
              {r.container && <span class="ml-2 text-xs text-muted">{fmtNum(r.container.sizeL, 2)} l</span>}
            </span>
            <span class="w-24 text-muted" title="Rezept">{planCounts[r.containerId] === undefined ? '—' : `${planCounts[r.containerId]} Stk.`}</span>
            <AmountInput value={r.count} placeholder="0" unit="Stk." disabled={!editable}
              label={`${r.container ? containerLabel(r.container) : 'Gebinde'} Anzahl`}
              onSave={(n) => patch((b) => setContainerCount(b, r.containerId, Math.floor(n ?? 0), planCounts))} />
            <button type="button" class={`${linkDanger} w-28 text-left`} disabled={!editable} aria-label="Gebinde entfernen"
              onClick={() => void patch((b) => setContainerCount(b, r.containerId, undefined, planCounts))}>
              <Trash2 size={14} class="inline" /> entfernen
            </button>
          </div>
        ))}
        <div class="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {addable.length > 0 && (
            <select class={inp} aria-label="Gebinde hinzufügen" disabled={!editable} value=""
              onChange={(e) => {
                const id = e.currentTarget.value;
                e.currentTarget.value = '';
                if (id) void patch((b) => setContainerCount(b, id, 0, planCounts));
              }}>
              <option value="">Gebinde hinzufügen …</option>
              {addable.map((x) => <option key={x.id} value={x.id}>{containerLabel(x)}</option>)}
            </select>
          )}
          {liters !== undefined && <span class="text-muted">Zusammen {fmtNum(liters, 1)} l</span>}
          {!containers && rows.length > 0 && <span class="text-xs text-caution">Gebinde nicht geladen.</span>}
        </div>

        {toFill.length > 0 && (
          <div class="mt-3">
            <h3 class={H3}>Beim Abfüllen</h3>
            {toFill.map((a) => (
              <AdditionRow key={a.row.id} brew={brew} recipe={recipe} row={a.row} amount={a.amount} unit={a.unit}
                editable={editable} patch={patch} />
            ))}
          </div>
        )}

        <div class="mt-3">
          {bottledAt === undefined ? (
            <>
              <p class="mb-2 text-sm text-muted">„Abgefüllt“ gibt den Gärplatz ab heute frei (Belegt bis).</p>
              <button type="button" class={btnPrimary} disabled={!editable} onClick={() => void bottled(Date.now())}>Abgefüllt</button>
            </>
          ) : (
            <div class="max-w-[14rem]">
              <Field label="Abgefüllt um">
                <input type="datetime-local" class={`${inp} w-full`} value={time} disabled={!editable}
                  onInput={(e) => setTime(e.currentTarget.value)}
                  onBlur={(e) => {
                    const value = e.currentTarget.value;
                    const t = Date.parse(value);
                    if (value !== toLocalInput(bottledAt)) void bottled(Number.isNaN(t) ? undefined : t);
                  }} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card title="Bilanz">
        <h3 class={H3}>Volumen</h3>
        {result('Ausschlagmenge', values.postBoilVolume, m.postBoilVolume, 'l', 1, 'postBoilVolume')}
        {result('Anstellwürze', values.batchVolume, m.batchVolume, 'l', 1, 'batchVolume')}
        {speiseShown && result('Speise', values.speiseVolume, m.speiseVolume, 'l', 1, 'speiseVolume')}
        {result('Jungbier', bottling?.youngL, beer?.measured ? beer.youngL : undefined, 'l', 1, 'bottledVolume', 'Anstellwürze ohne Trub und Stopfhopfen')}
        {kegShown && result('Verschnitt im Keg', values.dilutionVolume, m.dilutionVolume, 'l', 1, 'dilutionVolume')}
        {result('Abgefüllt', values.bottledVolume, m.bottledVolume, 'l', 1, 'bottledVolume')}

        <h3 class={H3}>Effizienz</h3>
        <EffRow label="Maischeeffizienz" soll={targets.efficiency?.mashPct} ist={eff.mashPct} />
        <EffRow label="Sudhausausbeute" soll={targets.efficiency?.yieldPct} ist={eff.yieldPct} />
        <EffRow label="Gesamteffizienz" soll={targets.efficiency?.fermenterPct} ist={overall} />

        <h3 class={H3}>Bier</h3>
        {result('Stammwürze', values.pitchGravity, m.pitchGravity, '°P', 1, 'pitchGravity', 'der Anstellwürze')}
        {result('Restextrakt', values.finalGravity, m.finalGravity, '°P', 1, 'finalGravity', 'scheinbar')}
        {result('Alkohol', plannedBeerValues?.abvPct, actualBeerValues?.abvPct, '% vol', undefined, undefined,
          [actualBeerValues?.estimated && 'Stammwürze aus dem Plan', (actualBeerValues ?? plannedBeerValues)?.withSpeise && 'mit Speise', kegShown && 'nach dem Verschnitt']
            .filter(Boolean).join(', ') || undefined)}
        {result('Endvergärungsgrad', plannedBeerValues?.attenuationPct, actualBeerValues?.attenuationPct, '%', 1, undefined, 'scheinbar')}
        <p class="mt-2 text-xs text-muted">Alkohol und Endvergärungsgrad nach Balling aus Stammwürze und Restextrakt. Mit Speise kommt der Alkohol aus ihrer Gärung dazu (aus der Kohlensäure-Zielmenge gerechnet) und die Speise verdünnt das Jungbier; der Endvergärungsgrad bleibt der der Hauptgärung. Ohne gemessene Stammwürze der Anstellwürze steht bei einem Verschnitt im Kessel die geplante. Ein Verschnitt im Keg verdünnt den Alkohol nach Volumen; Stammwürze und Restextrakt bleiben die des vergorenen Biers.</p>
      </Card>

      <Card title="Notizen zur Abfüllung">
        <Field label="Gespeichert mit „Speichern“">
          <textarea class={`${inp} w-full`} rows={2} value={notes ?? ''}
            onInput={(e) => onNotes(e.currentTarget.value || undefined)} />
        </Field>
      </Card>
    </>
  );
}
