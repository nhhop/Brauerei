import { KINDS, SCOPE_TIMINGS, type Recipe, type Scope } from '../../recipes';
import { inp } from '../../ui';
import { Card, Field, NumInput } from './fields';
import { IngredientCard } from './IngredientCard';
import { PhaseList } from './PhaseList';

export interface TabProps {
  recipe: Recipe;
  onChange: (patch: Partial<Recipe>) => void;
}

export function OverviewTab({ recipe, onChange }: TabProps) {
  const mashMin = recipe.mash.reduce((s, p) => s + p.duration, 0);
  return (
    <>
      <Card title="Rezept">
        <div class="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input class={`${inp} w-full`} value={recipe.name}
              onInput={(e) => onChange({ name: e.currentTarget.value })} />
          </Field>
          <Field label="Stil">
            <input class={`${inp} w-full`} value={recipe.style} placeholder="z.B. Pale Ale"
              onInput={(e) => onChange({ style: e.currentTarget.value })} />
          </Field>
          <Field label="Ausschlagmenge (l)">
            <NumInput value={recipe.volumeL} onChange={(n) => onChange({ volumeL: n })} />
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
        <p class="text-sm text-muted">
          Stammwürze, Alkohol, Bittere und Farbe werden später aus den Zutaten berechnet.
        </p>
      </Card>
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
          match={(i) => i.kind === k.id} />
      ))}
    </>
  );
}

function ProcessIngredients({ recipe, onChange, scope, title = 'Zutaten' }: TabProps & { scope: Scope; title?: string }) {
  return (
    <IngredientCard title={title} scope={scope}
      all={recipe.ingredients} onChange={(ingredients) => onChange({ ingredients })}
      match={(i) => SCOPE_TIMINGS[scope].includes(i.timing)} />
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
