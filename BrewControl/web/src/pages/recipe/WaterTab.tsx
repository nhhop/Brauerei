import { grainAbsorptionOf } from '../../brewhouse';
import { lauterText } from '../../efficiency';
import { useCatalog } from '../../ingredientSource';
import { atKnockOut, wortExtract } from '../../recipeStats';
import { DEFAULT_MASH_RATIO, DEFAULT_SPARGE_TEMP, type Dilution, type RecipeWater } from '../../recipes';
import { calcWater, fmtL, type Loss, type Water } from '../../recipeWater';
import { Segmented } from '../../components/Segmented';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { btnSecondary, inp } from '../../ui';
import { CalcTable, Row, Section } from './CalcTable';
import { Card, Field, NumInput, OptNum } from './fields';
import { Stat, type TabProps } from './tabs';
import { TreatmentCard } from './TreatmentCard';

const num = (n: number) => n.toFixed(1).replace('.', ',');

// Up to two decimals, no trailing zeros (0,96 l/kg must not read 1,0).
const num2 = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

const round1 = (n: number) => Math.round(n * 10) / 10;

// Water volumes, counted back from the knock-out volume (recipeWater.ts), and
// the water treatment (recipeTreatment.ts).
export function WaterTab({ recipe, onChange, brewhouses, brewery }: TabProps) {
  const catalog = useCatalog();
  if (!brewhouses) {
    return <Card title="Wassermenge"><p class="text-sm text-muted">Sudhäuser nicht geladen, Wassermengen nicht verfügbar.</p></Card>;
  }
  const bh = brewhouses.find((b) => b.id === recipe.brewhouseId);
  const hot = atKnockOut(recipe, bh, catalog?.entries ?? null, brewery);
  const wort = catalog ? wortExtract(hot, catalog.entries, bh, brewery) : undefined;
  const { water: w, notes } = calcWater(hot, bh, wort?.extractKg, brewery, wort?.draw);
  const lauter = wort?.efficiency.lauter;
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
      <Section title="Wassermenge">
        <div class="p-4">
        <p class="mb-3 text-xs text-muted">Sudhaus „{bh.name}“, vom Ausschlag ({fmtL(w.knockOutL)}) zurückgerechnet</p>
        <dl class="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat large label="Hauptguss" value={w.strikeL} unit="l" digits={1} sub={fillSub(w.strikeFillL, w.strikeL)} />
          <Stat large label="Nachguss" value={w.sparge ? w.spargeL : undefined} unit="l" digits={1}
            sub={w.sparge ? fillSub(w.spargeFillL, w.spargeL) : 'Vollguss'} />
          <Stat large label="Gesamtwasser" value={w.totalL} unit="l" digits={1} />
          <Stat large label="Pfannevoll" value={w.preBoilL} unit="l" digits={1} />
          <Stat large label="Läutereffizienz" value={lauter?.pct} unit="%" digits={0} sub={lauter && lauterText(lauter)} />
        </dl>

        <div class="mt-4 flex flex-wrap items-end gap-4">
          <Field label="Nachguss">
            <Segmented value={!w.sparge ? 'none' : (settings.spargeMethod ?? 'batch')} disabled={!w.canSparge}
              onChange={(v) => set(v === 'none' ? { sparge: false } : { sparge: undefined, spargeMethod: v === 'batch' ? undefined : v })}
              options={[{ value: 'none', label: 'No Sparge' }, { value: 'batch', label: 'Batch Sparge' }, { value: 'fly', label: 'Fly Sparge' }]} />
          </Field>
          {w.sparge && (
            <>
              <Field label="Nachguss-Temperatur">
                <NumInput unit="°C" value={settings.spargeTempC ?? DEFAULT_SPARGE_TEMP} onChange={(n) => set({ spargeTempC: n })} />
              </Field>
              {settings.spargeMethod !== 'fly' && (
                <Field label="Gaben">
                  <NumInput value={settings.spargeBatches ?? 1} class="w-16"
                    onChange={(n) => set({ spargeBatches: n > 1 ? Math.round(n) : undefined })} />
                </Field>
              )}
            </>
          )}
          {!w.canSparge && <span class="text-xs text-muted">Das Sudhaus hat keinen Nachguss</span>}
        </div>

        <DilutionSection w={w} value={settings.dilution} onChange={(dilution) => set({ dilution })} />
        <WaterBar w={w} />
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
        </div>
        <Calculation w={w} boilMin={recipe.boil.durationMin} cold={recipe.volumeBasis === 'cold'} settings={settings} set={set}
          bhEvaporation={boilEvaporation ?? 0} bhAbsorption={grainAbsorptionOf(bh)} />
      </Section>
      <TreatmentCard recipe={recipe} onChange={onChange} w={w} brewery={brewery} catalog={catalog?.entries ?? null} />
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
        <Field label="Menge">
          <NumInput unit="l" value={value?.lead !== 'gravity' ? (value?.volumeL ?? 0) : round1(d.volumeL)}
            onChange={(n) => set({ lead: 'volume', volumeL: n })} />
        </Field>
        <Field label={at === 'kettle' ? 'Pfannen-Stammwürze' : 'Anstell-Stammwürze'}>
          {gravity === undefined ? (
            <input class={`${inp} w-28 text-muted`} readOnly value="—" title="Braucht die Stammwürze (Vergärbares verknüpfen)" />
          ) : (
            <NumInput unit="°P" value={value?.lead === 'gravity' && value.plato !== undefined ? value.plato : round1(gravity)}
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

// Total water split by where it goes. Slots 3 and 4 are below 3:1 contrast on
// the light theme, so the legend carries every value.
// A dilution adds its own segment on top of the total water.
function WaterBar({ w }: { w: Water }) {
  const d = w.dilution;
  const parts = [
    { label: d.at === 'kettle' && d.volumeL > 0 ? 'Ausschlag ohne Verschnitt' : 'Ausschlag', l: d.kettleL, color: 'var(--series-1)' },
    ...(d.volumeL > 0 ? [{ label: 'Verschnitt', l: d.volumeL, color: 'color-mix(in srgb, var(--series-1) 45%, transparent)' }] : []),
    { label: 'Verdampfung', l: w.evaporationL + w.mashEvaporationL, color: 'var(--series-2)' },
    { label: 'Treber', l: w.absorptionL, color: 'var(--series-3)' },
    { label: 'Totraum/Transfer', l: w.wortLossL, color: 'var(--series-4)' },
  ];
  const total = w.totalL + d.volumeL;
  if (total <= 0) return null;
  const pct = (l: number) => (l / total) * 100;
  return (
    <div class="mt-4">
      <div class="flex h-2.5 overflow-hidden rounded-full">
        {parts.filter((p) => p.l > 0).map((p) => (
          <div key={p.label} class="h-full" style={{ width: `${pct(p.l)}%`, background: p.color }}
            title={`${p.label}: ${fmtL(p.l)} (${Math.round(pct(p.l))} %)`} />
        ))}
      </div>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.label} class="flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span class="text-fg">{fmtL(p.l)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const lossRows = (losses: Loss[]) => losses.map((x) => <Row key={x.label} op="+" label={x.label} l={x.l} basis="Sudhaus" />);

// `cold`: the knock-out follows from the recipe's Anstellwürze (Gärung tab).
function Calculation({ w, boilMin, cold, settings, set, bhEvaporation, bhAbsorption }: {
  w: Water; boilMin: number; cold: boolean; settings: RecipeWater; set: (p: Partial<RecipeWater>) => void;
  bhEvaporation: number; bhAbsorption: number;
}) {
  // An input over the brewhouse value; the basis cell offers to drop the override.
  const over = (key: 'evaporationLPerH' | 'grainAbsorptionLPerKg', unit: string, bh: number, from: string) => ({
    input: <OptNum unit={unit} class="w-full" value={settings[key]} placeholder={String(bh).replace('.', ',')}
      onChange={(n) => set({ [key]: n })} />,
    basis: <>{from}{settings[key] !== undefined && (
      <button type="button" class="ml-2 text-accent hover:underline" onClick={() => set({ [key]: undefined })}>Sudhaus-Wert</button>
    )}</>,
  });
  const evap = over('evaporationLPerH', 'l/h', bhEvaporation, `${w.evaporationFrom} · × ${boilMin} min Kochdauer`);
  const absorb = over('grainAbsorptionLPerKg', 'l/kg', bhAbsorption, `${w.absorptionFrom} · × ${num2(w.grainKg)} kg Schüttung`);
  return (
    <CalcTable head="Vom Ausschlag zurückgerechnet"
      note="Werte aus dem Sudhaus lassen sich hier für dieses Rezept überschreiben. Ohne Nachguss wird das gesamte Wasser als Hauptguss eingemaischt; das Verhältnis ist dann ein Ergebnis.">
      <Row strong label={cold ? 'Ausschlag (aus der Anstellwürze)' : 'Ausschlag'} l={w.knockOutL} basis={cold ? undefined : 'Rezept'} />
      <Row op="+" label="Verdampfung" input={evap.input} l={w.evaporationL} basis={evap.basis} />
      <Row strong label="Pfannevoll" l={w.preBoilL} />
      {w.wortLosses.length > 0 ? lossRows(w.wortLosses) : <Row op="+" label="Würzeverluste (kein Transfer)" l={0} basis="Sudhaus" />}
      <Row op="+" label="Treberverlust" input={absorb.input} l={w.absorptionL} basis={absorb.basis} />
      {w.mashEvaporationL > 0 && (
        <Row op="+" label="Verdampfung beim Maischen (Dekoktion, Kochrast)" l={w.mashEvaporationL} basis="Sudhaus" />
      )}
      <Row strong label="Gesamtwasser" l={w.totalL} />
      {w.sparge ? (
        <Row label="davon Hauptguss" input={<NumInput unit="l/kg" class="w-full" value={settings.mashRatioLPerKg ?? DEFAULT_MASH_RATIO} onChange={(n) => set({ mashRatioLPerKg: n })} />} l={w.strikeL} basis={`Rezept · Verhältnis × ${num2(w.grainKg)} kg Schüttung`} />
      ) : (
        <Row label="davon Hauptguss" input={w.mashRatioLPerKg === undefined ? undefined : `${num2(w.mashRatioLPerKg)} l/kg`} l={w.strikeL}
          basis="Vollguss · Verhältnis ergibt sich" />
      )}
      {w.strikeFill.length > 0 && (
        <>
          {lossRows(w.strikeFill)}
          <Row strong label="Hauptguss einfüllen" l={w.strikeFillL} />
        </>
      )}
      {w.sparge && <Row label="davon Nachguss" l={w.spargeL} basis="Rest des Gesamtwassers" />}
      {w.spargeFill.length > 0 && (
        <>
          {lossRows(w.spargeFill)}
          <Row strong label="Nachguss einfüllen" l={w.spargeFillL} />
        </>
      )}
    </CalcTable>
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
