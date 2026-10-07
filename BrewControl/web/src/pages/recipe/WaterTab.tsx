import type { ComponentChildren } from 'preact';
import { grainAbsorptionOf } from '../../brewhouse';
import { useCatalog } from '../../ingredientSource';
import { wortExtract } from '../../recipeStats';
import { DEFAULT_MASH_RATIO, DEFAULT_SPARGE_TEMP, type Dilution, type RecipeWater } from '../../recipes';
import { calcWater, fmtL, type Loss, type Source, type Water } from '../../recipeWater';
import { Segmented } from '../../components/Segmented';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { btnSecondary, inp } from '../../ui';
import { Card, Field, NumInput, OptNum } from './fields';
import { Stat, type TabProps } from './tabs';
import { TreatmentCard } from './TreatmentCard';

const num = (n: number) => n.toFixed(1).replace('.', ',');

const round1 = (n: number) => Math.round(n * 10) / 10;

// Water volumes, counted back from the knock-out volume (recipeWater.ts), and
// the water treatment (recipeTreatment.ts).
export function WaterTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const catalog = useCatalog();
  if (!brewhouses) {
    return <Card title="Wassermenge"><p class="text-sm text-muted">Sudhäuser nicht geladen, Wassermengen nicht verfügbar.</p></Card>;
  }
  const bh = brewhouses.find((b) => b.id === recipe.brewhouseId);
  const extractKg = catalog ? wortExtract(recipe, catalog.ingredients).extractKg : undefined;
  const { water: w, notes } = calcWater(recipe, bh, extractKg);
  if (!w || !bh) {
    return (
      <Card title="Wassermenge">
        <Notes notes={notes} />
        <p class="mt-1 text-sm text-muted">Sudhaus in der Übersicht wählen.</p>
      </Card>
    );
  }

  const settings = recipe.water ?? {};
  const set = (p: Partial<RecipeWater>) => {
    const next = { ...settings, ...p };
    onChange({ water: Object.values(next).some((v) => v !== undefined) ? next : undefined });
  };
  const boilEvaporation = bh.vessels.find((v) => v.id === bh.steps.boil?.vesselId)?.evaporationLPerH;
  const fillSub = (fill: number, water: number) => (fill !== water ? `einfüllen ${fmtL(fill)}` : undefined);
  const fit = w.fitDilutionL === undefined ? undefined : Math.ceil(w.fitDilutionL * 10) / 10;

  return (
    <>
      <Card title="Wassermenge">
        <p class="mb-3 text-xs text-muted">Sudhaus „{bh.name}“, vom Ausschlag ({fmtL(w.knockOutL)}) zurückgerechnet</p>
        <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hauptguss" value={w.strikeL} unit="l" digits={1} sub={fillSub(w.strikeFillL, w.strikeL)} />
          <Stat label="Nachguss" value={w.sparge ? w.spargeL : undefined} unit="l" digits={1}
            sub={w.sparge ? fillSub(w.spargeFillL, w.spargeL) : 'Vollguss'} />
          <Stat label="Gesamtwasser" value={w.totalL} unit="l" digits={1} />
          <Stat label="Pfannevoll" value={w.preBoilL} unit="l" digits={1} />
        </dl>

        <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <ToggleSwitch checked={w.sparge} disabled={!w.canSparge}
            title={w.canSparge ? undefined : 'Das Sudhaus hat keinen Nachguss'}
            onChange={(on) => set({ sparge: on ? undefined : false })} />
          <span>Mit Nachguss</span>
          {!w.canSparge && <span class="text-xs text-muted">Das Sudhaus hat keinen Nachguss</span>}
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-4">
          <Field label="Hauptguss-Verhältnis (l/kg)">
            {w.sparge ? (
              <NumInput value={settings.mashRatioLPerKg ?? DEFAULT_MASH_RATIO} onChange={(n) => set({ mashRatioLPerKg: n })} />
            ) : (
              <input class={`${inp} w-24 text-muted`} readOnly value={w.mashRatioLPerKg === undefined ? '—' : num(w.mashRatioLPerKg)} />
            )}
          </Field>
          {w.sparge && (
            <Field label="Nachguss-Temperatur (°C)">
              <NumInput value={settings.spargeTempC ?? DEFAULT_SPARGE_TEMP} onChange={(n) => set({ spargeTempC: n })} />
            </Field>
          )}
          <Override label="Verdampfung (l/h)" value={settings.evaporationLPerH} brewhouse={boilEvaporation ?? 0}
            onChange={(evaporationLPerH) => set({ evaporationLPerH })} />
          <Override label="Treberverlust (l/kg)" value={settings.grainAbsorptionLPerKg} brewhouse={grainAbsorptionOf(bh)}
            onChange={(grainAbsorptionLPerKg) => set({ grainAbsorptionLPerKg })} />
        </div>

        <DilutionSection w={w} value={settings.dilution} onChange={(dilution) => set({ dilution })} />
        <WaterBar w={w} />
        <Calculation w={w} boilMin={recipe.boil.durationMin} />
        <Notes notes={notes} />
        {fit !== undefined && (
          <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            Mit mindestens {fmtL(fit)} Verschnitt in der Pfanne passt es.
            <button type="button" class={`${btnSecondary} px-2 text-xs`}
              onClick={() => set({ dilution: { at: 'kettle', lead: 'volume', volumeL: fit } })}>
              übernehmen
            </button>
          </p>
        )}
      </Card>
      <TreatmentCard recipe={recipe} onChange={onChange} w={w} brewery={brewery} catalog={catalog?.ingredients ?? null} />
    </>
  );
}

