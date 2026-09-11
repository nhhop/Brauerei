import type { Snapshot } from './types';

// Selectable "<role>/<snapshotId>" refs from the current snapshot, grouped by
// role — the shared source for the condition/series ref dropdowns. Sensor ids
// already carry the sub-channel suffix (e.g. "bme280.temp"); a controller ref
// resolves to its setpoint, not to a process value, which the legend says out
// loud so nobody expects otherwise.
export function refGroups(snap: Snapshot | null) {
  return [
    { legend: 'Sensoren', refs: (snap?.sensors ?? []).map((s) => `sensor/${s.id}`) },
    { legend: 'Aktoren', refs: (snap?.actuators ?? []).map((a) => `actuator/${a.id}`) },
    { legend: 'Regler (Sollwert)', refs: (snap?.controllers ?? []).map((c) => `controller/${c.id}`) },
  ];
}

// Unit of the referenced channel, for field suffixes. "" when unknown.
export function unitOf(snap: Snapshot | null, ref: string): string {
  if (!snap) return '';
  const slash = ref.indexOf('/');
  if (slash < 0) return '';
  const role = ref.slice(0, slash);
  const id = ref.slice(slash + 1);
  if (role === 'sensor') return snap.sensors.find((s) => s.id === id)?.meta.unit ?? '';
  if (role === 'actuator') return snap.actuators.find((a) => a.id === id)?.meta.unit ?? '';
  return '';
}
