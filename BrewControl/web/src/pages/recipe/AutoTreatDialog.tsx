import { useMemo, useState } from 'preact/hooks';
import type { Brewery } from '../../brewhouse';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { DEFAULT_MASH_PH, PH_MODEL_LABEL } from '../../mashPh';
import { agentOf, calcTreatment, catalogAgent, isTreatmentRow, type Column } from '../../recipeTreatment';
import { type Water } from '../../recipeWater';
import { TIMING_LABEL, type Ingredient, type Recipe, type WaterTarget } from '../../recipes';
import { DH_PER_MEQ, figuresOf, stateOf, type WaterAgentId, type WaterFigures } from '../../waterChem';
import { AUTO_ACIDS, AUTO_SALTS, autoTreat, resolveTarget } from '../../waterSolver';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { fmtNum } from '../WaterProfiles';
import { Field, NumInput, OptNum } from './fields';
import { TargetSelect } from './TreatmentCard';

const DEFAULT_SALTS: WaterAgentId[] = ['gypsum', 'cacl2', 'epsom', 'nacl'];

// Dialog "Automatisch": share of blend water, salts as "Brauwasser" and acid
// after the pH measurement towards a target profile. Shows before and after;
// only "Übernehmen" writes, replacing what an earlier run laid out.
export function AutoTreatDialog({ recipe, w, brewery, catalog, onChange, onClose }: {
  recipe: Recipe; w: Water; brewery: Brewery | null; catalog: CatalogIngredient[] | null;
  onChange: (patch: Partial<Recipe>) => void; onClose: () => void;
}) {
  const settings = recipe.water ?? {};
  const salts = AUTO_SALTS.filter((id) => catalogAgent(catalog, id));
  const acids = AUTO_ACIDS.filter((id) => catalogAgent(catalog, id));
  const [target, setTarget] = useState<WaterTarget>(settings.target ?? {});
  const [allowed, setAllowed] = useState<WaterAgentId[]>(DEFAULT_SALTS.filter((id) => salts.includes(id)));
  const [acid, setAcid] = useState<WaterAgentId | undefined>(acids.includes('lactic') ? 'lactic' : acids[0]);
  const [fixed, setFixed] = useState<number | undefined>(undefined);
  const [mashPh, setMashPh] = useState(settings.targetPh?.mash);

  const resolved = resolveTarget(target, brewery);
  const withPh: Recipe = { ...recipe, water: { ...settings, targetPh: { ...settings.targetPh, mash: mashPh } } };
  const result = useMemo(
    () => resolved && autoTreat(withPh, w, brewery, catalog, { target: resolved.ions, salts: allowed, acid, blendPct: fixed }),
    [JSON.stringify([target, allowed, acid, fixed, mashPh]), recipe, w, brewery, catalog],
  );
  const now = calcTreatment(recipe, w, brewery, catalog);
  const next = result && calcTreatment(result.recipe, w, brewery, catalog);
  const col = (cols: Column[], key: Column['key']) => cols.find((c) => c.key === key)!;
  const blendName = col(now.columns, 'strike').source?.blendWith.name ?? 'VE-Wasser';
  const differs = w.sparge && JSON.stringify({ ...settings.sources?.strike, blendPct: 0 }) !== JSON.stringify({ ...settings.sources?.sparge, blendPct: 0 });

  const apply = () => {
    if (!result) return;
    onChange({ ingredients: result.recipe.ingredients, water: { ...result.recipe.water, target } });
    onClose();
  };
  const toggle = (id: WaterAgentId) => setAllowed(allowed.includes(id) ? allowed.filter((x) => x !== id) : [...allowed, id]);
  const targetFig = resolved && figuresOf(stateOf({ id: '', name: '', ...resolved.ions }));
  const rows = recipe.ingredients.filter((i) => isTreatmentRow(i, catalog));

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-2xl ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-1 text-base font-medium text-fg">Aufbereitung automatisch</h2>
          <p class="mb-4 text-xs text-muted">
            Sucht den Anteil {blendName} und die Salze, mit denen der Hauptguss dem Ziel am nächsten kommt (Ca, Mg, Na,
            Cl, SO₄). Danach stellt die Säure die Maische ein. Salze gehen als „Brauwasser“ in Haupt- und Nachguss,
            die Säure kommt „nach pH-Messung“ in die Maische.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Zielprofil">
              <TargetSelect brewery={brewery} value={target} onChange={setTarget} />
            </Field>
            <Field label={`Anteil ${blendName}`}>
              <div class="flex items-center gap-2 text-sm text-fg">
                <label class="flex items-center gap-1">
                  <input type="checkbox" class="accent-accent" checked={fixed === undefined}
                    onChange={(e) => setFixed(e.currentTarget.checked ? undefined : (settings.sources?.strike?.blendPct ?? 0))} />
                  frei
                </label>
                {fixed !== undefined && (
                  <span class="flex items-center gap-1 text-xs text-muted">
                    <NumInput value={fixed} class="w-16" onChange={(n) => setFixed(Math.min(Math.max(n, 0), 100))} /> %
                  </span>
                )}
              </div>
            </Field>
          </div>
          {target.ions && (
            <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(['ca', 'mg', 'na', 'cl', 'so4', 'hco3'] as const).map((ion) => (
                <Field key={ion} label={`${ION_LABEL[ion]} (mg/l)`}>
                  <NumInput value={target.ions![ion]} class="w-full" onChange={(n) => setTarget({ ions: { ...target.ions!, [ion]: n } })} />
                </Field>
              ))}
            </div>
          )}
          <div class="mt-3">
            <span class="mb-1 block text-xs text-muted">Erlaubte Salze</span>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {salts.map((id) => (
                <label key={id} class="flex items-center gap-1">
                  <input type="checkbox" class="accent-accent" checked={allowed.includes(id)} onChange={() => toggle(id)} />
                  {catalogAgent(catalog, id)!.entry.name}
                </label>
              ))}
            </div>
          </div>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Säure">
              <select class={`${inp} w-full`} value={acid ?? ''}
                onChange={(e) => setAcid((e.currentTarget.value || undefined) as WaterAgentId | undefined)}>
                <option value="">— keine —</option>
                {acids.map((id) => {
                  const a = catalogAgent(catalog, id)!;
                  return <option key={id} value={id}>{a.entry.name}{a.agent.form === 'liquid' ? ` ${fmtNum(a.strengthPct)} %` : ''}</option>;
                })}
              </select>
            </Field>
            {now.model === 'troester' ? (
              <Field label="Ziel-pH der Maische">
                <OptNum value={mashPh} placeholder={fmtNum(DEFAULT_MASH_PH, 1)} class="w-20" onChange={setMashPh} />
              </Field>
            ) : (
              <Field label={`Ziel-RA der Maische (${PH_MODEL_LABEL.kolbach})`}>
                <span class="text-sm text-fg">
                  {col(now.columns, 'mash').raTarget
                    ? `Mitte von ${col(now.columns, 'mash').raTarget!.map((r) => fmtNum(r * DH_PER_MEQ, 1)).join(' bis ')} °dH`
                    : '—'}
                </span>
              </Field>
            )}
          </div>

          {result && next && resolved ? (
            <>
              <h3 class="mt-5 mb-1 text-sm font-medium">Vorschau Hauptguss</h3>
              <div class="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-x-3 text-sm">
                <div class="text-xs text-muted" />
                <div class="text-xs text-muted">Ziel</div>
                <div class="text-xs text-muted">Jetzt</div>
                <div class="text-xs text-muted">Vorschlag</div>
                {COMPARE.map(({ label, get, digits }) => (
                  <Compare key={label} label={label} digits={digits} target={targetFig && get(targetFig)}
                    before={get(col(now.columns, 'strike').after)} after={get(col(next.columns, 'strike').after)} />
                ))}
                {now.model === 'troester' ? (
                  <Compare label="Maische-pH" digits={2} target={mashPh ?? DEFAULT_MASH_PH}
                    before={col(now.columns, 'mash').ph?.after} after={col(next.columns, 'mash').ph?.after} />
                ) : (
                  <Compare label="Maische-RA (°dH)" digits={1}
                    before={col(now.columns, 'mash').after.raDh} after={col(next.columns, 'mash').after.raDh} />
                )}
              </div>

              <h3 class="mt-5 mb-1 text-sm font-medium">Gaben</h3>
              <ul class="space-y-0.5 text-sm">
                <li>{blendName}: {fmtNum(result.blendPct)} % in Haupt- und Nachguss
                  {(settings.sources?.strike?.blendPct ?? 0) !== result.blendPct && (
                    <span class="text-xs text-muted"> (bisher {fmtNum(settings.sources?.strike?.blendPct ?? 0)} %)</span>
                  )}</li>
                {result.rows.map((i) => <DoseLine key={i.id} i={i} catalog={catalog} tag="neu" />)}
                {rows.filter((i) => i.auto).map((i) => <DoseLine key={i.id} i={i} catalog={catalog} tag="entfällt" strike />)}
                {rows.filter((i) => !i.auto).map((i) => <DoseLine key={i.id} i={i} catalog={catalog} tag="bleibt" />)}
              </ul>
              {[...result.notes, ...(differs ? ['Haupt- und Nachguss haben verschiedene Ausgangswässer; verglichen wird nur der Hauptguss.'] : [])]
                .map((n) => <p key={n} class="mt-2 text-xs text-caution">{n}</p>)}
            </>
          ) : (
            <p class="mt-5 text-sm text-muted">Bitte ein Zielprofil wählen.</p>
          )}
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={!result} onClick={apply}>Übernehmen</button>
        </div>
      </div>
    </div>
  );
}

