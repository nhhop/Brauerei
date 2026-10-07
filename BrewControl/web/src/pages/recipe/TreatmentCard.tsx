import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Plus, Trash2 } from 'lucide-preact';
import type { Brewery } from '../../brewhouse';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { BOIL_PH_DROP, DEFAULT_MASH_PH, MALT_BUFFER, PH_MODEL_LABEL, alkalinitySlope, type PhModel } from '../../mashPh';
import {
  COLUMN_LABEL, TIMING_OF, agentOf, calcTreatment, isTreatmentRow, suggestAgent, waterById,
  type Column, type ColumnKey, type Grist,
} from '../../recipeTreatment';
import { fmtL, type Water } from '../../recipeWater';
import {
  TIMING_LABEL, allowedTimings, uid, type Ingredient, type PhKey, type Recipe, type RecipeWater, type WaterKey, type WaterSource,
} from '../../recipes';
import { TabBtn } from '../../components/TabBtn';
import { DH_PER_MEQ, RA_REFERENCE_PH, VE_WATER, type WaterFigures } from '../../waterChem';
import { btnSecondary, inp } from '../../ui';
import { fmtNum } from '../WaterProfiles';
import { Card, NumInput, OptNum } from './fields';
import { IngredientPicker } from './IngredientPicker';
import { Strength } from './IngredientCard';

const VOLUME_BASIS: Record<ColumnKey, string> = {
  strike: 'Hauptguss einfüllen', mash: 'Hauptguss in der Maische', sparge: 'Nachguss einfüllen',
  preBoil: 'Pfannevoll', knockOut: 'Ausschlagmenge', dilution: 'Verschnitt', total: 'Endmenge im Gärbehälter',
};
const START: Partial<Record<ColumnKey, string>> = {
  mash: 'der aufbereitete Hauptguss', preBoil: 'Maische und Nachguss, nach Volumen gemischt',
  knockOut: 'die Würze vor dem Kochen, durch die Verdampfung konzentriert, mit einem Verschnitt in der Pfanne',
  total: 'die Ausschlagwürze, mit einem Verschnitt im Gärbehälter',
};
// Where the wort's pH starts, for "Berechnung".
const PH_START: Partial<Record<ColumnKey, string>> = {
  preBoil: 'Maische nach allen Gaben, mit der Restalkalität des Nachgusses',
  knockOut: `vor dem Kochen nach den Gaben, ${fmtNum(BOIL_PH_DROP, 2)} weniger durchs Kochen, mit einem Verschnitt in der Pfanne`,
  total: 'Ausschlag nach den Gaben, mit einem Verschnitt im Gärbehälter',
};

const isWaterKey = (k: ColumnKey): k is WaterKey => k === 'strike' || k === 'sparge' || k === 'dilution';
const isPhKey = (k: ColumnKey): k is PhKey => k !== 'total';

