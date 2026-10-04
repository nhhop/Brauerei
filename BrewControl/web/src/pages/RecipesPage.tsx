import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Pencil, Plus, Trash2, BookOpen } from 'lucide-preact';
import { deleteRecipe, listRecipes, newRecipe, saveRecipe, type Recipe } from '../recipes';
import { PageShell } from '../components/PageShell';
import { ConfirmModal } from '../components/ConfirmModal';
import { Fab } from '../components/Fab';
import { badgeAccent, btnPrimary } from '../ui';

// Recipe library. Picking a row opens the editor; new recipes start as drafts.
export function RecipesPage(_: { path?: string }) {
  const [recipes, setRecipes] = useState<Recipe[]>(listRecipes);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

  function create() {
    const r = saveRecipe(newRecipe());
    route(`/rezepte/${r.id}`);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteRecipe(deleteTarget.id);
    setDeleteTarget(null);
    setRecipes(listRecipes());
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

      {recipes.length === 0 ? (
        <p class="mt-4 text-sm text-muted">Noch keine Rezepte. Lege über „Neues Rezept“ das erste an.</p>
      ) : (
        <div class="mt-4 space-y-4">
          {recipes.map((r) => (
            <div key={r.id} onClick={() => route(`/rezepte/${r.id}`)}
              class="cursor-pointer rounded-md border border-card-border bg-card p-4 shadow-elev-2 hover:bg-fg/5">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5">
                  <BookOpen size={20} class="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <div class="flex items-center gap-2 font-medium">
                      {r.name || 'Ohne Namen'}
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
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal open={deleteTarget !== null} title="Rezept löschen?" confirmLabel="Löschen" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.name}“ wird dauerhaft entfernt.
      </ConfirmModal>
    </PageShell>
  );
}
