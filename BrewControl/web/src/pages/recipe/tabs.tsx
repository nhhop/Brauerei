import type { Brewhouse } from '../../brewhouse';
import { useCatalog } from '../../ingredientSource';
import { calcStats } from '../../recipeStats';
import { DEFAULT_EFFICIENCY, KINDS, SCOPE_TIMINGS, type Recipe, type Scope } from '../../recipes';
import { inp } from '../../ui';
import { Card, Field, NumInput } from './fields';
import { IngredientCard } from './IngredientCard';
import { PhaseList } from './PhaseList';
import { StyleCard } from './StyleCard';
import { StylePicker } from './StylePicker';
import { STYLE_COMPARISON } from '../../styleSource';

export interface TabProps {
  recipe: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
  brewhouses: Brewhouse[] | null;  // null = the list did not load
}

export function Stat({ label, value, unit, digits, sub }: {
  label: string; value?: number; unit: string; digits: number; sub?: string;
}) {
  return (
    <div>
      <dt class="text-xs text-muted">{label}</dt>
      <dd class="text-lg font-semibold">
        {value === undefined ? '—' : <>{value.toFixed(digits)} <span class="text-xs font-normal text-muted">{unit}</span></>}
      </dd>
      {sub && <dd class="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

// A recipe may point to a brewhouse that was deleted since; it stays selectable as "(fehlt)".
function BrewhouseSelect({ recipe, onChange, brewhouses }: TabProps) {
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

export function OverviewTab({ recipe, onChange, brewhouses }: TabProps) {
  const mashMin = recipe.mash.reduce((s, p) => s + p.duration, 0);
  const catalog = useCatalog();
  const stats = catalog ? calcStats(recipe, catalog.ingredients) : null;
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
          <Field label="Sudhausausbeute (%)">
            <NumInput value={recipe.efficiencyPct ?? DEFAULT_EFFICIENCY} onChange={(n) => onChange({ efficiencyPct: n })} />
          </Field>
          <Field label="Sudhaus">
            <BrewhouseSelect recipe={recipe} onChange={onChange} brewhouses={brewhouses} />
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
      {STYLE_COMPARISON && <StyleCard recipe={recipe} stats={stats ?? { notes: [] }} />}
      <Card title="Brauplan">
        <ul class="space-y-1 text-sm text-muted">
          <li>{recipe.ingredients.length} Zutat{recipe.ingredients.length === 1 ? '' : 'en'}</li>
          <li>Maischen: {recipe.mash.length} Rast{recipe.mash.length === 1 ? '' : 'en'}, {mashMin} min</li>
          <li>Würzekochen: {recipe.boil.durationMin} min</li>
          <li>Gärung: {recipe.fermentation.length} Phase{recipe.fermentation.length === 1 ? '' : 'n'}</li>
        </ul>
      </Card>
    </>
  );
}

export function IngredientsTab({ recipe, onChange }: TabProps) {
  return (
    <>
      {KINDS.map((k) => (
        <IngredientCard key={k.id} title={k.label} kind={k.id}
          all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
          match={(i) => i.kind === k.id} boilMin={recipe.boil.durationMin} />
      ))}
    </>
  );
}

function ProcessIngredients({ recipe, onChange, scope, title = 'Zutaten' }: Pick<TabProps, 'recipe' | 'onChange'> & { scope: Scope; title?: string }) {
  return (
    <IngredientCard title={title} scope={scope}
      all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
      match={(i) => SCOPE_TIMINGS[scope].includes(i.timing)} boilMin={recipe.boil.durationMin} />
  );
}

export function MashTab({ recipe, onChange }: TabProps) {
  return (
    <>
      <PhaseList title="Maischeplan" addLabel="Rast" namePlaceholder="z.B. Maltoserast"
        durationUnit="min" empty="Noch keine Rasten."
        items={recipe.mash} onChange={(mash) => onChange({ mash })} />
      <ProcessIngredients recipe={recipe} onChange={onChange} scope="mash" title="Zutaten (Maische)" />
    </>
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
