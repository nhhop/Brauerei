import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ProfileCategory, ProfileConfig } from '../types';
import {
  getProfiles, createProfile, updateProfile, deleteProfile,
  createProfileCategory, updateProfileCategory, deleteProfileCategory,
} from '../api';
import { PageShell } from '../components/PageShell';
import { SkeletonList } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';
import { NameModal } from '../components/NameModal';
import { ProfileEditorModal } from '../components/ProfileEditorModal';
import { TabBtn } from '../components/TabBtn';
import { Fab } from '../components/Fab';
import { fmtDuration } from '../components/ProgramCard';
import { btnPrimary } from '../ui';
import { Pencil, Check, Plus, Trash2, ListChecks } from 'lucide-preact';

type SaveCfg = Pick<ProfileConfig, 'name' | 'category' | 'steps'>;

// Profile library: reusable step templates, grouped into categories. The
// categories are the tab strip (same mechanic as the dashboard tabs) — a
// profile always belongs to exactly one.
export function ProfilesPage(_props: { path?: string }) {
  const [categories, setCategories] = useState<ProfileCategory[]>([]);
  const [profiles, setProfiles] = useState<ProfileConfig[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Edit mode gates the category affordances (+ Neu, pencil on the active tab).
  const [editMode, setEditMode] = useState(false);
  const [catMeta, setCatMeta] = useState<null | 'create' | 'edit'>(null);
  const [catDelete, setCatDelete] = useState<ProfileCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // One response carries both lists, and deleting a category cascades into its
  // profiles — so every mutation refetches instead of patching locally.
  function refresh(): Promise<void> {
    return getProfiles().then((lib) => {
      setCategories(lib.categories);
      setProfiles(lib.profiles);
      setActiveCat((cur) =>
        cur && lib.categories.some((c) => c.id === cur) ? cur : (lib.categories[0]?.id ?? null));
    }).catch(() => {});
  }

  useEffect(() => { refresh().finally(() => setLoaded(true)); }, []);

  const activeCategory = categories.find((c) => c.id === activeCat) ?? null;
  const shown = profiles.filter((p) => p.category === activeCat);

  async function saveCategoryName(name: string) {
    if (catMeta === 'edit' && activeCategory) await updateProfileCategory(activeCategory.id, name);
    else {
      const id = await createProfileCategory(name);
      setActiveCat(id);
    }
    setCatMeta(null);
    await refresh();
  }

  async function confirmDeleteCategory() {
    if (!catDelete) return;
    setDeleting(true);
    try {
      await deleteProfileCategory(catDelete.id);
      setCatDelete(null);
      setEditMode(false);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function saveProfile(cfg: SaveCfg) {
    if (editing) await updateProfile(editing.id, cfg);
    else await createProfile(cfg);
    setEditorOpen(false);
    setEditing(null);
    await refresh();
  }

  async function confirmDeleteProfile() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProfile(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  function openCreate() { setEditing(null); setEditorOpen(true); }

  // Stable identity: the editor re-hydrates from `initial` whenever it changes,
  // so a fresh object per render would wipe what's being typed.
  const editorInitial = useMemo(
    () => editing ?? (activeCat ? { category: activeCat } : undefined),
    [editing, activeCat]);

  const catProfileCount = catDelete ? profiles.filter((p) => p.category === catDelete.id).length : 0;

  return (
    <PageShell>
      <header class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Profile</h1>
        <button type="button" onClick={openCreate} disabled={!activeCategory}
          class={`${btnPrimary} hidden md:inline-flex`}>
          + Neues Profil
        </button>
      </header>
      {activeCategory && <Fab icon={Plus} label="Neues Profil" onClick={openCreate} />}

      <div class="my-4 flex items-end gap-2 border-b border-border">
        <div class="flex flex-1 overflow-x-auto">
          {categories.map((c) => {
            const active = c.id === activeCat;
            return (
              <TabBtn key={c.id} active={active}
                onClick={() => { if (!active) setActiveCat(c.id); }}>
                {c.name}
                {editMode && active && (
                  <button type="button" title="Umbenennen / Löschen"
                    onClick={(e) => { e.stopPropagation(); setCatMeta('edit'); }}
                    class="ml-1.5 text-faint hover:text-fg"><Pencil size={12} /></button>
                )}
              </TabBtn>
            );
          })}
          {(editMode || categories.length === 0) && (
            <button type="button"
              class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-muted hover:text-fg"
              onClick={() => setCatMeta('create')}>
              + Neu
            </button>
          )}
        </div>
        {activeCategory && !editMode && (
          <button type="button"
            class="mb-2 flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10"
            onClick={() => setEditMode(true)}
            title="Kategorien bearbeiten">
            <Pencil size={12} /> Kategorien
          </button>
        )}
        {activeCategory && editMode && (
          <button type="button"
            class="mb-2 flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-fg hover:bg-accent/90"
            onClick={() => setEditMode(false)}
            title="Bearbeiten beenden">
            <Check size={12} /> Fertig
          </button>
        )}
      </div>

      {!loaded ? (
        <SkeletonList count={2} />
      ) : categories.length === 0 ? (
        <p class="text-sm text-muted">
          Noch keine Kategorie. Lege über „+ Neu“ eine an (z.B. Maische oder Gärung), danach kannst du Profile darin ablegen.
        </p>
      ) : shown.length === 0 ? (
        <p class="text-sm text-muted">
          Noch keine Profile in dieser Kategorie. Ein Profil ist eine wiederverwendbare Schrittfolge, die du in ein Programm übernehmen kannst.
        </p>
      ) : (
        <div class="space-y-4">
          {shown.map((p) => (
            <div key={p.id} class="rounded-md border border-card-border bg-card p-4 shadow-elev-2">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5">
                  <ListChecks size={20} class="mt-0.5 shrink-0 text-muted" />
                  <div>
                    <div class="font-medium">{p.name}</div>
                    <div class="text-xs text-muted">
                      {p.steps.length} Schritt{p.steps.length === 1 ? '' : 'e'}
                      {' · '}
                      {fmtDuration(p.steps.reduce((sum, s) => sum + s.holdSec, 0))}
                    </div>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2 text-xs">
                  <button type="button" onClick={() => { setEditing(p); setEditorOpen(true); }}
                    class="rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10"
                    title="Profil bearbeiten">
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(p)}
                    class="rounded-md border border-border px-2 py-1 text-critical hover:bg-fg/10"
                    title="Profil löschen">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NameModal
        open={catMeta !== null}
        title={catMeta === 'edit' ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
        submitLabel={catMeta === 'edit' ? 'Speichern' : 'Erstellen'}
        placeholder="z.B. Maische"
        initial={catMeta === 'edit' ? (activeCategory ?? undefined) : undefined}
        onSave={saveCategoryName}
        onDelete={catMeta === 'edit' && activeCategory
          ? () => { setCatDelete(activeCategory); setCatMeta(null); }
          : undefined}
        onClose={() => setCatMeta(null)}
      />

      <ProfileEditorModal
        open={editorOpen}
        categories={categories}
        initial={editorInitial}
        editing={editing !== null}
        onSave={saveProfile}
        onDelete={editing ? () => { setDeleteTarget(editing); setEditorOpen(false); } : undefined}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Profil löschen?"
        confirmLabel="Löschen"
        destructive
        pending={deleting}
        onConfirm={confirmDeleteProfile}
        onCancel={() => setDeleteTarget(null)}>
        „{deleteTarget?.name}“ wird dauerhaft entfernt. Bereits daraus erstellte Programme bleiben unverändert.
      </ConfirmModal>

      <ConfirmModal
        open={catDelete !== null}
        title="Kategorie löschen?"
        confirmLabel="Löschen"
        destructive
        pending={deleting}
        onConfirm={confirmDeleteCategory}
        onCancel={() => setCatDelete(null)}>
        „{catDelete?.name}“ wird entfernt
        {catProfileCount > 0
          ? ` — zusammen mit ${catProfileCount} Profil${catProfileCount === 1 ? '' : 'en'} darin.`
          : '.'}
      </ConfirmModal>
    </PageShell>
  );
}
