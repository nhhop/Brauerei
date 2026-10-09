import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-preact';
import { Fragment, type ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { breweryBoilC, heatingText, type Brewery, type Brewhouse } from '../../brewhouse';
import { lovibond } from '../../brewMath';
import type { Efficiency } from '../../efficiency';
import { useCatalog } from '../../ingredientSource';
import { calcMash, fmtClock, type MashPlan, type MashRow } from '../../mashPlan';
import { calcStats, wortExtract, type RecipeStats, type WortPart } from '../../recipeStats';
import { calcWater, fmtL } from '../../recipeWater';
import {
  MASH_KIND_LABEL, SCOPE_TIMINGS, addCharge, chargeIdOf, chargesOf, isMashGrain, removeCharge, uid,
  type Infusion, type MashStep, type MashStepKind, type Recipe,
} from '../../recipes';
import { btnPrimary, btnSecondary, dialogFooter, dialogFrame, dialogScrim, dialogSheet, inp } from '../../ui';
import { Card, Field, NumInput } from './fields';
import { IngredientCard, type IngredientGroup } from './IngredientCard';
import { MashCurve } from './MashCurve';
import { Stat, type TabProps } from './tabs';

const num = (n: number) => n.toFixed(1).replace('.', ',');
const round1 = (n: number) => Math.round(n * 10) / 10;
const kg = (n: number) => `${n.toFixed(2).replace('.', ',')} kg`;

// Rests the "+ Rast" menu offers; the button itself adds the next one above
// the plan's last temperature.
const REST_PRESETS: { name: string; tempC: number; durationMin: number }[] = [
  { name: 'Gummirast', tempC: 40, durationMin: 20 },
  { name: 'Ferulasäurerast', tempC: 45, durationMin: 15 },
  { name: 'Eiweißrast', tempC: 52, durationMin: 10 },
  { name: 'Maltoserast', tempC: 63, durationMin: 40 },
  { name: 'Verzuckerungsrast', tempC: 72, durationMin: 20 },
  { name: 'Abmaischen', tempC: 78, durationMin: 5 },
];

// Tab "Maischen": head card, the mash ingredients by charge, the mash plan and
// its temperature curve. The numbers come from mashPlan.ts; without a
// brewhouse the plan is editable but not computed.
export function MashTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const catalog = useCatalog();
  const bh = brewhouses?.find((b) => b.id === recipe.brewhouseId);
  const wort = catalog ? wortExtract(recipe, catalog.ingredients, bh, brewery) : undefined;
  const water = bh ? calcWater(recipe, bh, wort?.extractKg).water : undefined;
  const plan = bh && water ? calcMash(recipe, bh, brewery, water) : undefined;
  const stats = catalog ? calcStats(recipe, catalog.ingredients, bh, brewery) : undefined;
  return (
    <>
      <HeadCard bh={bh} brewery={brewery} plan={plan} loaded={brewhouses !== null} efficiency={wort?.efficiency} />
      <GrainCard recipe={recipe} onChange={onChange} plan={plan} stats={stats} parts={wort?.colors ?? []} />
      <PlanCard recipe={recipe} onChange={onChange} plan={plan} boilC={plan?.boilC ?? breweryBoilC(brewery)} />
      {plan && (
        <Card title="Temperaturverlauf">
          <MashCurve plan={plan} />
        </Card>
      )}
    </>
  );
}

function TextStat({ label, text, sub }: { label: string; text: string; sub?: string }) {
  return (
    <div>
      <dt class="text-xs text-muted">{label}</dt>
      <dd class="text-lg font-semibold">{text}</dd>
      {sub && <dd class="text-xs text-muted">{sub}</dd>}
    </div>
  );
}

