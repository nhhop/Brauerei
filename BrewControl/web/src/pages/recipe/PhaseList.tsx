import type { ComponentChildren } from 'preact';
import { Trash2 } from 'lucide-preact';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import type { ProfilePhase } from '../../fermentationProfiles';
import { uid, type Phase } from '../../recipes';
import { inp } from '../../ui';
import { Section } from './CalcTable';
import { MenuItem, NumInput, OptNum, SplitButton } from './fields';

// Row layouts, switched on the card's width (as the mash plan): a grid with a
// head row where the columns fit, else the name with the delete button and
// the numbers below it. Tailwind needs whole class names, so one set per
// variant; the pressure column needs more room.
const LAYOUT = {
  plain: {
    grid: '@[34rem]:grid @[34rem]:grid-cols-[minmax(8rem,1fr)_6.5rem_7rem_7rem_2rem] @[34rem]:gap-x-2 @[34rem]:gap-y-1',
    head: '@[34rem]:grid', contents: '@[34rem]:contents', narrow: '@[34rem]:hidden', field: '@[34rem]:w-full',
    name: '@[34rem]:basis-auto', span: '@[34rem]:col-span-full',
  },
  pressure: {
    grid: '@[41rem]:grid @[41rem]:grid-cols-[minmax(8rem,1fr)_6.5rem_7rem_7rem_6.75rem_2rem] @[41rem]:gap-x-2 @[41rem]:gap-y-1',
    head: '@[41rem]:grid', contents: '@[41rem]:contents', narrow: '@[41rem]:hidden', field: '@[41rem]:w-full',
    name: '@[41rem]:basis-auto', span: '@[41rem]:col-span-full',
  },
};

const dec = (n: number) => String(n).replace('.', ',');

// Fermentation phases in their order: name, temperature, duration, the ramp
// from the previous phase (not for the first) and, with `pressure`, the
// pressure. Above the card the title, the pressure switch (with `onPressure`),
// `action` (the profile menu) and "+ Phase" with `presets` in its menu. A phase
// above `pressureLimitBar` (what the strongest fermenter takes) is flagged.
export function PhaseList({
  title, addLabel, namePlaceholder, durationUnit, empty, items, onChange, pressure, onPressure, presets, pressureLimitBar, action,
}: {
  title: string;
  addLabel: string;
  namePlaceholder: string;
  durationUnit: string;
  empty: string;
  items: Phase[];
  onChange: (next: Phase[]) => void;
  pressure?: boolean;
  onPressure?: (on: boolean) => void;
  presets?: { label: string; phase: ProfilePhase }[];
  pressureLimitBar?: number;   // unset = no fermenters known
  action?: ComponentChildren;  // in the head before "+ Phase" (the profile menu)
}) {
  const L = pressure ? LAYOUT.pressure : LAYOUT.plain;
  const patch = (id: string, p: Partial<Phase>) => onChange(items.map((x) => (x.id === id ? { ...x, ...p } : x)));
  // The first phase has no ramp.
  const add = (p: ProfilePhase) => {
    const next = { id: uid(), ...structuredClone(p) };
    if (items.length === 0) delete next.rampDays;
    onChange([...items, next]);
  };
  const days = (n: number) => `${dec(n)} ${n === 1 ? 'Tag' : 'Tage'}`;

  return (
    <Section title={title}
      action={
        <div class="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {onPressure && (
            <label class="flex items-center gap-2 text-xs text-muted">
              Unter Druck vergären
              <ToggleSwitch checked={!!pressure} onChange={onPressure} />
            </label>
          )}
          {action}
          <SplitButton label={addLabel} onMain={() => add({ name: '', tempC: 20, duration: 7 })}
            arrowTitle="Vordefinierte Phasen"
            menu={presets && ((close) => presets.map((x) => (
              <MenuItem key={x.label} label={x.label}
                sub={`${dec(x.phase.tempC)} °C · ${days(x.phase.duration)}`}
                onClick={() => { add(x.phase); close(); }} />
            )))} />
        </div>
      }>
      <div class="@container text-sm">
        {items.length === 0 ? (
          <p class="p-4 text-muted">{empty}</p>
        ) : (
          <>
            <div class={`hidden border-b border-border px-4 py-1.5 text-xs text-muted ${L.grid} ${L.head}`}>
              <span>Phase</span>
              <span>Temperatur</span>
              <span>Dauer</span>
              <span>Rampe</span>
              {pressure && <span>Druck</span>}
              <span />
            </div>
            {items.map((p, i) => (
              <div key={p.id} class={`flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 last:border-b-0 ${L.grid}`}>
                <input class={`${inp} min-w-0 flex-1 basis-40 ${L.name}`} placeholder={namePlaceholder} value={p.name}
                  aria-label="Name der Phase" onInput={(e) => patch(p.id, { name: e.currentTarget.value })} />
                {/* below the breakpoint the numbers are a line of their own under name and delete */}
                <div class={`order-last flex basis-full flex-wrap items-center gap-2 text-xs text-muted ${L.contents}`}>
                  <NumInput unit="°C" value={p.tempC} onChange={(n) => patch(p.id, { tempC: n })} class={`w-28 ${L.field}`} />
                  <NumInput unit={durationUnit} value={p.duration} onChange={(n) => patch(p.id, { duration: n })} class={`w-28 ${L.field}`} />
                  {i > 0 ? (
                    <span class="flex items-center gap-1" title="Zeit, in der die Temperatur von der vorigen Phase hierher läuft; zählt zur Dauer">
                      <span class={L.narrow}>Rampe</span>
                      <OptNum unit={durationUnit} value={p.rampDays} placeholder="0" class={`w-28 ${L.field}`}
                        onChange={(n) => patch(p.id, { rampDays: n || undefined })} />
                    </span>
                  ) : <span class={`hidden ${L.head}`} />}
                  {pressure && (
                    <span class="flex items-center gap-1">
                      <span class={L.narrow}>Druck</span>
                      <OptNum unit="bar" value={p.pressureBar} placeholder="0" class={`w-28 ${L.field}`}
                        onChange={(n) => patch(p.id, { pressureBar: n || undefined })} />
                    </span>
                  )}
                </div>
                <button type="button" title="Entfernen" aria-label="Phase entfernen" onClick={() => onChange(items.filter((x) => x.id !== p.id))}
                  class="justify-self-end rounded-md px-2 py-1.5 text-muted hover:bg-fg/10 hover:text-critical">
                  <Trash2 size={14} />
                </button>
                {i > 0 && (p.rampDays ?? 0) > p.duration && (
                  <p class={`order-last basis-full text-xs text-caution ${L.span}`}>Die Rampe ist länger als die Phase.</p>
                )}
                {pressure && pressureLimitBar !== undefined && (p.pressureBar ?? 0) > pressureLimitBar && (
                  <p class={`order-last basis-full text-xs text-caution ${L.span}`}>
                    Kein Gärplatz ist bis {dec(p.pressureBar!)} bar druckfest.
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </Section>
  );
}
