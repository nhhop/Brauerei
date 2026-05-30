import { useState, useEffect } from 'preact/hooks';
import type { Actuator } from '../types';
import { writeActuator } from '../api';

export function ActuatorCard({ actuator, onDelete, onEdit }: { actuator: Actuator; onDelete?: () => void; onEdit?: () => void }) {
  const { id, meta, state } = actuator;
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(v: number) {
    setPending(true);
    setErr(null);
    try { await writeActuator(id, v); }
    catch (e) { setErr(String(e)); }
    finally { setPending(false); }
  }

  return (
    <div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-stone-900">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-500">{meta.kind}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-stone-400 hover:text-stone-700 leading-none text-sm">✎</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="text-stone-400 hover:text-red-600 leading-none">×</button>
          )}
        </div>
      </div>
      <div class="mt-3">
        {meta.kind === 'Binary' && (
          <BinaryToggle value={state.v ?? 0} disabled={pending} onChange={send} />
        )}
        {meta.kind === 'Continuous' && (
          <ContinuousSlider
            value={state.v ?? meta.min}
            min={meta.min}
            max={meta.max}
            step={meta.res || 0.01}
            unit={meta.unit}
            disabled={pending}
            onChange={send}
          />
        )}
        {(meta.kind === 'Discrete' || meta.kind === 'Cumulative') && (
          <DiscreteInput value={state.v ?? 0} disabled={pending} onSubmit={send} />
        )}
      </div>
      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
      {actuator.fault && (
        <span class="mt-2 inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
          ⚠ {actuator.fault}
        </span>
      )}
    </div>
  );
}

function BinaryToggle({
  value, disabled, onChange,
}: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  const on = value >= 0.5;
  return (
    <button
      class={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        on ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
      disabled={disabled}
      onClick={() => onChange(on ? 0 : 1)}
    >
      {on ? 'ON' : 'OFF'}
    </button>
  );
}

function ContinuousSlider({
  value, min, max, step, unit, disabled, onChange,
}: {
  value: number; min: number; max: number; step: number; unit: string;
  disabled: boolean; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  // Sync from server while the user isn't actively dragging.
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onInput={(e) => setLocal(parseFloat((e.target as HTMLInputElement).value))}
        onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-stone-900"
      />
      <div class="mt-1 flex justify-between text-xs text-stone-500">
        <span>{min}</span>
        <span class="font-mono text-stone-900">
          {local.toFixed(2)} {unit}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function DiscreteInput({
  value, disabled, onSubmit,
}: { value: number; disabled: boolean; onSubmit: (v: number) => void }) {
  const [v, setV] = useState(value.toString());
  return (
    <div class="flex gap-2">
      <input
        type="number"
        value={v}
        onInput={(e) => setV((e.target as HTMLInputElement).value)}
        disabled={disabled}
        class="w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm"
      />
      <button
        onClick={() => {
          const n = parseFloat(v);
          if (!isNaN(n)) onSubmit(n);
        }}
        disabled={disabled}
        class="rounded bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
