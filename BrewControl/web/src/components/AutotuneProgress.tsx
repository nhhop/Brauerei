import type { ControllerParams } from '../types';

const PHASES = ['Anfahren', 'Schwingung', 'Fertig'] as const;

export function AutotuneProgress({ params }: { params: ControllerParams | undefined }) {
  const done = params?.autotuneState === 'done';
  const total = params?.autotuneCyclesTotal ?? 0;
  const observed = params?.autotuneCyclesObserved ?? 0;
  const phase = done ? 2 : observed > 0 ? 1 : 0;
  const pct = done ? 100 : total > 0 ? Math.min(100, Math.round((observed / total) * 100)) : 0;

  return (
    <div>
      <div class="flex items-center">
        {PHASES.map((label, i) => (
          <div key={label} class="flex items-center" style={i < PHASES.length - 1 ? { flex: 1 } : undefined}>
            <div class="flex flex-col items-center gap-1">
              <div class={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                i <= phase ? 'bg-accent text-accent-fg' : 'bg-fg/10 text-faint'}`}>
                {i + 1}
              </div>
              <span class={`text-[10px] ${i === phase ? 'text-fg font-medium' : 'text-faint'}`}>{label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div class={`mx-1 h-px flex-1 ${i < phase ? 'bg-accent' : 'bg-fg/10'}`} />
            )}
          </div>
        ))}
      </div>
      <div class="mt-2 h-1 overflow-hidden rounded-full bg-fg/10">
        <div class="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p class="mt-1 text-right font-mono text-xs text-muted">{pct}%</p>
    </div>
  );
}
