import { UNIT_FITS } from './brewhouse';
import { deleteDoc, listDocs, saveDoc } from './docStore';
import { uid } from './recipes';
import { unitOf } from './refs';
import type { Snapshot } from './types';

// Fermentation cellar ("Gärkeller"): the fermenters (Gärplätze) and the
// containers (Gebinde) a brew is filled into. Each is a document of its own
// (/fermenters/<id>.json, /containers/<id>.json), so the brew day and the
// booking plan refer to them by id. A fermenter holds no occupancy. The
// firmware checks only `id`; fields added later stay optional on read
// (normalize…), there is no schema version.

export type FermenterKind = 'bucket' | 'carboy' | 'conical' | 'pressure' | 'keg' | 'other';

export const FERMENTER_KINDS: { value: FermenterKind; label: string }[] = [
  { value: 'bucket', label: 'Eimer / Fass' },
  { value: 'carboy', label: 'Glasballon' },
  { value: 'conical', label: 'Edelstahl konisch' },
  { value: 'pressure', label: 'Druckgärtank' },
  { value: 'keg', label: 'Keg' },
  { value: 'other', label: 'Sonstiges' },
];

export type Tempering = 'none' | 'cool' | 'heat' | 'both';

export const TEMPERINGS: { value: Tempering; label: string }[] = [
  { value: 'none', label: 'ohne Temperierung' },
  { value: 'cool', label: 'kühlen' },
  { value: 'heat', label: 'heizen' },
  { value: 'both', label: 'kühlen und heizen' },
];

export interface Fermenter {
  id: string;
  name: string;
  updatedAt: number;        // epoch ms, like Recipe
  kind: FermenterKind;
  volumeL: number;
  trubLossL?: number;       // unset = the recipe's assumption holds
  maxPressureBar?: number;  // gauge pressure; unset = not pressure-rated
  tempering: Tempering;
  ambientTempC?: number;    // where it stands; unset = unknown (no hint whether a phase needs cooling or heating)
  manual: boolean;         // "von Hand": no registry link; only counts with a tempering
  controller?: string;      // snapshot ids; a device on another board is a Remote item here
  actuator?: string;
  sensor?: string;          // temperature probe, with or without tempering
  densitySensor?: string;   // e.g. an iSpindel as a remote sensor; the fermentation course draws it
}

export type ContainerKind = 'bottle' | 'keg';

export const CONTAINER_KINDS: { value: ContainerKind; label: string }[] = [
  { value: 'bottle', label: 'Flasche' },
  { value: 'keg', label: 'Keg' },
];

export interface Container {
  id: string;
  updatedAt: number;
  kind: ContainerKind;
  name?: string;            // shown instead of "Flasche 0,5 l"
  sizeL: number;
  count: number;            // how many there are
  fillLossL?: number;       // lost per filling; unset = 0
  maxPressureBar?: number;
}

export function newFermenter(): Fermenter {
  return { id: uid(), name: '', updatedAt: 0, kind: 'bucket', volumeL: 0, tempering: 'none', manual: true };
}

export function newContainer(): Container {
  return { id: uid(), updatedAt: 0, kind: 'bottle', sizeL: 0.5, count: 1 };
}

// Fills in what an older or hand-edited file lacks.
export function normalizeFermenter(raw: Partial<Fermenter> & { id: string }): Fermenter {
  return { ...newFermenter(), kind: 'other', name: '', ...raw };
}

export function normalizeContainer(raw: Partial<Container> & { id: string }): Container {
  return { ...newContainer(), sizeL: 0, count: 0, ...raw };
}

// "None" has no controller or actuator to keep; the probe stays.
export function setTempering(f: Fermenter, tempering: Tempering): Fermenter {
  if (tempering !== 'none') return { ...f, tempering };
  const { controller: _c, actuator: _a, ...rest } = f;
  return { ...rest, tempering };
}

const num = (n: number) => String(n).replace('.', ',');

export function containerLabel(c: Container): string {
  return c.name?.trim() || `${CONTAINER_KINDS.find((k) => k.value === c.kind)?.label ?? c.kind} ${num(c.sizeL)} l`;
}

// "60 l · kühlen und heizen · Regler glycol · bis 1,5 bar"
export function fermenterSummary(f: Fermenter): string {
  const parts = [`${num(f.volumeL)} l`, TEMPERINGS.find((t) => t.value === f.tempering)!.label];
  if (f.tempering !== 'none') {
    parts.push(f.manual ? 'von Hand' : f.controller ? `Regler ${f.controller}` : f.actuator ? `Aktor ${f.actuator}` : 'ohne Verknüpfung');
  }
  if (f.maxPressureBar) parts.push(`bis ${num(f.maxPressureBar)} bar`);
  return parts.join(' · ');
}

