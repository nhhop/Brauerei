import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { route } from 'preact-router';
import { Ellipsis } from 'lucide-preact';
import { saveJson } from '../api';
import { getBrewery, listBrewhouses, type Brewery, type Brewhouse } from '../brewhouse';
import {
  deleteRecipe, duplicateRecipe, exportRecipes, getRecipe, groupVersions, listRecipes, newVersion, rootOf,
  saveRecipe, versionOf, type Recipe, type RecipeSummary,
} from '../recipes';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { badgeAccent, badgeSuccess, btnPrimary, btnSecondary } from '../ui';
import { MenuItem } from './recipe/fields';
import { VersionSelect } from './recipe/Versions';
import { MashTab } from './recipe/MashTab';
import {
  BoilTab, FermentationTab, IngredientsTab, OverviewTab, type TabProps,
} from './recipe/tabs';
import { WaterTab } from './recipe/WaterTab';

const TABS: { id: string; label: string; view: (p: TabProps) => JSX.Element }[] = [
  { id: 'overview', label: 'Übersicht', view: OverviewTab },
  { id: 'ingredients', label: 'Zutaten', view: IngredientsTab },
  { id: 'water', label: 'Wasser', view: WaterTab },
  { id: 'mash', label: 'Maischen', view: MashTab },
  { id: 'boil', label: 'Würzekochen', view: BoilTab },
  { id: 'fermentation', label: 'Gärung', view: FermentationTab },
];

const summaryOf = ({ id, name, style, volumeL, status, rootId, version, updatedAt }: Recipe): RecipeSummary =>
  ({ id, name, style, volumeL, status, rootId, version, updatedAt });

