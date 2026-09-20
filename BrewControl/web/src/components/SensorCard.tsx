import { Pencil, RotateCcw, X, TriangleAlert } from 'lucide-preact';
import type { Sensor, Severity, WidgetMode } from '../types';
import { badgeCaution, badgeCritical, widgetSizeClass } from '../ui';
import { CardModeButton } from './CardModeButton';
import { Gauge } from './Gauge';

export function SensorCard({ sensor, alarm, viewMode = 'normal', onDelete, onReset, onEdit, onCycleMode }: {
  sensor: Sensor;
  alarm?: Severity;
  viewMode?: WidgetMode;
  onDelete?: () => void;
  onReset?: () => void;
  onEdit?: () => void;
  onCycleMode?: () => void;
}) {
  const { id, meta, state } = sensor;
  const v = state.v;
  const live = state.ok && v != null && isFinite(v);
  const pct = live && meta.max > meta.min
    ? Math.max(0, Math.min(100, ((v - meta.min) / (meta.max - meta.min)) * 100))
    : 0;

  return (
    <div class={`${widgetSizeClass[viewMode]} rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8`}>
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <h3 class="font-medium text-fg">{id}</h3>
          {viewMode !== 'compact' && <div class="text-xs text-muted">{meta.quantity}</div>}
        </div>
        <div class="flex items-center gap-2">
          {viewMode === 'compact' && <span class="text-xs text-muted">{meta.quantity}</span>}
          {onCycleMode && <CardModeButton mode={viewMode} onCycle={onCycleMode} />}
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-faint hover:text-fg"><Pencil size={14} /></button>
          )}
          {onReset && (
            <button type="button" onClick={onReset}
              title={meta.quantity === 'Mass' ? 'Tare' : 'Reset volume'}
              class="text-faint hover:text-accent"><RotateCcw size={14} /></button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="text-faint hover:text-critical"><X size={16} /></button>
          )}
        </div>
      </div>

      {viewMode === 'compact' && (
        <div class="mt-2 flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-1">
            <span class="font-mono text-xl tabular-nums text-fg">{live ? v.toFixed(2) : '—'}</span>
            <span class="text-sm text-muted">{meta.unit}</span>
          </div>
          {(!state.ok || sensor.fault || alarm) && (
            <TriangleAlert size={14} class={alarm === 'critical' ? 'text-critical' : 'text-caution'} />
          )}
        </div>
      )}

      {viewMode === 'gauge' && (
        <>
          <div class="mt-1 flex flex-col items-center">
            <Gauge value={live ? v : meta.min} min={meta.min} max={meta.max} size={220} rangeLabels>
              <div class="flex flex-col items-center">
                <span class="font-mono text-2xl tabular-nums text-fg">{live ? v.toFixed(2) : '—'}</span>
                <span class="text-sm text-muted">{meta.unit}</span>
              </div>
            </Gauge>
          </div>
          {sensor.fault && (
            <span class={`mt-1 ${badgeCaution}`}>
              <TriangleAlert size={12} /> {sensor.fault}
            </span>
          )}
          {alarm && (
            <span class={`mt-1 ${alarm === 'critical' ? badgeCritical : badgeCaution}`}>
              <TriangleAlert size={12} /> Grenzwert
            </span>
          )}
        </>
      )}

      {viewMode === 'normal' && (
        <>
          <div class="mt-2 flex items-baseline gap-1">
            <span class="font-mono text-2xl tabular-nums text-fg">
              {live ? v.toFixed(2) : '—'}
            </span>
            <span class="text-sm text-muted">{meta.unit}</span>
            {!state.ok && (
              <span class={`ml-auto ${badgeCaution}`}>stale</span>
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
            <span class={`mt-2 ${badgeCaution}`}>
              <TriangleAlert size={12} /> {sensor.fault}
            </span>
          )}
          {alarm && (
            <span class={`mt-2 ${alarm === 'critical' ? badgeCritical : badgeCaution}`}>
              <TriangleAlert size={12} /> Grenzwert
            </span>
          )}
        </>
      )}
    </div>
  );
}
