import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Phase } from '../../recipes';
import { Section } from './CalcTable';

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const dec = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

// Temperature of the phases over the days: a phase with a ramp runs from the
// previous temperature to its own within `rampDays` (at most its duration) and
// holds the rest; without one it is a jump at its start. The name of a phase
// stands at the point where it reaches its temperature. The pressure (none = 0)
// steps at the start of its phase.
export function fermentationCurveOf(phases: Pick<Phase, 'name' | 'tempC' | 'duration' | 'rampDays' | 'pressureBar'>[]): {
  xs: number[]; ys: number[]; bars: number[]; labels: string[];
} {
  const xs: number[] = [];
  const ys: number[] = [];
  const bars: number[] = [];
  const labels: string[] = [];
  const push = (x: number, y: number, bar: number, label = '') => {
    xs.push(x); ys.push(y); bars.push(bar); labels.push(label);
  };
  let day = 0;
  phases.forEach((p, i) => {
    const ramp = i > 0 ? Math.min(Math.max(p.rampDays ?? 0, 0), p.duration) : 0;
    const bar = p.pressureBar ?? 0;
    if (i > 0) {
      push(day, phases[i - 1].tempC, phases[i - 1].pressureBar ?? 0);
      push(day, phases[i - 1].tempC, bar);
    }
    push(day + ramp, p.tempC, bar, p.name);
    day += p.duration;
    push(day, p.tempC, bar);
  });
  return { xs, ys, bars, labels };
}

// `pressure`: also draw the pressure on a second axis (when any phase has one).
export function FermentationCurve({ phases, pressure }: { phases: Phase[]; pressure?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null);
  const { xs, ys, bars, labels } = fermentationCurveOf(phases);
  const showBars = !!pressure && bars.some((b) => b > 0);
  const key = JSON.stringify([xs, ys, labels, showBars ? bars : null]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || xs.length === 0) return;
    const fg = cssVar('--fg', '#888');
    const muted = cssVar('--muted', '#888');
    const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
    const line = cssVar('--series-1', '#2a78d6');
    const point = cssVar('--series-2', '#eb6834');
    const marks = ys.map((y, i) => (labels[i] ? y : null));
    const barColor = cssVar('--series-3', '#1baf7a');
    const u = new uPlot({
      width: el.clientWidth || 600,
      height: 220,
      legend: { show: false },
      cursor: { show: false },
      scales: { x: { time: false }, bar: { range: (_u: uPlot, _min: number, max: number) => [0, max * 1.2] as [number, number] } },
      series: [
        {},
        { stroke: line, width: 2, points: { show: false } },
        { stroke: point, fill: point, paths: () => null, points: { show: true, size: 8, stroke: point, fill: point } },
        ...(showBars ? [{ scale: 'bar', stroke: barColor, width: 2, dash: [6, 4], points: { show: false } }] : []),
      ],
      axes: [
        { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((v) => `${dec(v)} d`) },
        { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((v) => `${dec(v)} °C`), size: 56 },
        ...(showBars ? [{
          scale: 'bar', side: 1, stroke: barColor, grid: { show: false }, ticks: { stroke: grid }, size: 64,
          values: (_u: uPlot, splits: number[]) => splits.map((v) => `${dec(v)} bar`),
        }] : []),
      ],
      hooks: {
        // Names above their points; one close to the previous label goes below.
        draw: [(u) => {
          const { ctx } = u;
          const px = devicePixelRatio;
          ctx.save();
          ctx.fillStyle = muted;
          ctx.font = `${11 * px}px sans-serif`;
          ctx.textAlign = 'left';
          let lastEnd = -Infinity;
          let lastBelow = true;
          labels.forEach((text, i) => {
            if (!text) return;
            const x = u.valToPos(xs[i], 'x', true) + 6 * px;
            const below = x < lastEnd && !lastBelow;
            const y = u.valToPos(ys[i], 'y', true) + (below ? 16 : -6) * px;
            ctx.fillText(text, x, y);
            lastEnd = x + ctx.measureText(text).width;
            lastBelow = below;
          });
          ctx.restore();
        }],
      },
    }, showBars ? [xs, ys, marks, bars] : [xs, ys, marks], el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 600, height: 220 }));
    ro.observe(el);
    return () => { ro.disconnect(); u.destroy(); };
  }, [key]);

  return <div ref={elRef} class="w-full" />;
}

// The curve in its own card, as under the mash plan; nothing without phases.
export function FermentationCurveSection({ phases, pressure }: { phases: Phase[]; pressure?: boolean }) {
  if (phases.length === 0) return null;
  return (
    <Section title="Temperaturverlauf">
      <div class="p-4"><FermentationCurve phases={phases} pressure={pressure} /></div>
    </Section>
  );
}
