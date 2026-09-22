import type { CalibrationMode, CalibrationPoint } from './types';

// Support points of the calibration dialog. The form values stay strings so an
// in-progress input like "7," survives a re-render (same reasoning as in
// ProgramStepsEditor); parsing and validation live here so they are testable
// without a DOM.

// Mirrors CalibratedSensor::kMaxPoints / kMaxDegree in the library.
export const MAX_POINTS = 8;
export const MAX_DEGREE = 3;

export interface PointDraft { raw: string; value: string }

export function emptyPoint(): PointDraft {
  return { raw: '', value: '' };
}

// Tolerates a comma as decimal separator. The dialog's number inputs normally
// hand one over already converted (or reject it), but that depends on browser
// and locale, so do not rely on it.
export function num(s: string): number {
  return parseFloat(s.replace(',', '.'));
}

// How many points the mode needs at minimum.
export function requiredCount(mode: CalibrationMode, degree: number): number {
  if (mode === 'poly') return degree + 1;
  return mode === 'twopoint' ? 2 : 1;
}

// Pads the list so it holds at least `n` rows (never drops what the user typed).
export function ensureRows(rows: PointDraft[], n: number): PointDraft[] {
  if (rows.length >= n) return rows;
  return [...rows, ...Array.from({ length: n - rows.length }, emptyPoint)];
}

// Why the points cannot be applied yet, or null when they are fine. The
// messages mirror what the firmware would reject, so the user does not need a
// round trip to find out.
export function pointsProblem(
  rows: PointDraft[], mode: CalibrationMode, degree: number,
): string | null {
  const need = requiredCount(mode, degree);
  if (rows.length < need) {
    return mode === 'poly'
      ? `Grad ${degree} braucht mindestens ${need} Punkte.`
      : `Es werden ${need} Punkte gebraucht.`;
  }
  if (rows.length > MAX_POINTS) return `Höchstens ${MAX_POINTS} Punkte.`;

  const raws: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = num(rows[i].raw);
    const value = num(rows[i].value);
    if (isNaN(raw) || isNaN(value)) {
      return `Punkt ${i + 1}: Rohwert messen und Referenzwert eintragen.`;
    }
    raws.push(raw);
  }

  if (mode === 'gain' && raws[0] === 0) {
    return 'Der Rohwert darf für den Faktor nicht 0 sein.';
  }
  if (mode === 'twopoint' && raws[0] === raws[1]) {
    return 'Die beiden Rohwerte müssen verschieden sein.';
  }
  if (mode === 'poly') {
    for (let i = 0; i < raws.length; i++) {
      for (let j = i + 1; j < raws.length; j++) {
        if (raws[i] === raws[j]) {
          return `Punkt ${i + 1} und ${j + 1} haben denselben Rohwert.`;
        }
      }
    }
  }
  return null;
}

// The points to send. Call only after pointsProblem() returned null.
export function pointsToWire(rows: PointDraft[]): CalibrationPoint[] {
  return rows.map((p) => ({ raw: num(p.raw), value: num(p.value) }));
}
