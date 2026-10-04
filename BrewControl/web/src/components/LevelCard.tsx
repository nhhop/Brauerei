import { useEffect, useRef, useState } from 'preact/hooks';
import { Crosshair, Pencil, X, TriangleAlert } from 'lucide-preact';
import type { Sensor } from '../types';
import { badgeCaution } from '../ui';
import {
  channelKey, levelBubble, levelStraight, levelStraightMode, LEVEL_INNER_FRAC, type LevelChannels,
} from '../levelBubble';

// One card for a GY-521 that shows pitch and roll together: a spirit level
// instead of the channel list. The bubble moves towards the high side; the
// dashed line and the number on the rim give the direction of the lean, as in
// common level apps. Other channels on the card (tilt, dir, temp, ...) stay
// readable as small rows below. With an axis at 45 degrees or more (the device
// stands on an edge) it turns into a straight level for the dominant axis.

const C = 100;          // centre of the viewBox
const GLASS_R = 78;
const BUBBLE_R = 10;
const TRAVEL = GLASS_R - BUBBLE_R; // the bubble's centre never leaves this circle
const TARGET_R = 14;    // ring in the middle: the bubble inside it = level
const TUBE_HALF = 70;   // straight level: the bubble's centre travels +-70 for +-90 degrees
const TUBE_H = 36;
// The rim label sits just outside the glass; its centre keeps a text half
// width (sideways) or half height (up/down) of clearance in its own direction.
const LABEL_GAP = 6;
const LABEL_HALF_W = 17;
const LABEL_HALF_H = 5;

// The snapshot arrives about once a second, so the bubble eases towards each new
// position instead of jumping: it covers ~95 % of the way in 3 x EASE_MS.
const EASE_MS = 300;

function useEased(x: number, y: number): { x: number; y: number } {
  const [pos, setPos] = useState({ x, y });
  const cur = useRef(pos);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const k = 1 - Math.exp(-(now - last) / EASE_MS);
      last = now;
      const done = Math.hypot(x - cur.current.x, y - cur.current.y) < 0.002;
      cur.current = done ? { x, y }
        : { x: cur.current.x + (x - cur.current.x) * k, y: cur.current.y + (y - cur.current.y) * k };
      setPos(cur.current);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [x, y]);
  return pos;
}

function fmt(s: Sensor): string {
  const v = s.state.v;
  return s.state.ok && v != null && isFinite(v) ? v.toFixed(1) : '—';
}

