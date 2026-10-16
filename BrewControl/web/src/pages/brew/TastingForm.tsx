import type { ComponentChildren } from 'preact';
import { ChipGroup } from '../../components/ChipGroup';
import { Segmented } from '../../components/Segmented';
import { StarRating } from '../../components/StarRating';
import {
  pickOne, pickRating, setFaultLevel, textOrUndefined, toggleFault, toggleId, type FaultLevel, type Tasting,
} from '../../brewTasting';
import {
  ALCOHOLS, AROMA, AROMA_GROUPS, BALANCES, BITTER_INTENSITIES, BITTER_QUALITIES, BODIES, CARBONATIONS, CLARITIES, COLORS,
  COMPLEXITIES, DRINKABILITIES, FAULTS, FAULT_GROUPS, FAULT_LEVELS, FINISH_LENGTHS, FIRST_IMPRESSIONS, HEAD_AMOUNTS,
  HEAD_STABILITIES, HEAD_TEXTURES, STYLE_FITS, TEXTURES, type Choice,
} from '../../tastingVocab';
import { inp } from '../../ui';
import { Field } from '../recipe/fields';

const LEVELS = FAULT_LEVELS.map((l) => ({ value: l.id as FaultLevel, label: l.label }));

// The hints of the picked choices, under the pills.
function Hints({ items, ids }: { items: Choice[]; ids: string[] }) {
  const hints = items.filter((c) => c.hint && ids.includes(c.id));
  return <>{hints.map((c) => <p key={c.id} class="mt-1 text-xs text-muted">{c.hint}</p>)}</>;
}

// Picks one of `items`; the same pill again clears it.
function Single({ label, items, value, onChange }: {
  label: string; items: Choice[]; value: string | undefined; onChange: (v: string | undefined) => void;
}) {
  return (
    <div class="mb-3">
      <div class="mb-1 text-xs text-muted">{label}</div>
      <ChipGroup items={items} selected={value ? [value] : []} onToggle={(id) => onChange(pickOne(value, id))} />
      <Hints items={items} ids={value ? [value] : []} />
    </div>
  );
}

// Picks any number of `items`.
function Multi({ label, items, ids, onChange }: { label: string; items: Choice[]; ids: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div class="mb-3">
      <div class="mb-1 text-xs text-muted">{label}</div>
      <ChipGroup items={items} selected={ids} onToggle={(id) => onChange(toggleId(ids, id))} />
      <Hints items={items} ids={ids} />
    </div>
  );
}

