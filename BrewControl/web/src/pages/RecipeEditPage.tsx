import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { getBrewery, listBrewhouses, type Brewery, type Brewhouse } from '../brewhouse';
import { getRecipe, saveRecipe, type Recipe } from '../recipes';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { badgeAccent, badgeSuccess, btnPrimary, btnSecondary } from '../ui';
import {
  BoilTab, FermentationTab, IngredientsTab, MashTab, OverviewTab, type TabProps,
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

// Recipe editor. Changes stay in a local draft until "Speichern" — no autosave.
export function RecipeEditPage({ id }: { path?: string; id?: string }) {
  const [saved, setSaved] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState('overview');
  const [brewhouses, setBrewhouses] = useState<Brewhouse[] | null>(null);
  const [brewery, setBrewery] = useState<Brewery | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadState('loading');
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
        <div class="flex min-w-0 items-center gap-3">
          <Breadcrumb trail={[{ label: 'Rezepte', href: '/rezepte' }, { label: draft.name || 'Ohne Namen' }]} />
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
        </div>
      </header>
      {saveError && <p class="mt-2 text-sm text-critical">Speichern fehlgeschlagen. Das Rezept ist nur im Browser vorhanden, bis es gespeichert ist.</p>}

      <div class="my-4 flex overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <TabBtn key={t.id} active={t.id === tab} onClick={() => setTab(t.id)}>{t.label}</TabBtn>
        ))}
      </div>

      <View recipe={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} brewhouses={brewhouses} brewery={brewery} />
    </PageShell>
  );
}
