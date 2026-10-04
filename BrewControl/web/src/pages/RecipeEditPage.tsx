import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { getRecipe, saveRecipe, type Recipe } from '../recipes';
import { Breadcrumb } from '../components/Breadcrumb';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { badgeAccent, badgeSuccess, btnPrimary, btnSecondary } from '../ui';
import {
  BoilTab, FermentationTab, IngredientsTab, MashTab, OverviewTab, type TabProps,
} from './recipe/tabs';

const TABS: { id: string; label: string; view: (p: TabProps) => JSX.Element }[] = [
  { id: 'overview', label: 'Übersicht', view: OverviewTab },
  { id: 'ingredients', label: 'Zutaten', view: IngredientsTab },
  { id: 'mash', label: 'Maischen', view: MashTab },
  { id: 'boil', label: 'Würzekochen', view: BoilTab },
  { id: 'fermentation', label: 'Gärung', view: FermentationTab },
];

// Recipe editor. Changes stay in a local draft until "Speichern" — no autosave.
export function RecipeEditPage({ id }: { path?: string; id?: string }) {
  const stored = useMemo(() => (id ? getRecipe(id) : null), [id]);
  const [saved, setSaved] = useState<Recipe | null>(stored);
  const [draft, setDraft] = useState<Recipe | null>(stored);
  const [tab, setTab] = useState('overview');

  if (!draft || !saved) {
    return (
      <PageShell>
        <Breadcrumb trail={[{ label: 'Rezepte', href: '/rezepte' }, { label: 'Nicht gefunden' }]} />
        <p class="mt-4 text-sm text-muted">Rezept nicht gefunden.</p>
      </PageShell>
    );
  }

  // updatedAt only changes on save, so it must not count as an edit.
  const dirty = JSON.stringify({ ...draft, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 });
  const View = TABS.find((t) => t.id === tab)!.view;

  function save() {
    setSaved(saveRecipe(draft!));
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

      <div class="my-4 flex overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <TabBtn key={t.id} active={t.id === tab} onClick={() => setTab(t.id)}>{t.label}</TabBtn>
        ))}
      </div>

      <View recipe={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
    </PageShell>
  );
}
