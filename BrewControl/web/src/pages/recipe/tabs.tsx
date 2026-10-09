import { DEFAULT_CONVERSION, type Brewery, type Brewhouse } from '../../brewhouse';
import { BASIS_LABEL, basisOf, efficiencyInput, lauterText, type Efficiency, type EfficiencyBasis } from '../../efficiency';
import { useCatalog } from '../../ingredientSource';
import { calcStats, wortExtract } from '../../recipeStats';
import { calcTreatment } from '../../recipeTreatment';
import { calcMash, fmtClock } from '../../mashPlan';
import { calcWater } from '../../recipeWater';
import {
  KINDS, SCOPE_TIMINGS, chargeIdOf, chargesOf, isMashGrain, replaceDecoctions, type Ingredient, type Recipe, type Scope,
} from '../../recipes';
import { badgeAccent, inp } from '../../ui';
import { Card, Field, NumInput, Override } from './fields';
import { IngredientCard } from './IngredientCard';
import { PhaseList } from './PhaseList';
import { StyleCard } from './StyleCard';
import { StylePicker } from './StylePicker';
import { STYLE_COMPARISON } from '../../styleSource';

export interface TabProps {
  recipe: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
  brewhouses: Brewhouse[] | null;  // null = the list did not load
  brewery: Brewery | null;         // null = not loaded (yet)
}

