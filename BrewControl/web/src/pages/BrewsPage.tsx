import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { ChevronRight, FlaskConical } from 'lucide-preact';
import { DONE_PREVIEW, groupBrews } from '../brewList';
import { STATUS_LABEL, listBrews, type BrewSummary } from '../brews';
import { listFermenters, type Fermenter } from '../cellar';
import { PageShell } from '../components/PageShell';
import { badge, badgeAccent, badgeSuccess } from '../ui';
import { formatIsoDate } from './brew/format';
import { CellarPlan } from './CellarPlan';

export const statusBadge = (s: BrewSummary['status']) =>
  s === 'planned' ? `${badge} bg-fg/10 text-muted` : s === 'active' ? badgeAccent : badgeSuccess;

const num = (n: number | undefined, unit: string) => (n === undefined ? '–' : `${n.toFixed(1).replace('.', ',')} ${unit}`);
const COLS = 'sm:grid-cols-[48px_minmax(0,2fr)_110px_100px_100px_100px_20px]';

// All brews under the fermenters' occupancy plan: running ones as cards, planned
// and finished ones as tables. A brew is made from a recipe (tab "Sude" there).
export function BrewsPage(_: { path?: string }) {
  const [brews, setBrews] = useState<BrewSummary[] | null>(null);
  const [fermenters, setFermenters] = useState<Fermenter[]>([]);
  const [error, setError] = useState(false);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    listBrews().then(setBrews).catch(() => setError(true));
    listFermenters().then(setFermenters).catch(() => {});
  }, []);

  const fermenterName = (b: BrewSummary) =>
    b.fermenterId ? fermenters.find((f) => f.id === b.fermenterId)?.name ?? 'Gärplatz fehlt' : undefined;
  const open = (b: BrewSummary) => route(`/sude/${b.id}`);
  const head = 'hidden items-center gap-3 border-b border-card-border px-4 py-2 text-xs font-semibold text-muted sm:grid';
  const rowCls = `grid w-full items-center gap-x-3 gap-y-0.5 border-b border-card-border px-4 py-2.5 text-left last:border-b-0 hover:bg-fg/5 ${COLS}`;
  const section = (title: string, n: number) => <h2 class="mb-2 mt-6 text-sm font-semibold text-muted">{title} · {n}</h2>;
  const frame = 'overflow-hidden rounded-md border border-card-border bg-card shadow-elev-2';

  const g = brews && groupBrews(brews);

  return (
    <PageShell>
      <h1 class="text-2xl font-semibold tracking-tight">Sude</h1>
      {error ? (
        <p class="mt-4 text-sm text-critical">Sude konnten nicht geladen werden.</p>
      ) : g === null ? (
        <p class="mt-4 text-sm text-muted">Lädt …</p>
      ) : brews!.length === 0 ? (
        <p class="mt-4 text-sm text-muted">Noch keine Sude. Einen Sud legst du in einem fertigen Rezept im Tab „Sude“ an.</p>
      ) : (
        <>
          <div class="mt-4" />
          <CellarPlan brews={brews!} fermenters={fermenters} />

          {g.active.length > 0 && (
            <section>
              {section('Aktiv', g.active.length)}
              <div class="grid gap-3 md:grid-cols-2">
                {g.active.map((b) => (
                  <button key={b.id} type="button" onClick={() => open(b)}
                    class="flex flex-col gap-1.5 rounded-md border border-card-border bg-card p-4 text-left shadow-elev-2 hover:bg-fg/5">
                    <span class="flex items-center justify-between gap-2">
                      <span class="flex min-w-0 items-center gap-2 font-medium">
                        <FlaskConical size={18} class="shrink-0 text-muted" />
                        <span class="text-muted">#{b.number}</span>
                        <span class="truncate">{b.name || 'Ohne Namen'}</span>
                      </span>
                      <span class={statusBadge(b.status)}>{STATUS_LABEL[b.status]}</span>
                    </span>
                    <span class="text-xs text-muted">
                      {[`Rezept v${b.version}`, b.brewDate && `Brautag ${formatIsoDate(b.brewDate)}`, fermenterName(b)]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {g.planned.length > 0 && (
            <section>
              {section('Planung', g.planned.length)}
              <div class={frame}>
                <div class={`${head} ${COLS}`}>
                  <span>Nr.</span><span>Sud</span><span>Geplant</span><span>Gärplatz</span><span /><span /><span />
                </div>
                {g.planned.map((b) => (
                  <button key={b.id} type="button" onClick={() => open(b)} class={rowCls}>
                    <span class="text-sm tabular-nums text-muted">#{b.number}</span>
                    <span class="min-w-0 truncate"><b>{b.name || 'Ohne Namen'}</b> <span class="text-xs text-muted">· Rezept v{b.version}</span></span>
                    <span class="text-sm tabular-nums">{b.brewDate ? formatIsoDate(b.brewDate) : '–'}</span>
                    <span class="truncate text-sm text-muted sm:col-span-2">{fermenterName(b) ?? '–'}</span>
                    <span class="hidden sm:block" />
                    <ChevronRight size={16} class="hidden text-muted sm:block" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {g.done.length > 0 && (
            <section>
              {section('Abgeschlossen', g.done.length)}
              <div class={frame}>
                <div class={`${head} ${COLS}`}>
                  <span>Nr.</span><span>Sud</span><span>Brautag</span><span class="text-right">Stammwürze</span>
                  <span class="text-right">Alkohol</span><span class="text-right">Gesamteff.</span><span />
                </div>
                {(allDone ? g.done : g.done.slice(0, DONE_PREVIEW)).map((b) => (
                  <button key={b.id} type="button" onClick={() => open(b)} class={rowCls}>
                    <span class="text-sm tabular-nums text-muted">#{b.number}</span>
                    <span class="min-w-0 truncate font-bold">{b.name || 'Ohne Namen'}</span>
                    <span class="text-sm tabular-nums">{b.brewDate ? formatIsoDate(b.brewDate) : '–'}</span>
                    <span class="flex gap-3 text-sm tabular-nums text-muted sm:contents">
                      <span class="sm:text-right sm:text-fg">{num(b.ogActual, '°P')}</span>
                      <span class="sm:text-right sm:text-fg">{num(b.abvPct, '%')}</span>
                      <span class="sm:text-right sm:text-fg">{num(b.yieldPct, '%')}</span>
                    </span>
                    <ChevronRight size={16} class="hidden text-muted sm:block" />
                  </button>
                ))}
              </div>
              {g.done.length > DONE_PREVIEW && (
                <button type="button" class="mt-2 text-sm text-accent hover:underline" onClick={() => setAllDone(!allDone)}>
                  {allDone ? 'Weniger anzeigen' : `Alle ${g.done.length} anzeigen`}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}
