import { useEffect, useRef, useState } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getLogData, getLogSessions, getLogs, resolveRef, type LogData } from '../../api';
import { heatingOf, type Brewhouse } from '../../brewhouse';
import { setPhaseStart, type Brew } from '../../brews';
import type { MashRow } from '../../mashPlan';
import { formatTime, loadTimeSettings } from '../../time';
import type { Actuator, LogConfig, LogSession, Snapshot } from '../../types';
import { outputPct } from '../../components/ControllerCard';
import { btnPrimary, inp } from '../../ui';
import { Card, Field } from '../recipe/fields';
import { curveOf } from '../recipe/MashCurve';
import { toLocalInput } from './format';
import type { Patch } from './PrepTab';

// The log is shown from a little before the plan to a little after it.
const LEAD_SEC = 15 * 60;
const TAIL_SEC = 30 * 60;
const LIVE_STEP_SEC = 5;

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// The plan's mash line (curveOf) on the clock, in epoch seconds: the first
// mashing in lies on `mashedInAt` (epoch ms), heating the strike water before
// it. A jump gets a second of its own, so each x is there once.
export function sollCourse(rows: MashRow[], mashedInAt: number): {
  xs: number[]; ys: (number | null)[]; fromSec: number; toSec: number;
} {
  const { xs, ys } = curveOf(rows);
  const anchorMin = rows.find((r) => r.step.kind === 'doughIn')?.startMin ?? 0;
  const t0 = Math.round(mashedInAt / 1000);
  const out: number[] = [];
  for (const x of xs) {
    const s = t0 + Math.round((x - anchorMin) * 60);
    out.push(out.length > 0 && s <= out[out.length - 1] ? out[out.length - 1] + 1 : s);
  }
  return { xs: out, ys, fromSec: out[0], toSec: out[out.length - 1] };
}

// Fills the gaps between two values of `ys` along the line between them, so the
// plan has a value at every time the log has one (the legend reads it there).
export function fillLinear(xs: number[], ys: (number | null | undefined)[]): (number | null | undefined)[] {
  const out = [...ys];
  let last = -1;
  ys.forEach((y, i) => {
    if (y == null) return;
    for (let j = last + 1; last >= 0 && j < i; j++) {
      out[j] = ys[last]! + ((y - ys[last]!) * (xs[j] - xs[last])) / (xs[i] - xs[last]);
    }
    last = i;
  });
  return out;
}

// The first log that records the sensor.
export function pickLog(logs: LogConfig[], sensorId: string | undefined): LogConfig | undefined {
  return sensorId ? logs.find((l) => l.series.some((s) => s.ref === `sensor/${sensorId}`)) : undefined;
}

// The session that holds a course ending at `toSec`: the latest one begun before.
export function sessionFor(sessions: LogSession[], toSec: number): LogSession | undefined {
  return [...sessions].sort((a, b) => b.start - a.start).find((s) => s.start <= toSec);
}

// The log's rows from `fromSec` to `toSec` as [time, temperature, heating in %].
// A column the log does not have stays empty.
export function istCourse(
  d: LogData, tempRef: string | undefined, heatRef: string | undefined, pct: (v: number) => number | null,
  fromSec: number, toSec: number,
): [number[], (number | null)[], (number | null)[]] {
  const col = (ref: string | undefined) => (ref && d.refs.includes(ref) ? d.data[d.refs.indexOf(ref) + 1] : undefined);
  const temps = col(tempRef);
  const heats = col(heatRef);
  const out: [number[], (number | null)[], (number | null)[]] = [[], [], []];
  (d.data[0] ?? []).forEach((ts, i) => {
    if (ts === null || ts < fromSec || ts > toSec) return;
    const h = heats?.[i];
    out[0].push(ts);
    out[1].push(temps?.[i] ?? null);
    out[2].push(h == null ? null : pct(h));
  });
  return out;
}

// The actuator that heats the mash: the one its heater's controller drives,
// else the heater's own.
export function heatActuatorOf(bh: Brewhouse, snap: Snapshot | null): Actuator | undefined {
  const heater = heatingOf(bh, 'mash').heater;
  if (!heater || heater.manual || !snap) return undefined;
  const params = snap.controllers.find((c) => c.id === heater.controller)?.params;
  const id = params?.actuator ?? params?.heatActuator ?? heater.actuator;
  return snap.actuators.find((a) => a.id === id);
}

