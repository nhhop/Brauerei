import { useEffect, useRef } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Snapshot, LogConfig, TimeSettings } from '../types';
import { getLogData, getSnapshot, resolveRef } from '../api';
import { unitOf } from '../refs';
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
  legendHost?: HTMLElement | null;   // when set, move uPlot's legend into this element (e.g. the card's title row)
}

// Renders one log session as a uPlot line chart. Without `session` it shows the
// current session live (hydrate from CSV, then append a point per snapshot);
// with `session` it shows that archived session read-only.
export function ChartCard({ log, snap, height = 240, fill, session, legendHost }: Props) {
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
  // Latest snapshot for the build effect, which must not re-run on every snapshot.
  const snapRef = useRef(snap);
  snapRef.current = snap;

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

    function makeOpts(refs: string[], tset: TimeSettings, units: string[]): uPlot.Options {
      const axisColor = cssVar('--fg', '#888');
      const gridColor = cssVar('--border', 'rgba(128,128,128,0.2)');
      // One y-scale per unit, so series of very different magnitude each get
      // their own range. Unitless series can't be grouped safely (a 0/1 relay
      // vs. a 0–255 PWM) and get a scale of their own. First scale sits left,
      // the rest on the right.
      const scaleKeys = refs.map((ref, i) => units[i] || ref);
      const groups = [...new Set(scaleKeys)];
      const yAxes = groups.map((key, gi) => {
        const members = scaleKeys.flatMap((k, i) => (k === key ? [i] : []));
        return {
          unit: units[members[0]],
          axis: {
            scale: key,
            side: gi === 0 ? 3 : 1,
            // A single-series axis takes that line's color, so it's clear which scale it reads.
            stroke: members.length === 1 ? PALETTE[members[0] % PALETTE.length] : axisColor,
            // Only the left axis draws grid lines; several misaligned grids would just be noise.
            grid: { show: gi === 0, stroke: gridColor },
            ticks: { stroke: gridColor },
          } satisfies uPlot.Axis,
        };
      });
      return {
        width: el!.clientWidth || 600,
        height: heightRef.current,
        series: [
          // Legend "Time" shows the full date+time (with seconds) at the cursor.
          { value: (u) => { const cx = cursorX(u); return cx == null ? '--' : formatDateTime(Math.round(cx), tset); } },
          ...refs.map((ref, i) => ({
            label: ref,
            scale: scaleKeys[i],
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
          ...yAxes.map((y) => y.axis),
        ],
        hooks: {
          // Unit as a horizontal caption below each y-axis (in the x-axis row)
          // instead of uPlot's rotated `label`. uPlot renders one .u-axis div
          // per axis in option order (x first) and keeps it positioned on resize.
          ready: [(u) => {
            const axisEls = u.root.querySelectorAll<HTMLElement>('.u-axis');
            yAxes.forEach((y, gi) => {
              const host = axisEls[gi + 1];
              if (!y.unit || !host) return;
              const cap = document.createElement('div');
              cap.textContent = y.unit;
              cap.style.cssText = `position:absolute;top:100%;left:0;right:0;padding-top:11px;text-align:center;font-size:12px;line-height:1;color:${y.axis.stroke}`;
              host.appendChild(cap);
            });
          }],
        },
      };
    }

    // Units come from the snapshot; the archive (and the logs page before the
    // first SSE event) has none, so fetch one. Units are fixed per build.
    const snapP = snapRef.current ? Promise.resolve(snapRef.current) : getSnapshot().catch(() => null);
    Promise.all([getLogData(log.id, session), loadTimeSettings(), snapP]).then(([d, tset, unitSnap]) => {
      if (!alive || !el) return;
      // Fall back to the config's series when the server has no data yet.
      const refs = d.refs.length ? d.refs : log.series.map((s) => s.ref);
      const data = d.refs.length ? d.data : [[], ...refs.map(() => [])];
      refsRef.current = refs;
      dataRef.current = data;
      const xs = data[0];
      lastTsRef.current = xs.length ? (xs[xs.length - 1] as number) : 0;
      uRef.current?.destroy();
      const units = refs.map((ref) => unitOf(unitSnap, ref));
      uRef.current = new uPlot(makeOpts(refs, tset, units), data as uPlot.AlignedData, el);
      // Move the legend out of the plot into the caller-supplied slot (e.g. the
      // card's title row) so it no longer takes vertical space below the chart.
      if (legendHost) {
        const legend = uRef.current.root.querySelector('.u-legend');
        if (legend) legendHost.appendChild(legend);
      }
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
      // uPlot.destroy() only removes its own root — the legend was reparented
      // out of it above, so it must be cleared separately here.
      legendHost?.replaceChildren();
      uRef.current?.destroy();
      uRef.current = null;
    };
  }, [log.id, seriesKey, height, fill, session, legendHost]);

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
