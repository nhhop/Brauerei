import { failed } from './api';
import { DEFAULT_EFFICIENCY, VALID_ID, uid } from './recipes';
import { unitOf } from './refs';
import type { Snapshot } from './types';

// Brewing system ("Brauanlage"): the brewery (site values shared by all
// brewhouses) and its brewhouses. Process steps are assigned freely to vessels.
// A brewhouse refers only into itself and to registry ids, so a brew can copy it
// as it stood on the brew day. The firmware checks only `id`; fields added later
// stay optional on read (normalizeBrewhouse), there is no schema version.

export type StepKey = 'strike' | 'mash' | 'lauter' | 'sparge' | 'boil' | 'whirlpool' | 'hopback' | 'chill';

// Process order. A step no vessel takes on does not exist in that brewhouse
// (without sparge only full-volume mashing is possible).
export const STEPS: { key: StepKey; label: string; required?: boolean; heated?: boolean }[] = [
  { key: 'strike', label: 'Hauptguss bereiten', heated: true },
  { key: 'mash', label: 'Maischen', required: true, heated: true },
  { key: 'lauter', label: 'Läutern', required: true },
  { key: 'sparge', label: 'Nachguss bereiten', heated: true },
  { key: 'boil', label: 'Kochen', required: true, heated: true },
  { key: 'whirlpool', label: 'Whirlpool' },
  { key: 'hopback', label: 'Hop Back' },
  { key: 'chill', label: 'Kühlen' },
];

export const stepLabel = (k: StepKey) => STEPS.find((s) => s.key === k)!.label;

export interface Brewery {
  grainTempC: number;
  tapWaterTempC: number;
}

export const DEFAULT_BREWERY: Brewery = { grainTempC: 18, tapWaterTempC: 12 };

export interface Vessel {
  id: string;
  name: string;
  volumeL: number;
  deadSpaceL: number;
  evaporationLPerH?: number;  // only shown/checked while the vessel boils
  lauterMethod?: string;      // descriptive (false bottom, bag …), only while it lauters
}

export type DeviceKind = 'heater' | 'pump' | 'agitator' | 'valve' | 'chiller' | 'condenser' | 'coil';

// Group order of the editor; `actuator` names the registry link of that kind.
export const DEVICE_KINDS: { kind: DeviceKind; label: string; group: string; actuator: string }[] = [
  { kind: 'heater', label: 'Heizquelle', group: 'Heizquellen', actuator: 'Regler oder Aktor' },
  { kind: 'pump', label: 'Pumpe', group: 'Pumpen', actuator: 'Aktor' },
  { kind: 'agitator', label: 'Rührwerk', group: 'Rührwerke', actuator: 'Aktor' },
  { kind: 'valve', label: 'Ventil (Wasserzulauf)', group: 'Ventile', actuator: 'Aktor' },
  { kind: 'coil', label: 'Spirale', group: 'Spiralen', actuator: 'Kühlwasserventil' },
  { kind: 'chiller', label: 'Kühler', group: 'Kühler', actuator: 'Kühlwasserventil' },
  { kind: 'condenser', label: 'Kondensator', group: 'Kondensatoren', actuator: 'Kühlwasserventil' },
];

export type ChillerType = 'immersion' | 'plate' | 'counterflow' | 'icebath' | 'nochill';

export const CHILLER_TYPES: { value: ChillerType; label: string }[] = [
  { value: 'immersion', label: 'Eintauchkühler' },
  { value: 'plate', label: 'Plattenkühler' },
  { value: 'counterflow', label: 'Gegenstromkühler' },
  { value: 'icebath', label: 'Eisbad' },
  { value: 'nochill', label: 'No-Chill' },
];

export interface Device {
  id: string;
  kind: DeviceKind;
  name: string;
  vesselId?: string;      // location; none = inline (RIMS tube, plate chiller)
  manual: boolean;        // "von Hand": no registry link needed
  controller?: string;    // snapshot ids; chiller/condenser/coil: actuator = cooling water valve
  actuator?: string;
  powerW?: number;        // heater
  flowLPerMin?: number;   // pump
  chillerType?: ChillerType;
}

export interface StepConfig {
  vesselId: string;
  heaterId?: string;      // indirect = the heater is not in vesselId (derived, see heatingOf)
  pumpId?: string;        // recirculation
  agitatorId?: string;
  valveIds?: string[];    // water inlet during this step
  chillerId?: string;     // chill: a chiller or a coil (counts as immersion chiller)
  coolMinutes?: number;   // chill: assumed time until below isomerisation temperature (IBU)
  condenserId?: string;   // boil
  powerPct?: number;      // boil: heating power while boiling (below 100 with a condenser)
  heatRateKPerMin?: number;
}

