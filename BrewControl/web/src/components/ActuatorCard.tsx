import { useState, useEffect } from 'preact/hooks';
import { Pencil, X, TriangleAlert } from 'lucide-preact';
import type { Actuator, Controller, ProgramConfig, Severity } from '../types';
import { writeActuator, enableActuator, enableController, controlProgram, setActuatorInterval } from '../api';
import { pickIntervalUnit, intervalUnitMultiplier } from '../intervalUnit';
import { ToggleSwitch } from './ToggleSwitch';
import { ConfirmModal } from './ConfirmModal';
import { controllerOwnerOf, programOwnerOf } from '../ownership';
import { btnPrimary, inp, badgeCaution, badgeCritical } from '../ui';
import { Slider } from './Slider';

export function ActuatorCard({ actuator, controllers = [], programs = [], alarm, onDelete, onEdit }: {
  actuator: Actuator; controllers?: Controller[]; programs?: ProgramConfig[];
  alarm?: Severity; onDelete?: () => void; onEdit?: () => void;
}) {
  const { id, meta, state, target, enabled, interval } = actuator;
  const [pending, setPending] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Neither the actuator record nor the wire format names its owner — derive
  // it from the controllers/programs that currently target this id. A
  // controller wins over a program if somehow both apply (rare, and the
  // controller is the more immediate driver).
  const ctrlOwner = controllerOwnerOf(controllers, id);
  const progOwner = ctrlOwner ? undefined : programOwnerOf(programs, id);
  const ownerActive = (ctrlOwner?.enabled ?? false) || progOwner != null;

  async function send(v: number) {
    setPending(true);
    setErr(null);
    try { await writeActuator(id, v); }
    catch (e) { setErr(String(e)); }
    finally { setPending(false); }
  }

  async function doToggle() {
    setToggling(true);
    setErr(null);
    try { await enableActuator(id, !enabled); }
    catch (e) { setErr(String(e)); }
    finally { setToggling(false); }
  }

  async function toggleEnabled() {
    if (ownerActive) { setConfirmOpen(true); return; }
    await doToggle();
  }

  async function toggleAndDisableOwner() {
    setToggling(true);
    setErr(null);
    try {
      await enableActuator(id, !enabled);
      if (ctrlOwner) await enableController(ctrlOwner.id, false);
      else if (progOwner) await controlProgram(progOwner.id, 'pause');
    } catch (e) { setErr(String(e)); }
    finally { setToggling(false); setConfirmOpen(false); }
  }

  async function sendInterval(onSec: number, periodSec: number) {
    setErr(null);
    try { await setActuatorInterval(id, onSec, periodSec); }
    catch (e) { setErr(String(e)); }
  }

  return (
    <div class="min-h-[160px] rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{meta.kind}</span>
          <ToggleSwitch checked={enabled} disabled={toggling} mixed={ownerActive}
            title={ownerActive
              ? `Wird von ${ctrlOwner ? `Regler „${ctrlOwner.id}“` : `Programm „${progOwner!.id}“`} gesteuert`
              : (enabled ? 'Aktor ausschalten' : 'Aktor einschalten')}
            onChange={() => toggleEnabled()} />
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
      <div class={`mt-3 ${enabled ? '' : 'opacity-60'}`}>
        {meta.kind === 'Binary' && (
          // No value control: the master switch above is the whole story for
          // a Binary actuator. This just reports what the pin is doing, which
          // a controller or an interval schedule may drive on its own.
          <BinaryState value={state.v ?? 0} />
        )}
        {meta.kind === 'Continuous' && (
          <ContinuousSlider
            value={target} min={meta.min} max={meta.max}
            step={meta.res || 0.01} unit={meta.unit} disabled={pending || !enabled} onChange={send}
          />
        )}
        {(meta.kind === 'Discrete' || meta.kind === 'Cumulative') && (
          <DiscreteInput value={target} disabled={pending || !enabled} onSubmit={send} />
        )}
      </div>
      {interval && (
        <IntervalSlider periodSec={interval.periodSec} onSec={interval.onSec} onChange={sendInterval} />
      )}
      {err && <p class="mt-2 text-xs text-critical">{err}</p>}
      {actuator.fault && (
        <span class={`mt-2 ${badgeCaution}`}>
          <TriangleAlert size={12} /> {actuator.fault}
        </span>
      )}
      {alarm && (
        <span class={`mt-2 ${alarm === 'critical' ? badgeCritical : badgeCaution}`}>
          <TriangleAlert size={12} /> Grenzwert
        </span>
      )}
      <ConfirmModal open={confirmOpen}
        title={`„${id}“ wird von ${ctrlOwner ? `Regler „${ctrlOwner.id}“` : `Programm „${progOwner?.id}“`} gesteuert`}
        confirmLabel="Aktor schalten"
        extraLabel={ctrlOwner ? 'Aktor schalten und Regler deaktivieren' : 'Aktor schalten und Programm pausieren'}
        pending={toggling}
        onConfirm={async () => { await doToggle(); setConfirmOpen(false); }}
        onExtra={toggleAndDisableOwner}
        onCancel={() => setConfirmOpen(false)}>
        Ein manueller Schaltvorgang wird sonst im nächsten Regel-/Programmschritt wieder überschrieben.
      </ConfirmModal>
    </div>
  );
}

// Live physical state, not the switch position — the two differ whenever a
// controller or an interval schedule is driving the actuator.
function BinaryState({ value }: { value: number }) {
  const on = value >= 0.5;
  return (
    <div class="flex items-center gap-2">
      <span class={`h-2.5 w-2.5 rounded-full ${on ? 'bg-accent' : 'bg-fg/20'}`} />
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
      <Slider min={min} max={max} step={step} value={local} disabled={disabled} color="var(--accent)"
        onInput={setLocal} onChange={onChange} />
      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>{min}</span>
        <span class="font-mono text-fg">{local.toFixed(2)} {unit}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// Only the "on" amount is live-adjustable here — cycle length/unit are
// creation-time config (Edit modal), same split as Controller setpoint
// (live on the card) vs. Kp/Ki/Kd (modal-only).
function IntervalSlider({ periodSec, onSec, onChange }: {
  periodSec: number; onSec: number; onChange: (onSec: number, periodSec: number) => void;
}) {
  const unit = pickIntervalUnit(periodSec);
  const mult = intervalUnitMultiplier(unit);
  const periodDisplay = periodSec / mult;
  const [local, setLocal] = useState(onSec / mult);
  useEffect(() => { setLocal(onSec / mult); }, [onSec, periodSec]);
  return (
    <div class="mt-3 border-t border-border/50 pt-3">
      <label class="block text-xs text-muted mb-1">
        Intervall: {Math.round(local * 100) / 100} / {periodDisplay} {unit} an
      </label>
      <Slider min={0} max={periodDisplay} step="any" value={local} color="var(--accent)"
        onInput={setLocal}
        onChange={(v) => onChange(Math.round(v * mult), periodSec)} />
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
        class={`${inp} w-full font-mono`} />
      <button onClick={() => { const n = parseFloat(v); if (!isNaN(n)) onSubmit(n); }}
        disabled={disabled}
        class={btnPrimary}>
        Send
      </button>
    </div>
  );
}
