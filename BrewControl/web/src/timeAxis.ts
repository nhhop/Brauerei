// Time-axis modes for the log charts. Older values get compressed so the newest
// ones keep their width: every mode maps the age a = tMax - t (seconds) onto a
// monotonic coordinate, newest at the right edge. The data itself stays in epoch
// seconds; uPlot gets the mapping as a custom scale (distr 100, fwd/bwd).

export type TimeAxisMode = 'linear' | 'log' | 'sqrt';

export const TIME_AXIS_MODES: TimeAxisMode[] = ['linear', 'log', 'sqrt'];

export const TIME_AXIS_LABELS: Record<TimeAxisMode, string> = {
  linear: 'Linear',
  log: 'Log',
  sqrt: 'Quadr.',
};

export function parseTimeAxis(v: unknown): TimeAxisMode {
  return TIME_AXIS_MODES.includes(v as TimeAxisMode) ? (v as TimeAxisMode) : 'linear';
}

// Scale of the log mode: ages below this stay roughly linear.
const LOG_TAU_SEC = 60;

// Compression f(|a|) of one non-linear mode, and its inverse. Both are
// increasing with f(0) = 0.
const FWD = {
  log: (a: number) => Math.log1p(a / LOG_TAU_SEC),
  sqrt: (a: number) => Math.sqrt(a),
};
const BWD = {
  log: (u: number) => Math.expm1(u) * LOG_TAU_SEC,
  sqrt: (u: number) => u * u,
};

// Extended oddly around a = 0, so values past tMax (uPlot pads zoom ranges)
// stay on a strictly increasing, invertible curve.
function sgn(v: number): number { return v < 0 ? -1 : 1; }

// fwd/bwd for uPlot's `scales.x`. `getTMax` is read on every call, so the
// mapping follows the live data without rebuilding the plot.
export function makeScale(mode: Exclude<TimeAxisMode, 'linear'>, getTMax: () => number) {
  const f = FWD[mode], g = BWD[mode];
  return {
    fwd: (t: number) => { const a = getTMax() - t; return -sgn(a) * f(Math.abs(a)); },
    bwd: (u: number) => getTMax() - -sgn(u) * g(Math.abs(u)),
  };
}

const AGE_STEPS_SEC = [
  60, 5 * 60, 15 * 60, 30 * 60,
  3600, 3 * 3600, 6 * 3600, 12 * 3600,
  86400, 3 * 86400, 7 * 86400, 14 * 86400, 30 * 86400,
];

// Tick positions (epoch seconds) at round ages before tMax that fall within
// [min, max]. Tick spacing in pixels is uneven by design, so no density
// control beyond dropping ages that end up closer than `minGapFrac` of the
// coordinate range.
export function ageSplits(
  min: number, max: number, tMax: number, fwd: (t: number) => number, minGapFrac = 0.08,
): number[] {
  const u0 = fwd(min), u1 = fwd(max);
  const span = Math.abs(u1 - u0);
  const out: number[] = [];
  let last = Infinity;
  // Newest tick first so the right-hand ones always survive the gap filter.
  const ages = [0, ...AGE_STEPS_SEC];
  for (const a of ages) {
    const t = tMax - a;
    if (t < min || t > max) continue;
    const u = fwd(t);
    if (span > 0 && Math.abs(last - u) < minGapFrac * span) continue;
    last = u;
    out.push(t);
  }
  return out.reverse();
}

// "jetzt", "-5 min", "-2 h", "-3 d"
export function ageLabel(a: number): string {
  const s = Math.round(a);
  if (s <= 0) return 'jetzt';
  if (s < 3600) return `-${Math.round(s / 60)} min`;
  if (s < 86400) return `-${Math.round(s / 3600)} h`;
  return `-${Math.round(s / 86400)} d`;
}
