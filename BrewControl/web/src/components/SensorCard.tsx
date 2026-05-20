import type { Sensor } from '../types';

export function SensorCard({ sensor, onDelete }: { sensor: Sensor; onDelete?: () => void }) {
  const { id, meta, state } = sensor;
  const v = state.v;
  const live = state.ok && v != null && isFinite(v);
  const pct = live && meta.max > meta.min
    ? Math.max(0, Math.min(100, ((v - meta.min) / (meta.max - meta.min)) * 100))
    : 0;

  return (
    <div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-stone-900">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-500">{meta.quantity}</span>
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="text-stone-400 hover:text-red-600 leading-none">×</button>
          )}
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-1">
        <span class="font-mono text-2xl tabular-nums text-stone-900">
          {live ? v.toFixed(2) : '—'}
        </span>
        <span class="text-sm text-stone-500">{meta.unit}</span>
        {!state.ok && (
          <span class="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            stale
          </span>
        )}
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          class="h-full rounded-full bg-stone-700 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-stone-400">
        <span>{meta.min}</span>
        <span>{meta.max}</span>
      </div>
    </div>
  );
}