export function Stat({ label, value, unit, digits, sub }: {
  label: string; value?: number; unit: string; digits: number; sub?: string;
}) {
  return (
    <div>
      <dt class="text-xs text-muted">{label}</dt>
      <dd class="text-lg font-semibold">
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

export function OverviewTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const catalog = useCatalog();
  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  const stats = catalog ? calcStats(recipe, catalog.ingredients, bh, brewery) : null;
  const water = calcWater(recipe, bh, catalog ? wortExtract(recipe, catalog.ingredients, bh, brewery).extractKg : undefined, brewery).water;
  const mash = bh && water ? calcMash(recipe, bh, brewery, water) : undefined;
  // Picking a brewhouse without a decoction vessel leaves the plan's decoctions
  // to be counted as rests; offer to turn them into rests for good.
  const stranded = !!mash && !mash.decoction && recipe.mash.some((s) => s.kind === 'decoction');
  const so4Cl = water && calcTreatment(recipe, water, brewery, catalog?.ingredients ?? null).columns[0].after.so4Cl;
  return (
    <>
      <Card title="Rezept">
        <div class="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input class={`${inp} w-full`} value={recipe.name}
              onInput={(e) => onChange({ name: e.currentTarget.value })} />
          </Field>
          <Field label="Stil">
            {STYLE_COMPARISON ? (
              <StylePicker recipe={recipe} onChange={onChange} />
            ) : (
              <input class={`${inp} w-full`} value={recipe.style} placeholder="z.B. Pale Ale"
                onInput={(e) => onChange({ style: e.currentTarget.value })} />
            )}
          </Field>
          <Field label="Ausschlagmenge (l)">
            <NumInput value={recipe.volumeL} onChange={(n) => onChange({ volumeL: n })} />
          </Field>
          <EfficiencyField recipe={recipe} onChange={onChange} bh={bh} brewery={brewery} />
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
          <div class="md:col-span-2">
            <Field label="Beschreibung">
              <textarea class={`${inp} w-full`} rows={3} value={recipe.description}
                onInput={(e) => onChange({ description: e.currentTarget.value })} />
            </Field>
          </div>
        </div>
      </Card>
      <Card title="Kennwerte">
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
      </Card>
      {so4Cl !== undefined && (
        <Card title="Charakter">
          <So4ClScale ratio={so4Cl} />
        </Card>
      )}
      {STYLE_COMPARISON && <StyleCard recipe={recipe} stats={stats ?? { notes: [] }} />}
      <Card title="Brauplan">
        <ul class="space-y-1 text-sm text-muted">
          <li>{recipe.ingredients.length} Zutat{recipe.ingredients.length === 1 ? '' : 'en'}</li>
          <li>Maischen: {recipe.mash.length} Schritte{mash ? `, ${fmtClock(mash.totalMin)} h` : ''}</li>
          <li>Würzekochen: {recipe.boil.durationMin} min</li>
          <li>Gärung: {recipe.fermentation.length} Phase{recipe.fermentation.length === 1 ? '' : 'n'}</li>
        </ul>
      </Card>
    </>
  );
}

// The input of the brewery's efficiency basis (efficiency.ts). The Konversion
// is the brewhouse's unless the recipe sets its own.
function EfficiencyField({ recipe, onChange, bh, brewery }: Pick<TabProps, 'recipe' | 'onChange' | 'brewery'> & { bh?: Brewhouse }) {
  const basis = basisOf(brewery);
  const label = `${BASIS_LABEL[basis]} (%)`;
  if (basis === 'conversion') {
    return (
      <Override label={label} value={recipe.conversionPct} brewhouse={bh?.mashEfficiencyPct ?? DEFAULT_CONVERSION}
        onChange={(conversionPct) => onChange({ conversionPct })} />
    );
  }
  return (
    <Field label={label}>
      <NumInput value={efficiencyInput(recipe, bh, basis).pct} onChange={(n) => onChange({ efficiencyPct: n })} />
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

// Sulfate : chloride of the strike water on a log scale from 1:4 to 4:1.
// TODO(verify): the zone limits 0.8 and 1.5 follow common calculators
// (Brewfather, Bru'n Water) and have no primary source here yet.
function So4ClScale({ ratio }: { ratio: number }) {
  const pos = (r: number) => Math.min(Math.max((Math.log(r) / Math.log(4) + 1) / 2, 0), 1) * 100;
  return (
    <div>
      <div class="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>Wasserprofil (Hauptguss)</span>
        <span>SO₄ : Cl <span class="font-medium text-fg">{ratio.toFixed(2).replace('.', ',')}</span></span>
      </div>
      <div class="relative h-2 rounded-full bg-fg/10">
        <div class="absolute inset-y-0 rounded-full bg-accent/25" style={{ left: `${pos(0.8)}%`, width: `${pos(1.5) - pos(0.8)}%` }} />
        <div class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-accent"
          style={{ left: `${pos(ratio)}%` }} />
      </div>
      <div class="mt-1 grid grid-cols-3 text-xs text-muted">
        <span>weich, vollmundig</span>
        <span class="text-center">ausgewogen</span>
        <span class="text-right">trocken, knackig</span>
      </div>
    </div>
  );
}

export function IngredientsTab({ recipe, onChange }: TabProps) {
  // With more than one charge, a mash grain shows the one it belongs to.
  const charges = chargesOf(recipe);
  const mark = charges.length > 1
    ? (i: Ingredient) => (isMashGrain(i) ? charges.find((c) => c.id === chargeIdOf(i, charges))!.name : undefined)
    : undefined;
  return (
    <>
      {KINDS.map((k) => (
        <IngredientCard key={k.id} title={k.label} kind={k.id}
          all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
          match={(i) => i.kind === k.id} boilMin={recipe.boil.durationMin} mark={mark} />
      ))}
    </>
  );
}

function ProcessIngredients({ recipe, onChange, scope }: Pick<TabProps, 'recipe' | 'onChange'> & { scope: Scope }) {
  return (
    <IngredientCard title="Zutaten" scope={scope}
      all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
      match={(i) => SCOPE_TIMINGS[scope].includes(i.timing)} boilMin={recipe.boil.durationMin} />
  );
}

export function BoilTab({ recipe, onChange }: TabProps) {
  const b = recipe.boil;
  const set = (p: Partial<Recipe['boil']>) => onChange({ boil: { ...b, ...p } });
  return (
    <>
      <Card title="Kochen & Whirlpool">
        <div class="flex flex-wrap gap-4">
          <Field label="Kochdauer (min)"><NumInput value={b.durationMin} onChange={(n) => set({ durationMin: n })} /></Field>
          <Field label="Whirlpool-Temperatur (°C)"><NumInput value={b.whirlpoolTempC} onChange={(n) => set({ whirlpoolTempC: n })} /></Field>
          <Field label="Whirlpool-Dauer (min)"><NumInput value={b.whirlpoolMin} onChange={(n) => set({ whirlpoolMin: n })} /></Field>
        </div>
      </Card>
      <ProcessIngredients recipe={recipe} onChange={onChange} scope="boil" />
    </>
  );
}

export function FermentationTab({ recipe, onChange }: TabProps) {
  return (
    <>
      <PhaseList title="Gärführung" addLabel="Phase" namePlaceholder="z.B. Hauptgärung"
        durationUnit="Tage" empty="Noch keine Phasen."
        items={recipe.fermentation} onChange={(fermentation) => onChange({ fermentation })} />
      <ProcessIngredients recipe={recipe} onChange={onChange} scope="fermentation" />
    </>
  );
}
