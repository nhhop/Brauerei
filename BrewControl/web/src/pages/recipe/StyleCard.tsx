import type { RecipeStats } from '../../recipeStats';
import { compareToStyle, type StyleRow } from '../../styleCompare';
import { styleCode, type BeerStyle, type StyleSource } from '../../styleSource';
import { badgeCaution, badgeSuccess } from '../../ui';
import { Card } from './fields';

// Shows how far each figure is from the style's range: the range as a band on a
// scale one half-width wider on both sides, the recipe's value as a marker.
function RangeBar({ row }: { row: StyleRow }) {
  if (row.min === undefined || row.max === undefined) return <div class="h-2 min-w-24 flex-1 rounded bg-fg/5" />;
  const half = (row.max - row.min) / 2;
  const lo = Math.max(0, row.min - half);
  const hi = row.max + half;
  const at = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo))) * 100;
  return (
    <div class="relative h-2 min-w-24 flex-1 rounded bg-fg/10">
      <div class="absolute inset-y-0 rounded bg-accent/40"
        style={{ left: `${at(row.min)}%`, width: `${at(row.max) - at(row.min)}%` }} />
      {row.value !== undefined && (
        <div class={`absolute -inset-y-1 w-0.5 rounded ${row.status === 'in' ? 'bg-success' : 'bg-caution'}`}
          style={{ left: `calc(${at(row.value)}% - 1px)` }} />
      )}
    </div>
  );
}

// 0.4 would round to "0" with no digits; show one digit then.
export function deltaText(row: StyleRow): string {
  const d = row.delta.toFixed(row.digits);
  return parseFloat(d) === 0 ? row.delta.toFixed(1) : d;
}

function Badge({ row }: { row: StyleRow }) {
  if (row.status === 'in') return <span class={badgeSuccess}>im Stil</span>;
  if (row.status === 'unknown') return <span class="text-xs text-muted">unbekannt</span>;
  return (
    <span class={badgeCaution}>
      {row.status === 'above' ? '+' : '−'}{deltaText(row)} {row.status === 'above' ? 'über' : 'unter'} Stil
    </span>
  );
}

// Shown once the recipe's style resolves (StyleDialog picks it).
export function StyleCard({ style, source, stats }: { style: BeerStyle; source: StyleSource; stats: RecipeStats }) {
  const cmp = compareToStyle(stats, style);
  const unknown = cmp.rows.length - cmp.knownCount;
  return (
    <Card title="Stil"
      action={
        <span class="text-right text-xs text-muted">
          {source.label} · {styleCode(style) && `${styleCode(style)} `}{style.name} · {cmp.inCount} von {cmp.knownCount} im Stil
          {unknown > 0 && ` (${unknown} unbekannt)`}
        </span>
      }>
      <ul class="space-y-3">
        {cmp.rows.map((r) => (
          <li key={r.key} class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="w-24 text-sm">{r.label}</span>
            <RangeBar row={r} />
            <span class="w-40 text-xs text-muted">
              {r.value !== undefined && <b class="font-semibold text-fg">{r.value.toFixed(r.digits)} </b>}
              {r.min !== undefined && r.max !== undefined
                ? `(${r.min.toFixed(r.digits)}–${r.max.toFixed(r.digits)} ${r.unit})`
                : '(kein Bereich)'}
            </span>
            <span class="w-32"><Badge row={r} /></span>
          </li>
        ))}
      </ul>
      {style.guide === 'bjcp-2021' && (
        <p class="mt-3 text-xs text-muted">
          Stilwerte: {source.label} Style Guidelines, {source.copyright} Die aktuelle Fassung gibt es auf{' '}
          <a href="https://www.bjcp.org" target="_blank" rel="noopener noreferrer" class="underline">www.bjcp.org</a>.
        </p>
      )}
    </Card>
  );
}