// ── Check ──────────────────────────────────────────────────────────────────────
// Errors block saving; hints do not.
export interface Check { errors: string[]; hints: string[] }

const bad = (n: number | undefined, min: number) => n !== undefined && !(Number.isFinite(n) && n >= min);

export function checkFermenter(f: Fermenter, snap: Snapshot | null): Check {
  const errors: string[] = [];
  const hints: string[] = [];

  if (!f.name.trim()) errors.push('Der Gärplatz braucht einen Namen.');
  if (!(Number.isFinite(f.volumeL) && f.volumeL > 0)) errors.push('Das Volumen muss größer als 0 sein.');
  if (bad(f.trubLossL, 0) || (f.trubLossL !== undefined && f.trubLossL >= f.volumeL)) {
    errors.push('Der Trubverlust muss zwischen 0 und dem Volumen liegen.');
  }
  if (bad(f.maxPressureBar, 0)) errors.push('„Druckfest bis“ darf nicht negativ sein.');
  if (f.tempering !== 'none' && !f.manual && !f.controller && !f.actuator) {
    errors.push('Die Temperierung ist angeschlossen, aber ohne Regler oder Aktor.');
  }

  if (snap) {
    // Remote sensors and actuators of other boards are local proxies, so they are found here too.
    const notCelsius = (ref: string) => {
      const unit = unitOf(snap, ref);
      return unit && unit.toLowerCase() !== '°c' ? unit : '';
    };
    if (f.controller) {
      const unit = notCelsius(`controller/${f.controller}`);
      if (!snap.controllers.some((c) => c.id === f.controller)) hints.push(`Regler „${f.controller}“ fehlt in der Registry.`);
      else if (unit) hints.push(`Regler „${f.controller}“ regelt auf ${unit}, erwartet ist °C.`);
    }
    if (f.actuator && !snap.actuators.some((a) => a.id === f.actuator)) hints.push(`Aktor „${f.actuator}“ fehlt in der Registry.`);
    if (f.sensor) {
      const unit = notCelsius(`sensor/${f.sensor}`);
      if (!snap.sensors.some((s) => s.id === f.sensor)) hints.push(`Fühler „${f.sensor}“ fehlt in der Registry.`);
      else if (unit) hints.push(`Fühler „${f.sensor}“ misst in ${unit}, erwartet ist °C.`);
    }
    if (f.densitySensor) {
      const unit = unitOf(snap, `sensor/${f.densitySensor}`);
      if (!snap.sensors.some((s) => s.id === f.densitySensor)) hints.push(`Dichtesensor „${f.densitySensor}“ fehlt in der Registry.`);
      else if (unit && !UNIT_FITS['°P'].includes(unit.toLowerCase())) {
        hints.push(`Dichtesensor „${f.densitySensor}“ misst in ${unit}, erwartet ist °P, SG oder °Bx; der Gärverlauf zeichnet ihn nicht.`);
      }
    }
  }
  return { errors, hints };
}

export function checkContainer(c: Container, _snap: Snapshot | null): Check {
  const errors: string[] = [];
  const hints: string[] = [];

  if (!(Number.isFinite(c.sizeL) && c.sizeL > 0)) errors.push('Die Größe muss größer als 0 sein.');
  if (!(Number.isInteger(c.count) && c.count >= 0)) errors.push('Die Anzahl muss eine ganze Zahl ab 0 sein.');
  if (bad(c.fillLossL, 0) || (c.fillLossL !== undefined && c.fillLossL >= c.sizeL)) {
    errors.push('Der Abfüllverlust muss zwischen 0 und der Größe liegen.');
  }
  if (bad(c.maxPressureBar, 0)) errors.push('„Druckfest bis“ darf nicht negativ sein.');

  if (c.kind === 'keg' && !c.maxPressureBar) hints.push('Keg ohne Angabe „druckfest bis“.');
  if (Number.isInteger(c.count) && c.count === 0) hints.push('Anzahl 0: Das Gebinde ist nicht vorrätig.');
  return { errors, hints };
}

// ── API ────────────────────────────────────────────────────────────────────────
const FERMENTERS = '/api/fermenters';
const CONTAINERS = '/api/containers';

export const listFermenters = () => listDocs<Fermenter>(FERMENTERS, normalizeFermenter, (f) => f.name);
export const saveFermenter = (f: Fermenter) => saveDoc(FERMENTERS, f);
export const deleteFermenter = (id: string) => deleteDoc(FERMENTERS, id);

export const listContainers = () => listDocs<Container>(CONTAINERS, normalizeContainer, containerLabel);
export const saveContainer = (c: Container) => saveDoc(CONTAINERS, c);
export const deleteContainer = (id: string) => deleteDoc(CONTAINERS, id);
