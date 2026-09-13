import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

// Shared 270° radial gauge — a speedometer-style arc with a 90° gap centered
// at the bottom, value increasing clockwise from the lower-left (min) to the
// lower-right (max) through 12 o'clock. Read-only by default; `interactive`
// adds a draggable thumb that reports value changes like `Slider` does for
// the linear case (see the drag/commit comment below).
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 82;
const STROKE = 14;
const START_DEG = 135;
const SWEEP_DEG = 270;

function polarToXY(deg: number, r: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

const ARC_PATH = (() => {
  const start = polarToXY(START_DEG, RADIUS);
  const end = polarToXY(START_DEG + SWEEP_DEG, RADIUS);
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${end.x} ${end.y}`;
})();

export function Gauge({ value, min, max, color = 'var(--accent)', fillValue, size = 200, interactive, step, ariaLabel, onInput, onChange, children }: {
  value: number;
  min: number;
  max: number;
  color?: string;
  // Position of the filled arc, independent of `value`/the thumb — mirrors
  // Slider's `fillValue` (e.g. the controller's Ist reading, while `value`/
  // the thumb tracks the draggable Soll). Defaults to `value` when omitted.
  fillValue?: number;
  size?: number;
  interactive?: boolean;
  step?: number;
  ariaLabel?: string;
  onInput?: (v: number) => void;
  onChange?: (v: number) => void;
  children?: ComponentChildren;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [local, setLocal] = useState(value);
  const localRef = useRef(value);
  const dragging = useRef(false);
  const lastSent = useRef(value);

  // Same reasoning as Slider.tsx: while the pointer is down, ignore external
  // `value` updates so the thumb doesn't fight the drag.
  useEffect(() => {
    if (dragging.current) return;
    setLocal(value);
    localRef.current = value;
    lastSent.current = value;
  }, [value]);

  function commit() {
    const v = localRef.current;
    if (v === lastSent.current) return;
    lastSent.current = v;
    onChange?.(v);
  }

  function valueFromPointer(clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return localRef.current;
    const rect = svg.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    let rel = angle - START_DEG;
    if (rel < 0) rel += 360;
    let pct: number;
    if (rel <= SWEEP_DEG) {
      pct = (rel / SWEEP_DEG) * 100;
    } else {
      // Pointer is in the bottom gap — snap to whichever end is nearer.
      const gapMid = SWEEP_DEG + (360 - SWEEP_DEG) / 2;
      pct = rel < gapMid ? 100 : 0;
    }
    return min + (pct / 100) * (max - min);
  }

  function applyLocal(v: number) {
    localRef.current = v;
    setLocal(v);
    onInput?.(v);
  }

  function handlePointerDown(e: PointerEvent) {
    if (!interactive) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    dragging.current = true;
    applyLocal(valueFromPointer(e.clientX, e.clientY));
  }
  function handlePointerMove(e: PointerEvent) {
    if (!dragging.current) return;
    applyLocal(valueFromPointer(e.clientX, e.clientY));
  }
  function handlePointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    commit();
  }
  function handlePointerCancel() {
    dragging.current = false;
  }
  function handleKeyDown(e: KeyboardEvent) {
    if (!interactive) return;
    const nudge = step ?? (max - min) / 100;
    let delta = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') delta = nudge;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') delta = -nudge;
    else return;
    e.preventDefault();
    const v = Math.max(min, Math.min(max, localRef.current + delta));
    localRef.current = v;
    setLocal(v);
    lastSent.current = v;
    onInput?.(v);
    onChange?.(v);
  }

  const track = 'color-mix(in oklab, var(--fg) 12%, transparent)';
  const clampPct = (v: number) => max > min ? Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)) : 0;
  const pct = clampPct(fillValue ?? local);
  const thumb = polarToXY(START_DEG + (clampPct(local) / 100) * SWEEP_DEG, RADIUS);

  return (
    <div class="relative" style={{ width: size, height: size }}>
      <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size}
        class={interactive ? 'touch-none' : undefined}
        style={{ cursor: interactive ? 'pointer' : undefined }}
        role={interactive ? 'slider' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-valuenow={interactive ? local : undefined}
        aria-valuemin={interactive ? min : undefined}
        aria-valuemax={interactive ? max : undefined}
        aria-label={interactive ? ariaLabel : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}>
        <path d={ARC_PATH} fill="none" stroke={track} stroke-width={STROKE} stroke-linecap="round" />
        {/* Gap deliberately far larger than the remaining path length: with
            `pct` and `100-pct` as a complementary pair, float rounding can
            make their sum land a hair under 100, letting the dash pattern
            wrap and draw an infinitesimal second dash at the path's end —
            invisible in itself, but stroke-linecap="round" renders even a
            zero-length dash as a full dot. An oversized gap can never
            complete within the path, so the pattern never repeats. */}
        <path d={ARC_PATH} fill="none" stroke={color} stroke-width={STROKE} stroke-linecap="round"
          pathLength={100} stroke-dasharray={`${pct} 1000`} />
        {interactive && (
          <circle cx={thumb.x} cy={thumb.y} r={STROKE * 0.7} fill="#fff" stroke="rgba(0,0,0,0.15)" stroke-width={1} />
        )}
      </svg>
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}
