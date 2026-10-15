import { useEffect, useRef, useState } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getLogData, getLogSessions, getLogs, type LogData } from '../../api';
import type { BrewReadings } from '../../brewReadings';
import type { Brew } from '../../brews';
import type { Fermenter } from '../../cellar';
import {
  DAY_SEC, handCols, logCols, logRows, LONG_LOG_ROWS, platoOf, sollCol, type Col,
} from '../../fermentCourse';
import type { Phase } from '../../recipes';
import { unitOf } from '../../refs';
import type { LogConfig, Snapshot } from '../../types';
import { Card } from '../recipe/fields';
import { inp } from '../../ui';
import { pickLog, sessionFor } from './MashCourse';
import type { Patch } from './PrepTab';

// The log is read from a little before the pitching to two days after the plan.
const LEAD_SEC = 3600;
const TAIL_DAYS = 2;

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

const fmt = (v: number | null, unit: string) => (v == null ? '–' : `${v.toFixed(1).replace('.', ',')} ${unit}`);

// uPlot's line for a column.
function seriesOf(c: Col): uPlot.Series {
  const unit = c.scale === 'plato' ? '°P' : '°C';
  const color = { soll: cssVar('--series-3', '#1baf7a'), temp: cssVar('--series-1', '#2a78d6'), setpoint: cssVar('--series-2', '#eb6834'),
    density: cssVar('--series-4', '#eda100'), 'hand-gravity': cssVar('--series-4', '#eda100'), 'hand-temp': cssVar('--series-1', '#2a78d6') }[c.key] ?? '#888';
  const base = { label: c.label, scale: c.scale, stroke: color, value: (_u: uPlot, v: number | null) => fmt(v, unit) };
  if (c.style === 'dots') return { ...base, width: 0, paths: () => null, points: { show: true, size: 9, fill: color } };
  return {
    ...base, spanGaps: true, points: { show: false },
    width: c.style === 'thin' ? 1 : 2, ...(c.style === 'soll' && { dash: [6, 4] }),
  };
}

// The plan, the log's Ist values and the hand readings over days after pitching;
// °C on the left, °P on the right.
function CourseChart({ soll, ist, hand }: { soll: Col | null; ist: Col[]; hand: Col[] }) {
  const elRef = useRef<HTMLDivElement>(null);
  const cols = [...(soll ? [soll] : []), ...ist, ...hand];
  const key = JSON.stringify(cols);

  useEffect(() => {
    const el = elRef.current;
    if (!el || cols.length === 0) return;
    const fg = cssVar('--fg', '#888');
    const grid = cssVar('--border', 'rgba(128,128,128,0.2)');
    const axis = { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid } };
    const hasPlato = cols.some((c) => c.scale === 'plato');
    const hasTemp = cols.some((c) => c.scale === 'temp');
    const u = new uPlot({
      width: el.clientWidth || 600,
      height: 260,
      scales: { x: { time: false } },
      series: [{ label: 'Tag', value: (_u, v) => (v == null ? '–' : `Tag ${v.toFixed(1).replace('.', ',')}`) }, ...cols.map(seriesOf)],
      axes: [
        { ...axis, label: 'Tage nach dem Anstellen', values: (_u, splits) => splits.map((v) => String(v).replace('.', ',')) },
        ...(hasTemp ? [{ ...axis, scale: 'temp', size: 56, values: (_u: uPlot, splits: number[]) => splits.map((v) => `${v} °C`) }] : []),
        ...(hasPlato ? [{
          ...axis, scale: 'plato', side: 1 as const, size: 52, grid: { show: false },
          values: (_u: uPlot, splits: number[]) => splits.map((v) => `${v} °P`),
        }] : []),
      ],
    }, uPlot.join(cols.map((c) => [c.xs, c.ys] as uPlot.AlignedData)), el);
    const ro = new ResizeObserver(() => u.setSize({ width: el.clientWidth || 600, height: 260 }));
    ro.observe(el);
    return () => { ro.disconnect(); u.destroy(); };
  }, [key]);

  return <div ref={elRef} class="w-full" />;
}