// Planned dilution (high gravity): volume and gravity, the one edited last leads.
// Closed while nothing is planned. Changing the place keeps the volume, since
// the gravity means another wort there.
function DilutionSection({ w, value, onChange }: {
  w: Water; value: Dilution | undefined; onChange: (d: Dilution | undefined) => void;
}) {
  const d = w.dilution;
  const at = value?.at ?? 'kettle';
  const set = (p: Partial<Dilution>) => onChange({ at, lead: 'volume', ...value, ...p });
  const gravity = at === 'kettle' ? d.kettlePlato : d.finalPlato;
  return (
    <details class="mt-4" open={value !== undefined}>
      <summary class="cursor-pointer text-sm">Verschnitt{d.volumeL > 0 ? ` (${fmtL(d.volumeL)})` : ''}</summary>
      <div class="mt-2 flex flex-wrap items-end gap-4">
        <Field label="Ort">
          <Segmented value={at} onChange={(v) => set({ at: v, lead: 'volume', volumeL: round1(d.volumeL), plato: undefined })}
            options={[{ value: 'kettle', label: 'Pfanne bei Kochende' }, { value: 'fermenter', label: 'Gärbehälter' }]} />
        </Field>
        <Field label="Menge (l)">
          <NumInput value={value?.lead !== 'gravity' ? (value?.volumeL ?? 0) : round1(d.volumeL)}
            onChange={(n) => set({ lead: 'volume', volumeL: n })} />
        </Field>
        <Field label={at === 'kettle' ? 'Pfannen-Stammwürze (°P)' : 'Anstell-Stammwürze (°P)'}>
          {gravity === undefined ? (
            <input class={`${inp} w-24 text-muted`} readOnly value="—" title="Braucht die Stammwürze (Vergärbares verknüpfen)" />
          ) : (
            <NumInput value={value?.lead === 'gravity' && value.plato !== undefined ? value.plato : round1(gravity)}
              onChange={(n) => set({ lead: 'gravity', plato: n })} />
          )}
        </Field>
        {value && (
          <button type="button" class={btnSecondary} onClick={() => onChange(undefined)}>Kein Verschnitt</button>
        )}
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {at === 'kettle' ? (
          <>
            <Stat label="Pfannenmenge" value={d.kettleL} unit="l" digits={1} sub="am Kochende, vor dem Verschnitt" />
            <Stat label="Stammwürze nach Verschnitt" value={d.finalPlato} unit="°P" digits={1} />
          </>
        ) : (
          <>
            <Stat label="Kommt im Gärbehälter an" value={d.restL} unit="l" digits={1} sub="vor dem Verschnitt" />
            <Stat label="Ausschlag-Stammwürze" value={d.kettlePlato} unit="°P" digits={1} />
            <Stat label="Anstellmenge" value={d.finalL} unit="l" digits={1} />
          </>
        )}
      </dl>
    </details>
  );
}

