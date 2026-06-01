import { useState } from 'preact/hooks';
import type { Controller, Sensor, Actuator } from '../types';
import { setControllerSetpoint, enableController } from '../api';

interface Props {
  controller: Controller;
  sensors: Sensor[];
  actuators: Actuator[];
  onDelete?: () => void;
  onEdit?: () => void;
}

export function ControllerCard({ controller, sensors, actuators, onDelete, onEdit }: Props) {
  const { id, setpoint, enabled, params } = controller;
  const [sp, setSp] = useState(setpoint.toString());
  const [toggling, setToggling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const linkedSensor = params?.sensor ? sensors.find((s) => s.id === params.sensor) : undefined;
  const linkedActuator = params?.actuator ? actuators.find((a) => a.id === params.actuator) : undefined;
  const linkedHeat = params?.heatActuator ? actuators.find((a) => a.id === params.heatActuator) : undefined;
  const linkedCool = params?.coolActuator ? actuators.find((a) => a.id === params.coolActuator) : undefined;
  const dualOutput = params?.heatActuator != null || params?.coolActuator != null;

  async function applySp() {
    const n = parseFloat(sp);
    if (isNaN(n)) { setErr('ungültiger Sollwert'); return; }
    setErr(null);
    try { await setControllerSetpoint(id, n); }
    catch (e) { setErr(String(e)); }
  }

  async function toggleEnabled() {
    setToggling(true);
    setErr(null);
    try { await enableController(id, !enabled); }
    catch (e) { setErr(String(e)); }
    finally { setToggling(false); }
  }

  function fmtActuatorOut(v: number | null, max: number): string {
    if (v == null || !isFinite(v)) return '—';
    return max <= 1 ? `${(v * 100).toFixed(0)}%` : v.toFixed(2);
  }

  return (
    <div class={`rounded-lg border bg-surface p-4 shadow-sm transition-opacity ${
      enabled ? 'border-border' : 'border-border/50 opacity-60'
    }`}>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-1.5">
          <button type="button" onClick={toggleEnabled} disabled={toggling}
            title={enabled ? 'Regler deaktivieren' : 'Regler aktivieren'}
            class={`text-base leading-none disabled:opacity-40 transition-colors ${
              enabled ? 'text-emerald-600 hover:text-faint' : 'text-faint hover:text-emerald-600'
            }`}>
            ⏻
          </button>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>

      {(linkedSensor || linkedActuator || dualOutput) && (
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
          {linkedSensor && (
            <span>Ist:{' '}
              <span class="font-mono text-fg">
                {linkedSensor.state.v != null && isFinite(linkedSensor.state.v)
                  ? linkedSensor.state.v.toFixed(2) : '—'}
              </span>{' '}{linkedSensor.meta.unit}
            </span>
          )}
          {!dualOutput && linkedActuator && (
            <span>Ausgang:{' '}
              <span class="font-mono text-fg">
                {fmtActuatorOut(linkedActuator.state.v, linkedActuator.meta.max)}
              </span>
            </span>
          )}
          {dualOutput && linkedHeat && (
            <span>Heizen:{' '}
              <span class="font-mono text-fg">
                {fmtActuatorOut(linkedHeat.state.v, linkedHeat.meta.max)}
              </span>
            </span>
          )}
          {dualOutput && linkedCool && (
            <span>Kühlen:{' '}
              <span class="font-mono text-fg">
                {fmtActuatorOut(linkedCool.state.v, linkedCool.meta.max)}
              </span>
            </span>
          )}
        </div>
      )}

      <div class="mt-3">
        <label for={`sp-${id}`} class="block text-xs text-muted">Setpoint</label>
        <div class="mt-1 flex gap-2">
          <input id={`sp-${id}`} type="number" step="any" value={sp}
            onInput={(e) => setSp((e.target as HTMLInputElement).value)}
            class="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-sm text-fg" />
          <button onClick={applySp}
            class="rounded bg-fg px-3 py-1 text-sm text-bg hover:bg-fg/80">
            Apply
          </button>
        </div>
      </div>

      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
