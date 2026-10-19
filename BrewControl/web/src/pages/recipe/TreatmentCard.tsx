import { useState } from 'preact/hooks';
import { Fragment, type ComponentChildren } from 'preact';
import { Calculator, Plus, Target, Trash2, Wand2, X } from 'lucide-preact';
import type { Brewery } from '../../brewhouse';
import type { CatalogIngredient } from '../../ingredientCatalog';
import { BOIL_PH_DROP, DEFAULT_MASH_PH, MALT_BUFFER, PH_MODEL_LABEL, alkalinitySlope, type PhModel } from '../../mashPh';
import {
  COLUMN_LABEL, TIMING_OF, agentOf, calcTreatment, doseContribution, isTreatmentRow, phOf, sourceParts, sourceWaters, suggestAgent, waterById,
  type Column, type ColumnKey, type Grist,
} from '../../recipeTreatment';
import { fmtL, type Water } from '../../recipeWater';
import {
  TIMING_LABEL, allowedTimings, uid, type Ingredient, type PhKey, type Recipe, type RecipeWater, type WaterKey, type WaterSource,
  type WaterTarget,
} from '../../recipes';
import { TabBtn } from '../../components/TabBtn';
import { DH_PER_MEQ, RA_REFERENCE_PH, VE_WATER, figuresOf, stateOf, type TargetIons, type WaterFigures } from '../../waterChem';
import { OWN_TARGET, TARGET_PROFILES, resolveTarget, targetProfiles } from '../../waterSolver';
import { btnSecondary, inp } from '../../ui';
import { fmtNum } from '../WaterProfiles';
import { Section } from './CalcTable';
import { NumInput, OptNum } from './fields';
import { IngredientPicker } from './IngredientPicker';
import { Strength } from './IngredientCard';
import { AutoTreatDialog } from './AutoTreatDialog';

const VOLUME_BASIS: Record<ColumnKey, string> = {
  strike: 'Hauptguss einfüllen', mash: 'Hauptguss in der Maische', sparge: 'Nachguss einfüllen',
  preBoil: 'Pfannevoll', knockOut: 'Ausschlagmenge', dilution: 'Verschnitt', total: 'Endmenge im Gärbehälter, mit einem Verschnitt im Keg das Bier danach',
};
const START: Partial<Record<ColumnKey, string>> = {
  mash: 'der aufbereitete Hauptguss', preBoil: 'Maische und Nachguss, nach Volumen gemischt',
  knockOut: 'die Würze vor dem Kochen, durch die Verdampfung konzentriert, mit einem Verschnitt in der Pfanne',
  total: 'die Ausschlagwürze, mit einem Verschnitt im Gärbehälter oder Keg',
};
// Where the wort's pH starts, for "Berechnung".
const PH_START: Partial<Record<ColumnKey, string>> = {
  preBoil: 'Maische nach allen Gaben, mit der Restalkalität des Nachgusses',
  knockOut: `vor dem Kochen nach den Gaben, ${fmtNum(BOIL_PH_DROP, 2)} weniger durchs Kochen, mit einem Verschnitt in der Pfanne`,
  total: 'Ausschlag nach den Gaben, mit einem Verschnitt im Gärbehälter oder Keg',
};

const isWaterKey = (k: ColumnKey): k is WaterKey => k === 'strike' || k === 'sparge' || k === 'dilution';
const isPhKey = (k: ColumnKey): k is PhKey => k !== 'total';

