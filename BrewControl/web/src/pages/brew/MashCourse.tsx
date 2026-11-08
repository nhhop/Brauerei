import { useEffect, useRef, useState } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { createLog, getLogs, resolveRef, type LogData } from '../../api';
import { heatingOf, type Brewhouse } from '../../brewhouse';
import { setPhaseStart, type Brew } from '../../brews';
import { brewLogConfig, loadLogWindow } from '../../logWindow';
import type { MashRow } from '../../mashPlan';
import { formatTime, loadTimeSettings } from '../../time';
import type { Actuator, LogConfig, Snapshot } from '../../types';
import { outputPct } from '../../components/ControllerCard';
import { btnPrimary, btnSecondary, inp } from '../../ui';
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

// How far from the rest's temperature the mash still counts as resting.
export const REST_BAND_K = 1;

export interface RestActual {
  row: MashRow;
  meanC: number | null;     // mean of the log over the rest
  durationMin: number | null;
}

// The rests of the plan (rows that hold) as the log saw them. A rest begins
// with the first value within ±REST_BAND_K of its temperature, searched from
// the end of the rest before (as seen, else as planned; the first one from
// mashing in, so heating the strike water does not count), and ends with the
// last value in the band before the mash reaches the next rest's band
// (outside its own) or the next rest's planned end passes; the last rest runs
// to the end of the log. A rest the mash never reached stays empty.
export function restActuals(rows: MashRow[], mashedInAt: number, xs: number[], temps: (number | null)[]): RestActual[] {
  const doughIn = Math.max(rows.findIndex((r) => r.step.kind === 'doughIn'), 0);
  const anchorMin = rows[doughIn]?.startMin ?? 0;
  const clock = (min: number) => Math.round(mashedInAt / 1000) + Math.round((min - anchorMin) * 60);
  const rests = rows.filter((r, i) => i >= doughIn && r.holdMin > 0);
  const inBand = (v: number | null, c: number) => v !== null && Math.abs(v - c) <= REST_BAND_K;
  let searchFrom = clock(anchorMin);
  return rests.map((row, n) => {
    const next = rests[n + 1];
    const plannedEnd = clock(row.startMin + row.holdMin);
    const stopAt = next ? clock(next.startMin + next.holdMin) : Infinity;
    const first = xs.findIndex((x, i) => x >= searchFrom && x <= stopAt && inBand(temps[i], row.tempC));
    if (first < 0) {
      searchFrom = Math.max(searchFrom, plannedEnd);
      return { row, meanC: null, durationMin: null };
    }
    let last = first;
    for (let i = first + 1; i < xs.length && xs[i] <= stopAt; i++) {
      if (inBand(temps[i], row.tempC)) last = i;
      else if (next && inBand(temps[i], next.tempC)) break;
    }
    const vals = temps.slice(first, last + 1).filter((v): v is number => v !== null);
    searchFrom = xs[last];
    return {
      row,
      meanC: vals.reduce((a, b) => a + b, 0) / vals.length,
      durationMin: (xs[last] - xs[first]) / 60,
    };
  });
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
  const [istVersion, setIstVersion] = useState(0);  // the rest table reads istRef again
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
    const data = !logId ? Promise.resolve<LogData>({ refs: [], data: [[]] }) : loadLogWindow(logId, fromSec, toSec);
    Promise.all([data.catch(() => ({ refs: [], data: [[]] }) as LogData), loadTimeSettings()]).then(([d, tset]) => {
      if (!alive) return;
      istRef.current = istCourse(d, sensorId && `sensor/${sensorId}`, heatId && `actuator/${heatId}`, pct, fromSec, toSec);
      setEmpty(!!logId && istRef.current[0].length === 0);
      setIstVersion((v) => v + 1);
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
    setIstVersion((v) => v + 1);
    u.setData(joined());
  }, [snap]);

  const rests = istVersion > 0 && istRef.current[1].some((v) => v !== null)
    ? restActuals(rows, at, istRef.current[0], istRef.current[1]) : [];

  return (
    <>
      <div ref={elRef} class="w-full" />
      {empty && <p class="mt-2 text-xs text-muted">Das Log hat für diesen Zeitraum keine Werte.</p>}
      {rests.length > 0 && <RestTable rests={rests} />}
    </>
  );
}