function HeadCard({ bh, brewery, plan, loaded, efficiency: e }: {
  bh?: Brewhouse; brewery: Brewery | null; plan?: MashPlan; loaded: boolean; efficiency?: Efficiency;
}) {
  const rateSub = !plan ? undefined
    : plan.heating.via === 'infusion' ? 'Aufguss: wärmere Rasten durch Zubrühen'
    : plan.heatRate?.estimated ? 'geschätzt aus der Heizleistung'
    : plan.heatRate ? 'Sudhaus' : 'unbekannt';
  return (
    <Card title="Maischen">
      {!bh && (
        <p class="mb-3 text-sm text-muted">
          {loaded ? 'Sudhaus in der Übersicht wählen, dann rechnet der Plan Temperaturen und Heizzeiten.'
            : 'Sudhäuser nicht geladen, der Plan wird nicht gerechnet.'}
        </p>
      )}
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Konversion" value={e?.conversionPct} unit="%" digits={0}
          sub={e?.conversionPct === undefined ? undefined : e.basis === 'conversion' ? e.inputFrom : 'berechnet'} />
        <Stat label="Malztemperatur" value={brewery?.grainTempC} unit="°C" digits={1} sub="Brauerei" />
        <Stat label="Siedepunkt" value={plan?.boilC ?? breweryBoilC(brewery)} unit="°C" digits={1}
          sub={`${brewery?.altitudeM ?? 0} m ü. NN`} />
        <TextStat label="Heizung" text={plan ? heatingText(plan.heating) || '—' : '—'} />
        <Stat label="Heizrate" value={plan?.heatRate?.kPerMin} unit="K/min" digits={1} sub={rateSub} />
        <TextStat label="Gesamtdauer" text={plan ? `${fmtClock(plan.totalMin)} h` : '—'}
          sub={plan && 'ab Aufheizen des Hauptgusses'} />
      </dl>
    </Card>
  );
}