export interface Transfer {
  id: string;
  step: StepKey;
  from: string;
  to: string;             // vessel id or 'out' (knocking out to the fermenter)
  drive: 'pump' | 'gravity' | 'manual';
  pumpId?: string;
  lossL: number;          // only counts with drive 'pump'
  recovered: boolean;     // the loss comes back in the next step
}

export const DRIVES: { value: Transfer['drive']; label: string }[] = [
  { value: 'pump', label: 'Pumpe' },
  { value: 'gravity', label: 'Schwerkraft' },
  { value: 'manual', label: 'von Hand' },
];

export type MeasureKey =
  | 'grainTemp' | 'tapWaterTemp' | 'strikeVolume' | 'strikePh'
  | 'mashTemp' | 'mashPh'
  | 'spargeVolume' | 'spargeTemp' | 'spargePh'
  | 'preBoilVolume' | 'preBoilGravity' | 'postBoilVolume' | 'postBoilGravity'
  | 'batchVolume' | 'pitchTemp';

// Set by the brewing process, not by the brewhouse; shown only for steps the
// brewhouse has. A brewhouse links each to a sensor or leaves it "von Hand".
export const MEASUREMENTS: { key: MeasureKey; step: StepKey; label: string; unit: string }[] = [
  { key: 'grainTemp', step: 'strike', label: 'Malztemperatur', unit: '°C' },
  { key: 'tapWaterTemp', step: 'strike', label: 'Leitungswassertemperatur', unit: '°C' },
  { key: 'strikeVolume', step: 'strike', label: 'Hauptgussmenge', unit: 'l' },
  { key: 'strikePh', step: 'strike', label: 'pH Hauptguss', unit: 'pH' },
  { key: 'mashTemp', step: 'mash', label: 'Maischetemperatur', unit: '°C' },
  { key: 'mashPh', step: 'mash', label: 'pH Maische', unit: 'pH' },
  { key: 'spargeVolume', step: 'sparge', label: 'Nachgussmenge', unit: 'l' },
  { key: 'spargeTemp', step: 'sparge', label: 'Nachgusstemperatur', unit: '°C' },
  { key: 'spargePh', step: 'sparge', label: 'pH Nachguss', unit: 'pH' },
  { key: 'preBoilVolume', step: 'boil', label: 'Pfannevoll', unit: 'l' },
  { key: 'preBoilGravity', step: 'boil', label: 'Stammwürze vor dem Kochen', unit: '°P' },
  { key: 'postBoilVolume', step: 'boil', label: 'Menge nach dem Kochen', unit: 'l' },
  { key: 'postBoilGravity', step: 'boil', label: 'Stammwürze nach dem Kochen', unit: '°P' },
  { key: 'batchVolume', step: 'chill', label: 'Ausschlagmenge', unit: 'l' },
  { key: 'pitchTemp', step: 'chill', label: 'Anstelltemperatur', unit: '°C' },
];

// Sensor units that fit a measurement's unit (compared case-insensitively).
const UNIT_FITS: Record<string, string[]> = {
  '°C': ['°c'],
  l: ['l'],
  '°P': ['°p', 'sg', '°bx', 'brix'],
  pH: ['ph'],
};

export interface Brewhouse {
  id: string;
  name: string;
  description: string;
  updatedAt: number;      // epoch ms, like Recipe
  mashEfficiencyPct: number;
  coolingShrinkPct: number;
  vessels: Vessel[];
  devices: Device[];
  steps: Partial<Record<StepKey, StepConfig>>;
  transfers: Transfer[];
  measurements: Partial<Record<MeasureKey, string>>;  // sensor id; missing = "von Hand"
}

// ── Vessel presets and labels ──────────────────────────────────────────────────
// A preset only pre-ticks a vessel's steps; the kind is not stored. `heated`
// is the name when the vessel is heated directly while mashing ("…pfanne").
export const VESSEL_PRESETS: { label: string; heated?: string; steps: StepKey[] }[] = [
  { label: 'HLT', steps: ['strike', 'sparge'] },
  { label: 'Maischbottich', heated: 'Maischpfanne', steps: ['mash'] },
  { label: 'Läuterbottich', steps: ['lauter'] },
  { label: 'Maisch-/Läuterbottich', heated: 'Maisch-/Läuterpfanne', steps: ['mash', 'lauter'] },
  { label: 'Würzepfanne', steps: ['boil', 'whirlpool'] },
  { label: 'Maisch-/Würzepfanne', steps: ['mash', 'boil', 'whirlpool'] },
  { label: 'HLT/Würzepfanne', steps: ['sparge', 'boil', 'whirlpool'] },
  { label: 'All-in-One', steps: ['mash', 'lauter', 'boil', 'whirlpool'] },
  { label: 'Zwischenbehälter', steps: [] },
  { label: 'Whirlpool-Tank', steps: ['whirlpool'] },
  { label: 'Hop Back', steps: ['hopback'] },
];