const th = 'whitespace-nowrap px-2 py-1.5 text-right font-semibold';
const td = 'whitespace-nowrap px-2 py-1.5 text-right tabular-nums';

// Table "Maischeplan": each rest as planned and as the log saw it.
function RestTable({ rests }: { rests: RestActual[] }) {
  return (
    <div class="mt-3 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="border-b border-card-border text-xs text-muted">
          <tr>
            <th class="px-2 py-1.5 text-left font-semibold">Rast</th>
            <th class={th}>Soll</th>
            <th class={th}>Soll-Dauer</th>
            <th class={th}>Ist-Mittel</th>
            <th class={th}>Ist-Dauer</th>
          </tr>
        </thead>
        <tbody>
          {rests.map((r, i) => (
            <tr key={i} class="border-b border-card-border last:border-0">
              <td class="px-2 py-1.5">{r.row.step.name || '–'}</td>
              <td class={td}>{fmt(r.row.tempC, '°C')}</td>
              <td class={td}>{Math.round(r.row.holdMin)} min</td>
              <td class={td}>{fmt(r.meanC, '°C')}</td>
              <td class={td}>{r.durationMin == null ? '–' : `${Math.round(r.durationMin)} min`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="mt-1 text-xs text-muted">Ist: solange die Maische höchstens {REST_BAND_K} K von der Rasttemperatur abweicht.</p>
    </div>
  );
}

// "Log anlegen" under the hint that no log records the probe.
export function LogButton({ busy, disabled, error, what, onClick }: {
  busy: boolean; disabled: boolean; error: string; what: string; onClick: () => void;
}) {
  return (
    <div class="mt-2">
      <button type="button" class={btnSecondary} disabled={disabled || busy} onClick={onClick}>Log anlegen</button>
      <p class="mt-1 text-xs text-muted">{what}</p>
      {error && <p class="mt-1 text-xs text-critical">{error}</p>}
    </div>
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
  const heater = heatingOf(bh, 'mash').heater;
  const heatController = heater && !heater.manual ? heater.controller : undefined;
  const has =(ref: string) => !!log?.series.some((s) => s.ref === ref);
  const at = brew.phaseStartedAt?.mash;
  // The time field saves when it is left; an emptied one takes the anchor away.
  const [time, setTime] = useState('');
  useEffect(() => setTime(at === undefined ? '' : toLocalInput(at)), [at]);

  const hint = !sensorId ? 'Im Sudhaus ist die Maischetemperatur mit keinem Fühler verknüpft; der Verlauf zeigt nur den Maischeplan.'
    : logs === null ? undefined
    : !log ? 'Kein Log zeichnet den Maischefühler auf.'
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

  // One log per brewhouse, so the next brew finds it again.
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const addLog = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const cfg = brewLogConfig({
        name: `Sudhaus ${bh.name}`, intervalSec: 10, sensors: [sensorId], others: [heat && `actuator/${heat.id}`],
        controller: heatController,
      });
      const id = await createLog(cfg);
      setLogs((l) => [...(l ?? []), { id, ...cfg }]);
      await patch((b) => ({ ...b, logId: id }));
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

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
      {sensorId && logs !== null && !log && (
        <LogButton busy={creating} disabled={!editable} error={createError} onClick={() => void addLog()}
          what={`„Sudhaus ${bh.name}“ zeichnet den Maischefühler${heat ? ' und die Heizleistung' : ''} alle 10 s auf${heatController ? ', solange der Regler an ist' : ''}.`} />
      )}
    </Card>
  );
}