// Recipe editor. Changes stay in a local draft until "Speichern" — no autosave.
export function RecipeEditPage({ id }: { path?: string; id?: string }) {
  const [saved, setSaved] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState('overview');
  const [brewhouses, setBrewhouses] = useState<Brewhouse[] | null>(null);
  const [brewery, setBrewery] = useState<Brewery | null>(null);
  const [list, setList] = useState<RecipeSummary[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ discardFor: string } | 'deleteVersion' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadState('loading');
    setSaved(null);
    setDraft(null);
    setList(null);
    setActionError(null);
    listRecipes().then((l) => alive && setList(l)).catch(() => {});
    (id ? getRecipe(id) : Promise.resolve(null))
      .then((r) => {
        if (!alive) return;
        setSaved(r);
        setDraft(r);
        setLoadState('missing');
      })
      .catch(() => alive && setLoadState('error'));
    listBrewhouses().then((list) => alive && setBrewhouses(list)).catch(() => {});
    getBrewery().then((b) => alive && setBrewery(b)).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  if (!draft || !saved) {
    const [crumb, text] = {
      loading: ['Lädt …', 'Lädt …'],
      missing: ['Nicht gefunden', 'Rezept nicht gefunden.'],
      error: ['Fehler', 'Rezept konnte nicht geladen werden.'],
    }[loadState];
    return (
      <PageShell>
        <Breadcrumb trail={[{ label: 'Rezepte', href: '/rezepte' }, { label: crumb }]} />
        <p class="mt-4 text-sm text-muted">{text}</p>
      </PageShell>
    );
  }

  // updatedAt only changes on save, so it must not count as an edit.
  const dirty = JSON.stringify({ ...draft, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 });
  const View = TABS.find((t) => t.id === tab)!.view;
  // The versions of this recipe, the saved state of the open one included even
  // when the list is stale or did not load.
  const versions = groupVersions([...(list ?? []).filter((r) => r.id !== saved.id), summaryOf(saved)])
    .find((g) => rootOf(g[0]) === rootOf(saved))!;

  function openVersion(to: string) {
    if (to === saved!.id) return;
    if (dirty) setConfirm({ discardFor: to });
    else route(`/rezepte/${to}`);
  }

  // Menu actions work on the saved state; they are locked while there are edits.
  async function act(what: () => Promise<void>, failure: string) {
    setMenuOpen(false);
    setActionError(null);
    try { await what(); } catch { setActionError(failure); }
  }
  const createVersion = () => act(async () => {
    const v = await saveRecipe(newVersion(saved!, versions));
    route(`/rezepte/${v.id}`);
  }, 'Neue Version konnte nicht angelegt werden.');
  const duplicate = () => act(async () => {
    const r = await saveRecipe(duplicateRecipe(saved!));
    route(`/rezepte/${r.id}`);
  }, 'Rezept konnte nicht dupliziert werden.');
  const exportJson = () => act(async () => {
    saveJson(await exportRecipes(versions), `${(saved!.name || 'Rezept').replace(/[\\/:*?"<>|]+/g, '-')}.json`);
  }, 'Export fehlgeschlagen.');
  const deleteVersion = () => {
    setConfirm(null);
    return act(async () => {
      await deleteRecipe(saved!.id);
      const rest = versions.filter((v) => v.id !== saved!.id);
      route(`/rezepte/${rest[rest.length - 1].id}`);
    }, 'Version konnte nicht gelöscht werden.');
  };

  // The saved copy is what was sent, so edits made while the request runs stay dirty.
  function save() {
    setSaveError(false);
    saveRecipe(draft!)
      .then(setSaved)
      .catch(() => setSaveError(true));
  }

  return (
    <PageShell>
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Breadcrumb trail={[{ label: 'Rezepte', href: '/rezepte' }, { label: draft.name || 'Ohne Namen' }]} />
          {versions.length > 1 && <VersionSelect versions={versions} current={saved.id} onOpen={openVersion} />}
          <span class={draft.status === 'draft' ? badgeAccent : badgeSuccess}>
            {draft.status === 'draft' ? 'Entwurf' : 'Fertig'}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class={btnSecondary}
            onClick={() => setDraft({ ...draft, status: draft.status === 'draft' ? 'final' : 'draft' })}>
            {draft.status === 'draft' ? 'Als fertig markieren' : 'Zurück zu Entwurf'}
          </button>
          <button type="button" class={btnPrimary} disabled={!dirty} onClick={save}>
            Speichern{dirty ? ' •' : ''}
          </button>
          <div class="relative">
            <button type="button" class={`${btnSecondary} px-2`} title="Weitere Aktionen" aria-label="Weitere Aktionen"
              aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <Ellipsis size={16} />
            </button>
            {menuOpen && (
              <>
                <div class="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div role="menu" class="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border border-card-border bg-surface p-1 shadow-elev-16">
                  {saved.status === 'final' && (
                    // Numbering needs the other versions, so it waits for the list.
                    <MenuItem label="Neue Version als Entwurf" sub={dirty ? 'erst speichern' : list === null ? 'lädt …' : undefined}
                      disabled={dirty || list === null} onClick={createVersion} />
                  )}
                  <MenuItem label="Duplizieren" sub={dirty ? 'erst speichern' : undefined} disabled={dirty} onClick={duplicate} />
                  <MenuItem label="Exportieren (JSON)" sub={dirty ? 'erst speichern' : undefined} disabled={dirty} onClick={exportJson} />
                  {versions.length > 1 && (
                    <MenuItem label="Diese Version löschen" onClick={() => { setMenuOpen(false); setConfirm('deleteVersion'); }} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {saveError && <p class="mt-2 text-sm text-critical">Speichern fehlgeschlagen. Das Rezept ist nur im Browser vorhanden, bis es gespeichert ist.</p>}
      {actionError && <p class="mt-2 text-sm text-critical">{actionError}</p>}

      <div class="my-4 flex overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <TabBtn key={t.id} active={t.id === tab} onClick={() => setTab(t.id)}>{t.label}</TabBtn>
        ))}
      </div>

      <View recipe={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} brewhouses={brewhouses} brewery={brewery}
        versions={versions} onOpenVersion={openVersion} />

      <ConfirmModal open={typeof confirm === 'object' && confirm !== null} title="Änderungen verwerfen?"
        confirmLabel="Verwerfen" destructive
        onConfirm={() => { const to = (confirm as { discardFor: string }).discardFor; setConfirm(null); route(`/rezepte/${to}`); }}
        onCancel={() => setConfirm(null)}>
        Die ungespeicherten Änderungen an v{versionOf(saved)} gehen verloren.
      </ConfirmModal>
      <ConfirmModal open={confirm === 'deleteVersion'} title="Version löschen?" confirmLabel="Löschen" destructive
        onConfirm={deleteVersion} onCancel={() => setConfirm(null)}>
        v{versionOf(saved)} von „{saved.name || 'Ohne Namen'}“ wird dauerhaft entfernt, die übrigen Versionen bleiben.
      </ConfirmModal>
    </PageShell>
  );
}
