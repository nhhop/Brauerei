import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CloudDrizzle, Droplet, Fan, Flame, RefreshCw, Snowflake, Waves, type LucideIcon } from 'lucide-preact';
import {
  OUT, STEPS, anchor, heatingOf, heatingText, schemaOf, stepShort, stepsOf, vesselLabel,
  type Brewhouse, type Device, type DeviceKind, type SchemaEdge, type Vessel,
} from '../brewhouse';
import { badgeAccent, badgeCaution } from '../ui';

const ICONS: Record<DeviceKind, LucideIcon> = {
  heater: Flame, pump: RefreshCw, agitator: Fan, valve: Droplet, chiller: Snowflake, condenser: CloudDrizzle, coil: Waves,
};

// Geometry in px. Cards stand in one row (the schema scrolls sideways when the
// window is narrower); edges between neighbours run through the gap, all
// others along lanes: recirculations above the row, transfers below it.
const CARD_W = 208;
const OUT_W = 120;
const GAP = 168;
const PAD = 16;
const LANE = 36;
const SLOT = 56;  // vertical room per edge in a gap

type Lane = { edge: SchemaEdge; side: 'top' | 'bottom'; lane: number; xa: number; xb: number };

// Process overview of a brewhouse. Every part is a button that opens the place
// to edit it (`onJump` with its anchor).
export function BrewhouseSchema({ bh, errorAt, onJump }: {
  bh: Brewhouse; errorAt: Set<string>; onJump: (at: string) => void;
}) {
  const { nodes, edges } = useMemo(() => schemaOf(bh), [bh]);
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setRowH(row.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [nodes.length > 0]);

  if (nodes.length === 0) {
    return <p class="text-sm text-muted">Noch keine Behälter. Lege sie im Tab „Behälter“ an.</p>;
  }

  const index = new Map(nodes.map((n, i) => [n, i]));
  const widths = nodes.map((n) => (n === OUT ? OUT_W : CARD_W));
  const xs: number[] = [];
  widths.reduce((x, w, i) => { xs[i] = x; return x + w + GAP; }, PAD);
  const width = xs[xs.length - 1] + widths[widths.length - 1] + PAD;

  // Neighbours share a gap; the rest gets a lane of its own.
  const gaps = new Map<number, SchemaEdge[]>();
  const laneEdges: { edge: SchemaEdge; side: 'top' | 'bottom' }[] = [];
  for (const e of edges) {
    const a = index.get(e.from)!;
    const b = index.get(e.to)!;
    if (Math.abs(a - b) === 1) {
      const g = Math.min(a, b);
      gaps.set(g, [...(gaps.get(g) ?? []), e]);
    } else {
      laneEdges.push({ edge: e, side: e.kind === 'recirc' ? 'top' : 'bottom' });
    }
  }
  // Attachment points: spread evenly along the card edge they leave from.
  const ends = new Map<string, number>();
  const attach = (node: string, side: string) => {
    const k = `${node}|${side}`;
    ends.set(k, (ends.get(k) ?? 0) + 1);
    return ends.get(k)!;
  };
  const pending = laneEdges.map(({ edge, side }) => ({
    edge, side, a: attach(edge.from, side), b: attach(edge.to, side),
  }));
  const xAt = (node: string, side: string, m: number) => {
    const i = index.get(node)!;
    return Math.round(xs[i] + (widths[i] * m) / (ends.get(`${node}|${side}`)! + 1));
  };
  let topCount = 0;
  let bottomCount = 0;
  const lanes: Lane[] = pending.map(({ edge, side, a, b }) => ({
    edge, side, lane: side === 'top' ? topCount++ : bottomCount++,
    xa: xAt(edge.from, side, a), xb: xAt(edge.to, side, b),
  }));

  const top = PAD + topCount * LANE + (topCount ? 8 : 0);
  const bottom = top + rowH;
  const height = bottom + PAD + bottomCount * LANE + (bottomCount ? 8 : 0);
  const maxInGap = Math.max(1, ...[...gaps.values()].map((g) => g.length));

  return (
    <>
      {/* Bleeds out of the page column to the window edges (cqw of the page's
          @container) and starts PAD left of the column, so the cards line up
          with it and scroll out to the window edge instead of being cut off. */}
      <div class="ml-[calc(50%_-_50cqw)] mr-[calc(50%_-_50cqw)] overflow-x-auto pl-[calc(50cqw_-_50%_-_16px)]">
        {/* flex: keeps the row's margin-top inside (no margin collapsing) */}
        <div class="relative flex flex-col" style={{ width, height: rowH ? height : undefined }}>
          <div ref={rowRef} class="flex items-stretch" style={{ paddingLeft: PAD, gap: GAP, marginTop: top, minHeight: maxInGap * SLOT + 16 }}>
            {nodes.map((n) => (n === OUT
              ? <OutCard key={n} onClick={() => onJump(edges.find((e) => e.to === OUT)!.at)} />
              : <VesselCard key={n} bh={bh} vessel={bh.vessels.find((v) => v.id === n)!} errorAt={errorAt} onJump={onJump} />))}
          </div>

          {rowH > 0 && (
            <>
              <svg class="pointer-events-none absolute left-0 top-0" width={width} height={height} aria-hidden="true">
                <defs>
                  <marker id="bh-head" orient="auto-start-reverse" markerWidth="5" markerHeight="5" refX="3.2" refY="2" overflow="visible">
                    <path d="M0 0 L4 2 L0 4 Z" style={{ fill: 'var(--muted)' }} />
                  </marker>
                  <marker id="bh-head-recirc" orient="auto-start-reverse" markerWidth="5" markerHeight="5" refX="3.2" refY="2" overflow="visible">
                    <path d="M0 0 L4 2 L0 4 Z" style={{ fill: 'var(--accent)' }} />
                  </marker>
                </defs>
                {[...gaps.entries()].flatMap(([g, list]) => list.map((e, k) => {
                  const y = Math.round(top + (rowH * (k + 1)) / (list.length + 1));
                  const x1 = xs[g] + widths[g];
                  const x2 = xs[g + 1];
                  const ltr = index.get(e.from)! < index.get(e.to)!;
                  const d = ltr ? `M ${x1} ${y} L ${x2 - 2} ${y}` : `M ${x2} ${y} L ${x1 + 2} ${y}`;
                  return <EdgePath key={`${g}-${k}`} edge={e} d={d} />;
                }))}
                {lanes.map((l, i) => {
                  const y = l.side === 'top' ? top - 14 - l.lane * LANE : bottom + 14 + l.lane * LANE;
                  const yEdge = l.side === 'top' ? top : bottom;
                  const yEnd = l.side === 'top' ? top - 2 : bottom + 2;
                  return <EdgePath key={`l${i}`} edge={l.edge} d={`M ${l.xa} ${yEdge} L ${l.xa} ${y} L ${l.xb} ${y} L ${l.xb} ${yEnd}`} />;
                })}
              </svg>

              {[...gaps.entries()].flatMap(([g, list]) => list.map((e, k) => {
                const y = Math.round(top + (rowH * (k + 1)) / (list.length + 1));
                return (
                  <EdgeLabel key={`${g}-${k}`} edge={e} onJump={onJump}
                    style={{ left: xs[g] + widths[g] + 8, width: GAP - 16, top: y - 6, transform: 'translateY(-100%)' }} />
                );
              }))}
              {lanes.map((l, i) => {
                const y = l.side === 'top' ? top - 14 - l.lane * LANE : bottom + 14 + l.lane * LANE;
                const mid = (l.xa + l.xb) / 2;
                return (
                  <EdgeLabel key={`l${i}`} edge={l.edge} onJump={onJump} inline
                    style={{ left: mid, top: l.side === 'top' ? y - 4 : y + 4, transform: `translate(-50%, ${l.side === 'top' ? '-100%' : '0'})` }} />
                );
              })}
            </>
          )}
        </div>
      </div>
      <div class="mt-1 flex flex-wrap px-1 gap-x-5 gap-y-2 text-xs text-muted">
        <span class="inline-flex items-center gap-1.5">
          <svg width="28" height="8" aria-hidden="true"><path d="M 1 4 L 27 4" stroke-width="2" style={{ stroke: 'var(--muted)' }} /></svg>Transfer
        </span>
        <span class="inline-flex items-center gap-1.5">
          <svg width="28" height="8" aria-hidden="true"><path d="M 1 4 L 27 4" stroke-width="2" stroke-dasharray="6 6" style={{ stroke: 'var(--accent)' }} /></svg>Umwälzung
        </span>
        <span class="inline-flex items-center gap-1.5"><span class="text-success">●</span>angeschlossen</span>
        <span class="inline-flex items-center gap-1.5"><span>○</span>von Hand</span>
      </div>
    </>
  );
}