const alpha = (hex: string, a: number) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})` : hex;
};

const fmt = (v: number | null, unit: string) => (v == null ? '–' : `${v.toFixed(1).replace('.', ',')} ${unit}`);

// Soll from the plan, Ist from the log's session, then a point per live
// snapshot while the brew runs.
function CourseChart({ rows, at, logId, sensorId, heat, snap, live }: {
  rows: MashRow[];
  at: number;                  // mashed in, epoch ms
  logId: string | undefined;
  sensorId: string | undefined;
  heat: Actuator | undefined;
  snap: Snapshot | null;
  live: boolean;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const uRef = useRef<uPlot | null>(null);
  const istRef = useRef<[number[], (number | null)[], (number | null)[]]>([[], [], []]);
  const [empty, setEmpty] = useState(false);
  const heatRef = useRef(heat);
  heatRef.current = heat;
  const soll = sollCourse(rows, at);
  const sollKey = JSON.stringify([soll.xs, soll.ys]);
  const fromSec = soll.fromSec - LEAD_SEC;
  const toSec = soll.toSec + TAIL_SEC;
  const heatId = heat?.id;

  const joined = () => {
    const d = uPlot.join(
      [[soll.xs, soll.ys], heatId ? istRef.current : [istRef.current[0], istRef.current[1]]] as uPlot.AlignedData[],
      [[0, 0], [0, 1, 1]],
    );
    d[1] = fillLinear(d[0] as number[], d[1] as (number | null | undefined)[]);
    return d;
  };

  useEffect(() => {
    let alive = true;
    const el = elRef.current;
    if (!el) return;
    const pct = (v: number) => (heatRef.current ? outputPct({ ...heatRef.current, state: { ...heatRef.current.state, v } }) : null);
    const data = !logId ? Promise.resolve<LogData>({ refs: [], data: [[]] })
      : getLogSessions(logId).catch(() => [] as LogSession[]).then((sessions) => {
        const s = sessionFor(sessions, toSec);
        if (sessions.length > 0 && !s) return { refs: [], data: [[]] };
        return getLogData(logId, s && !s.active ? s.start : undefined);
      });
    Promise.all([data.catch(() => ({ refs: [], data: [[]] }) as LogData), loadTimeSettings()]).then(([d, tset]) => {
      if (!alive) return;
      istRef.current = istCourse(d, sensorId && `sensor/${sensorId}`, heatId && `actuator/${heatId}`, pct, fromSec, toSec);
      setEmpty(!!logId && istRef.current[0].length === 0);
      const fg = cssVar('--fg', '#888');
      const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
      const heatColor = cssVar('--series-2', '#eb6834');
      const temp = (color: string): uPlot.Series => ({
        stroke: color, width: 2, points: { show: false }, value: (_u, v) => fmt(v, '°C'),
      });
      uRef.current?.destroy();
      uRef.current = new uPlot({
        width: el.clientWidth || 600,
        height: 260,
        scales: { pct: { range: [0, 100] } },
        series: [
          { label: 'Zeit', value: (_u, v) => (v == null ? '–' : formatTime(v, tset)) },
          { ...temp(cssVar('--series-3', '#1baf7a')), label: 'Soll', dash: [6, 4] },
          { ...temp(cssVar('--series-1', '#2a78d6')), label: 'Ist' },
          ...(heatId ? [{
            label: 'Heizleistung', scale: 'pct', stroke: heatColor, fill: alpha(heatColor, 0.2), width: 1,
            points: { show: false }, value: (_u: uPlot, v: number | null) => fmt(v, '%'),
          }] : []),
        ],
        axes: [
          { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((t) => formatTime(t, tset)) },
          { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid }, values: (_u, splits) => splits.map((v) => `${v} °C`), size: 56 },
          ...(heatId ? [{
            scale: 'pct', side: 1 as const, stroke: fg, grid: { show: false }, ticks: { stroke: grid },
            values: (_u: uPlot, splits: number[]) => splits.map((v) => `${v} %`), size: 52,
          }] : []),
        ],
      }, joined(), el);
    });
    const ro = new ResizeObserver(() => uRef.current?.setSize({ width: el.clientWidth || 600, height: 260 }));
    ro.observe(el);
    return () => {
      alive = false;
      ro.disconnect();
      uRef.current?.destroy();
      uRef.current = null;
    };
  }, [sollKey, logId, sensorId, heatId]);

  // Live points from the snapshots (the server's time is their x), up to the window's end.
  useEffect(() => {
    const u = uRef.current;
    const ts = snap?.serverTime;
    const ist = istRef.current;
    if (!live || !u || !snap || !ts || !sensorId || ts < fromSec || ts > toSec) return;
    if (ist[0].length > 0 && ts < ist[0][ist[0].length - 1] + LIVE_STEP_SEC) return;
    ist[0].push(ts);
    ist[1].push(resolveRef(snap, `sensor/${sensorId}`));
    ist[2].push(outputPct(heat));
    setEmpty(false);
    u.setData(joined());
  }, [snap]);

  return (
    <>
      <div ref={elRef} class="w-full" />
      {empty && <p class="mt-2 text-xs text-muted">Das Log hat für diesen Zeitraum keine Werte.</p>}
    </>
  );
}

// Card "Verlauf": the mash plan against the temperature a device log recorded,
// with the heating power. The plan is laid on the clock by when the grain went
// in (phaseStartedAt.mash): "Eingemaischt", or `suggestedAt` from the mash
// program (epoch ms) while that time is not set.
export function MashCourse({ brew, rows, bh, snap, editable, patch, suggestedAt }: {
  brew: Brew;
  rows: MashRow[];
  bh: Brewhouse;
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
  suggestedAt?: number;
}) {
  const [logs, setLogs] = useState<LogConfig[] | null>(null);
  useEffect(() => {
    let alive = true;
    getLogs().then((l) => alive && setLogs(l)).catch(() => alive && setLogs([]));
    return () => { alive = false; };
  }, []);

  const sensorId = bh.measurements.mashTemp;
  const log = logs?.find((l) => l.id === brew.logId) ?? pickLog(logs ?? [], sensorId);
  const heat = heatActuatorOf(bh, snap);
  const has = (ref: string) => !!log?.series.some((s) => s.ref === ref);
  const at = brew.phaseStartedAt?.mash;
  // The time field saves when it is left; an emptied one takes the anchor away.
  const [time, setTime] = useState('');
  useEffect(() => setTime(at === undefined ? '' : toLocalInput(at)), [at]);

  const hint = !sensorId ? 'Im Sudhaus ist die Maischetemperatur mit keinem Fühler verknüpft; der Verlauf zeigt nur den Maischeplan.'
    : logs === null ? undefined
    : !log ? 'Kein Log zeichnet den Maischefühler auf. Lege im Dashboard ein Diagramm mit dem Fühler und dem Aktor der Heizung an.'
    : !has(`sensor/${sensorId}`) ? `Das Log „${log.name}“ zeichnet den Maischefühler nicht auf.`
    : heat && !has(`actuator/${heat.id}`) ? `Das Log zeichnet den Aktor „${heat.label ?? heat.id}“ nicht auf; die Heizleistung kommt nur bei offener Seite dazu.`
    : undefined;

  const select = logs && logs.length > 0 && (
    <select class={`${inp} max-w-[12rem] text-xs`} aria-label="Log" value={log?.id ?? ''} disabled={!editable}
      onChange={(e) => { const logId = e.currentTarget.value; return patch((b) => ({ ...b, logId })); }}>
      {!log && <option value="">Log wählen</option>}
      {logs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );

  const mashedIn = (ms: number | undefined) => patch((b) => ({
    ...setPhaseStart(b, 'mash', ms), ...(!b.logId && log && { logId: log.id }),
  }));
  // The mash program's time is taken once per program, so a time the brewer
  // took away again stays away.
  const taken = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (at !== undefined || suggestedAt === undefined || !editable || logs === null || taken.current === brew.mashProgramId) return;
    taken.current = brew.mashProgramId;
    void mashedIn(suggestedAt);
  }, [at, suggestedAt, logs]);

  return (
    <Card title="Verlauf" action={select}>
      {at === undefined ? (
        <>
          <p class="mb-2 text-sm text-muted">
            Mit „Eingemaischt“ liegt der Maischeplan auf der Uhr und das Diagramm vergleicht ihn mit dem Gerätelog.
          </p>
          <button type="button" class={btnPrimary} disabled={!editable} onClick={() => mashedIn(Date.now())}>Eingemaischt</button>
        </>
      ) : (
        <>
          <CourseChart rows={rows} at={at} logId={log?.id} sensorId={sensorId} heat={heat} snap={snap} live={brew.status === 'active'} />
          <div class="mt-2 max-w-[14rem]">
            <Field label="Eingemaischt um">
              <input type="datetime-local" class={`${inp} w-full`} value={time} disabled={!editable}
                onInput={(e) => setTime(e.currentTarget.value)}
                onBlur={(e) => {
                  const value = e.currentTarget.value;
                  const t = Date.parse(value);
                  if (value !== toLocalInput(at)) void mashedIn(Number.isNaN(t) ? undefined : t);
                }} />
            </Field>
          </div>
        </>
      )}
      {hint && <p class="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
