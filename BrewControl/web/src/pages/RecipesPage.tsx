import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Pencil, Plus, Trash2, BookOpen } from 'lucide-preact';
import { brewsOfRoot, listBrews, type BrewSummary } from '../brews';
import {
  deleteRecipeVersions, groupVersions, importLocalRecipes, listRecipes, newRecipe, rootOf, saveRecipe, versionOf,
  type RecipeSummary,
} from '../recipes';
import { PageShell } from '../components/PageShell';
import { ConfirmModal } from '../components/ConfirmModal';
import { Fab } from '../components/Fab';
import { badge, badgeAccent, btnPrimary } from '../ui';

// Recipe library, one row per recipe showing its newest version. Picking a row
// opens the editor; new recipes start as drafts.
export function RecipesPage(_: { path?: string }) {
  // Versions grouped per recipe (oldest first), newest recipe first.
  const [recipes, setRecipes] = useState<RecipeSummary[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecipeSummary[] | null>(null);
  const [brews, setBrews] = useState<BrewSummary[] | null>(null);  // null = not loaded; deleting waits for it

  function refresh() {
    return listRecipes().then((list) => setRecipes(groupVersions(list)
      .sort((a, b) => Math.max(...b.map((r) => r.updatedAt)) - Math.max(...a.map((r) => r.updatedAt)))));
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteRecipeVersions(target);
      await refresh();
    } catch { setError('Rezept konnte nicht gelöscht werden.'); }
  }

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
      {recipes === null ? (
        !error && <p class="mt-4 text-sm text-muted">Lädt …</p>
      ) : recipes.length === 0 ? (
        <p class="mt-4 text-sm text-muted">Noch keine Rezepte. Lege über „Neues Rezept“ das erste an.</p>
      ) : (
        <div class="mt-4 space-y-4">
          {recipes.map((versions) => { const r = versions[versions.length - 1]; return (
            <div key={r.id} onClick={() => route(`/rezepte/${r.id}`)}
              class="cursor-pointer rounded-md border border-card-border bg-card p-4 shadow-elev-2 hover:bg-fg/5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5">
                  <BookOpen size={20} class="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <div class="flex items-center gap-2 font-medium">
                      {r.name || 'Ohne Namen'}
                      {versionOf(r) > 1 && <span class={`${badge} bg-fg/10 text-muted`}>v{versionOf(r)}</span>}
                      {r.status === 'draft' && <span class={badgeAccent}>Entwurf</span>}
                    </div>
                    <div class="text-xs text-muted">
                      {r.style || 'Kein Stil'}{' · '}{r.volumeL} l
                    </div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  <button type="button" title="Rezept bearbeiten"
                    onClick={(e) => { e.stopPropagation(); route(`/rezepte/${r.id}`); }}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10">
                    <Pencil size={14} />
                  </button>
                  <button type="button" title="Rezept löschen"
                    onClick={(e) => { e.stopPropagation(); askDelete(versions); }}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ); })}
        </div>
      )}

      <ConfirmModal open={deleteTarget !== null} title="Rezept löschen?" confirmLabel="Löschen" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.[deleteTarget.length - 1].name}“ wird dauerhaft entfernt
        {deleteTarget && deleteTarget.length > 1 ? `, mit allen ${deleteTarget.length} Versionen` : ''}.
      </ConfirmModal>
    </PageShell>
  );
}
