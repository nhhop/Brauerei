import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { FlaskConical } from 'lucide-preact';
import { STATUS_LABEL, listBrews, type BrewSummary } from '../brews';
import { listFermenters, type Fermenter } from '../cellar';
import { PageShell } from '../components/PageShell';
import { badge, badgeAccent, badgeSuccess } from '../ui';
import { formatIsoDate } from './brew/format';
import { CellarPlan } from './CellarPlan';

export const statusBadge = (s: BrewSummary['status']) =>
  s === 'planned' ? `${badge} bg-fg/10 text-muted` : s === 'active' ? badgeAccent : badgeSuccess;

// All brews, newest first, under the fermenters' occupancy plan. A brew is made
// from a recipe (tab "Sude" there).
export function BrewsPage(_: { path?: string }) {
  const [brews, setBrews] = useState<BrewSummary[] | null>(null);
  const [fermenters, setFermenters] = useState<Fermenter[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    listBrews().then(setBrews).catch(() => setError(true));
    listFermenters().then(setFermenters).catch(() => {});
  }, []);

  return (
    <PageShell>
      <h1 class="text-2xl font-semibold tracking-tight">Sude</h1>
      {error ? (
        <p class="mt-4 text-sm text-critical">Sude konnten nicht geladen werden.</p>
      ) : brews === null ? (
        <p class="mt-4 text-sm text-muted">Lädt …</p>
      ) : brews.length === 0 ? (
        <p class="mt-4 text-sm text-muted">Noch keine Sude. Einen Sud legst du in einem fertigen Rezept im Tab „Sude“ an.</p>
      ) : (
        <>
          <div class="mt-4" />
          <CellarPlan brews={brews} fermenters={fermenters} />
          <div class="space-y-2">
            {brews.map((b) => (
              <button key={b.id} type="button" onClick={() => route(`/sude/${b.id}`)}
                class="flex w-full items-start gap-2.5 rounded-md border border-card-border bg-card p-3 text-left shadow-elev-2 hover:bg-fg/5">
                <FlaskConical size={20} class="mt-0.5 shrink-0 text-muted" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2 font-medium">
                    <span class="text-muted">#{b.number}</span>
                    {b.name || 'Ohne Namen'}
                    <span class={statusBadge(b.status)}>{STATUS_LABEL[b.status]}</span>
                  </div>
                  <div class="text-xs text-muted">
                    {[
                      `Rezept v${b.version}`,
                      b.brewDate && `Brautag ${formatIsoDate(b.brewDate)}`,
                      b.fermenterId && (fermenters.find((f) => f.id === b.fermenterId)?.name ?? 'Gärplatz fehlt'),
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
