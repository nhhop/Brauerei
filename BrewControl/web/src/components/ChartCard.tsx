import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Snapshot, LogConfig, TimeSettings } from '../types';
import { getLogData, resolveRef } from '../api';
import { formatTime, formatDateTime, loadTimeSettings } from '../time';

// Distinct line colors, reused cyclically across series.
const PALETTE = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
];

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Cursor x in data units (seconds), or null when the cursor is off the plot.
function cursorX(u: uPlot): number | null {
  const left = u.cursor.left;
  return left != null && left >= 0 ? u.posToVal(left, 'x') : null;
}

// Linearly-interpolated value of series `si` at x=`cx` — the reconstructed
// signal between stored points (both compression algos rebuild linearly).
// Returns null across gaps (null endpoint) or outside the data range.
function interpAt(u: uPlot, si: number, cx: number): number | null {
  const xs = u.data[0] as number[];
  const ys = u.data[si] as (number | null)[];
  const n = xs.length;
  if (n === 0 || cx < xs[0] || cx > xs[n - 1]) return null;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= cx) lo = mid; else hi = mid;
  }
  const y0 = ys[lo], y1 = ys[hi];
  if (y0 == null || y1 == null) return null;
  const x0 = xs[lo], x1 = xs[hi];
  return x1 === x0 ? y1 : y0 + (y1 - y0) * ((cx - x0) / (x1 - x0));
}

function fmtNum(v: number | null): string {
  return v == null ? '--' : String(Math.round(v * 1000) / 1000);
}

interface Props {
  log: LogConfig;
  snap: Snapshot | null;
  height?: number;
  fill?: boolean;   // stretch to the parent's rendered height instead of a fixed `height`
  session?: number;   // when set, render that archived session read-only (no live)
}

// Renders one log session as a uPlot line chart. Without `session` it shows the
// current session live (hydrate from CSV, then append a point per snapshot);
// with `session` it shows that archived session read-only.
export function ChartCard({ log, snap, height = 240, fill, session }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const uRef = useRef<uPlot | null>(null);
  const dataRef = useRef<(number | null)[][]>([[]]);
  const refsRef = useRef<string[]>([]);
  const lastTsRef = useRef<number>(0);
  const enabledRef = useRef<boolean>(log.enabled);
  // In fill mode the actual height comes from the parent's flex layout, read
  // via ResizeObserver — kept in a ref (not state) so a resize just calls
  // uPlot's setSize instead of re-running the data-fetching effect below.
  const heightRef = useRef(height);

  // Rebuild the plot whenever the log identity or its series set changes.
  const seriesKey = log.series.map((s) => s.ref).join(',');
  useEffect(() => {
    let alive = true;
    const el = elRef.current;
    if (!el) return;
    heightRef.current = fill ? (el.clientHeight || height) : height;

    // uPlot's `height` option only covers the plot/axes; the legend table
    // below it adds its own rendered height on top. In fill mode `el` has a
    // fixed CSS height, so that legend row must be subtracted from it —
    // otherwise it overflows past the card's bottom edge.
    function fillHeight(): number {
      const legendH = el!.querySelector('.u-legend')?.getBoundingClientRect().height ?? 0;
      return Math.max(Math.round(el!.clientHeight - legendH), 0);
    }

    function makeOpts(refs: string[], tset: TimeSettings): uPlot.Options {
      const axisColor = cssVar('--fg', '#888');
      const gridColor = cssVar('--border', 'rgba(128,128,128,0.2)');
      return {
        width: el!.clientWidth || 600,
        height: heightRef.current,
        series: [
          // Legend "Time" shows the full date+time (with seconds) at the cursor.
          { value: (u) => { const cx = cursorX(u); return cx == null ? '--' : formatDateTime(Math.round(cx), tset); } },
          ...refs.map((ref, i) => ({
            label: ref,
            stroke: PALETTE[i % PALETTE.length],
            width: 1.5,
            spanGaps: false,
            // Legend shows the interpolated value at the cursor, not the nearest point.
            value: (u: uPlot, _v: number | null, si: number) => {
              const cx = cursorX(u);
              return cx == null ? '--' : fmtNum(interpAt(u, si, cx));
            },
          })),
        ],
        axes: [
          {
            stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor },
            // Use the configured time format (with seconds) instead of uPlot's default.
            values: (_u, splits) => splits.map((t) => formatTime(t, tset)),
          },
          { stroke: axisColor, grid: { stroke: gridColor }, ticks: { stroke: gridColor } },
        ],
      };
    }

    Promise.all([getLogData(log.id, session), loadTimeSettings()]).then(([d, tset]) => {
      if (!alive || !el) return;
      // Fall back to the config's series when the server has no data yet.
      const refs = d.refs.length ? d.refs : log.series.map((s) => s.ref);
      const data = d.refs.length ? d.data : [[], ...refs.map(() => [])];
      refsRef.current = refs;
      dataRef.current = data;
      const xs = data[0];
      lastTsRef.current = xs.length ? (xs[xs.length - 1] as number) : 0;
      uRef.current?.destroy();
      uRef.current = new uPlot(makeOpts(refs, tset), data as uPlot.AlignedData, el);
      // The legend didn't exist yet for the estimate above (used as the
      // initial `height`) — now that uPlot has rendered it, correct once.
      if (fill) onResize();
    }).catch(() => {});

    const onResize = () => {
      if (!uRef.current || !el) return;
      if (fill) heightRef.current = fillHeight();
      uRef.current.setSize({ width: el.clientWidth || 600, height: heightRef.current });
    };
    window.addEventListener('resize', onResize);

    // Fill mode: the flex parent (not window resize) drives the height.
    let ro: ResizeObserver | undefined;
    if (fill) {
      ro = new ResizeObserver(() => onResize());
      ro.observe(el);
    }

    return () => {
      alive = false;
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
      uRef.current?.destroy();
      uRef.current = null;
    };
  }, [log.id, seriesKey, height, fill, session]);

  // Append a live point per snapshot (server timestamp drives the x value).
  // Skipped for archived sessions, which are read-only.
  useEffect(() => {
    if (session) return;
    if (!snap || !snap.serverTime || !uRef.current) return;
    const ts = snap.serverTime;
    if (ts <= lastTsRef.current) return;  // monotonic / dedupe
    const refs = refsRef.current;
    const data = dataRef.current;
    const wasEnabled = enabledRef.current;
    enabledRef.current = log.enabled;
    if (!log.enabled) {
      // While logging is off, stop extending the line. On the on→off transition
      // push one gap (null) so the line breaks instead of spanning the pause.
      if (wasEnabled) {
        lastTsRef.current = ts;
        data[0].push(ts);
        refs.forEach((_ref, i) => data[i + 1].push(null));
        uRef.current.setData(data as uPlot.AlignedData);
      }
      return;
    }
    lastTsRef.current = ts;
    data[0].push(ts);
    refs.forEach((ref, i) => data[i + 1].push(resolveRef(snap, ref)));
    uRef.current.setData(data as uPlot.AlignedData);
  }, [snap]);

  return <div ref={elRef} class={fill ? 'h-full w-full' : 'w-full'} />;
}