export function stepsOf(bh: Brewhouse, vesselId: string): StepKey[] {
  return STEPS.map((s) => s.key).filter((k) => bh.steps[k]?.vesselId === vesselId);
}

const sameSet = (a: StepKey[], b: StepKey[]) => a.length === b.length && a.every((k) => b.includes(k));

// The preset matching the steps the vessel takes on. Heating the strike water
// and chilling often happen in a vessel that is named for something else, so
// they are ignored when nothing matches exactly.
export function vesselPreset(bh: Brewhouse, vessel: Vessel): (typeof VESSEL_PRESETS)[number] | undefined {
  const steps = stepsOf(bh, vessel.id);
  const minor: StepKey[] = ['strike', 'chill'];
  const core = steps.filter((k) => !minor.includes(k));
  return VESSEL_PRESETS.find((p) => sameSet(p.steps, steps))
    ?? (core.length > 0 ? VESSEL_PRESETS.find((p) => sameSet(p.steps, core)) : undefined);
}

// Name from the steps the vessel takes on: the matching preset, else the steps.
export function vesselLabel(bh: Brewhouse, vessel: Vessel): string {
  const preset = vesselPreset(bh, vessel);
  if (!preset) return stepsOf(bh, vessel.id).map(stepLabel).join(' · ');
  return preset.heated && heatingOf(bh, 'mash').direct && bh.steps.mash?.vesselId === vessel.id
    ? preset.heated : preset.label;
}

// ── Heating ────────────────────────────────────────────────────────────────────
export interface Heating {
  heater?: Device;
  direct: boolean;
  // How an indirect heating reaches the step's vessel; every way needs the
  // recirculation pump. coil: through a coil in the heater's vessel (HERMS);
  // vessel: through another vessel without a coil (Kettle-RIMS); inline: RIMS tube.
  via?: 'coil' | 'vessel' | 'inline';
  coil?: Device;
  viaVessel?: Vessel;
}

export function heatingOf(bh: Brewhouse, step: StepKey): Heating {
  const cfg = bh.steps[step];
  const heater = cfg?.heaterId ? bh.devices.find((d) => d.id === cfg.heaterId && d.kind === 'heater') : undefined;
  if (!cfg || !heater) return { direct: false };
  if (heater.vesselId === cfg.vesselId) return { heater, direct: true };
  if (!heater.vesselId) return { heater, direct: false, via: 'inline' };
  const viaVessel = bh.vessels.find((v) => v.id === heater.vesselId);
  const coil = bh.devices.find((d) => d.kind === 'coil' && d.vesselId === heater.vesselId);
  return coil ? { heater, direct: false, via: 'coil', coil, viaVessel } : { heater, direct: false, via: 'vessel', viaVessel };
}

export function heatingText(h: Heating): string {
  if (!h.heater) return '';
  if (h.direct) return 'direkt';
  const where = h.viaVessel?.name || '?';
  if (h.via === 'coil') return `indirekt über Spirale im ${where}`;
  if (h.via === 'vessel') return `indirekt über ${where}`;
  return 'indirekt über RIMS-Rohr';
}

// Short form for the list card, e.g. "2 Behälter · HERMS".
export function brewhouseSummary(bh: Brewhouse): string {
  const h = heatingOf(bh, 'mash');
  const kind = !h.heater ? '' : h.direct ? 'direkt beheizt'
    : h.via === 'coil' ? 'HERMS' : h.via === 'vessel' ? 'Kettle-RIMS' : 'RIMS';
  return [`${bh.vessels.length} Behälter`, kind].filter(Boolean).join(' · ');
}

// ── Schema ─────────────────────────────────────────────────────────────────────
// The overview diagram: vessels in process order (by their first step), then
// the fermenter when something is knocked out. Edges are the transfers, merged
// when several steps share route and drive, and the recirculations (dashed,
// both ways; from a vessel to itself when it is heated directly or inline).

const SHORT: Record<StepKey, string> = {
  strike: 'Hauptguss', mash: 'Maischen', lauter: 'Läutern', sparge: 'Nachguss',
  boil: 'Kochen', whirlpool: 'Whirlpool', hopback: 'Hop Back', chill: 'Kühlen',
};
export const stepShort = (k: StepKey) => SHORT[k];

export const OUT = 'out';

export interface SchemaEdge {
  kind: 'transfer' | 'recirc';
  from: string;     // vessel id, or OUT
  to: string;
  label: string;    // the steps
  detail: string;   // drive, pump, loss
  at: string;       // where to edit it (anchor)
}

