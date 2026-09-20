import { Pencil, RotateCcw, Rows3, Rows4, X, TriangleAlert } from 'lucide-preact';
import type { Sensor, Severity, WidgetMode } from '../types';
import { badgeCaution } from '../ui';

// One card for a multi-channel sensor: the sensor's id as the title, one row
// per channel below it. Single-channel sensors and separately placed channels
// keep using SensorCard — this card only exists to stop a multi-channel sensor
// from claiming several card slots in the grid.

export type RowMode = 'normal' | 'compact';

// A channel row only knows normal (value + bar) and compact (value only): a
// gauge needs the width of a card of its own, and a channel can still be
// placed as its own card when it deserves one.
export function rowMode(mode: WidgetMode): RowMode {
  return mode === 'compact' ? 'compact' : 'normal';
}

// "tank.volume" -> "volume"; a channel without a key (single-channel sensor)
// falls back to what it measures.
function channelLabel(s: Sensor): string {
  const dot = s.id.indexOf('.');
  return dot >= 0 ? s.id.slice(dot + 1) : s.meta.quantity;
}

export function SensorGroupCard({ baseId, channels, modeOf, alarmOf, onToggleMode, onReset, onEdit, onDelete }: {
  baseId: string;
  channels: Sensor[];
  modeOf: (channelId: string) => WidgetMode;
  alarmOf?: (channelId: string) => Severity | undefined;
  onToggleMode?: (channelId: string) => void;
  onReset?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  // The fault string belongs to the sensor, not to one channel — every channel
  // carries the same one, so it is shown once.
  const fault = channels.find((s) => s.fault)?.fault;

  return (
    <div class="rounded-lg border border-card-border bg-card p-4 shadow-elev-2 transition-shadow duration-200 hover:shadow-elev-8">
      <div class="flex items-center justify-between gap-2">
        <h3 class="min-w-0 truncate font-medium text-fg">{baseId}</h3>
        <div class="flex items-center gap-2">
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

      <div class="mt-2">
        {channels.map((s, i) => {
          const { meta, state } = s;
          const mode = rowMode(modeOf(s.id));
          const v = state.v;
          const live = state.ok && v != null && isFinite(v);
          const pct = live && meta.max > meta.min
            ? Math.max(0, Math.min(100, ((v - meta.min) / (meta.max - meta.min)) * 100))
            : 0;
          const alarm = alarmOf?.(s.id);
          const resettable = meta.kind === 'Cumulative' || meta.quantity === 'Mass';
          return (
            <div key={s.id}
              class={i > 0 ? 'mt-2 border-t border-border/60 pt-2' : ''}>
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-xs text-muted">{channelLabel(s)}</span>
                <div class="flex items-baseline gap-1">
                  <span class="font-mono text-lg tabular-nums text-fg">{live ? v.toFixed(2) : '—'}</span>
                  <span class="text-xs text-muted">{meta.unit}</span>
                </div>
                {(!state.ok || alarm) && (
                  <TriangleAlert size={14} class={alarm === 'critical' ? 'text-critical' : 'text-caution'} />
                )}
                {resettable && onReset && (
                  <button type="button" onClick={onReset}
                    title={meta.quantity === 'Mass' ? 'Tare' : 'Reset volume'}
                    class="text-faint hover:text-accent"><RotateCcw size={14} /></button>
                )}
                {onToggleMode && (
                  <button type="button" onClick={() => onToggleMode(s.id)}
                    title={mode === 'normal' ? 'Ansicht: Normal (klicken für Kompakt)' : 'Ansicht: Kompakt (klicken für Normal)'}
                    class="text-faint hover:text-fg">
                    {mode === 'normal' ? <Rows3 size={14} /> : <Rows4 size={14} />}
                  </button>
                )}
              </div>
              {mode === 'normal' && (
                <>
                  <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-fg/10">
                    <div class="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div class="mt-0.5 flex justify-between text-[10px] text-faint">
                    <span>{meta.min}</span>
                    <span>{meta.max}</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {fault && (
        <span class={`mt-2 ${badgeCaution}`}>
          <TriangleAlert size={12} /> {fault}
        </span>
      )}
    </div>
  );
}
