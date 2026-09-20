import { useState, useEffect } from 'preact/hooks';
import { Pencil, X } from 'lucide-preact';
import type { Actuator, Controller, ProgramConfig, Sensor, WidgetMode } from '../types';
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

// How far an actuator is driven, 0..100. The bar and the percentage read the
// same number in every view, whatever the actuator's own range happens to be.
function outputPct(a: Actuator | undefined): number | null {
  if (!a || a.state.v == null || !isFinite(a.state.v)) return null;
  const { min, max } = a.meta;
  if (max <= min) return null;
  return Math.max(0, Math.min(100, ((a.state.v - min) / (max - min)) * 100));
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
  const unit = linkedSensor?.meta.unit ?? '';

  const istVal = linkedSensor?.state.v;
  const istOk = istVal != null && isFinite(istVal);
  const spNum = parseFloat(sp);

  // Outputs, in the order they are shown. A dual-output controller drives both
  // stages at once, so both get their own bar.
  const outputs: { label: string; pct: number | null }[] = dualOutput
    ? [
        ...(params?.heatActuator ? [{ label: 'Heizen', pct: outputPct(linkedHeat) }] : []),
        ...(params?.coolActuator ? [{ label: 'Kühlen', pct: outputPct(linkedCool) }] : []),
      ]
    : (linkedActuator ? [{ label: 'Ausgang', pct: outputPct(linkedActuator) }] : []);

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

  const fmt = (v: number | null | undefined, digits = 1) =>
    v != null && isFinite(v) ? v.toFixed(digits) : '—';

  // Click-to-edit setpoint. The value carries the accent color in every view;
  // the unit sits outside so it stays small and muted next to the input too.
  function sollwert(size: 'lg' | 'md' | 'sm') {
    const valueClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base';
    const inputWidth = size === 'lg' ? 'w-28' : size === 'md' ? 'w-24' : 'w-20';
    return editingSp ? (
      <input type="number" step="any" value={sp} autoFocus
        onInput={(e) => setSp((e.target as HTMLInputElement).value)}
        onBlur={() => { applySp(); setEditingSp(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { applySp(); setEditingSp(false); }
          else if (e.key === 'Escape') { setSp(setpoint.toString()); setEditingSp(false); }
        }}
        class={`${inp} ${inputWidth} ${valueClass} font-mono tabular-nums text-right`} />
    ) : (
      <span onClick={() => setEditingSp(true)} title="Klicken zum Bearbeiten"
        class={`${valueClass} cursor-pointer font-mono font-semibold tabular-nums text-fg hover:opacity-80`}>
        {isNaN(spNum) ? sp : spNum.toFixed(1)}
      </span>
    );
  }

  function label(text: string, tight?: boolean) {
    return <span class={`${tight ? 'text-[10px]' : 'text-xs'} text-muted`}>{text}</span>;
  }

  function istBlock(size: 'lg' | 'sm') {
    return (
      <div class="flex items-baseline gap-1">
        <span class={`${size === 'lg' ? 'text-3xl' : 'text-base'} font-mono font-semibold tabular-nums text-accent`}>
          {fmt(istOk ? istVal : null, 2)}
        </span>
        <span class="text-xs text-muted">{unit}</span>
      </div>
    );
  }

  // Label + percentage + bar, in the configurable secondary color.
  function outputBar(o: { label: string; pct: number | null }) {
    return (
      <div key={o.label} class="mt-3">
        <div class="flex items-baseline justify-between gap-2">
          {label(o.label)}
          <span class="font-mono text-sm font-medium tabular-nums text-secondary">
            {o.pct == null ? '—' : `${o.pct.toFixed(0)} %`}
          </span>
        </div>
        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
          <div class="h-full rounded-full bg-secondary transition-[width] duration-300"
            style={{ width: `${o.pct ?? 0}%` }} />
        </div>
      </div>
    );
  }

  const setpointSlider = (
    <Slider value={isNaN(spNum) ? setpoint : spNum} min={rangeMin} max={rangeMax} step="any"
      color="var(--accent)" fillValue={istOk ? istVal : undefined}
      onInput={(v) => setSp(v.toString())}
      onChange={(v) => { setSp(v.toString()); applySp(v); }} />
  );

  // Rate-limited controllers ramp towards the setpoint — worth a line, since
  // the number on the card is the target, not what the controller acts on.
  const rampNote = params?.maxRatePerSec != null && (
    <p class="mt-2 text-[11px] text-muted">
      Ziel <span class="font-mono text-fg">{setpoint.toFixed(1)}</span>
      {' · aktuell '}
      <span class="font-mono text-fg">{(params.effectiveSetpoint ?? setpoint).toFixed(1)}</span>
      {Math.abs((params.effectiveSetpoint ?? setpoint) - setpoint) > 0.05 && ' (rampt)'}
    </p>
  );

  return (
    <div class={`${widgetSizeClass[viewMode]} rounded-lg border bg-card p-4 shadow-elev-2 transition-[opacity,box-shadow] duration-200 hover:shadow-elev-8 ${
      enabled ? 'border-card-border' : 'border-card-border/50 opacity-60'
    }`}>
      <div class="flex items-center justify-between gap-2">
        <h3 class="truncate font-medium text-fg">{id}</h3>
        <div class="flex shrink-0 items-center gap-1.5">
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

      {viewMode === 'normal' && (
        <>
          <div class="mt-2 flex items-start justify-between gap-3">
            <div class="min-w-0">
              {label('Ist')}
              {istBlock('lg')}
            </div>
            <div class="text-right">
              {label('Soll')}
              <div class="flex items-baseline justify-end gap-1">
                {sollwert('lg')}
                <span class="text-xs text-muted">{unit}</span>
              </div>
            </div>
          </div>
          <div class="mt-2">{setpointSlider}</div>
          <div class="mt-1 flex justify-between text-[10px] text-faint">
            <span>{rangeMin}</span>
            <span>{rangeMax}</span>
          </div>
          {rampNote}
          {outputs.map(outputBar)}
        </>
      )}

      {viewMode === 'gauge' && (
        <div class="mt-1 flex flex-col items-center">
          <Gauge value={isNaN(spNum) ? setpoint : spNum} min={rangeMin} max={rangeMax}
            fillValue={istOk ? istVal : undefined} color="var(--accent)" interactive rangeLabels
            ariaLabel={`Sollwert ${id}`}
            onInput={(val) => setSp(val.toString())}
            onChange={(val) => { setSp(val.toString()); applySp(val); }}
            size={220}>
            <div class="pointer-events-auto flex flex-col items-center leading-tight">
              {label('Soll', true)}
              <div class="flex items-baseline gap-1">
                {sollwert('md')}
                <span class="text-xs text-muted">{unit}</span>
              </div>
              <div class="mt-1.5">{label('Ist', true)}</div>
              {istBlock('lg')}
              {outputs.length > 0 && (
                <div class="mt-1.5 flex flex-col items-center">
                  {label(outputs.length > 1 ? 'Ausgänge' : outputs[0].label, true)}
                  <div class="flex items-baseline gap-2">
                    {outputs.map((o) => (
                      <span key={o.label} class="font-mono text-sm tabular-nums text-secondary">
                        {o.pct == null ? '—' : `${o.pct.toFixed(0)} %`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Gauge>
          {rampNote}
        </div>
      )}

      {viewMode === 'compact' && (
        <>
          <div class="mt-1.5 flex items-start justify-between gap-3">
            <div class="min-w-0">
              {label('Ist', true)}
              {istBlock('sm')}
            </div>
            <div>
              {label('Soll', true)}
              <div class="flex items-baseline gap-1">
                {sollwert('sm')}
                <span class="text-[10px] text-muted">{unit}</span>
              </div>
            </div>
            {outputs.length > 0 && (
              <div class="text-right">
                {label(outputs.length > 1 ? 'Ausgänge' : outputs[0].label)}
                <div class="flex items-baseline justify-end gap-2">
                  {outputs.map((o) => (
                    <span key={o.label} class="font-mono text-base font-semibold tabular-nums text-secondary">
                      {o.pct == null ? '—' : `${o.pct.toFixed(0)} %`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div class="mt-1.5">{setpointSlider}</div>
        </>
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
