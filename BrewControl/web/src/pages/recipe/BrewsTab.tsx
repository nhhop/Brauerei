import { route } from 'preact-router';
import { STATUS_LABEL, type BrewSummary } from '../../brews';
import { btnPrimary } from '../../ui';
import { formatIsoDate } from '../brew/format';
import { statusBadge } from '../BrewsPage';
import { Card } from './fields';

// Tab "Sude": the brews of every version of this recipe, newest first.
// Efficiency columns and the chart follow with the brew day (5b).
export function BrewsTab({ brews, onCreate, createBlock }: {
  brews: BrewSummary[] | null;   // null = the list did not load
  onCreate: () => void;
  createBlock?: string;          // why "Neuer Sud" is locked
}) {
  return (
    <Card title="Sude"
      action={
        <div class="flex items-center gap-2">
          {createBlock && <span class="text-xs text-muted">{createBlock}</span>}
          <button type="button" class={btnPrimary} disabled={!!createBlock} onClick={onCreate}>Neuer Sud aus diesem Rezept</button>
        </div>
      }>
      {brews === null ? (
        <p class="text-sm text-critical">Die Sude konnten nicht geladen werden.</p>
      ) : brews.length === 0 ? (
        <p class="text-sm text-muted">Aus diesem Rezept wurde noch kein Sud angelegt.</p>
      ) : (
        <ul class="divide-y divide-border">
          {brews.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => route(`/sude/${b.id}`)}
                class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-2 text-left text-sm hover:bg-fg/5">
                <span class="w-10 text-muted">#{b.number}</span>
                <span class="min-w-0 flex-1 truncate">{b.name || 'Ohne Namen'}</span>
                <span class="w-8 text-muted">v{b.version}</span>
                <span class="w-24 text-muted">{b.brewDate ? formatIsoDate(b.brewDate) : '–'}</span>
                <span class={statusBadge(b.status)}>{STATUS_LABEL[b.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
