import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { fmtClock, type MashPlan } from '../../mashPlan';

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Ramps and holds of the plan over time, from heating the strike water on; a
// point marks each addition (water, grain or a decoction put back). A
// transition without a known duration is drawn as a jump. A decoction has its
// own series (`decs`, null elsewhere) that drops back into the mash when it is
// put back; meanwhile the mash line shows the mash left behind.
export function curveOf(plan: MashPlan): {
  xs: number[]; ys: (number | null)[]; decs: (number | null)[]; marks: (number | null)[]; labels: string[];
} {
  const xs: number[] = [0];
  const ys: (number | null)[] = [plan.rows[0]?.fromC ?? 0];
  const decs: (number | null)[] = [null];
  const marks: (number | null)[] = [null];
  const labels: string[] = [''];
  const push = (x: number, y: number | null, label?: string, dec: number | null = null) => {
    xs.push(x);
    ys.push(y);
    decs.push(dec);
    marks.push(label === undefined || y === null ? null : y);
    labels.push(label ?? '');
  };
  for (const r of plan.rows) {
    if (r.decoction) {
      for (const p of r.decoction.curve) push(p.min, null, undefined, p.tempC);
      push(r.startMin, null, undefined, r.tempC);
      push(r.startMin, r.decoction.restMashC);
    }
    const added = r.waterL || r.grainKg || r.decoction ? r.step.name || '' : undefined;
    push(r.startMin, r.tempC, added);
    if (r.holdMin > 0) push(r.startMin + r.holdMin, r.tempC);
  }
  return { xs, ys, decs, marks, labels };
}

export function MashCurve({ plan }: { plan: MashPlan }) {
  const elRef = useRef<HTMLDivElement>(null);
  const { xs, ys, decs, marks, labels } = curveOf(plan);
  const key = JSON.stringify([xs, ys, decs, labels]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const fg = cssVar('--fg', '#888');
    const muted = cssVar('--muted', '#888');
    const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
    const line = cssVar('--series-1', '#2a78d6');
    const point = cssVar('--series-2', '#eb6834');
    const decoction = cssVar('--series-3', '#1baf7a');
    const u = new uPlot({
      width: el.clientWidth || 600,
      height: 220,
      legend: { show: false },
      cursor: { show: false },
      scales: { x: { time: false } },
      series: [
        {},
        { stroke: line, width: 2, points: { show: false }, spanGaps: true },
        { stroke: point, fill: point, paths: () => null, points: { show: true, size: 8, stroke: point, fill: point } },
        { stroke: decoction, width: 2, dash: [6, 4], points: { show: false } },
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
            const y = u.valToPos(ys[i]!, 'y', true) + (below ? 16 : -6) * px;
            ctx.fillText(text, x, y);
            lastEnd = x + ctx.measureText(text).width;
            lastBelow = below;
          });
          ctx.restore();
        }],
      },
    }, [xs, ys, marks, decs], el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 600, height: 220 }));
    ro.observe(el);
    return () => { ro.disconnect(); u.destroy(); };
  }, [key]);

  return <div ref={elRef} class="w-full" />;
}