const ION_LABEL = { ca: 'Ca', mg: 'Mg', na: 'Na', cl: 'Cl', so4: 'SO₄', hco3: 'HCO₃' };
const COMPARE: { label: string; get: (f: WaterFigures) => number | undefined; digits: number }[] = [
  { label: 'Calcium', get: (f) => f.ions.ca, digits: 0 },
  { label: 'Magnesium', get: (f) => f.ions.mg, digits: 0 },
  { label: 'Natrium', get: (f) => f.ions.na, digits: 0 },
  { label: 'Chlorid', get: (f) => f.ions.cl, digits: 0 },
  { label: 'Sulfat', get: (f) => f.ions.so4, digits: 0 },
  { label: 'Hydrogencarbonat', get: (f) => f.hco3, digits: 0 },
  { label: 'Restalkalität (°dH)', get: (f) => f.raDh, digits: 1 },
  { label: 'SO₄ : Cl', get: (f) => f.so4Cl, digits: 2 },
];

function Compare({ label, target, before, after, digits }: {
  label: string; target?: number; before?: number; after?: number; digits: number;
}) {
  const v = (n: number | undefined) => (n === undefined ? '—' : fmtNum(n, digits));
  return (
    <>
      <div class="border-t border-border py-0.5">{label}</div>
      <div class="border-t border-border py-0.5 tabular-nums text-muted">{v(target)}</div>
      <div class="border-t border-border py-0.5 tabular-nums text-muted">{v(before)}</div>
      <div class="border-t border-border py-0.5 font-medium tabular-nums">{v(after)}</div>
    </>
  );
}

function DoseLine({ i, catalog, tag, strike }: { i: Ingredient; catalog: CatalogIngredient[] | null; tag: string; strike?: boolean }) {
  const unit = agentOf(i, catalog)?.unit ?? 'g';
  return (
    <li class={strike ? 'text-muted line-through' : ''}>
      {i.name || 'Ohne Namen'}: {fmtNum(i.amount, 2)} {unit}, {TIMING_LABEL[i.timing]}
      <span class="ml-1 text-xs text-muted">({tag})</span>
    </li>
  );
}
