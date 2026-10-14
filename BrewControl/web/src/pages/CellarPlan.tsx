import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { ChevronLeft, ChevronRight } from 'lucide-preact';
import { STATUS_LABEL, addDays, todayIso, type BrewSummary } from '../brews';
import type { Fermenter } from '../cellar';
import { PLAN_DAYS, cellarPlan, isoWeek, planStart, type PlanBar } from '../occupancy';
import { btnSecondary } from '../ui';
import { formatIsoDate } from './brew/format';
import { Card } from './recipe/fields';

const DAY = 14;    // px per day
const LANE = 22;   // px per bar lane

// The card's background is translucent; the sticky names column needs an
// opaque one, or the bars show through it when scrolled.
const STICKY_BG = { background: 'linear-gradient(var(--card-bg), var(--card-bg)), var(--bg)' };

const short = (iso: string) => formatIsoDate(iso).slice(0, 6);

// Running = occupied (filled), planned = reserved (hatched), done = grey; an
// overlap turns red.
function barStyle(bar: PlanBar): Record<string, string> {
  const color = bar.overlap ? 'var(--critical)' : 'var(--accent)';
  if (bar.kind === 'active') return { background: color, color: 'var(--accent-fg)' };
  if (bar.kind === 'planned') {
    return {
      background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${color} 30%, transparent) 0 4px, transparent 4px 8px)`,
      border: `1px solid ${color}`, color: 'var(--fg)',
    };
  }
  return { background: 'color-mix(in srgb, var(--fg) 12%, transparent)', color: 'var(--muted)', ...(bar.overlap && { border: `1px solid ${color}` }) };
}

const barTitle = (bar: PlanBar) => {
  const b = bar.brew;
  return [`#${b.number} ${b.name || 'Ohne Namen'}`, STATUS_LABEL[b.status],
    `${formatIsoDate(b.occupiedFrom!)}–${formatIsoDate(b.occupiedUntil!)}`,
    bar.overdue && 'überfällig', bar.overlap && 'Überschneidung'].filter(Boolean).join(' · ');
};

// Occupancy of the fermenters over eight weeks from the week before, on top of
// the brew list. The grid scrolls inside the card; a bar opens its brew.
export function CellarPlan({ brews, fermenters }: { brews: BrewSummary[]; fermenters: Fermenter[] }) {
  const [offset, setOffset] = useState(0);
  const today = todayIso();
  const plan = cellarPlan(brews, fermenters, planStart(today, offset), today);
  const weeks = Array.from({ length: PLAN_DAYS / 7 }, (_, i) => addDays(plan.start, 7 * i));
  const width = PLAN_DAYS * DAY;
  const nameOf = (id: string | undefined) => fermenters.find((f) => f.id === id)?.name ?? 'ohne Gärplatz';

  const nav = (
    <div class="flex items-center gap-1">
      <button type="button" class={`${btnSecondary} px-2`} aria-label="Eine Woche zurück" onClick={() => setOffset(offset - 1)}>
        <ChevronLeft size={16} />
      </button>
      <button type="button" class={btnSecondary} disabled={offset === 0} onClick={() => setOffset(0)}>Heute</button>
      <button type="button" class={`${btnSecondary} px-2`} aria-label="Eine Woche vor" onClick={() => setOffset(offset + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );

  return (
    <Card title="Belegungsplan" action={nav}>
      <div class="overflow-x-auto">
        <div class="relative" style={{ width: `calc(6.5rem + ${width}px)` }}>
          <div class="flex border-b border-border text-xs text-muted">
            <div class="sticky left-0 z-10 w-[6.5rem] shrink-0" style={STICKY_BG} />
            {weeks.map((w) => (
              <div key={w} class="shrink-0 border-l border-border px-1 py-1" style={{ width: `${7 * DAY}px` }}>
                KW {isoWeek(w)} · {short(w)}
              </div>
            ))}
          </div>
          {plan.rows.map((row) => (
            <div key={row.fermenter?.id ?? ''} class="flex border-b border-border last:border-b-0">
              <div class="sticky left-0 z-10 w-[6.5rem] shrink-0 truncate py-1 pr-2 text-sm" style={STICKY_BG} title={row.fermenter?.name}>
                {row.fermenter?.name ?? <span class="text-muted">ohne Gärplatz</span>}
              </div>
              <div class="relative shrink-0" style={{ width: `${width}px`, height: `${row.lanes * LANE + 6}px` }}>
                {weeks.slice(1).map((_, i) => (
                  <div key={i} class="absolute inset-y-0 border-l border-border/60" style={{ left: `${(i + 1) * 7 * DAY}px` }} />
                ))}
                {row.bars.map((bar) => (
                  <button key={bar.brew.id} type="button" title={barTitle(bar)} onClick={() => route(`/sude/${bar.brew.id}`)}
                    class={`absolute truncate px-1 text-left text-[11px] leading-[18px] ${bar.cutLeft ? '' : 'rounded-l'} ${bar.cutRight ? '' : 'rounded-r'}`}
                    style={{
                      left: `${bar.from * DAY + 1}px`, width: `${(bar.to - bar.from + 1) * DAY - 2}px`, top: `${3 + bar.lane * LANE}px`,
                      height: '18px', ...barStyle(bar),
                    }}>
                    #{bar.brew.number} {bar.brew.name}{bar.overdue ? ' · überfällig' : ''}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {plan.todayIdx >= 0 && plan.todayIdx < PLAN_DAYS && (
            <div class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-critical/70"
              style={{ left: `calc(6.5rem + ${plan.todayIdx * DAY + DAY / 2}px)` }} title="Heute" />
          )}
        </div>
      </div>
      <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span><span class="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: 'var(--accent)' }} />belegt</span>
        <span>
          <span class="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle"
            style={barStyle({ kind: 'planned', overlap: false } as PlanBar)} />reserviert
        </span>
        <span><span class="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" style={barStyle({ kind: 'done', overlap: false } as PlanBar)} />abgeschlossen</span>
        <span><span class="mr-1 inline-block h-2.5 w-4 rounded-sm align-middle" style={{ background: 'var(--critical)' }} />Überschneidung</span>
      </div>
      {plan.overlaps.map(([a, b]) => (
        <p key={`${a.id}|${b.id}`} class="mt-2 text-sm text-critical">
          #{a.number} {a.name} und #{b.number} {b.name} überschneiden sich auf {nameOf(a.fermenterId)}.
        </p>
      ))}
    </Card>
  );
}
