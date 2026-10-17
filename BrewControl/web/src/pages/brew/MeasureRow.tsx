import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { deviation, unitOfMeasure } from '../../brewDay';
import type { MeasureId, Measurement } from '../../brews';
import { convertGravity, type GravityUnit } from '../../gravityUnits';
import type { Sensor } from '../../types';
import { UnitBox } from '../../components/UnitBox';
import { stepText } from '../../numStep';
import { badgeCaution, badgeSuccess, btnSecondary, inp, unitInput } from '../../ui';

export const fmtNum = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

const GRAVITY_UNITS: { value: GravityUnit; label: string; digits: number }[] = [
  { value: 'plato', label: '°P', digits: 1 },
  { value: 'sg', label: 'SG', digits: 3 },
  { value: 'brix', label: '°Bx', digits: 1 },
];

// One line efficiency | Soll | Ist | Abweichung, counted from the measurements.
export function EffRow({ label, soll, ist, sub }: { label: string; soll?: number; ist?: number; sub?: string }) {
  const dev = deviation('efficiency', soll, ist);
  return (
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <div class="min-w-[9rem] flex-1">
        <div class="font-semibold">{label}</div>
        {ist !== undefined && sub && <div class="text-xs text-muted">{sub}</div>}
      </div>
      <span class="w-24 text-muted" title="Soll">{soll === undefined ? '—' : `${fmtNum(soll, 1)} %`}</span>
      <span class="w-[6.75rem]">{ist === undefined ? '—' : `${fmtNum(ist, 1)} %`}</span>
      <span class="w-28">{dev && <span class={dev.level === 'ok' ? badgeSuccess : badgeCaution}>{dev.text}</span>}</span>
    </div>
  );
}

// One line label | Soll | Ist | Abweichung for a value that is counted, not
// entered: `unit` formats both; `devKey` names a measurement of the same unit to
// mark a deviation by its tolerance (volumes, gravities), without it none is.
export function ResultRow({ label, soll, ist, unit, digits = 1, devKey, sub, sollTitle = 'Soll' }: {
  label: string; soll?: number; ist?: number; unit: string; digits?: number; devKey?: MeasureId; sub?: string; sollTitle?: string;
}) {
  const dev = devKey ? deviation(devKey, soll, ist) : undefined;
  const text = (n: number | undefined) => (n === undefined ? '—' : `${fmtNum(n, digits)} ${unit}`);
  return (
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 text-sm last:border-b-0">
      <div class="min-w-[9rem] flex-1">
        <div>{label}</div>
        {sub && <div class="text-xs text-muted">{sub}</div>}
      </div>
      <span class="w-24 text-muted" title={sollTitle}>{text(soll)}</span>
      <span class="w-[6.75rem]">{text(ist)}</span>
      <span class="w-28">{dev && <span class={dev.level === 'ok' ? badgeSuccess : badgeCaution}>{dev.text}</span>}</span>
    </div>
  );
}

const digitsOf = (unit: string) => (unit === 'pH' ? 2 : 1);

// A sensor's value in the measurement's unit: gravities in °P.
export function sensorValue(s: Sensor | undefined, unit: string): number | undefined {
  const v = s?.state.ok ? s.state.v : null;
  if (v == null) return undefined;
  if (unit !== '°P') return v;
  const u = s!.meta.unit.toLowerCase();
  return u === 'sg' ? convertGravity(v, 'sg', 'plato') : u === '°bx' || u === 'brix' ? convertGravity(v, 'brix', 'plato') : v;
}

