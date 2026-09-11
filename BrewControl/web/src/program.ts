import type { Snapshot, ProgramStep, StepTarget } from './types';
import { unitOf } from './refs';
import { pickIntervalUnit, intervalUnitMultiplier } from './intervalUnit';

// Shared helpers for multi-target program steps — what kind of item a target id
// is, how to label a step's commands, and the state a program has built up by a
// given step. Used by ProgramStepsEditor and ProgramCard; the rules mirror
// ProgramRunner / ProgramTargets.h in the firmware.

// controller: v is its setpoint. binary: only `enabled` means anything (the
// target is pinned at 1). impulse: v queues that many pulses, fired once per
// run. level: any other actuator. missing: the id resolves to nothing (deleted,
// unbound "", or no snapshot yet).
export type TargetKind = 'controller' | 'binary' | 'impulse' | 'level' | 'missing';

export function targetKind(snap: Snapshot | null, id: string): TargetKind {
  if (!snap || !id) return 'missing';
  if (snap.controllers.some((c) => c.id === id)) return 'controller';
  const a = snap.actuators.find((x) => x.id === id);
  if (!a) return 'missing';
  if (a.meta.kind === 'Binary') return 'binary';
  if (a.meta.kind === 'Discrete') return 'impulse';
  return 'level';
}

// Whether the actuator runs a duty-cycle schedule (IntervalActuator) — only
// then does an `interval` command do anything.
export function hasInterval(snap: Snapshot | null, id: string): boolean {
  return snap?.actuators.find((a) => a.id === id)?.interval != null;
}

export function targetUnit(snap: Snapshot | null, id: string): string {
  const kind = targetKind(snap, id);
  if (kind === 'controller') return unitOf(snap, `controller/${id}`);
  if (kind === 'missing') return '';
  return unitOf(snap, `actuator/${id}`);
}

// Every id any step addresses, in order of first appearance.
export function programIds(steps: ProgramStep[]): string[] {
  const ids: string[] = [];
  for (const s of steps)
    for (const id of Object.keys(s.targets))
      if (!ids.includes(id)) ids.push(id);
  return ids;
}

// The state the program has built up by step k: per id and per field, the last
// value any of steps 0..k set. A pulse actuator's v is an event, not a state,
// and never part of it.
export function effectiveTargets(steps: ProgramStep[], k: number, snap: Snapshot | null): Record<string, StepTarget> {
  const out: Record<string, StepTarget> = {};
  for (let i = 0; i <= k && i < steps.length; i++) {
    for (const [id, t] of Object.entries(steps[i].targets)) {
      const acc = out[id] ?? (out[id] = {});
      if (t.enabled !== undefined) acc.enabled = t.enabled;
      if (t.interval) acc.interval = t.interval;
      if (t.v !== undefined && targetKind(snap, id) !== 'impulse') acc.v = t.v;
    }
  }
  for (const id of Object.keys(out))
    if (Object.keys(out[id]).length === 0) delete out[id];
  return out;
}

// "30 von 60 s" — on-share of a duty cycle, in the unit the actuator card uses.
export function fmtInterval(iv: { onSec: number; periodSec: number }): string {
  const unit = pickIntervalUnit(iv.periodSec);
  const mult = intervalUnitMultiplier(unit);
  return `${iv.onSec / mult} von ${iv.periodSec / mult} ${unit}`;
}

// One command as text, e.g. "10 °C", "Aus", "30 % · 30 von 60 s", "1×".
export function fmtTarget(snap: Snapshot | null, id: string, t: StepTarget): string {
  const kind = targetKind(snap, id);
  const parts: string[] = [];
  if (t.enabled === false) parts.push('Aus');
  if (t.v !== undefined && kind !== 'binary') {
    const unit = targetUnit(snap, id);
    parts.push(kind === 'impulse' ? `${t.v}×` : unit ? `${t.v} ${unit}` : String(t.v));
  }
  if (t.interval) parts.push(fmtInterval(t.interval));
  if (parts.length === 0 && t.enabled === true) parts.push('Ein');
  return parts.join(' · ');
}

// ── Hold time units ──────────────────────────────────────────────────────────
// Wire format is seconds; the editor lets each step pick its unit, since a mash
// rest is minutes and a fermentation phase is days. Same shape as intervalUnit.ts.

export type HoldUnit = 'min' | 'h' | 'd';

const HOLD_MULTIPLIER: Record<HoldUnit, number> = { min: 60, h: 3600, d: 86400 };

export function holdUnitMultiplier(unit: HoldUnit): number {
  return HOLD_MULTIPLIER[unit];
}

// Largest unit the duration divides into evenly, so a saved value reads back
// the way it was typed ("2 d", "36 h", "90 min").
export function pickHoldUnit(sec: number): HoldUnit {
  if (sec > 0 && sec % 86400 === 0) return 'd';
  if (sec > 0 && sec % 3600 === 0) return 'h';
  return 'min';
}
