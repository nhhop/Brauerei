// Shared helpers for displaying an actuator's duty-cycle schedule (wire
// format is always seconds — see IntervalActuator) in a human-friendly unit.
// Used by AddItemModal (create/edit) and ActuatorCard (live on-amount slider).

export type IntervalUnit = 's' | 'min' | 'h';

const MULTIPLIER: Record<IntervalUnit, number> = { s: 1, min: 60, h: 3600 };

export function intervalUnitMultiplier(unit: IntervalUnit): number {
  return MULTIPLIER[unit];
}

// Smallest unit that keeps the period's displayed number reasonably sized.
export function pickIntervalUnit(periodSec: number): IntervalUnit {
  if (periodSec < 120) return 's';
  if (periodSec < 7200) return 'min';
  return 'h';
}