function EdgePath({ edge, d }: { edge: SchemaEdge; d: string }) {
  const recirc = edge.kind === 'recirc';
  const head = recirc ? 'url(#bh-head-recirc)' : 'url(#bh-head)';
  return (
    <path d={d} fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray={recirc ? '6 6' : undefined}
      style={{ stroke: recirc ? 'var(--accent)' : 'var(--muted)' }}
      marker-end={head} marker-start={recirc && edge.from !== edge.to ? head : undefined} />
  );
}

function EdgeLabel({ edge, onJump, style, inline }: {
  edge: SchemaEdge; onJump: (at: string) => void; style: Record<string, string | number>; inline?: boolean;
}) {
  return (
    <button type="button" onClick={() => onJump(edge.at)} style={style}
      class={`absolute rounded px-1 text-center text-xs leading-4 hover:bg-fg/10 ${inline ? 'whitespace-nowrap' : ''} ${
        edge.kind === 'recirc' ? 'text-accent' : 'text-fg'}`}>
      {inline ? `${edge.label} · ${edge.detail}` : <>{edge.label}<br /><span class="text-muted">{edge.detail}</span></>}
    </button>
  );
}

function OutCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: OUT_W }}
      class="flex shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-faint bg-card p-2 text-center text-sm hover:bg-subtle-hover">
      <span class="font-semibold">Gärkeller</span>
      <span class="text-xs text-muted">Ausschlagen</span>
    </button>
  );
}

