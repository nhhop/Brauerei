const decimals = (n: number) => {
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

// Step of a number field's arrows: whole steps from 10 up, tenths below.
export const autoStep = (v: number) => (Math.abs(v) >= 10 ? 1 : 0.1);

// The value one arrow click away. Rounded to the finer of step and value, so
// 0.1 + 0.2 stays 0.3. Never below `min` (0 unless the field may go negative).
export function stepValue(v: number, dir: 1 | -1, step?: number, min = 0): number {
  const base = Number.isFinite(v) ? v : 0;
  const s = step ?? autoStep(base);
  const next = base + dir * s;
  const d = Math.max(decimals(s), decimals(base));
  return Math.max(min, Number(next.toFixed(d)));
}

// stepValue for a field that keeps its text with a decimal comma; an empty
// field steps from `fallback` (its placeholder).
export const stepText = (text: string, dir: 1 | -1, fallback = '', step?: number, min?: number) =>
  String(stepValue(parseFloat((text.trim() === '' ? fallback : text).replace(',', '.')), dir, step, min)).replace('.', ',');
