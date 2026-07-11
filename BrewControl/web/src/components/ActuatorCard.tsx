import { useState, useEffect } from 'preact/hooks';
import { Pencil, X, TriangleAlert } from 'lucide-preact';
import type { Actuator } from '../types';
import { writeActuator } from '../api';
import { ToggleSwitch } from './ToggleSwitch';
import { btnPrimary, inp } from '../ui';

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
    <div class="rounded-lg border border-border bg-surface p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{meta.kind}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-faint hover:text-fg"><Pencil size={14} /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="text-faint hover:text-red-600"><X size={16} /></button>
          )}
        </div>
      </div>
      <div class="mt-3">
        {meta.kind === 'Binary' && (
          <BinaryToggle value={state.v ?? 0} disabled={pending} onChange={send} />
        )}
        {meta.kind === 'Continuous' && (
          <ContinuousSlider
            value={state.v ?? meta.min} min={meta.min} max={meta.max}
            step={meta.res || 0.01} unit={meta.unit} disabled={pending} onChange={send}
          />
        )}
        {(meta.kind === 'Discrete' || meta.kind === 'Cumulative') && (
          <DiscreteInput value={state.v ?? 0} disabled={pending} onSubmit={send} />
        )}
      </div>
      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
      {actuator.fault && (
        <span class="mt-2 inline-flex items-center gap-1 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          <TriangleAlert size={12} /> {actuator.fault}
        </span>
      )}
    </div>
  );
}

function BinaryToggle({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  const on = value >= 0.5;
  return (
    <div class="flex items-center gap-2">
      <ToggleSwitch checked={on} disabled={disabled}
        onChange={(next) => onChange(next ? 1 : 0)} />
      <span class={`text-sm font-medium ${on ? 'text-fg' : 'text-muted'}`}>
        {on ? 'ON' : 'OFF'}
      </span>
    </div>
  );
}

function ContinuousSlider({ value, min, max, step, unit, disabled, onChange }: {
  value: number; min: number; max: number; step: number; unit: string;
  disabled: boolean; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <input type="range" min={min} max={max} step={step} value={local} disabled={disabled}
        onInput={(e) => setLocal(parseFloat((e.target as HTMLInputElement).value))}
        onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-accent" />
      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>{min}</span>
        <span class="font-mono text-fg">{local.toFixed(2)} {unit}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function DiscreteInput({ value, disabled, onSubmit }: { value: number; disabled: boolean; onSubmit: (v: number) => void }) {
  const [v, setV] = useState(value.toString());
  return (
    <div class="flex gap-2">
      <input type="number" value={v}
        onInput={(e) => setV((e.target as HTMLInputElement).value)}
        disabled={disabled}
        class={`${inp} font-mono`} />
      <button onClick={() => { const n = parseFloat(v); if (!isNaN(n)) onSubmit(n); }}
        disabled={disabled}
        class={btnPrimary}>
        Send
      </button>
    </div>
  );
}