const litres = (n: number) => `${String(n).replace('.', ',')} l`;

export function schemaOf(bh: Brewhouse): { nodes: string[]; edges: SchemaEdge[] } {
  const firstStep = (v: Vessel) => {
    const s = stepsOf(bh, v.id);
    return s.length ? STEPS.findIndex((x) => x.key === s[0]) : STEPS.length;
  };
  const nodes = bh.vessels.map((v, i) => ({ v, i }))
    .sort((a, b) => firstStep(a.v) - firstStep(b.v) || a.i - b.i)
    .map(({ v }) => v.id);
  const isVessel = (id: string | undefined) => bh.vessels.some((v) => v.id === id);
  const deviceName = (id: string | undefined) => {
    const d = bh.devices.find((x) => x.id === id);
    return d && (d.name || kindLabel(d.kind));
  };

  const edges: SchemaEdge[] = [];
  const merged = new Map<string, { edge: SchemaEdge; steps: StepKey[] }>();
  for (const t of bh.transfers) {
    if (!isVessel(t.from) || (t.to !== OUT && !isVessel(t.to))) continue;
    const parts: string[] = [];
    const chiller = bh.devices.find((d) => d.id === bh.steps.chill?.chillerId);
    if (t.step === 'chill' && chiller && !chiller.vesselId) parts.push(deviceName(chiller.id)!);
    if (t.drive === 'pump') {
      parts.push(deviceName(t.pumpId) ?? 'Pumpe', litres(t.lossL) + (t.recovered ? ' (kommt zurück)' : ''));
    } else {
      parts.push(DRIVES.find((d) => d.value === t.drive)!.label);
    }
    const detail = parts.join(' · ');
    const key = `${t.from}|${t.to}|${detail}`;
    const m = merged.get(key);
    if (m) {
      m.steps.push(t.step);
    } else {
      const edge: SchemaEdge = { kind: 'transfer', from: t.from, to: t.to, label: '', detail, at: anchor.transfer(t.id) };
      merged.set(key, { edge, steps: [t.step] });
      edges.push(edge);
    }
  }
  for (const { edge, steps } of merged.values()) {
    edge.label = STEPS.map((s) => s.key).filter((k) => steps.includes(k)).map(stepShort).join(' & ');
  }

  const seen = new Set<string>();
  for (const s of STEPS) {
    const cfg = bh.steps[s.key];
    if (!cfg?.pumpId || !isVessel(cfg.vesselId)) continue;
    const h = heatingOf(bh, s.key);
    const other = h.heater && (h.via === 'coil' || h.via === 'vessel') && h.viaVessel ? h.viaVessel.id : cfg.vesselId;
    const via = h.via === 'coil' ? `über ${h.coil!.name || 'Spirale'}` : h.via === 'inline' ? `über ${h.heater!.name || 'RIMS-Rohr'}` : '';
    const detail = [deviceName(cfg.pumpId) ?? 'Pumpe', via].filter(Boolean).join(' · ');
    const key = `${[cfg.vesselId, other].sort().join('|')}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ kind: 'recirc', from: cfg.vesselId, to: other, label: 'Umwälzung', detail, at: anchor.step(s.key) });
  }

  if (edges.some((e) => e.to === OUT)) nodes.push(OUT);
  return { nodes, edges };
}

// ── Check ──────────────────────────────────────────────────────────────────────
// `at` is the DOM id of the place to fix it (the editor scrolls there).
export interface Issue { text: string; at: string }

export const anchor = {
  general: 'bh-general',
  vessel: (id: string) => `bh-vessel-${id}`,
  device: (id: string) => `bh-device-${id}`,
  step: (k: StepKey) => `bh-step-${k}`,
  transfer: (id: string) => `bh-transfer-${id}`,
  measurement: (k: MeasureKey) => `bh-measure-${k}`,
  vessels: 'bh-vessels',
};

const kindLabel = (k: DeviceKind) => DEVICE_KINDS.find((d) => d.kind === k)!.label;

// Errors block saving; hints do not.
export function checkBrewhouse(bh: Brewhouse, snap: Snapshot | null): { errors: Issue[]; hints: Issue[] } {
  const errors: Issue[] = [];
  const hints: Issue[] = [];
  const vessel = (id: string | undefined) => bh.vessels.find((v) => v.id === id);
  const device = (id: string | undefined) => bh.devices.find((d) => d.id === id);

  if (!bh.name.trim()) errors.push({ text: 'Das Sudhaus braucht einen Namen.', at: anchor.general });

  for (const s of STEPS) {
    if (s.required && !bh.steps[s.key]) {
      errors.push({ text: `Kein Behälter übernimmt „${s.label}“.`, at: anchor.vessels });
    }
  }

  for (const d of bh.devices) {
    const name = d.name || kindLabel(d.kind);
    if (d.vesselId && !vessel(d.vesselId)) {
      errors.push({ text: `${name}: Den Behälter gibt es nicht mehr.`, at: anchor.device(d.id) });
    }
    if (d.manual) continue;
    const linked = d.kind === 'heater' ? d.controller || d.actuator : d.actuator;
    if (!linked) {
      const what = DEVICE_KINDS.find((k) => k.kind === d.kind)!.actuator;
      errors.push({ text: `${name} ist angeschlossen, aber ohne ${what}.`, at: anchor.device(d.id) });
    }
    if (d.kind === 'heater' && d.controller && !snap?.controllers.some((c) => c.id === d.controller)) {
      hints.push({ text: `${name}: Regler „${d.controller}“ fehlt in der Registry.`, at: anchor.device(d.id) });
    }
    if (d.actuator && !snap?.actuators.some((a) => a.id === d.actuator)) {
      hints.push({ text: `${name}: Aktor „${d.actuator}“ fehlt in der Registry.`, at: anchor.device(d.id) });
    }
  }

  for (const s of STEPS) {
    const cfg = bh.steps[s.key];
    if (!cfg) continue;
    const at = anchor.step(s.key);
    if (!vessel(cfg.vesselId)) {
      errors.push({ text: `${s.label}: Den Behälter gibt es nicht mehr.`, at: anchor.vessels });
    }
    const refs: [string | undefined, DeviceKind[]][] = [
      [cfg.heaterId, ['heater']], [cfg.pumpId, ['pump']], [cfg.agitatorId, ['agitator']],
      [cfg.chillerId, ['chiller', 'coil']], [cfg.condenserId, ['condenser']],
      ...(cfg.valveIds ?? []).map((id): [string, DeviceKind[]] => [id, ['valve']]),
    ];
    for (const [id, kinds] of refs) {
      if (id && !kinds.includes(device(id)?.kind as DeviceKind)) {
        errors.push({ text: `${s.label}: Ein ausgewähltes Gerät gibt es nicht mehr.`, at });
      }
    }
    const h = heatingOf(bh, s.key);
    if ((s.key === 'mash' || s.key === 'boil') && !h.heater) {
      errors.push({ text: `${s.label} braucht eine Heizquelle.`, at });
    }
    if (h.heater && !h.direct && !cfg.pumpId) {
      errors.push({ text: `${s.label}: Die indirekte Heizung (${heatingText(h)}) braucht eine Umwälzpumpe.`, at });
    }
    if (s.key === 'boil' && cfg.condenserId && !(cfg.powerPct != null && cfg.powerPct < 100)) {
      hints.push({ text: 'Kochen mit Kondensator: Heizleistung unter 100 % setzen, sonst kocht die Würze über.', at });
    }
    if (s.key === 'chill' && !cfg.chillerId) hints.push({ text: 'Kühlen ohne Kühler.', at });
  }

  for (const t of bh.transfers) {
    const at = anchor.transfer(t.id);
    if (!vessel(t.from)) errors.push({ text: 'Transfer ohne Quelle.', at });
    if (t.to !== 'out' && !vessel(t.to)) errors.push({ text: 'Transfer ohne Ziel.', at });
    if (t.drive === 'pump' && device(t.pumpId)?.kind !== 'pump') {
      errors.push({ text: 'Transfer mit Pumpe, aber ohne ausgewählte Pumpe.', at });
    }
    if (!bh.steps[t.step]) hints.push({ text: `Transfer im Schritt „${stepLabel(t.step)}“, den es hier nicht gibt.`, at });
  }

  for (const m of MEASUREMENTS) {
    const id = bh.measurements[m.key];
    if (!id || !bh.steps[m.step]) continue;
    const at = anchor.measurement(m.key);
    if (!snap?.sensors.some((s) => s.id === id)) {
      hints.push({ text: `${m.label}: Sensor „${id}“ fehlt in der Registry.`, at });
      continue;
    }
    const unit = unitOf(snap, `sensor/${id}`);
    if (unit && !UNIT_FITS[m.unit]?.includes(unit.toLowerCase())) {
      hints.push({ text: `${m.label}: Sensor „${id}“ misst in ${unit}, erwartet ist ${m.unit}.`, at });
    }
  }

  return { errors, hints };
}

// ── Edits ──────────────────────────────────────────────────────────────────────
// Pre-selection happens once, when a step is assigned or a device is added;
// after that the stored selection counts.

// Ticks or unticks `step` on `vesselId`. A step another vessel had moves here,
// keeping its numbers but not its devices (those belonged to the old vessel).
export function assignStep(bh: Brewhouse, vesselId: string, step: StepKey, on: boolean): Brewhouse {
  const steps = { ...bh.steps };
  if (!on) {
    if (steps[step]?.vesselId === vesselId) delete steps[step];
    return { ...bh, steps };
  }
  const old = steps[step];
  const here = (kind: DeviceKind) => bh.devices.find((d) => d.kind === kind && d.vesselId === vesselId)?.id;
  steps[step] = dropUndefined({
    vesselId,
    heatRateKPerMin: old?.heatRateKPerMin, coolMinutes: old?.coolMinutes, powerPct: old?.powerPct,
    heaterId: STEPS.find((s) => s.key === step)!.heated ? here('heater') : undefined,
    agitatorId: step === 'mash' ? here('agitator') : undefined,
    condenserId: step === 'boil' ? here('condenser') : undefined,
  });
  return { ...bh, steps };
}

export function newDevice(kind: DeviceKind, vesselId?: string): Device {
  return {
    id: uid(), kind, name: kindLabel(kind), vesselId, manual: true,
    ...(kind === 'chiller' ? { chillerType: 'immersion' as const } : {}),
  };
}

// Adds `d` and pre-selects it: an agitator for mashing in its vessel, a
// condenser for boiling in its vessel, a heater for heated steps there.
export function addDevice(bh: Brewhouse, d: Device): Brewhouse {
  const steps = { ...bh.steps };
  for (const s of STEPS) {
    const cfg = steps[s.key];
    if (!cfg || !d.vesselId || cfg.vesselId !== d.vesselId) continue;
    if (d.kind === 'agitator' && s.key === 'mash' && !cfg.agitatorId) steps[s.key] = { ...cfg, agitatorId: d.id };
    if (d.kind === 'condenser' && s.key === 'boil' && !cfg.condenserId) steps[s.key] = { ...cfg, condenserId: d.id };
    if (d.kind === 'heater' && s.heated && !cfg.heaterId) steps[s.key] = { ...cfg, heaterId: d.id };
  }
  return { ...bh, devices: [...bh.devices, d], steps };
}

// Removes the vessel and the references to it; the gaps show up in the check.
// Its steps go (a step exists only through its vessel). Its devices keep their
// location so the check flags them: clearing it would quietly turn a heater
// into an inline one (a RIMS tube).
export function removeVessel(bh: Brewhouse, id: string): Brewhouse {
  const steps = { ...bh.steps };
  for (const k of Object.keys(steps) as StepKey[]) if (steps[k]?.vesselId === id) delete steps[k];
  return {
    ...bh,
    vessels: bh.vessels.filter((v) => v.id !== id),
    steps,
    transfers: bh.transfers.map((t) => ({
      ...t, from: t.from === id ? '' : t.from, to: t.to === id ? '' : t.to,
    })),
  };
}

export function removeDevice(bh: Brewhouse, id: string): Brewhouse {
  const steps = { ...bh.steps };
  for (const k of Object.keys(steps) as StepKey[]) {
    const c = steps[k]!;
    const clear = (v: string | undefined) => (v === id ? undefined : v);
    steps[k] = dropUndefined({
      ...c,
      heaterId: clear(c.heaterId), pumpId: clear(c.pumpId), agitatorId: clear(c.agitatorId),
      chillerId: clear(c.chillerId), condenserId: clear(c.condenserId),
      valveIds: c.valveIds?.filter((v) => v !== id),
    });
  }
  return {
    ...bh,
    devices: bh.devices.filter((d) => d.id !== id),
    steps,
    transfers: bh.transfers.map((t) => (t.pumpId === id ? { ...t, pumpId: undefined } : t)),
  };
}

function dropUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

// ── Templates ──────────────────────────────────────────────────────────────────
// Every device starts "von Hand", so each template (but "Leer") passes the check.

function blank(name: string): Brewhouse {
  return {
    id: uid(), name, description: '', updatedAt: 0,
    mashEfficiencyPct: DEFAULT_EFFICIENCY, coolingShrinkPct: 4,
    vessels: [], devices: [], steps: {}, transfers: [], measurements: {},
  };
}

function vessel(name: string, volumeL: number, deadSpaceL: number, extra: Partial<Vessel> = {}): Vessel {
  return { id: uid(), name, volumeL, deadSpaceL, ...extra };
}

function transfer(step: StepKey, from: string, to: string, drive: Transfer['drive'], pumpId?: string, lossL = 0): Transfer {
  return { id: uid(), step, from, to, drive, pumpId, lossL, recovered: false };
}

// Builds a brewhouse from vessels with their steps and devices with their
// location, applying the same pre-selection as the editor.
function build(name: string, vessels: [Vessel, StepKey[]][], devices: Device[]): Brewhouse {
  let bh: Brewhouse = { ...blank(name), vessels: vessels.map(([v]) => v) };
  for (const [v, steps] of vessels) for (const s of steps) bh = assignStep(bh, v.id, s, true);
  for (const d of devices) bh = addDevice(bh, d);
  return bh;
}

const dev = (kind: DeviceKind, name: string, vesselId?: string, extra: Partial<Device> = {}): Device =>
  ({ ...newDevice(kind, vesselId), name, ...extra });

export const TEMPLATES: { key: string; label: string; desc: string; build: () => Brewhouse }[] = [
  {
    key: 'pot', label: 'Ein Topf (Sack/Malzkorb)', desc: 'Alles in einem Topf, direkt beheizt',
    build: () => {
      const pot = vessel('Topf', 50, 1, { evaporationLPerH: 3, lauterMethod: 'Sack' });
      const bh = build('Ein-Topf', [[pot, ['strike', 'mash', 'lauter', 'boil', 'whirlpool', 'chill']]], [
        dev('heater', 'Heizung', pot.id, { powerW: 3000 }),
        dev('chiller', 'Eintauchkühler', pot.id),
      ]);
      return withChiller({ ...bh, transfers: [transfer('chill', pot.id, 'out', 'gravity')] });
    },
  },
  {
    key: 'pot-pipe', label: 'Ein Topf mit Malzrohr', desc: 'Umwälzpumpe durch das Malzrohr',
    build: () => {
      const pot = vessel('Topf', 50, 2, { evaporationLPerH: 3, lauterMethod: 'Malzrohr' });
      let bh = build('Ein-Topf mit Malzrohr', [[pot, ['strike', 'mash', 'lauter', 'boil', 'whirlpool', 'chill']]], [
        dev('heater', 'Heizung', pot.id, { powerW: 3000 }),
        dev('pump', 'Umwälzpumpe', pot.id),
        dev('chiller', 'Eintauchkühler', pot.id),
      ]);
      bh = withPump(bh, 'mash', bh.devices.find((d) => d.kind === 'pump')!.id);
      return withChiller({ ...bh, transfers: [transfer('chill', pot.id, 'out', 'gravity')] });
    },
  },
  {
    key: 'kettle-lauter', label: 'Maische-/Würzepfanne + Läuterbottich', desc: 'Nachguss im Einkocher',
    build: () => {
      const kettle = vessel('Maische-/Würzepfanne', 50, 1, { evaporationLPerH: 3 });
      const tun = vessel('Läuterbottich', 40, 1, { lauterMethod: 'Senkboden' });
      const hlt = vessel('Einkocher', 27, 0.5);
      const bh = build('Pfanne + Läuterbottich', [
        [kettle, ['strike', 'mash', 'boil', 'whirlpool', 'chill']], [tun, ['lauter']], [hlt, ['sparge']],
      ], [
        dev('heater', 'Heizung', kettle.id, { powerW: 3500 }),
        dev('heater', 'Einkocher', hlt.id, { powerW: 1800 }),
        dev('chiller', 'Eintauchkühler', kettle.id),
      ]);
      return withChiller({
        ...bh,
        transfers: [
          transfer('mash', kettle.id, tun.id, 'manual'),
          transfer('sparge', hlt.id, tun.id, 'gravity'),
          transfer('lauter', tun.id, kettle.id, 'gravity'),
          transfer('chill', kettle.id, 'out', 'gravity'),
        ],
      });
    },
  },
  {
    key: 'herms2', label: '2-Kessel-HERMS', desc: 'Nachguss und Kochen in einem Kessel',
    build: () => {
      const kettle = vessel('HLT/Würzepfanne', 70, 2, { evaporationLPerH: 4 });
      const tun = vessel('Maisch-/Läuterbottich', 70, 1.5, { lauterMethod: 'Senkboden' });
      let bh = build('2-Kessel-HERMS', [
        [kettle, ['strike', 'sparge', 'boil', 'whirlpool', 'chill']], [tun, ['mash', 'lauter']],
      ], [
        dev('heater', 'Heizstab', kettle.id, { powerW: 5500 }),
        dev('coil', 'HERMS-Spirale', kettle.id),
        dev('pump', 'Pumpe'),
        dev('chiller', 'Plattenkühler', undefined, { chillerType: 'plate' }),
      ]);
      const pump = bh.devices.find((d) => d.kind === 'pump')!.id;
      bh = withPump(bh, 'mash', pump);
      bh = { ...bh, steps: { ...bh.steps, mash: { ...bh.steps.mash!, heaterId: bh.devices[0].id } } };
      return withChiller({
        ...bh,
        transfers: [
          transfer('strike', kettle.id, tun.id, 'pump', pump, 0.5),
          transfer('sparge', kettle.id, tun.id, 'pump', pump, 0.5),
          transfer('lauter', tun.id, kettle.id, 'pump', pump, 0.5),
          transfer('chill', kettle.id, 'out', 'pump', pump, 1),
        ],
      });
    },
  },
  {
    key: 'herms3', label: '3-Kessel-HERMS', desc: 'HLT mit Spirale, Maisch-/Läuterbottich, Würzepfanne',
    build: () => {
      const hlt = vessel('HLT', 70, 2);
      const tun = vessel('Maisch-/Läuterbottich', 70, 1.5, { lauterMethod: 'Senkboden' });
      const kettle = vessel('Würzepfanne', 70, 2, { evaporationLPerH: 4 });
      let bh = build('3-Kessel-HERMS', [
        [hlt, ['strike', 'sparge']], [tun, ['mash', 'lauter']], [kettle, ['boil', 'whirlpool', 'chill']],
      ], [
        dev('heater', 'Heizstab HLT', hlt.id, { powerW: 5500 }),
        dev('heater', 'Heizstab Würzepfanne', kettle.id, { powerW: 5500 }),
        dev('coil', 'HERMS-Spirale', hlt.id),
        dev('pump', 'Pumpe 1'),
        dev('pump', 'Pumpe 2'),
        dev('chiller', 'Plattenkühler', undefined, { chillerType: 'plate' }),
      ]);
      const [p1, p2] = bh.devices.filter((d) => d.kind === 'pump').map((d) => d.id);
      bh = withPump(bh, 'mash', p1);
      bh = { ...bh, steps: { ...bh.steps, mash: { ...bh.steps.mash!, heaterId: bh.devices[0].id } } };
      return withChiller({
        ...bh,
        transfers: [
          transfer('strike', hlt.id, tun.id, 'pump', p2, 0.5),
          transfer('sparge', hlt.id, tun.id, 'pump', p2, 0.5),
          transfer('lauter', tun.id, kettle.id, 'pump', p1, 0.5),
          transfer('chill', kettle.id, 'out', 'pump', p2, 1),
        ],
      });
    },
  },
  { key: 'empty', label: 'Leer', desc: 'Ohne Behälter und Geräte', build: () => blank('Neues Sudhaus') },
];

function withPump(bh: Brewhouse, step: StepKey, pumpId: string): Brewhouse {
  return { ...bh, steps: { ...bh.steps, [step]: { ...bh.steps[step]!, pumpId } } };
}

// Templates chill with their only chiller.
function withChiller(bh: Brewhouse): Brewhouse {
  const chiller = bh.devices.find((d) => d.kind === 'chiller');
  if (!chiller || !bh.steps.chill) return bh;
  return { ...bh, steps: { ...bh.steps, chill: { ...bh.steps.chill, chillerId: chiller.id } } };
}

export function duplicateBrewhouse(bh: Brewhouse): Brewhouse {
  return { ...structuredClone(bh), id: uid(), name: `${bh.name} (Kopie)`, updatedAt: 0 };
}

// Fills in what an older or hand-edited file lacks.
export function normalizeBrewhouse(raw: Partial<Brewhouse> & { id: string }): Brewhouse {
  return {
    ...blank(''),
    ...raw,
    vessels: raw.vessels ?? [], devices: raw.devices ?? [], steps: raw.steps ?? {},
    transfers: raw.transfers ?? [], measurements: raw.measurements ?? {},
  };
}

// ── API ────────────────────────────────────────────────────────────────────────
const BASE = '/api/brewhouses';

export async function listBrewhouses(): Promise<Brewhouse[]> {
  const r = await fetch(BASE);
  if (!r.ok) await failed(r);
  return ((await r.json()) as Brewhouse[]).map(normalizeBrewhouse).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveBrewhouse(bh: Brewhouse): Promise<Brewhouse> {
  if (!VALID_ID.test(bh.id)) throw new Error('ungültige ID');
  const saved = { ...bh, updatedAt: Date.now() };
  const r = await fetch(`${BASE}/${encodeURIComponent(bh.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved),
  });
  if (!r.ok) await failed(r);
  return saved;
}

export async function deleteBrewhouse(id: string): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) await failed(r);
}

// The defaults until the brewery was first saved.
export async function getBrewery(): Promise<Brewery> {
  const r = await fetch('/api/brewery');
  if (r.status === 404) return { ...DEFAULT_BREWERY };
  if (!r.ok) await failed(r);
  return { ...DEFAULT_BREWERY, ...((await r.json()) as Partial<Brewery>) };
}

export async function saveBrewery(b: Brewery): Promise<void> {
  const r = await fetch('/api/brewery', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  if (!r.ok) await failed(r);
}