// One line Messwert | Soll | Ist | Abweichung. The value is saved when the
// field is confirmed (Enter or leaving it); a linked sensor offers its live
// value. Gravities are kept in °P, the field converts.
export function MeasureRow({ id, label, sub, soll, value, sensor, suggest, disabled, onSave }: {
  id: MeasureId;
  label: string;
  sub?: ComponentChildren;
  soll?: number;
  value?: Measurement;
  sensor?: Sensor;          // linked in the brewhouse; unset = "von Hand"
  suggest?: { v: number; text: string };  // a value to take over, in the measurement's unit (°P for gravities)
  disabled?: boolean;
  onSave: (m: Measurement | undefined) => Promise<void>;
}) {
  const unit = unitOfMeasure(id);
  const gravity = unit === '°P';
  const [gu, setGu] = useState<GravityUnit>('plato');
  const g = GRAVITY_UNITS.find((x) => x.value === gu)!;
  const shown = (p: number) => (gravity ? convertGravity(p, 'plato', gu) : p);
  const digits = gravity ? g.digits : digitsOf(unit);
  const toText = (v: number | undefined) => (v === undefined ? '' : String(+shown(v).toFixed(digits + 1)).replace('.', ','));
  const [text, setText] = useState(toText(value?.v));
  const [busy, setBusy] = useState(false);
  useEffect(() => setText(toText(value?.v)), [value?.v, gu]);

  const live = sensorValue(sensor, unit);
  const dev = deviation(id, soll, value?.v);

  async function save(m: Measurement | undefined) {
    setBusy(true);
    try { await onSave(m); } finally { setBusy(false); }
  }

  function commit(t: string) {
    if (t.trim() === '') { if (value) void save(undefined); return; }
    const n = parseFloat(t.replace(',', '.'));
    if (Number.isNaN(n)) { setText(toText(value?.v)); return; }
    const v = gravity ? convertGravity(n, gu, 'plato') : n;
    if (value && Math.abs(value.v - v) < 1e-9) return;
    void save({ v, at: Date.now() });
  }

  const bump = (dir: 1 | -1) => {
    const t = stepText(text, dir, '', undefined, unit === '°C' ? -Infinity : 0);
    setText(t);
    commit(t);
  };
  const fieldEvents = {
    onInput: (e: Event) => setText((e.currentTarget as HTMLInputElement).value),
    onChange: (e: Event) => commit((e.currentTarget as HTMLInputElement).value),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
      else if (!gravity && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1); }
    },
  };

  return (
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 last:border-b-0">
      <div class="min-w-[9rem] flex-1">
        <div class="text-sm">{label}</div>
        {sub && <div class="text-xs text-muted">{sub}</div>}
      </div>
      <div class="w-24 text-sm text-muted" title="Soll">
        {soll === undefined ? '—' : `${fmtNum(shown(soll), digits)} ${gravity ? g.label : unit}`}
      </div>
      <div class="flex items-center gap-1">
        {gravity ? (
          <>
            <input type="text" inputMode="decimal" aria-label={`${label} Ist`} placeholder="Ist"
              class={`${inp} w-20`} disabled={disabled || busy} value={text} {...fieldEvents} />
            <select class={`${inp} px-1`} aria-label="Einheit" value={gu}
              onChange={(e) => setGu(e.currentTarget.value as GravityUnit)}>
              {GRAVITY_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </>
        ) : (
          <UnitBox unit={unit} class="w-32" onStep={disabled || busy ? undefined : bump}>
            <input type="text" inputMode="decimal" aria-label={`${label} Ist`} placeholder="Ist"
              class={unitInput} disabled={disabled || busy} value={text} {...fieldEvents} />
          </UnitBox>
        )}
      </div>
      <div class="w-28">
        {dev && <span class={dev.level === 'ok' ? badgeSuccess : badgeCaution}>{dev.text}</span>}
      </div>
      {sensor && (
        <div class="flex w-full items-center gap-2 text-xs text-muted">
          <span>{sensor.label ?? sensor.id}: {live === undefined ? 'kein Wert' : `${fmtNum(shown(live), digits)} ${gravity ? g.label : unit}`}</span>
          <button type="button" class={`${btnSecondary} px-2 py-0.5 text-xs`} disabled={disabled || busy || live === undefined}
            onClick={() => save({ v: live!, at: Date.now(), src: sensor.id })}>
            übernehmen
          </button>
        </div>
      )}
      {suggest && (
        <div class="flex w-full items-center gap-2 text-xs text-muted">
          <span>{suggest.text}</span>
          <button type="button" class={`${btnSecondary} px-2 py-0.5 text-xs`} disabled={disabled || busy || value?.v === suggest.v}
            onClick={() => save({ v: suggest.v, at: Date.now() })}>
            übernehmen
          </button>
        </div>
      )}
    </div>
  );
}
