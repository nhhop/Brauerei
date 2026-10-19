import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { DEFAULT_CONVERSION, type Brewery, type Brewhouse } from '../../brewhouse';
import { BASIS_LABEL, basisOf, efficiencyInput, lauterText, type Efficiency, type EfficiencyBasis } from '../../efficiency';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { useCatalog } from '../../ingredientSource';
import { ingredientFigures } from '../../ingredientRows';
import { atKnockOut, buGu, calcStats, pitchedL, wortExtract } from '../../recipeStats';
import { calcTreatment } from '../../recipeTreatment';
import { calcMash, fmtClock } from '../../mashPlan';
import { calcWater, fmtL } from '../../recipeWater';
import {
  KINDS, TIMING_LABEL, chargeIdOf, chargesOf, isMashGrain, replaceDecoctions, type Ingredient, type Recipe,
  type RecipeSummary, type Timing,
} from '../../recipes';
import { Segmented } from '../../components/Segmented';
import { badgeAccent, btnSecondary, inp } from '../../ui';
import { BeerGlass } from './BeerGlass';
import { Section } from './CalcTable';
import { Card, Field, NumInput, Override } from './fields';
import { KindTable, ProcessTable, type IngredientGroup } from './IngredientCard';
import { StyleCard } from './StyleCard';
import { StyleDialog } from './StyleDialog';
import { VersionCompareDialog } from './VersionCompareDialog';
import { VersionsCard } from './Versions';
import { resolveStyle, styleCode, useStyleSources, type StyleSource } from '../../styleSource';

export interface TabProps {
  recipe: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
  brewhouses: Brewhouse[] | null;  // null = the list did not load
  brewery: Brewery | null;         // null = not loaded (yet)
  versions?: RecipeSummary[];      // this recipe's versions, oldest first (overview only)
  onOpenVersion?: (id: string) => void;
  dirty?: boolean;                 // the recipe has unsaved edits (overview only)
}