// Card "Aufbereitung": one column per water, the mash, the wort before and after
// the boil (only with additions there), the total and, once picked, the target
// the strike water is compared with. Rows are the source water, the additions
// (the same entries as under Zutaten › Hilfsstoffe) and the result. On narrow
// screens the columns become tabs.
export function TreatmentCard({ recipe, onChange, w, brewery, catalog }: {
  recipe: Recipe; onChange: (patch: Partial<Recipe>) => void; w: Water;
  brewery: Brewery | null; catalog: CatalogIngredient[] | null;
}) {
  const [tab, setTab] = useState<ColumnKey | 'target'>('strike');
  const [auto, setAuto] = useState(false);
  const { columns, notes, model, grist } = calcTreatment(recipe, w, brewery, catalog);
  const rows = recipe.ingredients.filter((i) => isTreatmentRow(i, catalog));
  const settings = recipe.water ?? {};
  const setWater = (p: Partial<RecipeWater>) => onChange({ water: { ...settings, ...p } });
  const target = settings.target;
  const resolved = resolveTarget(target, brewery);
  const strike = columns.find((c) => c.key === 'strike')!;
  const active = columns.some((c) => c.key === tab) || (tab === 'target' && target) ? tab : 'strike';
  const targetOf = (k: PhKey) => settings.targetPh?.[k] ?? (k === 'mash' ? DEFAULT_MASH_PH : undefined);

  const setIngredients = (ingredients: Ingredient[]) => onChange({ ingredients });
  const patch = (id: string, p: Partial<Ingredient>) =>
    setIngredients(recipe.ingredients.map((i) => (i.id === id ? { ...i, ...p, auto: undefined } : i)));
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

  const hide = (k: ColumnKey | 'target') => (k === active ? '' : 'hidden md:block');
  const line = 'border-t border-border py-1.5';
  const row = (label: ComponentChildren, cell: (c: Column) => ComponentChildren, cls = line, targetCell?: ComponentChildren) => (
    <>
      <div class={`${cls} min-w-0 text-sm`}>{label}</div>
      {columns.map((c) => <div key={c.key} class={`${cls} ${hide(c.key)} min-w-0 text-sm`}>{cell(c)}</div>)}
      {target && <div class={`${cls} ${hide('target')} min-w-0 text-sm`}>{targetCell}</div>}
    </>
  );
  // The target's value with the strike water's deviation; own values are typed in.
  // `stacked` puts the deviation under the value instead of behind it.
  const targetIon = (ion: keyof TargetIons, compare = true, stacked = false) => {
    if (target?.ions) {
      return <NumInput value={target.ions[ion]} class="w-full" onChange={(n) => setWater({ target: { ions: { ...target.ions!, [ion]: n } } })} />;
    }
    if (!resolved) return null;
    const t = resolved.ions[ion];
    const off = compare && ion !== 'hco3' ? strike.after.ions[ion] - t : 0;
    return (
      <span class={`tabular-nums ${stacked ? 'flex flex-col items-end' : ''}`}
        title={compare ? `Hauptguss ${fmtNum(t + off)} mg/l` : 'Regelt die Säure über den Ziel-pH'}>
        {fmtNum(t)}
        {Math.abs(off) >= 0.5 && (
          <span class={`${stacked ? '' : 'ml-1'} text-xs ${Math.abs(off) > Math.max(10, 0.2 * t) ? 'text-caution' : 'text-muted'}`}>
            {off > 0 ? '+' : '−'}{fmtNum(Math.abs(off))}
          </span>
        )}
      </span>
    );
  };
  const targetFigures = resolved && figuresOf(stateOf({ id: '', name: '', ...resolved.ions }));
  const headerBtn = 'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-fg/10';
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
  // `withBefore` false (desktop table) leaves out the brackets: the value before has its own row there.
  const fig = (get: (f: WaterFigures) => number | undefined, digits = 0, waterOnly = false, withBefore = true) => (c: Column) => {
    if (waterOnly && c.wort) return <span class="text-xs text-muted" title="In der Würze nicht aus dem Wassermodell">—</span>;
    return pair(get(c.after), withBefore ? get(c.before) : undefined, digits);
  };
  // Water by the carbonate balance; mash and wort by the brewery's model.
  const ph = (c: Column, withBefore = true) => {
    if (c.ph) {
      const title = c.key === 'mash'
        ? `Geschätzt nach ${PH_MODEL_LABEL[model]}, etwa ± 0,1–0,2${withBefore ? '. In Klammern: vor der Gabe nach pH-Messung' : ''}`
        : `Grobe Schätzung über die Pufferung der Schüttung${withBefore ? '. In Klammern: vor den Gaben' : ''}`;
      return pair(c.ph.after, withBefore ? c.ph.before : undefined, 2, title, '≈ ');
    }
    if (!c.wort && c.key !== 'mash') return fig((f) => f.ph, 2, false, withBefore)(c);
    const why = model === 'kolbach' ? 'Das Modell Kolbach schätzt keinen pH' : 'Für die pH-Schätzung fehlen verknüpfte Malze';
    return <span class="text-xs text-muted" title={why}>—</span>;
  };

  // Desktop: one row per water, with its source water and additions below it;
  // the columns are the figures (the mobile tabs show the same data per column).
  const num = 'px-1 py-1.5 text-right tabular-nums';
  const ionOf = (c: Column) => (['ca', 'mg', 'na', 'cl', 'so4'] as const).map((ion) => (
    <td key={ion} class={num}>{fig((f) => f.ions[ion], 0, false, false)(c)}</td>
  ));
  const phTarget = (c: Column) => {
    if (!isPhKey(c.key) || (!isWaterKey(c.key) && !c.ph)) return null;
    const key = c.key;
    const water = isWaterKey(key);
    const known = water ? c.after.ph !== undefined : true;
    return (
      <div class="flex items-center gap-1">
        <OptNum value={settings.targetPh?.[key]} placeholder={key === 'mash' ? fmtNum(DEFAULT_MASH_PH, 1) : '—'} class="w-16"
          onChange={(n) => setWater({ targetPh: { ...settings.targetPh, [key]: n } })} />
        <button type="button" class={`${btnSecondary} px-1.5`} disabled={targetOf(key) === undefined || !known}
          aria-label={water ? 'Säure berechnen' : 'Säure/Base berechnen'}
          title={!known ? 'Das Ausgangswasser hat keinen pH'
            : water ? 'Säure berechnen: setzt die Säuregabe dieser Zeile, sonst legt sie Milchsäure an'
            : `Säure/Base berechnen: setzt die Säure oder Base${key === 'mash' ? ' mit Zeitpunkt „Maische nach pH-Messung“' : ' dieser Zeile'}, sonst legt sie Milchsäure bzw. Natron an`}
          onClick={() => computeAgent(c)}>
          <Calculator size={14} />
        </button>
      </div>
    );
  };
  const small = 'px-1 pb-1 tabular-nums';
  // A change with its sign; nothing when it rounds to zero.
  const delta = (n: number, digits = 0) => (Math.abs(n) < 0.5 * 10 ** -digits ? '' : `${n > 0 ? '+' : '−'}${fmtNum(Math.abs(n), digits)}`);
  // The source water and its blend water of a water column: the share is
  // editable (the two add up to 100 %), the rest is what each brings.
  const sourceRows = (c: Column) => {
    const key = c.key as WaterKey;
    const v = settings.sources?.[key];
    const waters = [...sourceWaters(brewery), VE_WATER];
    const setSrc = (p: WaterSource) => {
      const next = { ...v, ...p };
      setWater({ sources: { ...settings.sources, [key]: Object.values(next).some((x) => x !== undefined) ? next : undefined } });
    };
    const missing = v?.waterId && !waterById(brewery, v.waterId);
    return sourceParts(c).map((p, i) => (
      <tr key={`${c.key}-src${i}`} class="text-xs text-muted">
        <td class="pb-1 pl-4 pr-1">
          {i === 0 ? (
            <select class={`${inp} w-full py-1 text-xs`} aria-label={`Ausgangswasser ${COLUMN_LABEL[c.key]}`} value={v?.waterId ?? ''}
              onChange={(e) => setSrc({ waterId: e.currentTarget.value || undefined })}>
              <option value="">Standard ({c.source!.water.name})</option>
              {waters.map((w) => <option key={w.id} value={w.id}>{w.name || 'Ohne Namen'}</option>)}
              {missing && <option value={v!.waterId}>{v!.waterId} (fehlt)</option>}
            </select>
          ) : (
            <div class="flex items-center gap-1">
              <span>+</span>
              <select class={`${inp} w-full min-w-0 py-1 text-xs`} aria-label={`Verschnittwasser ${COLUMN_LABEL[c.key]}`} value={v?.blendId ?? VE_WATER.id}
                onChange={(e) => setSrc({ blendId: e.currentTarget.value === VE_WATER.id ? undefined : e.currentTarget.value })}>
                {waters.map((w) => <option key={w.id} value={w.id}>{w.name || 'Ohne Namen'}</option>)}
              </select>
            </div>
          )}
        </td>
        <td class="px-1 pb-1" title="Die Anteile ergeben zusammen 100 %">
          <NumInput unit="%" class="w-full" value={p.pct}
            onChange={(n) => setSrc({ blendPct: i === 0 ? (n < 100 ? Math.min(100 - n, 100) : undefined) : (n > 0 ? Math.min(n, 100) : undefined) })} />
        </td>
        <td class={`${small} text-right`}>{fmtL(p.litres)}</td>
        {(['ca', 'mg', 'na', 'cl', 'so4'] as const).map((ion) => (
          <td key={ion} class={`${small} text-right`}>{fmtNum(p.figures.ions[ion])}</td>
        ))}
        <td class={`${small} text-right`}>{fmtNum(p.figures.hco3)}</td>
        <td class={`${small} text-right`}>{fmtNum(p.figures.raDh, 1)}</td>
        <td class={`${small} text-right`} title={`Verhältnis im ${p.water.name}`}>{p.so4Cl === undefined ? '' : fmtNum(p.so4Cl, 2)}</td>
        <td /><td />
      </tr>
    ));
  };
  const th = 'px-1 py-1 text-right font-semibold';
  const desk = (
    <div class="-mx-4 hidden overflow-x-auto md:block">
      <table class="w-full min-w-[62rem] table-fixed text-sm">
        <colgroup>
          <col /><col class="w-28" /><col class="w-16" />
          {[...Array(6)].map((_, i) => <col key={i} class="w-14" />)}
          <col class="w-14" /><col class="w-14" /><col class="w-20" /><col class="w-36" />
        </colgroup>
        <thead class="text-xs text-muted">
          <tr>
            <th rowSpan={2} class="py-1 pl-4 pr-1 text-left font-semibold align-bottom">Wasser</th>
            <th rowSpan={2} class={`${th} align-bottom`}>Anteil</th>
            <th rowSpan={2} class={`${th} align-bottom`}>Menge</th>
            <th colSpan={6} class="border-b border-border px-1 pb-1 text-center font-semibold">Ergebnis (mg/l)</th>
            <th rowSpan={2} class={`${th} align-bottom`} title="Restalkalität">RA<span class="block font-normal">°dH</span></th>
            <th rowSpan={2} class={`${th} align-bottom`}>SO₄ : Cl</th>
            <th rowSpan={2} class={`${th} align-bottom`}>pH<span class="block font-normal">{PH_MODEL_LABEL[model]}</span></th>
            <th rowSpan={2} class="py-1 pl-3 pr-4 text-left font-semibold align-bottom">Ziel-pH</th>
          </tr>
          <tr>
            {[['Ca²⁺', 'Calcium'], ['Mg²⁺', 'Magnesium'], ['Na⁺', 'Natrium'], ['Cl⁻', 'Chlorid'], ['SO₄²⁻', 'Sulfat'], ['HCO₃⁻', 'Hydrogencarbonat']]
              .map(([l, t]) => <th key={l} class={`${th} font-semibold`} title={t}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <Fragment key={c.key}>
              <tr key={c.key} class={`border-t border-border align-top ${c.key === 'total' ? 'bg-fg/[0.03]' : ''}`}>
                <td class="py-1.5 pl-4 pr-1 font-medium">
                  {COLUMN_LABEL[c.key]}
                  {c.key === 'total' && <span class="block text-xs font-normal text-muted">alles</span>}
                </td>
                <td />
                <td class={`${num} text-muted`} title={VOLUME_BASIS[c.key]}>{fmtL(c.volumeL)}</td>
                {ionOf(c)}
                <td class={num}>{fig((f) => f.hco3, 0, true, false)(c)}</td>
                <td class={num}>{fig((f) => f.raDh, 1, true, false)(c)}</td>
                <td class={num}>{fig((f) => f.so4Cl, 2, false, false)(c)}</td>
                <td class={num}>{ph(c, false)}</td>
                <td class="py-1 pl-3 pr-4">{phTarget(c)}</td>
              </tr>
              {c.key === 'mash' && c.doses.length > 0 && (
                <tr class="text-xs text-muted" title="Das Wasser der Maische vor den Gaben">
                  <td class="pb-1 pl-8 pr-1">aus dem Hauptguss</td>
                  <td />
                  <td class="px-1 pb-1 text-right tabular-nums">{fmtL(c.volumeL)}</td>
                  {(['ca', 'mg', 'na', 'cl', 'so4'] as const).map((ion) => (
                    <td key={ion} class={`${small} text-right`}>{fmtNum(c.before.ions[ion])}</td>
                  ))}
                  <td class={`${small} text-right`}>{fmtNum(c.before.hco3)}</td>
                  <td class={`${small} text-right`}>{fmtNum(c.before.raDh, 1)}</td>
                  <td class={`${small} text-right`}>{c.before.so4Cl === undefined ? '' : fmtNum(c.before.so4Cl, 2)}</td>
                  <td class={`${small} text-right`}>{(() => { const p = phOf(c, c.start); return p === undefined ? '' : `≈ ${fmtNum(p, 2)}`; })()}</td>
                  <td />
                </tr>
              )}
              {c.source && isWaterKey(c.key) && sourceRows(c)}
              {c.doses.map((d) => {
                const k = doseContribution(c, d);
                return (
                  <tr key={`${c.key}-${d.ingredient.id}`} class="text-xs text-muted"
                    title={d.share ? 'Anteil der Gabe „Brauwasser“, nach Einfüllmenge' : undefined}>
                    <td class="pb-1 pl-8 pr-1">
                      + {d.ingredient.name || 'Ohne Namen'}
                      <span class="block pl-3 text-faint">{TIMING_LABEL[d.ingredient.timing]}</span>
                    </td>
                    <td class={`${small} text-right`}>{d.share && d.ingredient.amount > 0 ? `${Math.round((100 * d.amount) / d.ingredient.amount)} %` : ''}</td>
                    <td class={`${small} text-right`}>{fmtNum(d.amount, 2)} {d.agent?.unit ?? 'g'}</td>
                    {(['ca', 'mg', 'na', 'cl', 'so4'] as const).map((ion) => (
                      <td key={ion} class={`${small} text-right`}>{k && delta(k.ions[ion])}</td>
                    ))}
                    <td class={`${small} text-right`}>{k && delta(k.hco3)}</td>
                    <td class={`${small} text-right`}>{k && delta(k.raDh, 1)}</td>
                    <td />
                    <td class={`${small} text-right`} title="Allein gerechnet">{k && k.ph !== undefined && delta(k.ph, 2)}</td>
                    <td />
                  </tr>
                );
              })}
            </Fragment>
          ))}
          {target && (
            <tr class="border-t-2 border-border bg-fg/[0.03] align-top text-muted">
              <td class="py-1.5 pl-4 pr-1">
                <div class="flex items-center gap-1">
                  <span class="font-medium">Ziel</span>
                  <span class="text-xs">für den Hauptguss</span>
                </div>
                <div class="mt-1"><TargetSelect brewery={brewery} value={target} onChange={(t) => setWater({ target: t })} /></div>
              </td>
              <td /><td />
              {(['ca', 'mg', 'na', 'cl', 'so4'] as const).map((ion) => <td key={ion} class={`${num} text-fg`}>{targetIon(ion, true, true)}</td>)}
              <td class={`${num} text-fg`}>{targetIon('hco3', false, true)}</td>
              <td class={num}>{targetFigures && fmtNum(targetFigures.raDh, 1)}</td>
              <td class={num}>{targetFigures?.so4Cl !== undefined && fmtNum(targetFigures.so4Cl, 2)}</td>
              <td />
              <td class="py-1.5 pl-3 pr-4 text-right">
                <button type="button" title="Vergleich entfernen" aria-label="Vergleich entfernen" onClick={() => setWater({ target: undefined })}
                  class="rounded-md p-0.5 hover:bg-fg/10"><X size={14} /></button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const autoBtn = (
    <button type="button" class={headerBtn} title="VE-Anteil, Salze und Säure auf ein Zielprofil rechnen" onClick={() => setAuto(true)}>
      <Wand2 size={12} /> Automatisch
    </button>
  );
  const addBtn = (
    <button type="button" onClick={add} class={headerBtn}>
      <Plus size={12} /> Salz/Säure
    </button>
  );
  const salts = (
    <div class="hidden md:block">
      <Section title="Salze und Säuren" sub="dieselben Einträge wie unter Zutaten › Hilfsstoffe"
        action={<div class="flex gap-1">{autoBtn}{addBtn}</div>}>
        <div class="flex flex-col gap-2 px-4 py-3">
          {rows.length === 0 ? <span class="text-sm text-muted">Noch keine Salze oder Säuren.</span> : (
            <>
              <div class="grid grid-cols-[minmax(0,1fr)_14rem_8rem_7rem_2rem] gap-2 text-xs font-semibold text-muted">
                <span>Zutat</span><span>Zeitpunkt</span><span class="text-right">Menge gesamt</span><span class="text-right">Konzentration</span><span />
              </div>
              {rows.map((i) => {
                const agent = agentOf(i, catalog);
                return (
                  <div key={i.id} class="grid grid-cols-[minmax(0,1fr)_14rem_8rem_7rem_2rem] items-center gap-2">
                    <IngredientPicker ingredient={i} onChange={(p) => patch(i.id, p)} only={(e) => e.kind === 'auxiliary' && !!e.waterAgent} />
                    <select class={inp} value={i.timing} aria-label="Zeitpunkt"
                      onChange={(e) => patch(i.id, { timing: e.currentTarget.value as Ingredient['timing'] })}>
                      {allowedTimings('auxiliary', 'water').map((t) => <option key={t} value={t}>{TIMING_LABEL[t]}</option>)}
                    </select>
                    <NumInput unit={agent?.unit ?? 'g'} value={i.amount} class="w-full" onChange={(n) => patch(i.id, { amount: n })} />
                    {agent?.agent.form === 'liquid'
                      ? <Strength i={i} agent={agent} onChange={(strengthPct) => patch(i.id, { strengthPct })} />
                      : <span class="text-right text-xs text-muted">{agent ? 'fest' : ''}</span>}
                    <button type="button" title="Entfernen" aria-label="Entfernen"
                      onClick={() => setIngredients(recipe.ingredients.filter((x) => x.id !== i.id))}
                      class="rounded-md p-1 text-critical hover:bg-fg/10"><Trash2 size={14} /></button>
                  </div>
                );
              })}
              <span class="text-xs text-muted">
                „Brauwasser“ verteilt sich nach Einfüllmenge auf Haupt- und Nachguss; die Tabelle zeigt je Zeile die Menge, die dort landet.
              </span>
            </>
          )}
        </div>
      </Section>
    </div>
  );

  return (
    <>
    {salts}
    <Section title="Aufbereitung"
      action={
        <div class="flex flex-wrap justify-end gap-1">
          {!target && (
            <button type="button" class={headerBtn} title="Hauptguss mit einem Zielprofil vergleichen"
              onClick={() => { setWater({ target: {} }); setTab('target'); }}>
              <Target size={12} /> Ziel
            </button>
          )}
          <div class="contents md:hidden">{autoBtn}{addBtn}</div>
        </div>
      }>
      <div class="p-4">
      <div class="-mt-1 mb-2 flex overflow-x-auto border-b border-border md:hidden">
        {columns.map((c) => (
          <TabBtn key={c.key} active={c.key === active} onClick={() => setTab(c.key)}>{COLUMN_LABEL[c.key]}</TabBtn>
        ))}
        {target && <TabBtn active={active === 'target'} onClick={() => setTab('target')}>Ziel</TabBtn>}
      </div>
      <div style={{ '--n': columns.length + (target ? 1 : 0) }}
        class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 md:hidden">
        {row(<span class="text-xs text-muted">Volumenbasis</span>, (c) => (
          <div>
            <div class="hidden font-medium md:block">{COLUMN_LABEL[c.key]}</div>
            <div class="text-xs text-muted" title={VOLUME_BASIS[c.key]}>{fmtL(c.volumeL)}</div>
          </div>
        ), 'pb-1.5', (
          <div class="flex items-start justify-between gap-1">
            <div>
              <div class="hidden font-medium md:block">Ziel</div>
              <div class="text-xs text-muted">für den Hauptguss</div>
            </div>
            <button type="button" title="Vergleich entfernen" onClick={() => setWater({ target: undefined })}
              class="rounded-md p-0.5 text-muted hover:bg-fg/10">
              <X size={14} />
            </button>
          </div>
        ))}
        {row('Ausgangswasser', (c) => (c.source && isWaterKey(c.key)
          ? <SourcePicker brewery={brewery} value={settings.sources?.[c.key]} source={c.source}
              onChange={(v) => setWater({ sources: { ...settings.sources, [c.key]: v } })} />
          : <span class="text-xs text-muted">{{ mash: 'Hauptguss', preBoil: 'Maische + Nachguss', knockOut: 'Würze', total: 'alles' }[c.key as string]}</span>),
        line, <TargetSelect brewery={brewery} value={target ?? {}} onChange={(t) => setWater({ target: t })} />)}

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
        {row('Calcium', fig((f) => f.ions.ca), 'py-0.5', targetIon('ca'))}
        {row('Magnesium', fig((f) => f.ions.mg), 'py-0.5', targetIon('mg'))}
        {row('Natrium', fig((f) => f.ions.na), 'py-0.5', targetIon('na'))}
        {row('Chlorid', fig((f) => f.ions.cl), 'py-0.5', targetIon('cl'))}
        {row('Sulfat', fig((f) => f.ions.so4), 'py-0.5', targetIon('so4'))}
        {row('Hydrogencarbonat', fig((f) => f.hco3, 0, true), 'py-0.5', targetIon('hco3', false))}
        {row('Restalkalität (°dH)', fig((f) => f.raDh, 1, true), 'py-0.5',
          targetFigures && <span class="tabular-nums text-muted">{fmtNum(targetFigures.raDh, 1)}</span>)}
        {model === 'kolbach' && row(<span title="Palmer, nach Bierfarbe">Ziel-RA (°dH)</span>, (c) => c.raTarget && (
          <span class="tabular-nums">{fmtNum(c.raTarget[0] * DH_PER_MEQ, 1)} bis {fmtNum(c.raTarget[1] * DH_PER_MEQ, 1)}</span>
        ), 'py-0.5')}
        {row('SO₄ : Cl', fig((f) => f.so4Cl, 2), 'py-0.5',
          targetFigures?.so4Cl !== undefined && <span class="tabular-nums text-muted">{fmtNum(targetFigures.so4Cl, 2)}</span>)}
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

      {desk}

      <Calculation columns={columns} model={model} grist={grist} target={target && resolved} />
      {notes.length > 0 && (
        <ul class="mt-3 space-y-1 text-xs text-muted">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {auto && <AutoTreatDialog recipe={recipe} w={w} brewery={brewery} catalog={catalog} onChange={onChange} onClose={() => setAuto(false)} />}
      </div>
    </Section>
    </>
  );
}

// Target profiles: the brewery's own, the built-in ones, or own values.
export function TargetSelect({ brewery, value, onChange }: {
  brewery: Brewery | null; value: WaterTarget; onChange: (t: WaterTarget) => void;
}) {
  const own = (brewery?.waters ?? []).filter((p) => p.target);
  const missing = value.id && !value.ions && !targetProfiles(brewery).some((p) => p.id === value.id);
  const OWN = '__own';
  return (
    <select class={`${inp} w-full`} value={value.ions ? OWN : value.id ?? ''}
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (v === OWN) onChange({ ions: resolveTarget(value, brewery)?.ions ?? { ca: 0, mg: 0, na: 0, cl: 0, so4: 0, hco3: 0 } });
        else onChange(v ? { id: v } : {});
      }}>
      <option value="">— Zielprofil wählen —</option>
      {own.length > 0 && (
        <optgroup label="Eigene Zielprofile">
          {own.map((p) => <option key={p.id} value={p.id}>{p.name || 'Ohne Namen'}</option>)}
        </optgroup>
      )}
      <optgroup label="Mitgeliefert">
        {TARGET_PROFILES.map((p) => <option key={p.id} value={p.id} title={p.note}>{p.name}</option>)}
      </optgroup>
      <option value={OWN}>{OWN_TARGET}</option>
      {missing && <option value={value.id}>{value.id} (fehlt)</option>}
    </select>
  );
}

function SourcePicker({ brewery, value, source, onChange }: {
  brewery: Brewery | null;
  value: WaterSource | undefined;
  source: NonNullable<Column['source']>;
  onChange: (v: WaterSource | undefined) => void;
}) {
  const waters = [...sourceWaters(brewery), VE_WATER];
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
        <NumInput unit="%" value={value?.blendPct ?? 0}
          onChange={(n) => set({ blendPct: n > 0 ? Math.min(n, 100) : undefined })} />
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
          <NumInput unit={agent?.unit ?? 'g'} value={i.amount} onChange={(n) => onPatch({ amount: n })} />
        </div>
        <Strength i={i} agent={agent} onChange={(strengthPct) => onPatch({ strengthPct })} />
      </div>
    </div>
  );
}

function Calculation({ columns, model, grist, target }: {
  columns: Column[]; model: PhModel; grist?: Grist; target?: { name: string; note?: string };
}) {
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
        {target && (
          <p class="text-xs text-muted">
            Ziel „{target.name}“{target.note && ` (${target.note})`}: In Klammern steht die Abweichung des
            Hauptgusses, hervorgehoben ab 20 % bzw. 10 mg/l. HCO₃ und Restalkalität des Ziels dienen nur zur
            Information. Die Alkalität regelt die Säure über den Ziel-pH der Maische.
          </p>
        )}
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
