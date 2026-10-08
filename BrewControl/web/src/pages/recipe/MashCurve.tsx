import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { fmtClock, type MashPlan } from '../../mashPlan';

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Ramps and holds of the plan over time, from heating the strike water on; a
// point marks each addition (water or grain). A transition without a known
// duration is drawn as a jump.
export function curveOf(plan: MashPlan): { xs: number[]; ys: number[]; marks: (number | null)[]; labels: string[] } {
  const xs: number[] = [0];
  const ys: number[] = [plan.rows[0]?.fromC ?? 0];
  const marks: (number | null)[] = [null];
  const labels: string[] = [''];
  const push = (x: number, y: number, label?: string) => {
    xs.push(x);
    ys.push(y);
    marks.push(label === undefined ? null : y);
    labels.push(label ?? '');
  };
  for (const r of plan.rows) {
    const added = r.waterL || r.grainKg ? r.step.name || '' : undefined;
    push(r.startMin, r.tempC, added);
    if (r.holdMin > 0) push(r.startMin + r.holdMin, r.tempC);
  }
  return { xs, ys, marks, labels };
}

export function MashCurve({ plan }: { plan: MashPlan }) {
  const elRef = useRef<HTMLDivElement>(null);
  const { xs, ys, marks, labels } = curveOf(plan);
  const key = JSON.stringify([xs, ys, labels]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const fg = cssVar('--fg', '#888');
    const muted = cssVar('--muted', '#888');
    const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
    const line = cssVar('--series-1', '#2a78d6');
    const point = cssVar('--series-2', '#eb6834');
    const u = new uPlot({
      width: el.clientWidth || 600,
      height: 220,
      legend: { show: false },
      cursor: { show: false },
      scales: { x: { time: false } },
      series: [
        {},
        { stroke: line, width: 2, points: { show: false } },
        { stroke: point, fill: point, paths: () => null, points: { show: true, size: 8, stroke: point, fill: point } },
      ],
      axes: [
        { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map(fmtClock) },
        { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((v) => `${v} °C`), size: 56 },
      ],
      hooks: {
        // Names of the additions above their points; one close to the
        // previous label goes below its point instead.
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
    }, [xs, ys, marks], el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 600, height: 220 }));
    ro.observe(el);
    return () => { ro.disconnect(); u.destroy(); };
  }, [key]);

  return <div ref={elRef} class="w-full" />;
}
