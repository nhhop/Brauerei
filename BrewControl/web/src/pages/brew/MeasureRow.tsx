import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { deviation, unitOfMeasure } from '../../brewDay';
import type { MeasureId, Measurement } from '../../brews';
import { convertGravity, type GravityUnit } from '../../gravityUnits';
import type { Sensor } from '../../types';
import { badgeCaution, badgeSuccess, btnSecondary, inp } from '../../ui';

export const fmtNum = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

const GRAVITY_UNITS: { value: GravityUnit; label: string; digits: number }[] = [
  { value: 'plato', label: '°P', digits: 1 },
  { value: 'sg', label: 'SG', digits: 3 },
  { value: 'brix', label: '°Bx', digits: 1 },
];

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
export function MeasureRow({ id, label, sub, soll, value, sensor, disabled, onSave }: {
  id: MeasureId;
  label: string;
  sub?: ComponentChildren;
  soll?: number;
  value?: Measurement;
  sensor?: Sensor;          // linked in the brewhouse; unset = "von Hand"
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
        <input type="text" inputMode="decimal" aria-label={`${label} Ist`} placeholder="Ist"
          class={`${inp} w-20`} disabled={disabled || busy} value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onChange={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        {gravity ? (
          <select class={`${inp} px-1`} aria-label="Einheit" value={gu}
            onChange={(e) => setGu(e.currentTarget.value as GravityUnit)}>
            {GRAVITY_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        ) : <span class="w-6 text-xs text-muted">{unit}</span>}
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
    </div>
  );
}