function VesselCard({ bh, vessel: v, errorAt, onJump }: {
  bh: Brewhouse; vessel: Vessel; errorAt: Set<string>; onJump: (at: string) => void;
}) {
  const steps = stepsOf(bh, v.id);
  const label = vesselLabel(bh, v);
  const specs = [
    `${String(v.volumeL).replace('.', ',')} l`,
    `Totraum ${String(v.deadSpaceL).replace('.', ',')} l`,
    steps.includes('boil') && v.evaporationLPerH != null ? `${String(v.evaporationLPerH).replace('.', ',')} l/h` : '',
    steps.includes('lauter') ? v.lauterMethod ?? '' : '',
  ].filter(Boolean).join(' · ');
  // Indirect heating of the steps here, once each.
  const indirect = [...new Set(STEPS.filter((s) => s.heated && steps.includes(s.key))
    .map((s) => heatingOf(bh, s.key)).filter((h) => h.heater && !h.direct).map(heatingText))];
  const devices = bh.devices.filter((d) => d.vesselId === v.id);

  return (
    <div style={{ width: CARD_W }} class={`shrink-0 rounded-lg border bg-card p-3 text-left text-sm shadow-elev-2 ${
      errorAt.has(anchor.vessel(v.id)) ? 'border-critical' : 'border-card-border'}`}>
      <button type="button" onClick={() => onJump(anchor.vessel(v.id))}
        class="block w-full rounded text-left font-semibold hover:underline">
        {v.name || 'Ohne Namen'}
      </button>
      {label && label !== v.name && <span class={`${badgeAccent} mt-1`}>{label}</span>}
      <div class="mt-0.5 text-xs text-muted">{specs}</div>
      {steps.length > 0 && (
        <div class="mt-2 flex flex-wrap gap-1">
          {steps.map((s) => (
            <button key={s} type="button" onClick={() => onJump(anchor.step(s))}
              class="rounded bg-fg/[0.06] px-2 text-xs hover:bg-fg/10">{stepShort(s)}</button>
          ))}
        </div>
      )}
      {indirect.map((t) => <div key={t} class={`${badgeCaution} mt-2`}>{t}</div>)}
      {devices.length > 0 && (
        <ul class="mt-2 space-y-1">
          {devices.map((d) => <DeviceLine key={d.id} device={d} error={errorAt.has(anchor.device(d.id))} onJump={onJump} />)}
        </ul>
      )}
    </div>
  );
}

function DeviceLine({ device: d, error, onJump }: { device: Device; error: boolean; onJump: (at: string) => void }) {
  const Icon = ICONS[d.kind];
  const link = d.controller ? `Regler „${d.controller}“` : d.actuator ? `„${d.actuator}“` : '';
  const status = d.manual
    ? <span class="text-muted">○ von Hand</span>
    : link && !error
      ? <span class="text-success">● {link}</span>
      : <span class="text-critical">● {link || 'Verknüpfung fehlt'}</span>;
  return (
    <li>
      <button type="button" onClick={() => onJump(anchor.device(d.id))}
        class="flex w-full items-start gap-1.5 rounded text-left hover:bg-fg/5">
        <Icon size={14} class="mt-0.5 shrink-0 text-muted" />
        <span class="min-w-0">
          <span class="block">{d.name || d.kind}{d.kind === 'heater' && d.powerW ? ` · ${(d.powerW / 1000).toString().replace('.', ',')} kW` : ''}</span>
          <span class="block text-xs">{status}</span>
        </span>
      </button>
    </li>
  );
}
