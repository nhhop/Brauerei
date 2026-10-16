import { useEffect, useState } from 'preact/hooks';
import { Plus, Trash2 } from 'lucide-preact';
import type { SugarType } from '../../brewMath';
import { containerLabel, listContainers, listFermenters, type Container, type Fermenter } from '../../cellar';
import { calcBottling, calcCarbonation, maxPhasePressureBar, type Bottling, type CarbonationResult } from '../../fermentation';
import { useCatalog } from '../../ingredientSource';
import { atKnockOut, calcStats, wortExtract } from '../../recipeStats';
import { fmtL, resolveDilution } from '../../recipeWater';
import { CARBONATION_METHODS, type BottlingRow, type Carbonation, type CarbonationMethod, type Recipe } from '../../recipes';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { inp } from '../../ui';
import { Card, Field, NumInput, OptNum, Select } from './fields';
import { PhaseList } from './PhaseList';
import { ProcessIngredients, Stat, type TabProps } from './tabs';
import { Row } from './WaterTab';

const SUGARS: { value: SugarType; label: string }[] = [
  { value: 'saccharose', label: 'Saccharose' }, { value: 'traubenzucker', label: 'Traubenzucker' }, { value: 'dme', label: 'DME' },
];

const num = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');

// Fermentation phases, carbonation and the volume chain to the containers
// (fermentation.ts). Fermenters and containers come from the cellar.
export function FermentationTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const catalog = useCatalog();
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [fermenters, setFermenters] = useState<Fermenter[] | null>(null);
  useEffect(() => {
    let alive = true;
    listContainers().then((l) => alive && setContainers(l)).catch(() => {});
    listFermenters().then((l) => alive && setFermenters(l)).catch(() => {});
    return () => { alive = false; };
  }, []);

  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  const entries = catalog?.entries ?? null;
  const hot = atKnockOut(recipe, bh, entries, brewery);
  const wort = entries ? wortExtract(hot, entries, bh, brewery) : undefined;
  const stats = entries ? calcStats(hot, entries, bh, brewery) : undefined;
  const dilution = wort && resolveDilution(hot, wort.extractKg, bh, wort.draw);
  const bottling = bh && wort && dilution ? calcBottling(hot, bh, dilution, wort.draw, containers) : undefined;
  const carbonation = calcCarbonation(recipe, { beerL: bottling?.beerL ?? 0, fgPlato: stats?.fgPlato, speiseL: dilution?.speiseL ?? 0 });

  const maxBar = maxPhasePressureBar(recipe);
  const pressureHint = maxBar > 0 && fermenters && !fermenters.some((f) => (f.maxPressureBar ?? 0) >= maxBar)
    ? `Kein Gärplatz ist bis ${num(maxBar)} bar druckfest.` : undefined;

  return (
    <>
      <PhaseList title="Gärführung" addLabel="Phase" namePlaceholder="z.B. Hauptgärung"
        durationUnit="Tage" empty="Noch keine Phasen." pressure={!!recipe.pressureFermentation}
        items={recipe.fermentation} onChange={(fermentation) => onChange({ fermentation })}
        top={
          <div class="mb-3">
            <div class="flex items-center gap-3 text-sm">
              <ToggleSwitch checked={!!recipe.pressureFermentation}
                onChange={(on) => onChange({ pressureFermentation: on ? true : undefined })} />
              <span>Unter Druck vergären</span>
            </div>
            {pressureHint && <p class="mt-1 text-xs text-caution">{pressureHint}</p>}
          </div>
        } />
      <ProcessIngredients recipe={recipe} onChange={onChange} scope="fermentation" />
      <CarbonationCard recipe={recipe} onChange={onChange} result={carbonation} haveBeer={!!bottling} />
      <BottlingCard recipe={recipe} onChange={onChange} b={bottling} containers={containers}
        missing={!catalog ? 'Katalog nicht geladen, Abfüllmenge nicht verfügbar.' : !bh ? 'Sudhaus in der Übersicht wählen.' : undefined} />
    </>
  );
}