// A recipe value over the brewhouse's: the placeholder shows the brewhouse
// value, the button drops the override.
function Override({ label, value, brewhouse, onChange }: {
  label: string; value: number | undefined; brewhouse: number; onChange: (n: number | undefined) => void;
}) {
  return (
    <div class="flex items-end gap-1">
      <Field label={label}>
        <OptNum value={value} placeholder={String(brewhouse)} onChange={onChange} />
      </Field>
      {value !== undefined && (
        <button type="button" class={btnSecondary} title={`Sudhaus-Wert ${String(brewhouse).replace('.', ',')}`}
          onClick={() => onChange(undefined)}>
          Sudhaus-Wert
        </button>
      )}
    </div>
  );
}

// Total water split by where it goes. Slots 3 and 4 are below 3:1 contrast on
// the light theme, so the legend carries every value.
// A dilution adds its own segment on top of the total water.
function WaterBar({ w }: { w: Water }) {
  const d = w.dilution;
  const parts = [
    { label: d.at === 'kettle' && d.volumeL > 0 ? 'Ausschlag ohne Verschnitt' : 'Ausschlag', l: d.kettleL, color: 'var(--series-1)' },
    ...(d.volumeL > 0 ? [{ label: 'Verschnitt', l: d.volumeL, color: 'color-mix(in srgb, var(--series-1) 45%, transparent)' }] : []),
    { label: 'Verdampfung', l: w.evaporationL, color: 'var(--series-2)' },
    { label: 'Treber', l: w.absorptionL, color: 'var(--series-3)' },
    { label: 'Totraum/Transfer', l: w.wortLossL, color: 'var(--series-4)' },
  ];
  const total = w.totalL + d.volumeL;
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

function Row({ op = '', label, l, from, strong }: {
  op?: string; label: ComponentChildren; l: number; from?: Source; strong?: boolean;
}) {
  return (
    <>
      <span class={strong ? 'font-semibold' : ''}>{op && <span class="inline-block w-4 text-muted">{op}</span>}{label}</span>
      <span class={`text-right tabular-nums ${strong ? 'font-semibold' : ''}`}>{fmtL(l)}</span>
      <span class="text-xs text-muted">{from ?? ''}</span>
    </>
  );
}

const lossRows = (losses: Loss[]) => losses.map((x) => <Row key={x.label} op="+" label={x.label} l={x.l} from="Sudhaus" />);

function Calculation({ w, boilMin }: { w: Water; boilMin: number }) {
  return (
    <details class="mt-4">
      <summary class="cursor-pointer text-sm">Berechnung</summary>
      <div class="mt-2 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 text-sm">
        <Row label="Ausschlag" l={w.knockOutL} from="Rezept" />
        <Row op="+" label={`Verdampfung (${num(w.evaporationLPerH)} l/h × ${boilMin} min)`} l={w.evaporationL} from={w.evaporationFrom} />
        <Row op="=" label="Pfannevoll" l={w.preBoilL} strong />
        {w.wortLosses.length > 0 ? lossRows(w.wortLosses) : <Row op="+" label="Würzeverluste (kein Transfer)" l={0} from="Sudhaus" />}
        <Row op="+" label={`Treber (${num(w.grainKg)} kg × ${num(w.absorptionLPerKg)} l/kg)`} l={w.absorptionL} from={w.absorptionFrom} />
        <Row op="=" label="Gesamtwasser" l={w.totalL} strong />
        {w.sparge ? (
          <Row label={`Hauptguss (${num(w.mashRatioLPerKg!)} l/kg × ${num(w.grainKg)} kg)`} l={w.strikeL} from="Rezept" />
        ) : (
          <Row label={`Hauptguss = Gesamtwasser (Vollguss${w.mashRatioLPerKg === undefined ? '' : `, ${num(w.mashRatioLPerKg)} l/kg`})`} l={w.strikeL} />
        )}
        {w.strikeFill.length > 0 && (
          <>
            {lossRows(w.strikeFill)}
            <Row op="=" label="Hauptguss einfüllen" l={w.strikeFillL} strong />
          </>
        )}
        {w.sparge && <Row label="Nachguss (Gesamtwasser − Hauptguss)" l={w.spargeL} />}
        {w.spargeFill.length > 0 && (
          <>
            {lossRows(w.spargeFill)}
            <Row op="=" label="Nachguss einfüllen" l={w.spargeFillL} strong />
          </>
        )}
      </div>
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