export function LevelCard({ baseId, level, onEdit, onCalibrate, onDelete }: {
  baseId: string;
  level: LevelChannels;
  onEdit?: () => void;
  onCalibrate?: () => void;
  onDelete?: () => void;
}) {
  const { pitch, roll, rest } = level;
  const live = pitch.state.ok && roll.state.ok && pitch.state.v != null && roll.state.v != null;
  const b = levelBubble(live ? roll.state.v! : NaN, live ? pitch.state.v! : NaN);
  const shown = b.valid;
  const tone = b.level ? 'var(--success)' : 'var(--accent)';
  const eased = useEased(b.x, b.y);
  const bx = C + eased.x * TRAVEL;
  const by = C - eased.y * TRAVEL;
  // Standing on an edge (an axis at 45 degrees or more): a straight level for
  // the dominant axis. Each mode keeps easing its own bubble, so a switch does
  // not make one glide in from the other's position.
  const straightMode = useRef(false);
  straightMode.current = levelStraightMode(straightMode.current,
    live ? roll.state.v! : NaN, live ? pitch.state.v! : NaN);
  const straight = straightMode.current;
  const st = levelStraight(live ? roll.state.v! : NaN, live ? pitch.state.v! : NaN);
  const stEased = useEased(st.x, 0);
  const stTone = st.level ? 'var(--success)' : 'var(--accent)';
  const fault = [pitch, roll, ...rest].find((s) => s.fault)?.fault;

  // Bearing on the rim, clockwise from the top: where the bubble is on screen,
  // so the label follows it while it eases.
  const rad = Math.atan2(eased.x, eased.y);
  const labelR = GLASS_R + LABEL_GAP
    + LABEL_HALF_W * Math.abs(Math.sin(rad)) + LABEL_HALF_H * Math.abs(Math.cos(rad));
  const lx = C + labelR * Math.sin(rad);
  const ly = C - labelR * Math.cos(rad);

  return (
    <div class="rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
      <div class="flex items-center justify-between gap-2">
        <h3 class="min-w-0 truncate font-medium text-fg">{baseId}</h3>
        <div class="flex items-center gap-2">
          {onCalibrate && (
            <button type="button" onClick={onCalibrate} title="Kalibrieren"
              class="text-faint hover:text-fg"><Crosshair size={14} /></button>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-faint hover:text-fg"><Pencil size={14} /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="text-faint hover:text-critical"><X size={16} /></button>
          )}
        </div>
      </div>

      <svg viewBox="0 0 200 200" class="mx-auto mt-2 block w-full max-w-[260px] overflow-visible" role="img"
        aria-label={shown
          ? `Libelle: Nick ${fmt(pitch)}°, Roll ${fmt(roll)}°`
          : 'Libelle: kein Messwert'}>
        {straight ? (
          <>
            {/* Nick runs up and down like in the round glass: the same tube, turned
                90 degrees counter-clockwise, so a positive angle is up. */}
            <g transform={st.axis === 'pitch' ? `rotate(-90 ${C} ${C})` : undefined}>
              <rect x={C - TUBE_HALF - BUBBLE_R} y={C - TUBE_H / 2} width={2 * (TUBE_HALF + BUBBLE_R)} height={TUBE_H}
                rx={TUBE_H / 2}
                fill={`color-mix(in oklab, ${st.valid ? stTone : 'var(--fg)'} 8%, transparent)`}
                stroke={st.valid && st.level ? stTone : 'color-mix(in oklab, var(--fg) 25%, transparent)'}
                stroke-width={2} />
              {/* 0 degrees in the middle, the marks beside it end the fine scale (15 degrees). */}
              {[-LEVEL_INNER_FRAC * TUBE_HALF, 0, LEVEL_INNER_FRAC * TUBE_HALF].map((dx) => (
                <line key={dx} x1={C + dx} y1={C - TUBE_H / 2 + 4} x2={C + dx} y2={C + TUBE_H / 2 - 4}
                  stroke="var(--faint)" stroke-width={dx === 0 ? 1.5 : 0.75} />
              ))}
              {st.valid && (
                <circle cx={C + stEased.x * TUBE_HALF} cy={C} r={BUBBLE_R}
                  fill={`color-mix(in oklab, ${stTone} 35%, transparent)`} stroke={stTone} stroke-width={2} />
              )}
            </g>
            {st.axis === 'pitch' ? (
              <>
                <text x={C - TUBE_H / 2 - 10} y={C} text-anchor="end" dominant-baseline="central"
                  font-size={11} fill="var(--muted)">Nick</text>
                {st.valid && st.upright && (
                  <text x={C + TUBE_H / 2 + 10} y={C} dominant-baseline="central"
                    font-size={11} fill="var(--success)">senkrecht</text>
                )}
              </>
            ) : (
              <>
                <text x={C} y={C - TUBE_H / 2 - 12} text-anchor="middle" font-size={11} fill="var(--muted)">Roll</text>
                {st.valid && st.upright && (
                  <text x={C} y={C + TUBE_H / 2 + 16} text-anchor="middle" font-size={11} fill="var(--success)">senkrecht</text>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <circle cx={C} cy={C} r={GLASS_R}
              fill={`color-mix(in oklab, ${shown ? tone : 'var(--fg)'} 8%, transparent)`}
              stroke={shown && b.level ? tone : 'color-mix(in oklab, var(--fg) 25%, transparent)'}
              stroke-width={2} />
            <line x1={C - GLASS_R} y1={C} x2={C + GLASS_R} y2={C} stroke="var(--faint)" stroke-width={0.75} />
            <line x1={C} y1={C - GLASS_R} x2={C} y2={C + GLASS_R} stroke="var(--faint)" stroke-width={0.75} />
            {/* Where the fine scale (to 15 degrees) ends and the squeezed one begins. */}
            <circle cx={C} cy={C} r={LEVEL_INNER_FRAC * TRAVEL} fill="none" stroke="var(--faint)"
              stroke-width={0.75} stroke-dasharray="1 3" />
            <circle cx={C} cy={C} r={TARGET_R} fill="none" stroke="var(--faint)" stroke-width={1.5} />
            {shown && !b.level && b.dirDeg != null && (
              <>
                <line x1={C} y1={C} x2={bx} y2={by} stroke="var(--muted)" stroke-width={1.5}
                  stroke-dasharray="2 3" stroke-linecap="round" />
                <text x={lx} y={ly} text-anchor="middle" dominant-baseline="central"
                  font-size={10} fill="var(--muted)" class="tabular-nums">{b.dirDeg.toFixed(1)}°</text>
              </>
            )}
            {shown && (
              <circle cx={bx} cy={by} r={BUBBLE_R}
                fill={`color-mix(in oklab, ${tone} 35%, transparent)`} stroke={tone} stroke-width={2} />
            )}
          </>
        )}
      </svg>

      <div class="mt-2 grid grid-cols-3 gap-2 text-center">
        <Readout label="Nick" value={fmt(pitch)} />
        <Readout label="Roll" value={fmt(roll)} />
        <Readout label="Neigung" value={shown ? b.magnitudeDeg.toFixed(1) : '—'} />
      </div>

      {rest.length > 0 && (
        <div class="mt-3 border-t border-border/60 pt-2">
          {rest.map((s) => (
            <div key={s.id} class="flex items-baseline gap-2 py-0.5">
              <span class="min-w-0 flex-1 truncate text-xs text-muted">{channelKey(s)}</span>
              <span class="font-mono text-sm tabular-nums text-fg">{fmt(s)}</span>
              <span class="text-xs text-muted">{s.meta.unit}</span>
              {!s.state.ok && <TriangleAlert size={14} class="text-caution" />}
            </div>
          ))}
        </div>
      )}

      {fault && (
        <span class={`mt-2 ${badgeCaution}`}>
          <TriangleAlert size={12} /> {fault}
        </span>
      )}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div class="font-mono text-lg tabular-nums text-fg">{value}<span class="text-xs text-muted">°</span></div>
      <div class="text-[10px] text-faint">{label}</div>
    </div>
  );
}