// "+ Label" plus an arrow that opens `menu`, or runs `onArrow`.
function SplitButton({ label, onMain, onArrow, arrowTitle, menu }: {
  label: string; onMain: () => void; onArrow?: () => void; arrowTitle: string;
  menu?: (close: () => void) => ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const btn = 'flex items-center gap-1 border border-border py-1 text-xs text-muted hover:bg-fg/10';
  return (
    <div class="relative inline-flex">
      <button type="button" onClick={onMain} class={`${btn} rounded-l-md px-2`}>
        <Plus size={12} /> {label}
      </button>
      <button type="button" title={arrowTitle} aria-label={arrowTitle} aria-haspopup={menu ? 'menu' : undefined}
        aria-expanded={menu ? open : undefined}
        onClick={() => (onArrow ? onArrow() : setOpen(!open))} class={`${btn} -ml-px rounded-r-md px-1.5`}>
        <ChevronDown size={12} />
      </button>
      {open && menu && (
        <>
          <div class="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" class="absolute right-0 top-full z-40 mt-1 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-card-border bg-surface p-1 shadow-elev-16">
            {menu(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ label, sub, disabled, onClick }: {
  label: string; sub?: string; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      class="flex w-full items-baseline justify-between gap-3 rounded px-2.5 py-2 text-left text-sm hover:bg-fg/5 disabled:text-faint disabled:hover:bg-transparent">
      <span>{label}</span>
      {sub && <span class="text-xs text-muted">{sub}</span>}
    </button>
  );
}

// ── Ingredients by charge ──────────────────────────────────────────────────────

function GrainCard({ recipe, onChange, plan, stats, parts }: {
  recipe: Recipe; onChange: TabProps['onChange']; plan?: MashPlan; stats?: RecipeStats; parts: WortPart[];
}) {
  const [splitting, setSplitting] = useState(false);
  const charges = chargesOf(recipe);
  const totalKg = recipe.ingredients.filter(isMashGrain).reduce((s, i) => s + i.amount, 0);
  const extractAll = parts.reduce((s, p) => s + p.extractKg, 0);
  const colorAll = parts.reduce((s, p) => s + lovibond(p.ebc) * p.kg, 0);

  // A charge's part of the original gravity and the colour (Morey's MCU are
  // linear in the grain, so its share of them).
  function header(id: string, index: number) {
    const c = charges[index];
    const rows = recipe.ingredients.filter((i) => isMashGrain(i) && chargeIdOf(i, charges) === id);
    const ids = new Set(rows.map((i) => i.id));
    const mine = parts.filter((p) => ids.has(p.id));
    const chargeKg = rows.reduce((s, i) => s + i.amount, 0);
    const plato = stats?.ogPlato !== undefined && extractAll > 0
      ? (stats.ogPlato * mine.reduce((s, p) => s + p.extractKg, 0)) / extractAll : undefined;
    const ebc = stats?.ebc !== undefined && colorAll > 0
      ? (stats.ebc * mine.reduce((s, p) => s + lovibond(p.ebc) * p.kg, 0)) / colorAll : undefined;
    const row = plan?.rows.find((r) => r.step.kind === 'doughIn' && chargeIdOf(r.step, charges) === id);
    const step = recipe.mash.find((s) => s.kind === 'doughIn' && chargeIdOf(s, charges) === id);
    const rename = (name: string) => onChange({ charges: charges.map((x) => (x.id === id ? { ...x, name } : x)) });
    return (
      <>
        <input class={`${inp} w-32 font-medium`} value={c.name} aria-label="Name der Schüttung"
          onInput={(e) => rename(e.currentTarget.value)} />
        <span class="text-xs text-muted">
          {step ? `${step.name || 'Einmaischen'}${row ? ` · ${fmtClock(row.startMin)}` : ''}` : 'nicht im Plan'}
        </span>
        <span class="text-xs tabular-nums">
          {kg(chargeKg)} · {totalKg > 0 ? Math.round((chargeKg / totalKg) * 100) : 0} %
          {ebc !== undefined && ` · ${Math.round(ebc)} EBC`}
          {plato !== undefined && ` · ${num(plato)} °P`}
        </span>
        {index > 0 && (
          <button type="button" title="Schüttung entfernen, Malz zurück in die erste"
            onClick={() => onChange(removeCharge(recipe, id))}
            class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
            <Trash2 size={14} />
          </button>
        )}
      </>
    );
  }

  const groups: IngredientGroup[] | undefined = charges.length > 1 ? charges.map((c, index) => ({
    id: c.id,
    header: header(c.id, index),
    match: (i) => isMashGrain(i) && chargeIdOf(i, charges) === c.id,
    init: { kind: 'fermentable', timing: 'mash', chargeId: index === 0 ? undefined : c.id },
    addLabel: 'Malz',
  })) : undefined;

  return (
    <>
      <IngredientCard title="Zutaten (Maische)" scope="mash" all={recipe.ingredients}
        onChange={(ingredients) => onChange({ ingredients })}
        match={(i) => SCOPE_TIMINGS.mash.includes(i.timing)} boilMin={recipe.boil.durationMin} groups={groups}
        action={<SplitButton label="Schüttung" onMain={() => onChange(addCharge(recipe))}
          onArrow={() => setSplitting(true)} arrowTitle="Schüttung aufteilen" />} />
      {splitting && <SplitDialog recipe={recipe} onChange={onChange} onClose={() => setSplitting(false)} />}
    </>
  );
}

// "Schüttung aufteilen": moves a share of every malt of one charge into a new
// charge, which is mashed in at the chosen place in the plan.
function SplitDialog({ recipe, onChange, onClose }: {
  recipe: Recipe; onChange: TabProps['onChange']; onClose: () => void;
}) {
  const charges = chargesOf(recipe);
  const [fromId, setFromId] = useState(charges[0].id);
  const [pct, setPct] = useState(50);
  const [after, setAfter] = useState(recipe.mash[recipe.mash.length - 1].id);
  const valid = pct > 0 && pct < 100;
  const result = addCharge(recipe, { fromId, pct, afterStepId: after });
  const grains = recipe.ingredients.filter((i) => isMashGrain(i) && chargeIdOf(i, charges) === fromId);
  const kept = (id: string) => result.ingredients!.find((i) => i.id === id)!.amount;
  const newName = result.charges![result.charges!.length - 1].name;
  const sumKept = grains.reduce((s, i) => s + kept(i.id), 0);
  const sumMoved = grains.reduce((s, i) => s + i.amount - kept(i.id), 0);

  return (
    <div class={dialogScrim} onClick={onClose}>
      <div class={`max-h-[90vh] w-full max-w-lg ${dialogFrame} ${dialogSheet}`} onClick={(e) => e.stopPropagation()}>
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <h2 class="mb-4 text-base font-medium text-fg">Schüttung aufteilen</h2>
          <div class="flex flex-wrap items-end gap-4">
            {charges.length > 1 && (
              <Field label="Schüttung">
                <select class={inp} value={fromId} onChange={(e) => setFromId(e.currentTarget.value)}>
                  {charges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Abspalten (%)">
              <NumInput value={pct} onChange={setPct} class="w-20" />
            </Field>
          </div>
          {grains.length === 0 ? (
            <p class="mt-4 text-sm text-muted">Die Schüttung hat kein Malz.</p>
          ) : (
            <div class="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
              <span class="text-xs text-muted">Malz</span>
              <span class="text-right text-xs text-muted">bleibt</span>
              <span class="text-right text-xs text-muted">{newName}</span>
              {grains.map((i) => (
                <Fragment key={i.id}>
                  <span class="truncate">{i.name || '—'}</span>
                  <span class="text-right tabular-nums">{kg(kept(i.id))}</span>
                  <span class="text-right tabular-nums">{kg(i.amount - kept(i.id))}</span>
                </Fragment>
              ))}
              <span class="font-semibold">Summe</span>
              <span class="text-right font-semibold tabular-nums">{kg(sumKept)}</span>
              <span class="text-right font-semibold tabular-nums">{kg(sumMoved)}</span>
            </div>
          )}
          <div class="mt-4">
            <Field label="Zugabe im Maischeplan">
              <select class={`${inp} w-full`} value={after} onChange={(e) => setAfter(e.currentTarget.value)}>
                {recipe.mash.slice(1).map((s) => <option key={s.id} value={s.id}>nach {s.name || MASH_KIND_LABEL[s.kind]}</option>)}
              </select>
            </Field>
            <p class="mt-1 text-xs text-muted">Legt dort einen Schritt „Einmaischen“ für {newName} an.</p>
          </div>
        </div>
        <div class={dialogFooter}>
          <button type="button" class={btnSecondary} onClick={onClose}>Abbrechen</button>
          <button type="button" class={btnPrimary} disabled={!valid || grains.length === 0}
            onClick={() => { onChange(result); onClose(); }}>
            Aufteilen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mash plan ──────────────────────────────────────────────────────────────────

const GRID = 'md:grid md:grid-cols-[1rem_6.5rem_minmax(8rem,1.3fr)_minmax(12.5rem,1fr)_5rem_5.5rem_6.5rem_2.75rem_2rem] md:items-center md:gap-2';

function PlanCard({ recipe, onChange, plan, boilC }: {
  recipe: Recipe; onChange: TabProps['onChange']; plan?: MashPlan; boilC: number;
}) {
  const steps = recipe.mash;
  const charges = chargesOf(recipe);
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const set = (mash: MashStep[]) => onChange({ mash });
  const patch = (id: string, p: Partial<MashStep>) => set(steps.map((s) => (s.id === id ? { ...s, ...p } : s)));
  // The first two steps stay in place.
  function move(from: number, to: number) {
    if (from < 2 || to < 2 || to >= steps.length || from === to) return;
    const next = [...steps];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    set(next);
  }
  const add = (s: Omit<MashStep, 'id'>) => set([...steps, { id: uid(), ...s }]);

  const lastC = plan ? plan.rows[plan.rows.length - 1].tempC
    : [...steps].reverse().find((s) => s.tempC !== undefined)?.tempC ?? 63;
  const nextRest = REST_PRESETS.find((p) => p.tempC > lastC + 0.5) ?? REST_PRESETS[REST_PRESETS.length - 1];
  const unmashed = charges.slice(1).filter((c) => !steps.some((s) => s.kind === 'doughIn' && chargeIdOf(s, charges) === c.id));

  // Insertion index under the pointer, never above the fixed steps.
  function dropIndex(clientY: number): number {
    const els = [...listRef.current!.querySelectorAll<HTMLElement>('[data-step]')];
    const i = els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    return Math.max(2, i < 0 ? els.length : i);
  }

  const menu = (close: () => void) => {
    const pick = (s: Omit<MashStep, 'id'>) => { add(s); close(); };
    return (
      <>
        <div class="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">Schritt</div>
        <MenuItem label="Zubrühen" sub="Wasser zugeben, heiß oder kalt"
          onClick={() => pick({ kind: 'infusion', name: 'Zubrühen', tempC: nextRest.tempC, durationMin: 10, infusion: { lead: 'temp' } })} />
        {unmashed.map((c) => (
          <MenuItem key={c.id} label={`Einmaischen · ${c.name}`} sub="weitere Schüttung"
            onClick={() => pick({ kind: 'doughIn', name: `${c.name} zugeben`, durationMin: 10, chargeId: c.id })} />
        ))}
        {unmashed.length === 0 && <MenuItem label="Einmaischen" sub="erst Schüttung anlegen" disabled />}
        <MenuItem label="Dekoktion" sub="kommt mit 3d" disabled />
        <div class="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">Rast</div>
        {REST_PRESETS.map((p) => (
          <MenuItem key={p.name} label={p.name} sub={`${p.tempC} °C · ${p.durationMin} min`}
            onClick={() => pick({ kind: 'rest', ...p })} />
        ))}
      </>
    );
  };

  const holdMin = plan?.rows.reduce((s, r) => s + r.holdMin, 0) ?? 0;
  const strikeRow = plan?.rows[0];

  return (
    <Card title="Maischeplan"
      action={<SplitButton label="Rast" onMain={() => add({ kind: 'rest', ...nextRest })} arrowTitle="Weitere Schritte" menu={menu} />}>
      <div ref={listRef} class="text-sm">
        <div class={`hidden border-b border-border pb-1 text-xs text-muted ${GRID}`}>
          <span />
          <span>Schritt</span>
          <span>Bezeichnung</span>
          <span>Zugabe</span>
          <span>Temperatur</span>
          <span>Dauer</span>
          <span>Übergang</span>
          <span class="text-right">Beginn</span>
          <span />
        </div>
        {steps.map((s, k) => (
          <StepRow key={s.id} step={s} index={k} count={steps.length} row={plan?.rows[k]} recipe={recipe}
            boilC={boilC} patch={(p) => patch(s.id, p)} onMove={(by) => move(k, k + by)}
            onDelete={() => set(steps.filter((x) => x.id !== s.id))}
            dragging={drag?.from === k}
            dropBefore={!!drag && drag.to === k && drag.to !== drag.from && drag.to !== drag.from + 1}
            dropAfter={!!drag && k === steps.length - 1 && drag.to === steps.length && drag.from !== k}
            grip={{
              onPointerDown: (e: PointerEvent) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                setDrag({ from: k, to: k });
              },
              onPointerMove: (e: PointerEvent) => { if (drag) setDrag({ ...drag, to: dropIndex(e.clientY) }); },
              onPointerUp: () => {
                if (drag) move(drag.from, drag.to > drag.from ? drag.to - 1 : drag.to);
                setDrag(null);
              },
              onPointerCancel: () => setDrag(null),
            }} />
        ))}
        {plan && strikeRow && (
          <div class="flex flex-wrap justify-between gap-x-4 gap-y-1 pt-2 text-xs text-muted">
            <span>
              Wasser {fmtL(strikeRow.waterL!)}
              {plan.infusionL > 0 && ` + ${fmtL(plan.infusionL)} Zubrühen`} = Hauptguss {fmtL(strikeRow.waterL! + plan.infusionL)}
            </span>
            <span>
              Rasten {Math.round(holdMin)} min · Übergänge {Math.round(plan.totalMin - holdMin)} min · gesamt{' '}
              <span class="font-semibold text-fg">{fmtClock(plan.totalMin)} h</span>
            </span>
          </div>
        )}
      </div>
      {plan && plan.notes.length > 0 && (
        <ul class="mt-3 space-y-1 text-xs text-muted">
          {plan.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </Card>
  );
}

const CHANGEABLE: MashStepKind[] = ['rest', 'infusion'];

function StepRow({ step: s, index: k, count, row, recipe, boilC, patch, onMove, onDelete, dragging, dropBefore, dropAfter, grip }: {
  step: MashStep; index: number; count: number; row?: MashRow; recipe: Recipe; boilC: number;
  patch: (p: Partial<MashStep>) => void; onMove: (by: -1 | 1) => void; onDelete: () => void;
  dragging: boolean; dropBefore: boolean; dropAfter: boolean;
  grip: Record<string, (e: PointerEvent) => void>;
}) {
  const fixed = k < 2;
  const charges = chargesOf(recipe);
  const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10 disabled:opacity-30';
  const ro = (text: string) => <span class="tabular-nums text-muted">{text}</span>;
  const indicator = dropBefore ? 'shadow-[inset_0_2px_0_var(--accent)]' : dropAfter ? 'shadow-[inset_0_-2px_0_var(--accent)]' : '';

  let addition: ComponentChildren;
  if (s.kind === 'strike') {
    addition = ro(row ? `${fmtL(row.waterL!)} Hauptguss` : 'Hauptguss');
  } else if (s.kind === 'doughIn') {
    const amount = row?.grainKg !== undefined ? ` · ${kg(row.grainKg)}` : '';
    addition = k === 1 || charges.length < 2 ? ro(`${charges[0].name}${amount}`) : (
      <span class="flex items-center gap-1">
        <select class={inp} value={chargeIdOf(s, charges)} aria-label="Schüttung"
          onChange={(e) => patch({ chargeId: e.currentTarget.value })}>
          {charges.slice(1).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {ro(amount.replace(' · ', ''))}
      </span>
    );
  } else if (s.kind === 'infusion') {
    addition = <InfusionFields step={s} row={row} boilC={boilC} patch={patch} />;
  } else {
    addition = row?.waterL ? ro(`${fmtL(row.waterL)} à ${num(row.waterTempC!)} °C`) : ro('—');
  }

  const tempEditable = s.kind === 'rest' || s.kind === 'infusion' || s.kind === 'decoction' || (s.kind === 'doughIn' && k === 1);
  return (
    <div data-step class={`flex flex-wrap items-center gap-2 border-b border-border py-2 ${GRID} ${dragging ? 'opacity-50' : ''} ${indicator}`}>
      <span class="max-md:hidden">
        {!fixed && (
          <button type="button" title="Ziehen zum Verschieben" aria-label="Ziehen zum Verschieben" {...grip}
            class="flex cursor-grab touch-none items-center text-faint hover:text-fg">
            <GripVertical size={14} />
          </button>
        )}
      </span>
      <span class="w-28 md:w-auto">
        {fixed || s.kind === 'doughIn' || !CHANGEABLE.includes(s.kind) ? (
          <span class="text-xs text-muted">{MASH_KIND_LABEL[s.kind]}</span>
        ) : (
          <select class={`${inp} w-full`} value={s.kind} aria-label="Art des Schritts"
            onChange={(e) => {
              const kind = e.currentTarget.value as MashStepKind;
              patch({ kind, infusion: kind === 'infusion' ? { lead: 'temp' } : undefined });
            }}>
            <option value="rest">Rast</option>
            <option value="infusion">Zubrühen</option>
            <option value="decoction" disabled>Dekoktion (kommt mit 3d)</option>
          </select>
        )}
      </span>
      <input class={`${inp} min-w-0 flex-1 basis-40 md:basis-auto`} value={s.name} placeholder={MASH_KIND_LABEL[s.kind]}
        aria-label="Bezeichnung" onInput={(e) => patch({ name: e.currentTarget.value })} />
      <span class={`basis-full text-xs md:basis-auto ${(s.kind === 'rest' && !row?.waterL) || s.kind === 'decoction' ? 'max-md:hidden' : ''}`}>
        {addition}
      </span>
      <span class="flex items-center gap-1 text-xs text-muted">
        {tempEditable ? (
          <NumInput value={s.tempC ?? round1(row?.tempC ?? 0)} onChange={(n) => patch({ tempC: n })} class="w-16" />
        ) : (
          <span class="tabular-nums">{row ? num(row.tempC) : '—'}</span>
        )}
        °C
      </span>
      <span class="flex items-center gap-1 text-xs text-muted">
        {s.kind === 'strike' ? '—' : (
          <>
            <NumInput value={s.durationMin ?? 0} onChange={(n) => patch({ durationMin: n })} class="w-14" /> min
          </>
        )}
      </span>
      <span class="text-xs text-muted" title={row?.transition.kind === 'cool' ? 'geschätzt' : undefined}>
        {row?.transition.text ?? '—'}
      </span>
      <span class="text-right text-xs tabular-nums md:text-sm">{row ? fmtClock(row.startMin) : '—'}</span>
      <span class="ml-auto flex items-center gap-1 md:ml-0">
        {!fixed && (
          <>
            <button type="button" title="Nach oben" disabled={k === 2} onClick={() => onMove(-1)} class={`${iconBtn} md:hidden`}>
              <ArrowUp size={14} />
            </button>
            <button type="button" title="Nach unten" disabled={k === count - 1} onClick={() => onMove(1)} class={`${iconBtn} md:hidden`}>
              <ArrowDown size={14} />
            </button>
            <button type="button" title="Entfernen" onClick={onDelete}
              class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </span>
    </div>
  );
}

// Volume and water temperature of an infusion: the one edited last leads, the
// other shows the result (muted). Ice fixes the temperature.
function InfusionFields({ step, row, boilC, patch }: {
  step: MashStep; row?: MashRow; boilC: number; patch: (p: Partial<MashStep>) => void;
}) {
  const inf: Infusion = step.infusion ?? { lead: 'volume' };
  const set = (p: Partial<Infusion>) => patch({ infusion: { ...inf, ...p } });
  const byVolume = inf.lead === 'volume' && !inf.ice;
  return (
    <span class="flex flex-wrap items-center gap-1 text-muted">
      <NumInput value={byVolume ? (inf.volumeL ?? 0) : round1(row?.waterL ?? 0)}
        onChange={(n) => set({ lead: 'volume', volumeL: n, ice: undefined })} class={`w-16 ${byVolume ? '' : 'text-muted'}`} />
      l
      {inf.ice ? <span class="px-1">Eis</span> : (
        <>
          <NumInput value={!byVolume ? (inf.waterTempC ?? round1(boilC)) : round1(row?.waterTempC ?? 0)}
            onChange={(n) => set({ lead: 'temp', waterTempC: n })} class={`w-16 ${byVolume ? 'text-muted' : ''}`} />
          °C
        </>
      )}
      <label class="ml-1 flex items-center gap-1">
        <input type="checkbox" checked={!!inf.ice} onChange={(e) => set({ ice: e.currentTarget.checked || undefined, lead: 'temp' })} />
        Eis
      </label>
    </span>
  );
}
