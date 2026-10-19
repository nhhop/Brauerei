import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Copy, Pencil, Plus, Search, Trash2 } from 'lucide-preact';
import { brewsOfRoot, listBrews, type BrewSummary } from '../brews';
import {
  deleteRecipeVersions, duplicateRecipe, getRecipe, groupVersions, importLocalRecipes, listRecipes, newRecipe, rootOf,
  saveRecipe, versionOf, type RecipeSummary,
} from '../recipes';
import { ebcSwatch, filterRows, recipeRows, SORT_LABEL, sortRows, type SortKey } from '../recipeList';
import { PageShell } from '../components/PageShell';
import { ConfirmModal } from '../components/ConfirmModal';
import { Fab } from '../components/Fab';
import { badge, badgeAccent, btnPrimary, inp } from '../ui';
import { formatIsoDate } from './brew/format';

const COLS = 'md:grid-cols-[minmax(0,2.4fr)_72px_92px_68px_48px_64px_44px_108px_112px]';
const num = (n: number | undefined, unit = '', digits = 1) =>
  n === undefined ? '–' : `${n.toFixed(digits).replace('.', ',')}${unit}`;

// Recipe library, one table row per recipe showing its newest version. Picking a
// row opens the editor; new recipes start as drafts.
export function RecipesPage(_: { path?: string }) {
  // Versions grouped per recipe (oldest first).
  const [recipes, setRecipes] = useState<RecipeSummary[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecipeSummary[] | null>(null);
  const [brews, setBrews] = useState<BrewSummary[] | null>(null);  // null = not loaded; deleting waits for it
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last');

  function refresh() {
    return listRecipes().then((list) => setRecipes(groupVersions(list)));
  }

  // A failed import keeps the browser's copy for the next visit; the list shows regardless.
  useEffect(() => {
    importLocalRecipes()
      .catch((e) => console.warn('recipe import failed', e))
      .then(refresh)
      .catch(() => setError('Rezepte konnten nicht geladen werden.'));
    listBrews().then(setBrews).catch(() => {});
  }, []);

  // A recipe that brews were made from stays: the brews point to its versions.
  function askDelete(versions: RecipeSummary[]) {
    setError(null);
    if (brews === null) { setError('Die Sude sind nicht geladen; ohne sie lässt sich kein Rezept löschen.'); return; }
    const n = brewsOfRoot(brews, rootOf(versions[0])).length;
    if (n > 0) {
      setError(`„${versions[versions.length - 1].name || 'Ohne Namen'}“ lässt sich nicht löschen: ${n === 1 ? 'ein Sud nutzt' : `${n} Sude nutzen`} es.`);
      return;
    }
    setDeleteTarget(versions);
  }

  async function create() {
    try {
      const r = await saveRecipe(newRecipe());
      route(`/rezepte/${r.id}`);
    } catch { setError('Rezept konnte nicht angelegt werden.'); }
  }

  async function duplicate(id: string) {
    setError(null);
    try {
      const r = await getRecipe(id);
      if (!r) { setError('Rezept nicht gefunden.'); return; }
      const copy = await saveRecipe(duplicateRecipe(r));
      route(`/rezepte/${copy.id}`);
    } catch { setError('Rezept konnte nicht dupliziert werden.'); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteRecipeVersions(target);
      await refresh();
    } catch { setError('Rezept konnte nicht gelöscht werden.'); }
  }

  const rows = recipes && sortRows(filterRows(recipeRows(recipes, brews), query), sortKey);
  const iconBtn = 'rounded-md p-1.5 text-muted hover:bg-fg/10';

  return (
    <PageShell>
      <header class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Rezepte</h1>
        <button type="button" onClick={create} class={`${btnPrimary} hidden md:inline-flex`}>
          + Neues Rezept
        </button>
      </header>
      <Fab icon={Plus} label="Neues Rezept" onClick={create} />

      {error && <p class="mt-4 text-sm text-critical">{error}</p>}
      {rows === null ? (
        !error && <p class="mt-4 text-sm text-muted">Lädt …</p>
      ) : recipes!.length === 0 ? (
        <p class="mt-4 text-sm text-muted">Noch keine Rezepte. Lege über „Neues Rezept“ das erste an.</p>
      ) : (
        <>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label class="relative w-full sm:w-80">
              <Search size={16} class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" class={`${inp} w-full pl-8`} placeholder="Rezept oder Stil suchen"
                aria-label="Rezepte durchsuchen" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
            </label>
            <label class="flex items-center gap-2 text-sm text-muted">
              Sortieren nach
              <select class={`${inp} w-44`} value={sortKey} onChange={(e) => setSortKey(e.currentTarget.value as SortKey)}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
              </select>
            </label>
          </div>

          <div class="mt-4 overflow-hidden rounded-md border border-card-border bg-card shadow-elev-2">
            <div class={`hidden items-center gap-3 border-b border-card-border px-4 py-2 text-xs font-semibold text-muted md:grid ${COLS}`}>
              <span>Name · Stil</span><span class="text-right">Volumen</span><span class="text-right">Stammwürze</span>
              <span class="text-right">Alkohol</span><span class="text-right">IBU</span><span class="text-center">EBC</span>
              <span class="text-right">Sude</span><span>Zuletzt gebraut</span><span class="text-right">Aktionen</span>
            </div>
            {rows.map(({ versions, latest: r, brewCount, lastBrewed }) => {
              const swatch = r.ebc === undefined ? undefined : ebcSwatch(r.ebc);
              return (
                <div key={r.id} onClick={() => route(`/rezepte/${r.id}`)}
                  class={`grid cursor-pointer items-center gap-x-3 gap-y-1 border-b border-card-border px-4 py-2 last:border-b-0 hover:bg-fg/5 ${COLS}`}>
                  <span class="flex min-w-0 flex-col">
                    <span class="flex flex-wrap items-center gap-2">
                      <a href={`/rezepte/${r.id}`} onClick={(e) => e.stopPropagation()}
                        class="font-semibold text-fg hover:text-accent">{r.name || 'Ohne Namen'}</a>
                      {versionOf(r) > 1 && <span class={`${badge} bg-fg/10 text-muted`}>v{versionOf(r)}</span>}
                      {r.status === 'draft' && <span class={badgeAccent}>Entwurf</span>}
                    </span>
                    <span class="text-xs text-muted">{r.style || 'Kein Stil'}</span>
                  </span>
                  <span class="text-sm tabular-nums text-muted md:hidden">
                    {[`${num(r.volumeL, ' l', 0)}`, r.ogPlato !== undefined && num(r.ogPlato, ' °P'),
                      r.abvPct !== undefined && num(r.abvPct, ' %'), r.ibu !== undefined && `${num(r.ibu, '', 0)} IBU`,
                      `${brewCount} ${brewCount === 1 ? 'Sud' : 'Sude'}`].filter(Boolean).join(' · ')}
                  </span>
                  <span class="hidden text-right text-sm tabular-nums md:block">{num(r.volumeL, ' l', 0)}</span>
                  <span class="hidden text-right text-sm tabular-nums md:block">{num(r.ogPlato, ' °P')}</span>
                  <span class="hidden text-right text-sm tabular-nums md:block">{num(r.abvPct, ' %')}</span>
                  <span class="hidden text-right text-sm tabular-nums md:block">{num(r.ibu, '', 0)}</span>
                  <span class="hidden justify-self-center md:block">
                    {swatch ? (
                      <span class="inline-flex min-w-[52px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
                        style={{ background: swatch.bg, color: swatch.fg }} title={`Farbe ${num(r.ebc, ' EBC', 0)}`}>
                        {num(r.ebc, '', 0)}
                      </span>
                    ) : <span class="text-sm text-muted">–</span>}
                  </span>
                  <span class="hidden text-right text-sm tabular-nums md:block">{brewCount}</span>
                  <span class="hidden text-sm tabular-nums md:block">{lastBrewed ? formatIsoDate(lastBrewed) : '—'}</span>
                  <span class="flex justify-end gap-0.5">
                    <button type="button" title="Bearbeiten" aria-label={`${r.name || 'Rezept'} bearbeiten`} class={iconBtn}
                      onClick={(e) => { e.stopPropagation(); route(`/rezepte/${r.id}`); }}><Pencil size={16} /></button>
                    <button type="button" title="Duplizieren" aria-label={`${r.name || 'Rezept'} duplizieren`} class={iconBtn}
                      onClick={(e) => { e.stopPropagation(); duplicate(r.id); }}><Copy size={16} /></button>
                    <button type="button" title="Löschen" aria-label={`${r.name || 'Rezept'} löschen`} class={`${iconBtn} text-critical`}
                      onClick={(e) => { e.stopPropagation(); askDelete(versions); }}><Trash2 size={16} /></button>
                  </span>
                </div>
              );
            })}
            {rows.length === 0 && <p class="px-4 py-3 text-sm text-muted">Kein Rezept passt zur Suche.</p>}
          </div>
          <p class="mt-2 text-xs text-muted">{recipes!.length} {recipes!.length === 1 ? 'Rezept' : 'Rezepte'}</p>
        </>
      )}

      <ConfirmModal open={deleteTarget !== null} title="Rezept löschen?" confirmLabel="Löschen" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.[deleteTarget.length - 1].name}“ wird dauerhaft entfernt
        {deleteTarget && deleteTarget.length > 1 ? `, mit allen ${deleteTarget.length} Versionen` : ''}.
      </ConfirmModal>
    </PageShell>
  );
}
