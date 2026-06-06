import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Snapshot, LogConfig } from '../types';
import { getLogData, resolveRef } from '../api';

// Distinct line colors, reused cyclically across series.
const PALETTE = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
];

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

interface Props {
  log: LogConfig;
  snap: Snapshot | null;
  height?: number;
}

// Renders the current session of one log as a live uPlot line chart: hydrates
// from the session CSV on mount, then appends a point per incoming snapshot.
export function ChartCard({ log, snap, height = 240 }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const uRef = useRef<uPlot | null>(null);
  const dataRef = useRef<(number | null)[][]>([[]]);
  const refsRef = useRef<string[]>([]);
  const lastTsRef = useRef<number>(0);

  // Rebuild the plot whenever the log identity or its series set changes.
  const seriesKey = log.series.map((s) => s.ref).join(',');
  useEffect(() => {
    let alive = true;
    const el = elRef.current;
    if (!el) return;

    function makeOpts(refs: string[]): uPlot.Options {
      const axisColor = cssVar('--fg', '#888');
      const gridColor = cssVar('--border', 'rgba(128,128,128,0.2)');
      return {
        width: el!.clientWidth || 600,
        height,
        series: [
          {},
          ...refs.map((ref, i) => ({
            label: ref,
            stroke: PALETTE[i % PALETTE.length],
            width: 1.5,
            spanGaps: false,
          })),
        ],
        axes: [
          { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
          { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
        ],
      };
    }

    getLogData(log.id).then((d) => {
      if (!alive || !el) return;
      // Fall back to the config's series when the server has no data yet.
      const refs = d.refs.length ? d.refs : log.series.map((s) => s.ref);
      const data = d.refs.length ? d.data : [[], ...refs.map(() => [])];
      refsRef.current = refs;
      dataRef.current = data;
      const xs = data[0];
      lastTsRef.current = xs.length ? (xs[xs.length - 1] as number) : 0;
      uRef.current?.destroy();
      uRef.current = new uPlot(makeOpts(refs), data as uPlot.AlignedData, el);
    }).catch(() => {});

    const onResize = () => {
      if (uRef.current && el) uRef.current.setSize({ width: el.clientWidth || 600, height });
    };
    window.addEventListener('resize', onResize);
    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      uRef.current?.destroy();
      uRef.current = null;
    };
  }, [log.id, seriesKey, height]);

  // Append a live point per snapshot (server timestamp drives the x value).
  useEffect(() => {
    if (!snap || !snap.serverTime || !uRef.current) return;
    const ts = snap.serverTime;
    if (ts <= lastTsRef.current) return;  // monotonic / dedupe
    lastTsRef.current = ts;
    const refs = refsRef.current;
    const data = dataRef.current;
    data[0].push(ts);
    refs.forEach((ref, i) => data[i + 1].push(resolveRef(snap, ref)));
    uRef.current.setData(data as uPlot.AlignedData);
  }, [snap]);

  return <div ref={elRef} class="w-full" />;
}