// The aroma words, in their groups, to pick any number of.
function Aromas({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  return <ChipGroup items={AROMA} groups={AROMA_GROUPS} selected={ids} onToggle={(id) => onChange(toggleId(ids, id))} />;
}

function Notes({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  return (
    <Field label="Notizen">
      <textarea class={`${inp} w-full`} rows={2} value={value ?? ''} onInput={(e) => onChange(textOrUndefined(e.currentTarget.value))} />
    </Field>
  );
}

// A collapsible part of the form; `picked` is shown beside the title.
function Section({ title, picked = 0, children }: { title: string; picked?: number; children: ComponentChildren }) {
  return (
    <details open class="border-t border-border py-2">
      <summary class="cursor-pointer select-none text-sm font-medium">
        {title}{picked > 0 && <span class="ml-2 rounded-full bg-accent px-1.5 text-xs text-accent-fg">{picked}</span>}
      </summary>
      <div class="mt-3">{children}</div>
    </details>
  );
}

const count = (...values: unknown[]) => values.filter(Boolean).length;

// The form of one tasting, in the order of the tasting: appearance, smell,
// attack, main sip, finish, off-flavours, overall impression. Every change goes
// up as the whole new tasting.
export function TastingForm({ tasting: t, onChange }: { tasting: Tasting; onChange: (t: Tasting) => void }) {
  const set = (patch: Partial<Tasting>) => onChange({ ...t, ...patch });
  const setApp = (patch: Partial<Tasting['appearance']>) => set({ appearance: { ...t.appearance, ...patch } });
  const setAttack = (patch: Partial<Tasting['attack']>) => set({ attack: { ...t.attack, ...patch } });
  const setMain = (patch: Partial<Tasting['main']>) => set({ main: { ...t.main, ...patch } });
  const setFinish = (patch: Partial<Tasting['finish']>) => set({ finish: { ...t.finish, ...patch } });
  const setOverall = (patch: Partial<Tasting['overall']>) => set({ overall: { ...t.overall, ...patch } });
  const a = t.appearance;
  const f = t.finish;
  const noHead = a.headAmount === 'none';

  return (
    <>
      <Section title="Aussehen" picked={count(a.color, a.clarity, a.headAmount, a.headTexture, a.headStability)}>
        <Single label="Farbe" items={COLORS} value={a.color} onChange={(color) => setApp({ color })} />
        <Single label="Trübung" items={CLARITIES} value={a.clarity} onChange={(clarity) => setApp({ clarity })} />
        <Single label="Schaummenge" items={HEAD_AMOUNTS} value={a.headAmount} onChange={(headAmount) => setApp({ headAmount })} />
        {/* Without a head there is no texture or stability to rate. */}
        <fieldset disabled={noHead} class="m-0 min-w-0 border-0 p-0">
          <Single label="Schaumstruktur" items={HEAD_TEXTURES} value={a.headTexture} onChange={(headTexture) => setApp({ headTexture })} />
          <Single label="Schaumhaltbarkeit" items={HEAD_STABILITIES} value={a.headStability} onChange={(headStability) => setApp({ headStability })} />
        </fieldset>
        <Notes value={a.notes} onChange={(notes) => setApp({ notes })} />
      </Section>

      <Section title="Geruch" picked={t.aroma.descriptors.length}>
        <Aromas ids={t.aroma.descriptors} onChange={(descriptors) => set({ aroma: { ...t.aroma, descriptors } })} />
        <div class="mt-2"><Notes value={t.aroma.notes} onChange={(notes) => set({ aroma: { ...t.aroma, notes } })} /></div>
      </Section>

      <Section title="Antrunk" picked={count(t.attack.carbonation, t.attack.impression)}>
        <Single label="Rezenz (Kohlensäure-Empfinden)" items={CARBONATIONS} value={t.attack.carbonation} onChange={(carbonation) => setAttack({ carbonation })} />
        <Single label="Erster Geschmackseindruck" items={FIRST_IMPRESSIONS} value={t.attack.impression} onChange={(impression) => setAttack({ impression })} />
        <Notes value={t.attack.notes} onChange={(notes) => setAttack({ notes })} />
      </Section>

      <Section title="Haupttrunk" picked={count(t.main.body, t.main.balance) + t.main.textures.length}>
        <Single label="Mundgefühl / Körper" items={BODIES} value={t.main.body} onChange={(body) => setMain({ body })} />
        <Single label="Geschmacksbalance" items={BALANCES} value={t.main.balance} onChange={(balance) => setMain({ balance })} />
        <Multi label="Textur" items={TEXTURES} ids={t.main.textures} onChange={(textures) => setMain({ textures })} />
        <Notes value={t.main.notes} onChange={(notes) => setMain({ notes })} />
      </Section>

      <Section title="Nachtrunk / Abgang"
        picked={count(f.bitterIntensity, f.bitterQuality, f.length, f.alcohol, f.drinkability) + f.aftertaste.length}>
        <Single label="Intensität der Bittere" items={BITTER_INTENSITIES} value={f.bitterIntensity} onChange={(bitterIntensity) => setFinish({ bitterIntensity })} />
        <Single label="Qualität der Bittere" items={BITTER_QUALITIES} value={f.bitterQuality} onChange={(bitterQuality) => setFinish({ bitterQuality })} />
        <div class="mb-3">
          <div class="mb-1 text-xs text-muted">Retronasaler Nachhall (Nachgeschmack)</div>
          <Aromas ids={f.aftertaste} onChange={(aftertaste) => setFinish({ aftertaste })} />
        </div>
        <Single label="Nachhall-Dauer" items={FINISH_LENGTHS} value={f.length} onChange={(length) => setFinish({ length })} />
        <Single label="Alkoholwahrnehmung" items={ALCOHOLS} value={f.alcohol} onChange={(alcohol) => setFinish({ alcohol })} />
        <Single label="Trinkbarkeit" items={DRINKABILITIES} value={f.drinkability} onChange={(drinkability) => setFinish({ drinkability })} />
        <Notes value={f.notes} onChange={(notes) => setFinish({ notes })} />
      </Section>

      <Section title="Fehlaromen" picked={t.faults.length}>
        <ChipGroup items={FAULTS} groups={FAULT_GROUPS} tone="critical" selected={t.faults.map((x) => x.id)}
          onToggle={(id) => set({ faults: toggleFault(t.faults, id) })} />
        {t.faults.map((m) => {
          const fault = FAULTS.find((x) => x.id === m.id);
          return fault && (
            <div key={m.id} class="mt-3 rounded-md border border-border p-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-medium text-critical">{fault.label}</span>
                <Segmented value={m.level} options={LEVELS} onChange={(level) => set({ faults: setFaultLevel(t.faults, m.id, level) })} />
              </div>
              <p class="mt-1.5 text-xs text-muted">{fault.smell}</p>
              <p class="mt-0.5 text-xs text-muted">Häufige Ursachen: {fault.cause}</p>
            </div>
          );
        })}
      </Section>

      <Section title="Gesamteindruck" picked={count(t.overall.complexity, t.overall.styleFit, t.overall.enjoyment)}>
        <Single label="Komplexität" items={COMPLEXITIES} value={t.overall.complexity} onChange={(complexity) => setOverall({ complexity })} />
        <Single label="Stilgerechtigkeit" items={STYLE_FITS} value={t.overall.styleFit} onChange={(styleFit) => setOverall({ styleFit })} />
        <div class="mb-3">
          <div class="mb-1 text-xs text-muted">Genuss-Faktor</div>
          <StarRating value={t.overall.enjoyment} onPick={(n) => setOverall({ enjoyment: pickRating(t.overall.enjoyment, n) })} />
        </div>
        <Notes value={t.overall.notes} onChange={(notes) => setOverall({ notes })} />
      </Section>
    </>
  );
}