// Card "Aufbereitung": one column per water, the mash, the wort before and after
// the boil (only with additions there) and the total. Rows are the source water,
// the additions (the same entries as under Zutaten › Hilfsstoffe) and the result.
// On narrow screens the columns become tabs.
export function TreatmentCard({ recipe, onChange, w, brewery, catalog }: {
  recipe: Recipe; onChange: (patch: Partial<Recipe>) => void; w: Water;
  brewery: Brewery | null; catalog: CatalogIngredient[] | null;
}) {
  const [tab, setTab] = useState<ColumnKey>('strike');
  const { columns, notes, model, grist } = calcTreatment(recipe, w, brewery, catalog);
  const active = columns.some((c) => c.key === tab) ? tab : 'strike';
  const rows = recipe.ingredients.filter((i) => isTreatmentRow(i, catalog));
  const settings = recipe.water ?? {};
  const setWater = (p: Partial<RecipeWater>) => onChange({ water: { ...settings, ...p } });
  const targetOf = (k: PhKey) => settings.targetPh?.[k] ?? (k === 'mash' ? DEFAULT_MASH_PH : undefined);

  const setIngredients = (ingredients: Ingredient[]) => onChange({ ingredients });
  const patch = (id: string, p: Partial<Ingredient>) =>
    setIngredients(recipe.ingredients.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const add = () => setIngredients([...recipe.ingredients, { id: uid(), kind: 'auxiliary', name: '', amount: 0, timing: 'water' }]);

  function computeAgent(col: Column) {
    if (!isPhKey(col.key)) return;
    const key = col.key;
    const target = targetOf(key);
    const s = target === undefined ? undefined : suggestAgent(col, target, catalog);
    if (!s) return;
    const amount = Math.round(s.amount * 100) / 100;
    if (s.ingredient) patch(s.ingredient.id, { amount });
    else if (s.entry) {
      setIngredients([...recipe.ingredients, {
        id: uid(), kind: 'auxiliary', name: s.entry.name, ingredientId: s.entry.id, amount, timing: TIMING_OF[key],
      }]);
    }
  }

  const hide = (k: ColumnKey) => (k === active ? '' : 'hidden md:block');
  const line = 'border-t border-border py-1.5';
  const row = (label: ComponentChildren, cell: (c: Column) => ComponentChildren, cls = line) => (
    <>
      <div class={`${cls} min-w-0 text-sm`}>{label}</div>
      {columns.map((c) => <div key={c.key} class={`${cls} ${hide(c.key)} min-w-0 text-sm`}>{cell(c)}</div>)}
    </>
  );
  // A value with the one before in brackets, when it differs.
  const pair = (after: number | undefined, before: number | undefined, digits: number, title?: string, prefix = '') => {
    if (after === undefined) return <span class="text-muted">—</span>;
    return (
      <span class="tabular-nums" title={title ?? (before === undefined ? undefined : `vorher ${fmtNum(before, digits)}`)}>
        {prefix}{fmtNum(after, digits)}
        {before !== undefined && Math.abs(after - before) >= 0.5 * 10 ** -digits && (
          <span class="ml-1 text-xs text-muted">({fmtNum(before, digits)})</span>
        )}
      </span>
    );
  };
  // Alkalinity, RA and pH follow the water model only in water and mash.
  const fig = (get: (f: WaterFigures) => number | undefined, digits = 0, waterOnly = false) => (c: Column) => {
    if (waterOnly && c.wort) return <span class="text-xs text-muted" title="In der Würze nicht aus dem Wassermodell">—</span>;
    return pair(get(c.after), get(c.before), digits);
  };
  // Water by the carbonate balance; mash and wort by the brewery's model.
  const ph = (c: Column) => {
    if (c.ph) {
      const title = c.key === 'mash'
        ? `Geschätzt nach ${PH_MODEL_LABEL[model]}, etwa ± 0,1–0,2. In Klammern: vor der Gabe nach pH-Messung`
        : 'Grobe Schätzung über die Pufferung der Schüttung. In Klammern: vor den Gaben';
      return pair(c.ph.after, c.ph.before, 2, title, '≈ ');
    }
    if (!c.wort && c.key !== 'mash') return fig((f) => f.ph, 2)(c);
    const why = model === 'kolbach' ? 'Das Modell Kolbach schätzt keinen pH' : 'Für die pH-Schätzung fehlen verknüpfte Malze';
    return <span class="text-xs text-muted" title={why}>—</span>;
  };

  return (
    <Card title="Aufbereitung"
      action={
        <button type="button" onClick={add}
          class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10">
          <Plus size={12} /> Salz/Säure
        </button>
      }>
      <div class="-mt-1 mb-2 flex overflow-x-auto border-b border-border md:hidden">
        {columns.map((c) => (
          <TabBtn key={c.key} active={c.key === active} onClick={() => setTab(c.key)}>{COLUMN_LABEL[c.key]}</TabBtn>
        ))}
      </div>
      <div style={{ '--n': columns.length }}
        class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 md:grid-cols-[minmax(13rem,1.6fr)_repeat(var(--n),minmax(0,1fr))]">
        {row(<span class="text-xs text-muted">Volumenbasis</span>, (c) => (
          <div>
            <div class="hidden font-medium md:block">{COLUMN_LABEL[c.key]}</div>
            <div class="text-xs text-muted" title={VOLUME_BASIS[c.key]}>{fmtL(c.volumeL)}</div>
          </div>
        ), 'pb-1.5')}
        {row('Ausgangswasser', (c) => (c.source && isWaterKey(c.key)
          ? <SourcePicker brewery={brewery} value={settings.sources?.[c.key]} source={c.source}
              onChange={(v) => setWater({ sources: { ...settings.sources, [c.key]: v } })} />
          : <span class="text-xs text-muted">{{ mash: 'Hauptguss', preBoil: 'Maische + Nachguss', knockOut: 'Würze', total: 'alles' }[c.key as string]}</span>))}

        {rows.length === 0 && row(<span class="text-xs text-muted">Noch keine Salze oder Säuren.</span>, () => null)}
        {rows.map((i) => row(
          <DoseEditor i={i} catalog={catalog} onPatch={(p) => patch(i.id, p)}
            onRemove={() => setIngredients(recipe.ingredients.filter((x) => x.id !== i.id))} />,
          (c) => {
            const d = c.doses.find((x) => x.ingredient.id === i.id);
            if (!d) return null;
            const unit = d.agent?.unit ?? 'g';
            return (
              <span class={`tabular-nums ${d.share ? 'text-muted' : ''}`} title={d.share ? 'Anteil der Gabe „Brauwasser“' : undefined}>
                {fmtNum(d.amount, 2)} {unit}
              </span>
            );
          },
        ))}

        {row(<span class="text-xs font-medium text-muted">Ergebnis (mg/l)</span>, () => null, `${line} pt-3`)}
        {row('Calcium', fig((f) => f.ions.ca), 'py-0.5')}
        {row('Magnesium', fig((f) => f.ions.mg), 'py-0.5')}
        {row('Natrium', fig((f) => f.ions.na), 'py-0.5')}
        {row('Chlorid', fig((f) => f.ions.cl), 'py-0.5')}
        {row('Sulfat', fig((f) => f.ions.so4), 'py-0.5')}
        {row('Hydrogencarbonat', fig((f) => f.hco3, 0, true), 'py-0.5')}
        {row('Restalkalität (°dH)', fig((f) => f.raDh, 1, true), 'py-0.5')}
        {model === 'kolbach' && row(<span title="Palmer, nach Bierfarbe">Ziel-RA (°dH)</span>, (c) => c.raTarget && (
          <span class="tabular-nums">{fmtNum(c.raTarget[0] * DH_PER_MEQ, 1)} bis {fmtNum(c.raTarget[1] * DH_PER_MEQ, 1)}</span>
        ), 'py-0.5')}
        {row('SO₄ : Cl', fig((f) => f.so4Cl, 2), 'py-0.5')}
        {row(<>pH <span class="text-xs text-muted">· Maische/Würze nach {PH_MODEL_LABEL[model]}</span></>, ph, 'py-0.5')}

        {row('Ziel-pH', (c) => {
          if (!isPhKey(c.key) || (!isWaterKey(c.key) && !c.ph)) return null;
          const key = c.key;
          const water = isWaterKey(key);
          const known = water ? c.after.ph !== undefined : true;
          return (
            <div class="flex flex-wrap items-center gap-1">
              <OptNum value={settings.targetPh?.[key]} placeholder={key === 'mash' ? fmtNum(DEFAULT_MASH_PH, 1) : '—'} class="w-16"
                onChange={(n) => setWater({ targetPh: { ...settings.targetPh, [key]: n } })} />
              <button type="button" class={`${btnSecondary} px-2 text-xs`} disabled={targetOf(key) === undefined || !known}
                title={!known ? 'Das Ausgangswasser hat keinen pH'
                  : water ? 'Setzt die Säuregabe dieser Spalte, sonst legt sie Milchsäure an'
                  : `Setzt die Säure oder Base${key === 'mash' ? ' mit Zeitpunkt „Maische nach pH-Messung“' : ' dieser Spalte'}, sonst legt sie Milchsäure bzw. Natron an`}
                onClick={() => computeAgent(c)}>
                {water ? 'Säure berechnen' : 'Säure/Base berechnen'}
              </button>
            </div>
          );
        })}
      </div>

      <Calculation columns={columns} model={model} grist={grist} />
      {notes.length > 0 && (
        <ul class="mt-3 space-y-1 text-xs text-muted">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </Card>
  );
}

function SourcePicker({ brewery, value, source, onChange }: {
  brewery: Brewery | null;
  value: WaterSource | undefined;
  source: NonNullable<Column['source']>;
  onChange: (v: WaterSource | undefined) => void;
}) {
  const waters = [...(brewery?.waters ?? []), VE_WATER];
  const set = (p: WaterSource) => {
    const next = { ...value, ...p };
    onChange(Object.values(next).some((v) => v !== undefined) ? next : undefined);
  };
  const missing = value?.waterId && !waterById(brewery, value.waterId);
  return (
    <div class="space-y-1">
      <select class={`${inp} w-full`} value={value?.waterId ?? ''} onChange={(e) => set({ waterId: e.currentTarget.value || undefined })}>
        <option value="">Standard ({source.water.name})</option>
        {waters.map((p) => <option key={p.id} value={p.id}>{p.name || 'Ohne Namen'}</option>)}
        {missing && <option value={value!.waterId}>{value!.waterId} (fehlt)</option>}
      </select>
      <div class="flex flex-wrap items-center gap-1 text-xs text-muted">
        +
        <NumInput value={value?.blendPct ?? 0} class="w-14"
          onChange={(n) => set({ blendPct: n > 0 ? Math.min(n, 100) : undefined })} />
        %
        <select class={`${inp} w-full min-w-0 py-1 text-xs`} value={value?.blendId ?? VE_WATER.id}
          onChange={(e) => set({ blendId: e.currentTarget.value === VE_WATER.id ? undefined : e.currentTarget.value })}>
          {waters.map((p) => <option key={p.id} value={p.id}>{p.name || 'Ohne Namen'}</option>)}
        </select>
      </div>
    </div>
  );
}

// Name, moment, total amount and concentration of one addition; the columns
// show what of it lands where.
function DoseEditor({ i, catalog, onPatch, onRemove }: {
  i: Ingredient; catalog: CatalogIngredient[] | null; onPatch: (p: Partial<Ingredient>) => void; onRemove: () => void;
}) {
  const agent = agentOf(i, catalog);
  return (
    <div class="space-y-1">
      <div class="flex items-center gap-1">
        <IngredientPicker ingredient={i} onChange={onPatch} only={(c) => c.kind === 'auxiliary' && !!c.waterAgent} />
        <button type="button" title="Entfernen" onClick={onRemove}
          class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
          <Trash2 size={14} />
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <select class={`${inp} py-1 text-xs`} value={i.timing}
          onChange={(e) => onPatch({ timing: e.currentTarget.value as Ingredient['timing'] })}>
          {allowedTimings('auxiliary', 'water').map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
        </select>
        <div class="flex items-center gap-1 text-xs text-muted">
          <NumInput value={i.amount} onChange={(n) => onPatch({ amount: n })} class="w-16" />
          {agent?.unit ?? 'g'}
        </div>
        <Strength i={i} agent={agent} onChange={(strengthPct) => onPatch({ strengthPct })} />
      </div>
    </div>
  );
}

function Calculation({ columns, model, grist }: { columns: Column[]; model: PhModel; grist?: Grist }) {
  return (
    <details class="mt-4">
      <summary class="cursor-pointer text-sm">Berechnung</summary>
      <div class="mt-2 space-y-3 text-sm">
        {columns.map((c) => (
          <div key={c.key}>
            <div class="font-medium">{COLUMN_LABEL[c.key]}</div>
            <ul class="text-xs text-muted">
              <li>Volumen: {fmtL(c.volumeL)} ({VOLUME_BASIS[c.key]})</li>
              <li>Ausgangswasser: {c.source
                ? `${c.source.water.name}${c.source.blendPct > 0 ? ` + ${fmtNum(c.source.blendPct)} % ${c.source.blendWith.name}` : ''}`
                : START[c.key]}
              {!c.wort && `, Restalkalität ${fmtNum(c.before.ra, 2)} mEq/l`}</li>
              {c.doses.map((d) => (
                <li key={d.ingredient.id}>
                  {d.ingredient.name || 'Ohne Namen'}: {fmtNum(d.amount, 2)} {d.agent?.unit ?? 'g'}
                  {d.agent ? ` ${d.agent.agent.formula}${d.agent.agent.form === 'liquid' ? `, ${fmtNum(d.agent.strengthPct)} %` : ''}` : ', nicht eingerechnet'}
                  {d.share && ' (Anteil Brauwasser)'}
                </li>
              ))}
              <li>Ergebnis: {c.wort
                ? `Ca ${fmtNum(c.after.ions.ca)}, Mg ${fmtNum(c.after.ions.mg)}, Na ${fmtNum(c.after.ions.na)}, Cl ${fmtNum(c.after.ions.cl)}, SO₄ ${fmtNum(c.after.ions.so4)} mg/l`
                : `Alkalität ${fmtNum(c.after.alk, 2)} mEq/l, Restalkalität ${fmtNum(c.after.ra, 2)} mEq/l`}
                {c.after.ions.lactate > 0 && `, Lactat ${fmtNum(c.after.ions.lactate)} mg/l`}
                {c.after.ions.phosphate > 0 && `, Phosphat ${fmtNum(c.after.ions.phosphate)} mg/l`}</li>
              {c.basis?.kind === 'mash' && grist && (
                <li>pH: Schüttung in destilliertem Wasser {fmtNum(grist.diPh, 2)} bei {fmtNum(grist.ratio, 1)} l/kg
                  ({grist.parts.map((p) => `${p.name} ${fmtNum(p.kg, 2)} kg, ${p.acidity === undefined
                    ? `pH ${fmtNum(p.ph!, 2)}` : `${fmtNum(p.acidity)} mEq/kg`}${p.estimated ? ' geschätzt' : ''}`).join('; ')}),
                  Steigung {fmtNum(alkalinitySlope(grist.ratio), 3)} pH·l/mEq, ≈ {fmtNum(c.ph!.before, 2)} vor und
                  ≈ {fmtNum(c.ph!.after, 2)} nach der Gabe nach pH-Messung</li>
              )}
              {c.basis?.kind === 'wort' && (
                <li>pH: Start ≈ {fmtNum(c.basis.startPh, 2)} ({PH_START[c.key]}), Pufferung {fmtNum(c.basis.bufferMeq)} mEq/pH
                  {c.doses.length > 0 && `, nach den Gaben ≈ ${fmtNum(c.ph!.after, 2)}`}</li>
              )}
              {c.raTarget && (
                <li>Ziel-RA nach Bierfarbe (Palmer): {fmtNum(c.raTarget[0], 2)} bis {fmtNum(c.raTarget[1], 2)} mEq/l</li>
              )}
            </ul>
          </div>
        ))}
        <p class="text-xs text-muted">
          Restalkalität = Alkalität − Ca/3,5 − Mg/7 in mEq/l (Troester); Säuren zählen mit dem Anteil, den sie bei
          pH {fmtNum(RA_REFERENCE_PH, 1)} abgeben, Kreide nur zur Hälfte. HCO₃ = Alkalität × 61,02. „Brauwasser“
          verteilt sich nach Einfüllmenge auf Haupt- und Nachguss. Der pH nach Säure folgt aus dem
          Kalk-Kohlensäure-Gleichgewicht bei 25 °C und ist eine Schätzung. Die Würze trägt, was Maische und
          Nachguss mitbringen, nach Volumen gemischt und durch die Verdampfung konzentriert; „Gesamt“ ist der
          Beitrag von Wasser und Gaben zum Bier. Ionen aus dem Malz und was beim Maischen und Kochen ausfällt (vor
          allem Calcium als Phosphat und Oxalat) sind nicht berücksichtigt. In Klammern: vor den Gaben.
        </p>
        {model === 'troester' ? (
          <p class="text-xs text-muted">
            pH-Modell Troester (2009): Die Schüttung hat in destilliertem Wasser den pH Σ pHb·gb + 5,7·Σ gs −
            0,14·Σ(as·gs)/R (Basismalze nach ihrem pH, Spezialmalze nach ihrer Säure, R = Hauptguss je kg). Das
            Wasser verschiebt ihn um (0,013·R + 0,013)·RA. Säure über die Alkalität hinaus wirkt auf die Pufferung
            der Schüttung, {fmtNum(MALT_BUFFER, 1)} mEq/(kg·pH) aus Troesters Maische-Titration. Ohne Malzdaten
            gilt für Basismalz 5,82 − 0,02·EBC, für Karamellmalz 14 + 0,13·EBC mEq/kg, für Röstmalz 40 mEq/kg,
            Spezialmalz bis 25 EBC wie Basismalz, darüber wie Karamellmalz. Die Maische liegt etwa ± 0,1–0,2
            daneben. Die Würze ist eine grobe Schätzung mit derselben Pufferung: Nachguss, Verschnitt und Gaben
            wirken mit ihrer Restalkalität, das Kochen senkt um {fmtNum(BOIL_PH_DROP, 2)} (Troester: 0,1–0,2).
          </p>
        ) : (
          <p class="text-xs text-muted">
            pH-Modell Kolbach: nur die Restalkalität, ohne pH-Schätzung. Der Zielbereich folgt der Bierfarbe nach
            Palmer: RA (ppm CaCO₃) von 12,2·SRM − 122,4 bei Farbe aus Basis- und Karamellmalz bis 12,2·(SRM − 5,2)
            bei Farbe aus Röstmalz. Umschalten in Einstellungen › Brauanlage.
          </p>
        )}
      </div>
    </details>
  );
}