function CarbonationCard({ recipe, onChange, result: r, haveBeer }: {
  recipe: Recipe; onChange: (p: Partial<Recipe>) => void; result?: CarbonationResult; haveBeer: boolean;
}) {
  const c = recipe.carbonation;
  const set = (p: Partial<Carbonation>) => onChange({ carbonation: { ...c!, ...p } });
  function setMethod(m: CarbonationMethod | '') {
    if (!m) return onChange({ carbonation: undefined });
    onChange({ carbonation: { method: m, targetVol: c?.targetVol ?? 2.5, ...(m === 'sugar' ? { sugarType: c?.sugarType } : {}) } });
  }
  const at = (t?: number) => (t === undefined ? undefined : `bei ${num(t)} °C`);
  return (
    <Card title="Karbonisierung">
      <div class="flex flex-wrap items-end gap-4">
        <Field label="Verfahren">
          <select class={inp} value={c?.method ?? ''} onChange={(e) => setMethod(e.currentTarget.value as CarbonationMethod | '')}>
            <option value="">— keins —</option>
            {CARBONATION_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        {c && (
          <Field label="Ziel">
            <NumInput unit="vol CO₂" value={c.targetVol} onChange={(n) => set({ targetVol: n })} class="w-20" />
          </Field>
        )}
        {c?.method === 'sugar' && (
          <Field label="Zucker">
            <select class={inp} value={c.sugarType ?? 'saccharose'}
              onChange={(e) => set({ sugarType: e.currentTarget.value === 'saccharose' ? undefined : e.currentTarget.value as SugarType })}>
              {SUGARS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
        )}
      </div>
      {c && r && (
        <>
          <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {c.method !== 'forced' && <Stat label="Restkohlensäure" value={r.residualVol} unit="vol" digits={2} sub={at(r.residualTempC)} />}
            {c.method === 'sugar' && (
              <Stat label="Zucker" value={haveBeer ? r.sugarG : undefined} unit="g" digits={0} sub={haveBeer ? undefined : 'braucht die Abfüllmenge'} />
            )}
            {c.method === 'speise' && <Stat label="Speise" value={r.speiseL} unit="l" digits={1} sub="beim Ausschlagen abzweigen" />}
            {c.method === 'krausen' && <Stat label="Schlauchen bei" value={r.rackingPlato} unit="°P" digits={1} sub="scheinbarer Extrakt" />}
            {c.method === 'forced' && <Stat label="Druck" value={r.pressureBar} unit="bar" digits={2} sub={at(r.storageTempC)} />}
          </dl>
          <Notes notes={r.notes} />
        </>
      )}
    </Card>
  );
}

function BottlingCard({ recipe, onChange, b, containers, missing }: {
  recipe: Recipe; onChange: (p: Partial<Recipe>) => void; b?: Bottling; containers: Container[] | null; missing?: string;
}) {
  const rows = recipe.bottling?.containers ?? [];
  const setRows = (next: BottlingRow[]) => onChange({ bottling: next.length ? { containers: next } : undefined });
  const patch = (i: number, p: Partial<BottlingRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  // A new row: the rest row before it keeps the count it had.
  function add() {
    const fixed = rows.map((r, j) => (r.count === undefined && j === rows.length - 1 ? { ...r, count: b?.lines[j]?.count ?? 0 } : r));
    setRows([...fixed, { containerId: containers![0].id }]);
  }
  const opts = (containers ?? []).map((c) => ({ value: c.id, text: containerLabel(c) }));
  return (
    <Card title="Abfüllmenge"
      action={
        <button type="button" disabled={!containers?.length} onClick={add}
          title={containers?.length ? undefined : 'Keine Gebinde im Gärkeller'}
          class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10 disabled:opacity-40">
          <Plus size={12} /> Gebinde
        </button>
      }>
      <div class="flex flex-wrap items-end gap-4">
        <Field label="Trub">
          <OptNum unit="l" value={recipe.trubLossL} placeholder="0" onChange={(trubLossL) => onChange({ trubLossL })} />
        </Field>
      </div>
      {rows.length > 0 && (
        <div class="mt-3 space-y-2">
          {rows.map((r, i) => {
            const last = i === rows.length - 1;
            const line = b?.lines[i];
            return (
              <div key={i} class="flex flex-wrap items-center gap-2">
                <div class="min-w-0 flex-1 basis-40">
                  <Select value={r.containerId} groups={[{ opts }]} empty={null} onChange={(containerId) => patch(i, { containerId })} />
                </div>
                <div class="flex items-center gap-1 text-xs text-muted">
                  <OptNum value={r.count} placeholder={last ? 'Rest' : '0'} class="w-16"
                    onChange={(n) => patch(i, { count: n === undefined ? (last ? undefined : 0) : Math.max(0, Math.round(n)) })} />
                  Stück
                  {line?.rest && <span class="text-fg">= {line.count}</span>}
                </div>
                <button type="button" title="Entfernen" onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {containers?.length === 0 && (
        <p class="mt-2 text-xs text-muted">Gebinde legst du im <a href="/settings/anlage" class="text-accent hover:underline">Gärkeller</a> an.</p>
      )}
      {missing || !b ? (
        <p class="mt-3 text-sm text-muted">{missing}</p>
      ) : (
        <>
          <dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Anstellwürze" value={b.pitchL} unit="l" digits={1} />
            <Stat label="Jungbier" value={b.youngL} unit="l" digits={1} />
            <Stat label="Abgefüllt" value={b.bottledL} unit="l" digits={1} sub={b.leftL > 0.05 ? `Rest ${fmtL(b.leftL)}` : undefined} />
            <Stat label="Flaschen" value={rows.length ? b.bottles : undefined} unit="Stück" digits={0}
              sub={b.kegs ? `dazu ${b.kegs} Keg${b.kegs === 1 ? '' : 's'}` : undefined} />
          </dl>
          <BottlingBar b={b} />
          <BottlingCalculation b={b} cold={recipe.volumeBasis === 'cold'} />
          <Notes notes={b.notes} />
        </>
      )}
    </Card>
  );
}

// Where the knock-out (and a dilution in the fermenter) ends up. Slots 3 and 4
// are below 3:1 contrast on the light theme, so the legend carries every value.
function BottlingBar({ b }: { b: Bottling }) {
  const mix = (v: string) => `color-mix(in srgb, var(${v}) 45%, transparent)`;
  const parts = [
    { label: 'Abgefüllt', l: b.bottledL, color: 'var(--series-1)' },
    { label: 'Kühlschwund', l: b.intake.shrinkL, color: 'var(--series-2)' },
    { label: 'Totraum/Transfer', l: b.intake.losses.reduce((s, x) => s + x.l, 0), color: mix('--series-2') },
    { label: 'Hopfen', l: b.intake.kettleHopL + b.dryHopL, color: 'var(--series-3)' },
    { label: 'Trub', l: b.trubL, color: 'var(--series-4)' },
    { label: 'Abfüllverlust', l: b.fillLossL, color: mix('--series-4') },
    ...(b.leftL > 0 ? [{ label: 'Rest', l: b.leftL, color: 'color-mix(in srgb, var(--fg) 20%, transparent)' }] : []),
  ];
  const total = b.intake.cooledL + b.intake.shrinkL + b.dilutionL;
  if (total <= 0) return null;
  const pct = (l: number) => (l / total) * 100;
  return (
    <div class="mt-4">
      <div class="flex h-4 gap-[2px] overflow-hidden rounded">
        {parts.filter((p) => p.l > 0).map((p) => (
          <div key={p.label} class="h-full" style={{ width: `${pct(p.l)}%`, background: p.color }}
            title={`${p.label}: ${fmtL(p.l)} (${Math.round(pct(p.l))} %)`} />
        ))}
      </div>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.label} class="flex items-center gap-1.5">
            <span class="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <span class="text-fg">{fmtL(p.l)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// `cold`: the recipe's volume is the Anstellwürze, the knock-out follows from it.
function BottlingCalculation({ b, cold }: { b: Bottling; cold: boolean }) {
  const knockOutL = b.intake.cooledL + b.intake.shrinkL;
  const shrinkPct = knockOutL > 0 ? (b.intake.shrinkL / knockOutL) * 100 : 0;
  return (
    <details class="mt-4">
      <summary class="cursor-pointer text-sm">Berechnung</summary>
      <div class="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-sm">
        <Row label="Ausschlag" l={knockOutL} from={cold ? undefined : 'Rezept'} />
        <Row op="−" label={`Kühlschwund (${num(shrinkPct)} %)`} l={b.intake.shrinkL} from="Sudhaus" />
        {b.intake.losses.map((x) => <Row key={x.label} op="−" label={x.label} l={x.l} from="Sudhaus" />)}
        {b.intake.kettleHopL > 0 && <Row op="−" label="Hopfen im Kessel" l={b.intake.kettleHopL} />}
        {b.speiseL > 0 && <Row op="−" label="Speise" l={b.speiseL} />}
        {b.dilutionL > 0 && <Row op="+" label="Verschnitt im Gärbehälter" l={b.dilutionL} from="Rezept" />}
        <Row op="=" label="Anstellwürze" l={b.pitchL} from={cold ? 'Rezept' : undefined} strong />
        <Row op="−" label="Trub" l={b.trubL} from="Rezept" />
        {b.dryHopL > 0 && <Row op="−" label="Hopfen im Gärbehälter" l={b.dryHopL} />}
        <Row op="=" label="Jungbier" l={b.youngL} strong />
        {b.speiseL > 0 && <Row op="+" label="Speise" l={b.speiseL} />}
        {b.fillLossL > 0 && <Row op="−" label="Abfüllverluste" l={b.fillLossL} />}
        {b.leftL > 0 && <Row op="−" label="Rest, passt in kein ganzes Gebinde" l={b.leftL} />}
        <Row op="=" label="Abgefüllt" l={b.bottledL} strong />
      </div>
      <p class="mt-2 text-xs text-muted">
        Hopfen hält je Gramm Würze zurück, abhängig von der Form (Schätzwerte). Ohne Form am Hopfen gilt die des Lagerpostens, sonst T90.
      </p>
    </details>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul class="mt-3 space-y-1 text-xs text-muted">
      {notes.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}
