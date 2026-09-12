import type { Snapshot, CondOp } from '../types';
import { inp } from '../ui';
import { refGroups, unitOf } from '../refs';

// The {ref, op, value, hyst} threshold form, shared by the alarm editor and the
// sensor-triggered program step. Numeric fields are raw strings so in-progress
// input like "7," survives a re-render; the caller parses them on submit.
interface Props {
  snap: Snapshot | null;
  refValue: string;
  op: CondOp;
  value: string;
  hyst: string;
  onChange: (patch: Partial<{ refValue: string; op: CondOp; value: string; hyst: string }>) => void;
}

export function ConditionFields({ snap, refValue, op, value, hyst, onChange }: Props) {
  const groups = refGroups(snap);
  const unit = unitOf(snap, refValue);
  // A ref saved earlier whose item is gone won't be in the snapshot — keep it
  // selectable so editing doesn't silently retarget the condition.
  const refMissing = refValue !== '' && !groups.some((g) => g.refs.includes(refValue));

  // Without a live snapshot (e.g. the profile library, which has no SSE feed)
  // there is nothing to populate the dropdown with — fall back to a free-text
  // ref so a template can still name a sensor.
  const hasRefs = groups.some((g) => g.refs.length > 0);

  return (
    <div class="space-y-3">
      <label class="block">
        <span class="text-xs text-muted">Überwachter Wert</span>
        {hasRefs ? (
          <select class={`mt-1 w-full ${inp}`} value={refValue}
            onChange={(e) => onChange({ refValue: (e.target as HTMLSelectElement).value })}>
            <option value="">— bitte wählen —</option>
            {refMissing && <option value={refValue}>{refValue} (nicht vorhanden)</option>}
            {groups.map((g) => (
              <optgroup key={g.legend} label={g.legend}>
                {g.refs.map((r) => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            ))}
          </select>
        ) : (
          <input class={`mt-1 w-full ${inp}`} value={refValue} placeholder="sensor/hydrometer.gravity"
            onInput={(e) => onChange({ refValue: (e.target as HTMLInputElement).value })} />
        )}
      </label>

      <div class="flex gap-3">
        <label class="block w-36">
          <span class="text-xs text-muted">Bedingung</span>
          <select class={`mt-1 w-full ${inp}`} value={op}
            onChange={(e) => onChange({ op: (e.target as HTMLSelectElement).value as CondOp })}>
            <option value="gt">größer als</option>
            <option value="lt">kleiner als</option>
          </select>
        </label>
        <label class="block flex-1">
          <span class="text-xs text-muted">Grenzwert{unit && ` (${unit})`}</span>
          <input class={`mt-1 w-full ${inp}`} value={value} inputMode="decimal"
            onInput={(e) => onChange({ value: (e.target as HTMLInputElement).value })}
            placeholder="1.010" />
        </label>
        <label class="block w-28">
          <span class="text-xs text-muted">Hysterese{unit && ` (${unit})`}</span>
          <input class={`mt-1 w-full ${inp}`} value={hyst} inputMode="decimal"
            onInput={(e) => onChange({ hyst: (e.target as HTMLInputElement).value })} />
        </label>
      </div>
    </div>
  );
}
