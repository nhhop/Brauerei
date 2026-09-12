import { useState, useEffect, useRef } from 'preact/hooks';

// Shared range-slider look (white round thumb, colored fill bar underneath).
// Stays a native <input type="range"> (keyboard/touch/a11y for free) — only
// the thumb is visible on it (`.range-slider` in styles.css makes the track
// fully transparent); the colored fill is a separate, absolutely-positioned
// bar behind it, sized from `fillValue` (defaults to the thumb's own value).
//
// The commit (`onChange`) is gated strictly on pointerup/pointercancel, not
// on the browser's own 'change' event — measured in the field, Chrome fires
// 'change' continuously through an entire drag on a range input (not once
// at release, despite MDN), which was flooding the network with a request
// per tick. `input`/`change` only ever touch local state here; a genuine
// commit happens exactly once, when the pointer physically comes back up
// (or via the native 'change' for the no-pointer keyboard-arrow-keys path).
export function Slider({ value, min, max, step = 'any', color, fillValue, disabled, onInput, onChange }: {
  value: number;
  min: number;
  max: number;
  step?: number | 'any';
  color: string;
  fillValue?: number;
  disabled?: boolean;
  onInput?: (v: number) => void;
  onChange?: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  const localRef = useRef(value);
  // While the pointer is physically down, ignore external `value` updates
  // (e.g. the setpoint changing mid-drag) — otherwise the thumb snaps back
  // under the cursor and dragging feels like it's fighting the user.
  const dragging = useRef(false);
  const lastSent = useRef(value);

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

  const fillTo = fillValue ?? local;
  const pct = max > min ? Math.max(0, Math.min(100, ((fillTo - min) / (max - min)) * 100)) : 0;
  const track = 'color-mix(in oklab, var(--fg) 12%, transparent)';

  return (
    <div class="relative flex h-[18px] items-center">
      <div class="pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full"
        style={{ background: track }}>
        <div class="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={local} disabled={disabled}
        onPointerDown={() => { dragging.current = true; }}
        onPointerUp={() => { dragging.current = false; commit(); }}
        onPointerCancel={() => { dragging.current = false; }}
        onInput={(e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          localRef.current = v;
          setLocal(v);
          onInput?.(v);
        }}
        onChange={() => { if (!dragging.current) commit(); }}
        onBlur={() => { dragging.current = false; }}
        class="range-slider relative w-full" />
    </div>
  );
}
