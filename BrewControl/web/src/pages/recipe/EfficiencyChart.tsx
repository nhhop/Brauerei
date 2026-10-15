import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { BrewSummary } from '../../brews';

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// The measured efficiencies of the brews that have one, oldest first. The x
// axis counts the brews, so a gap in the numbers does not stretch the chart.
export function efficiencySeries(brews: Pick<BrewSummary, 'number' | 'version' | 'mashEffPct' | 'yieldPct'>[]): {
  xs: number[]; mash: (number | null)[]; yields: (number | null)[]; labels: string[];
} {
  const rows = brews.filter((b) => b.mashEffPct !== undefined || b.yieldPct !== undefined)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  return {
    xs: rows.map((_, i) => i),
    mash: rows.map((b) => b.mashEffPct ?? null),
    yields: rows.map((b) => b.yieldPct ?? null),
    labels: rows.map((b) => `#${b.number} · v${b.version}`),
  };
}

const pct = (v: number | null) => (v == null ? '–' : `${v.toFixed(1).replace('.', ',')} %`);

export function EfficiencyChart({ brews }: { brews: BrewSummary[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const { xs, mash, yields, labels } = efficiencySeries(brews);
  const key = JSON.stringify([mash, yields, labels]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || xs.length < 2) return;
    const fg = cssVar('--fg', '#888');
    const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
    const line = (color: string): uPlot.Series => ({
      stroke: color, width: 2, spanGaps: true, points: { show: true, size: 8, stroke: color, fill: color },
      value: (_u, v) => pct(v),
    });
    const u = new uPlot({
      width: el.clientWidth || 600,
      height: 200,
      scales: { x: { time: false, range: [-0.5, xs.length - 0.5] } },
      series: [
        { label: 'Sud', value: (_u, v) => (v == null ? '–' : labels[v] ?? '') },
        { ...line(cssVar('--series-1', '#2a78d6')), label: 'Maischeeffizienz' },
        { ...line(cssVar('--series-2', '#eb6834')), label: 'Sudhausausbeute' },
      ],
      axes: [
        { stroke: fg, grid: { show: false }, ticks: { stroke: grid }, splits: () => xs, values: (_u, splits) => splits.map((i) => labels[i] ?? '') },
        { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((v) => `${v} %`), size: 56 },
      ],
    }, [xs, mash, yields], el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 600, height: 200 }));
    ro.observe(el);
    return () => { ro.disconnect(); u.destroy(); };
  }, [key]);

  if (xs.length < 2) return null;
  return <div ref={elRef} class="w-full" />;
}