export function Stat({ label, value, unit, digits, sub, large }: {
  label: string; value?: number; unit: string; digits: number; sub?: string; large?: boolean;
}) {
  return (
    <div>
      <dt class="text-xs text-muted">{label}</dt>
      <dd class={large ? 'text-2xl font-semibold leading-tight tabular-nums' : 'text-lg font-semibold'}>
        {value === undefined ? '—' : <>{value.toFixed(digits).replace('.', ',')} <span class="text-xs font-normal text-muted">{unit}</span></>}
      </dd>
      {sub && <dd class="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

// A recipe may point to a brewhouse that was deleted since; it stays selectable as "(fehlt)".
function BrewhouseSelect({ recipe, onChange, brewhouses }: Omit<TabProps, 'brewery'>) {
  const id = recipe.brewhouseId;
  const missing = id && !brewhouses?.some((b) => b.id === id);
  return (
    <div class="flex flex-wrap items-center gap-2">
      <select class={`${inp} min-w-0 flex-1`} value={id ?? ''}
        onChange={(e) => onChange({ brewhouseId: e.currentTarget.value || undefined })}>
        <option value="">— keins —</option>
        {brewhouses?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        {missing && <option value={id}>{id} (fehlt)</option>}
      </select>
      {brewhouses?.length === 0 && (
        <a href="/settings/anlage" class="text-sm text-accent hover:underline">Brauanlage einrichten</a>
      )}
    </div>
  );
}

// The style as a name with its source; the dialog sets it. A link whose style
// is gone (an own style deleted) keeps the name and says so.
function StyleField({ recipe, sources, onOpen }: { recipe: Recipe; sources: StyleSource[] | null; onOpen: () => void }) {
  const linked = resolveStyle(sources, recipe);
  const ownSource = sources?.find((s) => s.guide === 'own');
  const sub = linked ? `${linked.source.label}${styleCode(linked.style) ? ` ${styleCode(linked.style)}` : ''}`
    : recipe.styleGuide === 'own' && ownSource && !ownSource.failed ? 'Eigener Stil nicht mehr vorhanden'
    : recipe.style && !recipe.styleId ? 'ohne Kennwerte'
    : undefined;
  return (
    <div class="block text-xs text-muted">
      <span class="mb-1 block">Stil</span>
      <div class="flex items-center gap-2">
        <span class={`${inp} min-w-0 flex-1 truncate`}>
          {recipe.style || <span class="text-muted">Kein Stil</span>}
          {sub && <span class="ml-2 text-xs text-muted">{sub}</span>}
        </span>
        <button type="button" class={btnSecondary} disabled={!sources} onClick={onOpen}>
          {recipe.style ? 'Ändern' : 'Wählen'}
        </button>
      </div>
    </div>
  );
}

export function OverviewTab({ recipe, onChange, brewhouses, brewery, versions, onOpenVersion, dirty }: TabProps) {
  const [comparing, setComparing] = useState(false);
  const [pickingStyle, setPickingStyle] = useState(false);
  const catalog = useCatalog();
  const { sources } = useStyleSources();
  const linked = resolveStyle(sources, recipe);
  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  const entries = catalog?.entries ?? null;
  const hot = atKnockOut(recipe, bh, entries, brewery);
  const stats = catalog ? calcStats(hot, catalog.entries, bh, brewery) : null;
  const wort = catalog ? wortExtract(hot, catalog.entries, bh, brewery) : undefined;
  const water = calcWater(hot, bh, wort?.extractKg, brewery, wort?.draw).water;
  const mash = bh && water ? calcMash(recipe, bh, brewery, water) : undefined;
  // Picking a brewhouse without a decoction vessel leaves the plan's decoctions
  // to be counted as rests; offer to turn them into rests for good.
  const stranded = !!mash && !mash.decoction && recipe.mash.some((s) => s.kind === 'decoction');
  const bugu = stats?.ibu !== undefined && stats.ogPlato !== undefined ? buGu(stats.ibu, stats.ogPlato) : undefined;
  const so4Cl = water && calcTreatment(recipe, water, brewery, catalog?.entries ?? null).columns[0].after.so4Cl;
  return (
    <>
      <Section title="Rezept">
        <div class="flex flex-col gap-4 p-4">
          <div class="flex items-center gap-5">
            <BeerGlass ebc={stats?.ebc} />
            <div class="flex min-w-0 flex-1 flex-col gap-2.5">
              <input class={`${inp} w-full px-2.5 py-1.5 text-xl font-semibold`} aria-label="Name" value={recipe.name}
                onInput={(e) => onChange({ name: e.currentTarget.value })} />
              <textarea class={`${inp} w-full`} rows={2} aria-label="Beschreibung" placeholder="Was soll das Bier sein?"
                value={recipe.description} onInput={(e) => onChange({ description: e.currentTarget.value })} />
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <Field label="Sudhaus">
              <BrewhouseSelect recipe={recipe} onChange={onChange} brewhouses={brewhouses} />
              {stranded && (
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-caution">
                  <span>„{bh!.name}“ hat keinen zweiten beheizten Behälter, die Dekoktionen im Maischeplan zählen als Rasten.</span>
                  <button type="button" class="rounded-md border border-border px-2 py-0.5 text-muted hover:bg-fg/10"
                    onClick={() => onChange({ mash: replaceDecoctions(recipe.mash, (s) => mash?.rows.find((r) => r.step.id === s.id)?.tempC) })}>
                    Durch Rasten ersetzen
                  </button>
                </div>
              )}
            </Field>
            <VolumeField recipe={recipe} onChange={onChange} bh={bh} entries={entries} brewery={brewery} knockOutL={hot.volumeL} />
            <StyleField recipe={recipe} sources={sources} onOpen={() => setPickingStyle(true)} />
            <EfficiencyField recipe={recipe} onChange={onChange} bh={bh} brewery={brewery} />
          </div>
        </div>
      </Section>
      <Section title="Kennwerte">
        <div class="p-4">
          {stats ? (
            <>
              <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Stammwürze" value={stats.ogPlato} unit="°P" digits={1} />
                <Stat label="Restextrakt" value={stats.fgPlato} unit="°P" digits={1} />
                <Stat label="Alkohol" value={stats.abv} unit="% vol" digits={1} />
                <Stat label="Bittere" value={stats.ibu} unit="IBU" digits={0} />
                <Stat label="Farbe" value={stats.ebc} unit="EBC" digits={0} />
              </dl>
              {stats.efficiency && <EfficiencyChain e={stats.efficiency} />}
              {stats.notes.length > 0 && (
                <ul class="mt-3 space-y-1 text-xs text-muted">
                  {stats.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p class="text-sm text-muted">Katalog nicht geladen, Kennwerte nicht verfügbar.</p>
          )}
        </div>
      </Section>
      {(bugu !== undefined || so4Cl !== undefined) && (
        <Section title="Charakter">
          <div class="flex flex-col gap-5 p-4">
            {bugu !== undefined && (
              <Scale label="Bittere" detail={<>BU:GU <span class="font-medium text-fg">{bugu.toFixed(2).replace('.', ',')}</span></>}
                at={(bugu - BUGU_MIN) / (BUGU_MAX - BUGU_MIN)} zone={[(0.5 - BUGU_MIN) / (BUGU_MAX - BUGU_MIN), (0.8 - BUGU_MIN) / (BUGU_MAX - BUGU_MIN)]}
                ends={['mild', 'ausgewogen', 'herb']} />
            )}
            {so4Cl !== undefined && <So4ClScale ratio={so4Cl} />}
          </div>
        </Section>
      )}
      {linked && <StyleCard style={linked.style} source={linked.source} stats={stats ?? { notes: [] }} />}
      {pickingStyle && sources && (
        <StyleDialog recipe={recipe} sources={sources} stats={stats}
          onPick={(p) => { onChange(p); setPickingStyle(false); }} onClose={() => setPickingStyle(false)} />
      )}
      {versions && versions.length > 1 && onOpenVersion && (
        <VersionsCard versions={versions} current={recipe.id} onOpen={onOpenVersion} onCompare={() => setComparing(true)} />
      )}
      {comparing && versions && versions.length > 1 && (
        <VersionCompareDialog versions={versions} recipe={recipe} dirty={!!dirty} brewhouses={brewhouses} brewery={brewery}
          onClose={() => setComparing(false)} />
      )}
      <Section title="Brauplan">
        <ul class="space-y-1 p-4 text-sm text-muted">
          <li>{recipe.ingredients.length} Zutat{recipe.ingredients.length === 1 ? '' : 'en'}</li>
          <li>Maischen: {recipe.mash.length} Schritte{mash ? `, ${fmtClock(mash.totalMin)} h` : ''}</li>
          <li>Würzekochen: {recipe.boil.durationMin} min</li>
          <li>Gärung: {recipe.fermentation.length} Phase{recipe.fermentation.length === 1 ? '' : 'n'}</li>
        </ul>
      </Section>
    </>
  );
}

// The recipe's volume: the knock-out (hot) or the Anstellwürze (cold, the
// knock-out is counted back). Switching converts the volume, the beer stays.
function VolumeField({ recipe, onChange, bh, entries, brewery, knockOutL }: Pick<TabProps, 'recipe' | 'onChange' | 'brewery'> & {
  bh?: Brewhouse; entries: CatalogIngredient[] | null; knockOutL: number;
}) {
  const cold = recipe.volumeBasis === 'cold';
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const pitch = cold ? pitchedL(recipe, bh, entries, brewery) : undefined;
  const setBasis = (b: 'hot' | 'cold') => {
    if (b === 'cold' && !cold) onChange({ volumeBasis: 'cold', volumeL: round1(pitchedL(recipe, bh, entries, brewery)) });
    if (b === 'hot' && cold) onChange({ volumeBasis: undefined, volumeL: round1(knockOutL) });
  };
  return (
    <Field label={cold ? 'Anstellwürze' : 'Ausschlagmenge'}>
      <div class="flex flex-wrap items-center gap-2">
        <NumInput unit="l" value={recipe.volumeL} onChange={(n) => onChange({ volumeL: n })} />
        <Segmented value={cold ? 'cold' : 'hot'} onChange={setBasis}
          options={[{ value: 'hot', label: 'heiß' }, { value: 'cold', label: 'kalt' }]} />
      </div>
      {cold && <p class="mt-1 text-xs text-muted">Ausschlag {fmtL(knockOutL)}, aus der Anstellwürze zurückgerechnet</p>}
      {pitch !== undefined && Math.abs(pitch - recipe.volumeL) > 0.05 && (
        <p class="mt-1 text-xs text-caution">Diese Anstellwürze ist nicht erreichbar, gerechnet wird mit {fmtL(pitch)}.</p>
      )}
    </Field>
  );
}

// The input of the brewery's efficiency basis (efficiency.ts). The Konversion
// is the brewhouse's unless the recipe sets its own.
function EfficiencyField({ recipe, onChange, bh, brewery }: Pick<TabProps, 'recipe' | 'onChange' | 'brewery'> & { bh?: Brewhouse }) {
  const basis = basisOf(brewery);
  const label = BASIS_LABEL[basis];
  if (basis === 'conversion') {
    return (
      <Override label={label} unit="%" value={recipe.conversionPct} brewhouse={bh?.mashEfficiencyPct ?? DEFAULT_CONVERSION}
        onChange={(conversionPct) => onChange({ conversionPct })} />
    );
  }
  return (
    <Field label={label}>
      <NumInput unit="%" value={efficiencyInput(recipe, bh, basis).pct} onChange={(n) => onChange({ efficiencyPct: n })} />
    </Field>
  );
}

// The whole chain, the input marked; what cannot follow (no brewhouse, no
// grain) is left out.
function EfficiencyChain({ e }: { e: Efficiency }) {
  const links: { basis?: EfficiencyBasis; label: string; value?: number; sub: string }[] = [
    { basis: 'conversion', label: BASIS_LABEL.conversion, value: e.conversionPct, sub: 'gelöst in der Maische' },
    { label: 'Läutereffizienz', value: e.lauter?.pct, sub: e.lauter ? lauterText(e.lauter) : '' },
    { basis: 'mash', label: BASIS_LABEL.mash, value: e.mashPct, sub: 'in der Pfanne' },
    { basis: 'yield', label: BASIS_LABEL.yield, value: e.yieldPct, sub: 'je kg Schüttung' },
    { basis: 'fermenter', label: BASIS_LABEL.fermenter, value: e.fermenterPct, sub: 'im Gärbehälter' },
  ];
  return (
    <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-5">
      {links.filter((l) => l.value !== undefined).map((l) => (
        <div key={l.label}>
          <dt class="flex flex-wrap items-center gap-1 text-xs text-muted">
            {l.label}
            {l.basis === e.basis && (
              <span class={badgeAccent}>{e.inputFrom === 'Rezept' ? 'Eingabe' : `Eingabe · ${e.inputFrom}`}</span>
            )}
          </dt>
          <dd class="text-lg font-semibold">
            {Math.round(l.value!)} <span class="text-xs font-normal text-muted">%</span>
          </dd>
          <dd class="text-xs text-muted">{l.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

// A marker on a bar with the balanced zone highlighted; `at` and `zone` are 0..1.
function Scale({ label, detail, at, zone, ends }: {
  label: string; detail: ComponentChildren; at: number; zone: [number, number]; ends: [string, string, string];
}) {
  const pos = (x: number) => Math.min(Math.max(x, 0), 1) * 100;
  return (
    <div>
      <div class="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{detail}</span>
      </div>
      <div class="relative h-2 rounded-full bg-fg/10">
        <div class="absolute inset-y-0 rounded-full bg-accent/25" style={{ left: `${pos(zone[0])}%`, width: `${pos(zone[1]) - pos(zone[0])}%` }} />
        <div class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent"
          style={{ left: `${pos(at)}%` }} />
      </div>
      <div class="mt-1 grid grid-cols-3 text-xs text-muted">
        <span>{ends[0]}</span>
        <span class="text-center">{ends[1]}</span>
        <span class="text-right">{ends[2]}</span>
      </div>
    </div>
  );
}

// BU:GU on a linear scale; the zone limits follow common brewing guides.
// TODO(verify): 0.5 and 0.8 have no primary source here yet.
const BUGU_MIN = 0.2;
const BUGU_MAX = 1.4;

// Sulfate : chloride of the strike water on a log scale from 1:4 to 4:1.
// TODO(verify): the zone limits 0.8 and 1.5 follow common calculators
// (Brewfather, Bru'n Water) and have no primary source here yet.
function So4ClScale({ ratio }: { ratio: number }) {
  const pos = (r: number) => (Math.log(r) / Math.log(4) + 1) / 2;
  return (
    <Scale label="Wasserprofil (Hauptguss)" detail={<>SO₄ : Cl <span class="font-medium text-fg">{ratio.toFixed(2).replace('.', ',')}</span></>}
      at={pos(ratio)} zone={[pos(0.8), pos(1.5)]} ends={['weich, vollmundig', 'ausgewogen', 'trocken, knackig']} />
  );
}

// The table figures (ingredientRows.ts) of the recipe at its knock-out.
export function useFigures(recipe: Recipe, brewhouses: Brewhouse[] | null, brewery: Brewery | null) {
  const entries = useCatalog()?.entries ?? null;
  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  return ingredientFigures(atKnockOut(recipe, bh, entries, brewery), entries, bh, brewery);
}

export function IngredientsTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const figures = useFigures(recipe, brewhouses, brewery);
  // With more than one charge, a mash grain shows the one it belongs to.
  const charges = chargesOf(recipe);
  const mark = charges.length > 1
    ? (i: Ingredient) => (isMashGrain(i) ? charges.find((c) => c.id === chargeIdOf(i, charges))!.name : undefined)
    : undefined;
  return (
    <>
      {KINDS.map((k) => (
        <KindTable key={k.id} kind={k.id} all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
          figures={figures} boilMin={recipe.boil.durationMin} mark={mark} />
      ))}
    </>
  );
}

const num = (n: number) => n.toFixed(0);

// The steps of a process tab: `always` are shown even without rows.
function processSteps(recipe: Recipe, scope: 'boil' | 'fermentation', bh?: Brewhouse): IngredientGroup[] {
  const step = (id: string, timings: Timing[], note?: string, always = true): IngredientGroup => ({
    id, title: TIMING_LABEL[timings[0]], note, match: (i) => timings.includes(i.timing),
    add: { timing: timings[0] }, empty: always ? 'Keine Zutaten' : undefined,
  });
  const b = recipe.boil;
  if (scope === 'boil') {
    return [
      step('preBoil', ['preBoil'], undefined, false),
      step('firstWort', ['firstWort'], 'beim Läutern in die Pfanne'),
      step('boil', ['boil'], `${num(b.durationMin)} min · 0 min = Kochende`),
      { ...step('whirlpool', ['whirlpool'], `${num(b.whirlpoolTempC)} °C · ${num(b.whirlpoolMin)} min`), title: 'Whirlpool / Hop Stand' },
      step('hopBack', ['hopBack'], undefined, !!bh?.steps.hopback),
      step('knockOut', ['knockOut'], undefined, false),
      step('kettleSour', ['kettleSour'], undefined, false),
    ];
  }
  return [
    { ...step('pitch', ['pitch', 'dip'], 'vor und mit der Hefegabe, Dip Hopping') },
    step('primary', ['primary']),
    step('maturation', ['maturation'], 'Stopfen, Schönung, zweite Kultur'),
    step('bottling', ['bottling']),
  ];
}

export function ProcessIngredients({ recipe, onChange, scope, brewhouses, brewery }: Omit<TabProps, 'versions'> & { scope: 'boil' | 'fermentation' }) {
  const figures = useFigures(recipe, brewhouses, brewery);
  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  return (
    <ProcessTable title="Zutaten" info="alle Zutaten nach Art unter Zutaten" scope={scope} mode="process"
      all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
      figures={figures} boilMin={recipe.boil.durationMin} groups={processSteps(recipe, scope, bh)} />
  );
}

export function BoilTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const b = recipe.boil;
  const set = (p: Partial<Recipe['boil']>) => onChange({ boil: { ...b, ...p } });
  return (
    <>
      <Card title="Kochen & Whirlpool">
        <div class="flex flex-wrap gap-4">
          <Field label="Kochdauer"><NumInput unit="min" value={b.durationMin} onChange={(n) => set({ durationMin: n })} /></Field>
          <Field label="Whirlpool-Temperatur"><NumInput unit="°C" value={b.whirlpoolTempC} onChange={(n) => set({ whirlpoolTempC: n })} /></Field>
          <Field label="Whirlpool-Dauer"><NumInput unit="min" value={b.whirlpoolMin} onChange={(n) => set({ whirlpoolMin: n })} /></Field>
        </div>
      </Card>
      <ProcessIngredients recipe={recipe} onChange={onChange} brewhouses={brewhouses} brewery={brewery} scope="boil" />
    </>
  );
}
