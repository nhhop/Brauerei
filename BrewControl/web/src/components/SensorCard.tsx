import type { Sensor } from '../types';

export function SensorCard({ sensor, onDelete, onReset, onEdit }: { sensor: Sensor; onDelete?: () => void; onReset?: () => void; onEdit?: () => void }) {
  const { id, meta, state } = sensor;
  const v = state.v;
  const live = state.ok && v != null && isFinite(v);
  const pct = live && meta.max > meta.min
    ? Math.max(0, Math.min(100, ((v - meta.min) / (meta.max - meta.min)) * 100))
    : 0;

  return (
    <div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{meta.quantity}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onReset && (
            <button type="button" onClick={onReset}
              title={meta.quantity === 'Mass' ? 'Tare' : 'Reset volume'}
              class="text-sm leading-none text-faint hover:text-blue-600">↺</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-1">
        <span class="font-mono text-2xl tabular-nums text-fg">
          {live ? v.toFixed(2) : '—'}
        </span>
        <span class="text-sm text-muted">{meta.unit}</span>
        {!state.ok && (
          <span class="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            stale
          </span>
        )}
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-faint">
        <span>{meta.min}</span>
        <span>{meta.max}</span>
      </div>
      {sensor.fault && (
        <span class="mt-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          ⚠ {sensor.fault}
        </span>
      )}
    </div>
  );
}
