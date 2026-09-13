import { useState, useEffect } from 'preact/hooks';
import { Pencil, X } from 'lucide-preact';
import type { Controller, Sensor, Actuator, ProgramConfig, WidgetMode } from '../types';
import { setControllerSetpoint, enableController, writeActuator, controlProgram } from '../api';
import { ToggleSwitch } from './ToggleSwitch';
import { ConfirmModal } from './ConfirmModal';
import { AutotuneProgress } from './AutotuneProgress';
import { Slider } from './Slider';
import { Gauge } from './Gauge';
import { CardModeButton } from './CardModeButton';
import { programOwnerOf } from '../ownership';
import { inp, widgetSizeClass } from '../ui';

interface Props {
  controller: Controller;
  sensors: Sensor[];
  actuators: Actuator[];
  programs?: ProgramConfig[];
  viewMode?: WidgetMode;
  onDelete?: () => void;
  onEdit?: () => void;
  onCycleMode?: () => void;
}

export function ControllerCard({ controller, sensors, actuators, programs = [], viewMode = 'normal', onDelete, onEdit, onCycleMode }: Props) {
  const { id, setpoint, enabled, params } = controller;
  const [sp, setSp] = useState(setpoint.toString());
  useEffect(() => { setSp(setpoint.toString()); }, [setpoint]);
  const [toggling, setToggling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingSp, setEditingSp] = useState(false);

  const isPid = params?.Kp != null;
  const autotuneState = params?.autotuneState as string | undefined;

  const linkedSensor = params?.sensor ? sensors.find((s) => s.id === params.sensor) : undefined;
  const linkedActuator = params?.actuator ? actuators.find((a) => a.id === params.actuator) : undefined;
  const linkedHeat = params?.heatActuator ? actuators.find((a) => a.id === params.heatActuator) : undefined;
  const linkedCool = params?.coolActuator ? actuators.find((a) => a.id === params.coolActuator) : undefined;
  const dualOutput = params?.heatActuator != null || params?.coolActuator != null;

  // A running/paused program may also target this controller's id directly
  // (see ProgramStep.targets) — same "owner" concept as an actuator's
  // controller, just one level up.
  const progOwner = programOwnerOf(programs, id);

  // Regelbereich: explicit params.rangeMin/Max (set in the edit dialog) win,
  // otherwise fall back to the linked sensor's measurement range.
  const hasExplicitRange = params?.rangeMin != null && params?.rangeMax != null && params.rangeMax > params.rangeMin;
  const rangeMin = hasExplicitRange ? params!.rangeMin! : (linkedSensor?.meta.min ?? 0);
  const rangeMax = hasExplicitRange ? params!.rangeMax! : (linkedSensor?.meta.max ?? 100);
  const spUnit = linkedSensor?.meta.unit ?? '';

  // Fill bar: red while below setpoint (still heating up), blue at/above it
  // (reached or overshot).
  const istVal = linkedSensor?.state.v;
  const istOk = istVal != null && isFinite(istVal);
  const spNum = parseFloat(sp);
  const sliderColor = istOk && !isNaN(spNum) && istVal! < spNum
    ? 'var(--critical)' : 'var(--accent)';

  async function applySp(v?: number) {
    // Accept the value directly rather than always re-reading `sp`: called
    // right after setSp() in the same tick (e.g. from the slider's
    // onChange), `sp` in this closure is still the pre-update value — React
    // state updates don't apply until the next render.
    const n = v ?? parseFloat(sp);
    if (isNaN(n)) { setErr('ungültiger Sollwert'); return; }
    setErr(null);
    try { await setControllerSetpoint(id, n); }
    catch (e) { setErr(String(e)); }
  }

  async function doToggle() {
    setToggling(true);
    setErr(null);
    try {
      await enableController(id, !enabled);
      if (enabled) {
        const min = params?.min ?? 0;
        if (params?.actuator) await writeActuator(params.actuator, min);
        if (params?.heatActuator) await writeActuator(params.heatActuator, 0);
        if (params?.coolActuator) await writeActuator(params.coolActuator, 0);
      }
    } catch (e) { setErr(String(e)); }
    finally { setToggling(false); }
  }

  async function toggleEnabled() {
    if (progOwner) { setConfirmOpen(true); return; }
    await doToggle();
  }

  async function toggleAndPauseProgram() {
    await doToggle();
    try { await controlProgram(progOwner!.id, 'pause'); }
    catch (e) { setErr(String(e)); }
    finally { setConfirmOpen(false); }
  }

  function fmtActuatorOut(v: number | null, max: number): string {
    if (v == null || !isFinite(v)) return '—';
    return max <= 1 ? `${(v * 100).toFixed(0)}%` : v.toFixed(2);
  }

  // Click-to-edit Sollwert value — identical across all three view modes,
  // just the input width differs to fit tighter layouts.
  function sollwertValue(narrow?: boolean) {
    return editingSp ? (
      <input type="number" step="any" value={sp} autoFocus
        onInput={(e) => setSp((e.target as HTMLInputElement).value)}
        onBlur={() => { applySp(); setEditingSp(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { applySp(); setEditingSp(false); }
          else if (e.key === 'Escape') { setSp(setpoint.toString()); setEditingSp(false); }
        }}
        class={`${inp} ${narrow ? 'w-20' : 'w-24'} font-mono text-right`} />
    ) : (
      <span onClick={() => setEditingSp(true)} title="Klicken zum Bearbeiten"
        class="cursor-pointer font-mono text-fg hover:text-accent">
        {isNaN(spNum) ? sp : spNum.toFixed(1)} {spUnit}
      </span>
    );
  }

  return (
    <div class={`${widgetSizeClass[viewMode]} rounded-lg border bg-card p-4 shadow-elev-2 transition-[opacity,box-shadow] duration-200 hover:shadow-elev-8 ${
      enabled ? 'border-card-border' : 'border-card-border/50 opacity-60'
    }`}>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-1.5">
          <ToggleSwitch checked={enabled} disabled={toggling} mixed={!!progOwner}
            title={progOwner ? `Wird von Programm „${progOwner.id}“ gesteuert`
              : (enabled ? 'Regler deaktivieren' : 'Regler aktivieren')}
            onChange={() => toggleEnabled()} />
          {onCycleMode && <CardModeButton mode={viewMode} onCycle={onCycleMode} />}
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-faint hover:text-fg"><Pencil size={14} /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="text-faint hover:text-critical"><X size={16} /></button>
          )}
        </div>
      </div>

      {(linkedSensor || linkedActuator || dualOutput || params?.maxRatePerSec != null) && (
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
          {params?.maxRatePerSec != null && (
            <span>Ziel: <span class="font-mono text-fg">{setpoint.toFixed(1)}</span>
              {' · aktuell: '}
              <span class="font-mono text-fg">
                {(params.effectiveSetpoint ?? setpoint).toFixed(1)}
              </span>
              {Math.abs((params.effectiveSetpoint ?? setpoint) - setpoint) > 0.05 && ' (rampt)'}
            </span>
          )}
        </div>
      )}

      {viewMode === 'compact' && (
        <div class="mt-3 flex items-center justify-between">
          <span class="text-xs text-muted">Sollwert</span>
          {sollwertValue(true)}
        </div>
      )}

      {viewMode === 'gauge' && (
        <div class="mt-1 flex flex-col items-center">
          <Gauge value={isNaN(spNum) ? setpoint : spNum} min={rangeMin} max={rangeMax}
            fillValue={istOk ? istVal : undefined} color={sliderColor} interactive
            ariaLabel={`Sollwert ${id}`}
            onInput={(val) => setSp(val.toString())}
            onChange={(val) => { setSp(val.toString()); applySp(val); }}
            size={220}>
            <div class="pointer-events-auto flex flex-col items-center gap-0.5">
              <span class="text-[10px] uppercase tracking-wide text-faint">Soll</span>
              {sollwertValue(true)}
            </div>
          </Gauge>
          <div class="-mt-1 flex w-[220px] justify-between text-[10px] text-faint">
            <span>{rangeMin}</span>
            <span>{rangeMax}</span>
          </div>
        </div>
      )}

      {viewMode === 'normal' && (
        <div class="mt-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-muted">Sollwert</span>
            {sollwertValue()}
          </div>
          <div class="mt-1.5">
            <Slider value={isNaN(spNum) ? setpoint : spNum} min={rangeMin} max={rangeMax} step="any"
              color={sliderColor} fillValue={istOk ? istVal : undefined}
              onInput={(v) => setSp(v.toString())}
              onChange={(v) => { setSp(v.toString()); applySp(v); }} />
          </div>
          <div class="mt-1 flex justify-between text-[10px] text-faint">
            <span>{rangeMin}</span>
            <span>{rangeMax}</span>
          </div>
        </div>
      )}

      {viewMode !== 'compact' && isPid && autotuneState && (
        <div class="mt-3 border-t border-border/50 pt-3">
          {autotuneState === 'running' && <AutotuneProgress params={params} />}
          {autotuneState === 'done' && (
            <span class="text-xs text-success font-mono">
              Kp {Number(params?.Kp).toFixed(2)} · Ki {Number(params?.Ki).toFixed(2)} · Kd {Number(params?.Kd).toFixed(2)}
            </span>
          )}
        </div>
      )}

      {err && <p class="mt-2 text-xs text-critical">{err}</p>}
      {progOwner && (
        <ConfirmModal open={confirmOpen}
          title={`„${id}“ wird von Programm „${progOwner.id}“ gesteuert`}
          confirmLabel="Regler schalten"
          extraLabel="Regler schalten und Programm pausieren"
          pending={toggling}
          onConfirm={async () => { await doToggle(); setConfirmOpen(false); }}
          onExtra={toggleAndPauseProgram}
          onCancel={() => setConfirmOpen(false)}>
          Ein manueller Schaltvorgang wird sonst im nächsten Programmschritt wieder überschrieben.
        </ConfirmModal>
      )}
    </div>
  );
}