// Card "Gärverlauf": the plan of the phases (ramps included) against the
// temperature, the controller's setpoint and the density a device log recorded,
// with the readings from the "Messungen" card as dots. The plan lies on the
// clock from the pitching (phaseStartedAt.fermentation). The log is the one
// that records the fermenter's probe, unless the brewer chose another.
export function FermentCourse({ brew, fermenter, phases, snap, editable, patch, readings, og }: {
  brew: Brew;
  fermenter: Fermenter | undefined;
  phases: Phase[];
  snap: Snapshot | null;
  editable: boolean;
  patch: Patch;
  readings: BrewReadings | null;
  og: number | undefined;   // original extract, °P: the gravity of a refractometer reading
}) {
  const [logs, setLogs] = useState<LogConfig[] | null>(null);
  const [data, setData] = useState<LogData | null>(null);
  useEffect(() => {
    let alive = true;
    getLogs().then((l) => alive && setLogs(l)).catch(() => alive && setLogs([]));
    return () => { alive = false; };
  }, []);

  const pitchedAt = brew.phaseStartedAt?.fermentation;
  const sensorId = fermenter?.sensor;
  const log = logs?.find((l) => l.id === brew.fermentLogId) ?? pickLog(logs ?? [], sensorId);
  const has = (ref: string) => !!log?.series.some((s) => s.ref === ref);
  const refs = {
    temp: sensorId && `sensor/${sensorId}`,
    setpoint: fermenter && !fermenter.manual && fermenter.controller ? `controller/${fermenter.controller}` : undefined,
    density: fermenter?.densitySensor && `sensor/${fermenter.densitySensor}`,
  };
  const densityUnit = refs.density ? unitOf(snap, refs.density) : undefined;

  const soll = sollCol(phases);
  const endDay = soll ? soll.xs[soll.xs.length - 1] : 0;
  const pitchedSec = pitchedAt === undefined ? 0 : Math.round(pitchedAt / 1000);
  const planEndSec = pitchedSec + (endDay + TAIL_DAYS) * DAY_SEC;

  // The session that holds the course: the latest one begun before its end.
  const logId = log?.id;
  useEffect(() => {
    setData(null);
    if (!logId || pitchedAt === undefined) return;
    let alive = true;
    getLogSessions(logId).catch(() => []).then((sessions) => {
      const s = sessionFor(sessions, planEndSec);
      if (sessions.length > 0 && !s) return { refs: [], data: [[]] } as LogData;
      return getLogData(logId, s && !s.active ? s.start : undefined);
    }).then((d) => alive && setData(d)).catch(() => alive && setData({ refs: [], data: [[]] }));
    return () => { alive = false; };
  }, [logId, pitchedAt, planEndSec]);

  const hand = readings && pitchedAt !== undefined ? handCols(readings.readings, pitchedAt, og) : [];
  const lastDay = Math.max(endDay, ...hand.flatMap((c) => c.xs));
  const ist = data && pitchedAt !== undefined
    ? logCols(data, refs, densityUnit, pitchedSec, pitchedSec - LEAD_SEC, pitchedSec + (lastDay + TAIL_DAYS) * DAY_SEC) : [];

  const hint = !fermenter ? 'Ohne Gärplatz zeigt der Verlauf nur den Plan und deine Messungen.'
    : !sensorId ? 'Der Gärplatz hat keinen Temperaturfühler; der Verlauf zeigt nur den Plan und deine Messungen.'
    : logs === null ? undefined
    : !log ? 'Kein Log zeichnet den Fühler des Gärplatzes auf. Lege im Dashboard ein Diagramm mit dem Fühler an.'
    : !has(`sensor/${sensorId}`) ? `Das Log „${log.name}“ zeichnet den Fühler des Gärplatzes nicht auf.`
    : refs.setpoint && !has(refs.setpoint) ? `Das Log zeichnet den Regler „${fermenter.controller}“ nicht auf; sein Sollwert fehlt im Verlauf.`
    : refs.density && !has(refs.density) ? `Das Log zeichnet den Dichtesensor „${fermenter.densitySensor}“ nicht auf.`
    : refs.density && snap && !platoOf(densityUnit) ? `Der Dichtesensor misst in „${densityUnit || '?'}“, nicht in °P, SG oder °Bx; seine Dichte fehlt im Verlauf.`
    : undefined;
  const rows = log ? logRows(log.intervalSec, lastDay + TAIL_DAYS + LEAD_SEC / DAY_SEC) : 0;

  const select = logs && logs.length > 0 && (
    <select class={`${inp} max-w-[12rem] text-xs`} aria-label="Log" value={log?.id ?? ''} disabled={!editable}
      onChange={(e) => { const fermentLogId = e.currentTarget.value; return patch((b) => ({ ...b, fermentLogId })); }}>
      {!log && <option value="">Log wählen</option>}
      {logs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );

  return (
    <Card title="Gärverlauf" action={select}>
      {pitchedAt === undefined ? (
        <p class="text-sm text-muted">
          Mit „Angestellt“ liegt der Gärplan auf der Uhr, und das Diagramm vergleicht ihn mit dem Gerätelog und deinen Messungen.
        </p>
      ) : (
        <>
          <CourseChart soll={soll} ist={ist} hand={hand} />
          {logId && data && ist.length === 0 && <p class="mt-2 text-xs text-muted">Das Log hat für diesen Zeitraum keine Werte.</p>}
          {rows > LONG_LOG_ROWS && (
            <p class="mt-2 text-xs text-muted">
              Das Log „{log!.name}“ schreibt alle {log!.intervalSec} s. Für den Verlauf wird die ganze Session geladen, bei Wochen sind das
              etwa {Math.round(rows / 1000)} 000 Zeilen; ein längeres Intervall macht das Laden schneller.
            </p>
          )}
        </>
      )}
      {hint && <p class="mt-2 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
