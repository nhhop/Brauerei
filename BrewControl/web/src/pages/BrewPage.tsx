import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Ellipsis } from 'lucide-preact';
import {
  PHASES, STATUS_LABEL, deleteBrew, getBrew, listBrews, moveBrewDate, occupancyOverlaps, saveBrew,
  type Brew, type BrewSummary,
} from '../brews';
import { unbookStock } from '../brewStart';
import { getBrewery, listBrewhouses, type Brewery, type Brewhouse } from '../brewhouse';
import { listFermenters, type Fermenter } from '../cellar';
import { reloadCatalog, saveStockLot } from '../ingredientSource';
import { getRecipe, type Recipe } from '../recipes';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { btnPrimary, btnSecondary, inp } from '../ui';
import { Card, Field, MenuItem } from './recipe/fields';
import { StartBrewDialog } from './brew/StartBrewDialog';
import { formatIsoDate } from './brew/format';
import { statusBadge } from './BrewsPage';

const summaryOf = (b: Brew): BrewSummary => {
  const { id, number, name, recipeId, rootId, version, status, brewDate, fermenterId, occupiedFrom, occupiedUntil, updatedAt } = b;
  return { id, number, name, recipeId, rootId, version, status, brewDate, fermenterId, occupiedFrom, occupiedUntil, updatedAt };
};

// One brew. Edits stay in a draft until "Speichern", as in the recipe editor.
// Until the start the brew uses today's brewhouse and fermenter; from then on
// its frozen copies. The phase tabs get their content with 5b and 5c.
export function BrewPage({ id }: { path?: string; id?: string }) {
  const [saved, setSaved] = useState<Brew | null>(null);
  const [draft, setDraft] = useState<Brew | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);  // null = gone
  const [all, setAll] = useState<BrewSummary[]>([]);
  const [brewhouses, setBrewhouses] = useState<Brewhouse[] | null>(null);
  const [fermenters, setFermenters] = useState<Fermenter[] | null>(null);
  const [brewery, setBrewery] = useState<Brewery | null>(null);
  const [tab, setTab] = useState<string>(PHASES[0].id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<'start' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoadState('loading');
    (id ? getBrew(id) : Promise.resolve(null))
      .then((b) => {
        if (!alive) return;
        setSaved(b);
        setDraft(b);
        setLoadState('missing');
        if (b) getRecipe(b.recipeId).then((r) => alive && setRecipe(r)).catch(() => alive && setRecipe(null));
      })
      .catch(() => alive && setLoadState('error'));
    listBrews().then((l) => alive && setAll(l)).catch(() => {});
    listBrewhouses().then((l) => alive && setBrewhouses(l)).catch(() => {});
    listFermenters().then((l) => alive && setFermenters(l)).catch(() => {});
    getBrewery().then((b) => alive && setBrewery(b)).catch(() => {});
    return () => { alive = false; };
  }, [id]);

  if (!draft || !saved) {
    const [crumb, text] = {
      loading: ['Lädt …', 'Lädt …'],
      missing: ['Nicht gefunden', 'Sud nicht gefunden.'],
      error: ['Fehler', 'Sud konnte nicht geladen werden.'],
    }[loadState];
    return (
      <PageShell>
        <Breadcrumb trail={[{ label: 'Sude', href: '/sude' }, { label: crumb }]} />
        <p class="mt-4 text-sm text-muted">{text}</p>
      </PageShell>
    );
  }

  const dirty = JSON.stringify({ ...draft, updatedAt: 0 }) !== JSON.stringify({ ...saved, updatedAt: 0 });
  const planned = saved.status === 'planned';
  const set = (patch: Partial<Brew>) => setDraft({ ...draft, ...patch });
  const overlaps = occupancyOverlaps(summaryOf(draft), all);
  const brewhouse = brewhouses?.find((b) => b.id === saved.brewhouseId);
  const fermenter = fermenters?.find((f) => f.id === saved.fermenterId);

  async function persist(b: Brew) {
    const s = await saveBrew(b);
    setSaved(s);
    setDraft(s);
    setAll((l) => [...l.filter((x) => x.id !== s.id), summaryOf(s)]);
  }

  function save() {
    setError(null);
    saveBrew(draft!)
      .then((s) => { setSaved(s); setAll((l) => [...l.filter((x) => x.id !== s.id), summaryOf(s)]); })
      .catch(() => setError('Speichern fehlgeschlagen.'));
  }

  async function run(what: () => Promise<void>, failure: string) {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try { await what(); } catch { setError(failure); }
    setBusy(false);
  }

  // Gives the taken amounts back to lots that still exist, then deletes.
  const remove = (giveBack: boolean) => run(async () => {
    setDialog(null);
    if (giveBack) {
      const catalog = await reloadCatalog();
      for (const b of saved.booked ?? []) {
        const lot = catalog.stock.find((l) => l.id === b.lotId);
        if (lot) await saveStockLot(unbookStock(lot, b.amount));
      }
      await reloadCatalog();
    }
    await deleteBrew(saved.id);
    route('/sude');
  }, 'Löschen fehlgeschlagen.');

  // A frozen copy wins over today's object once the brew has started.
  const brewhouseName = planned ? undefined : saved.frozen?.brewhouse?.name ?? '–';
  const fermenterName = planned ? undefined : saved.frozen?.fermenter?.name ?? '–';
  const startBlock = dirty ? 'erst speichern' : !recipe ? 'Rezept fehlt' : !brewery ? 'Brauerei lädt …' : undefined;

  return (
    <PageShell>
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Breadcrumb trail={[{ label: 'Sude', href: '/sude' }, { label: `#${saved.number} ${draft.name || 'Ohne Namen'}` }]} />
          <span class={statusBadge(saved.status)}>{STATUS_LABEL[saved.status]}</span>
        </div>
        <div class="flex items-center gap-2">
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
                  {planned && (
                    <MenuItem label="Brautag starten" sub={startBlock} disabled={!!startBlock || busy}
                      onClick={() => { setMenuOpen(false); setDialog('start'); }} />
                  )}
                  {saved.status === 'active' && (
                    <MenuItem label="Abschließen" sub={dirty ? 'erst speichern' : undefined} disabled={dirty || busy}
                      onClick={() => run(() => persist({ ...saved, status: 'done' }), 'Abschließen fehlgeschlagen.')} />
                  )}
                  <MenuItem label="Löschen" disabled={busy} onClick={() => { setMenuOpen(false); setDialog('delete'); }} />
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {error && <p class="mt-2 text-sm text-critical">{error}</p>}

      <div class="mt-4" />
      <Card title="Sud">
        <div class="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input class={`${inp} w-full`} value={draft.name} onInput={(e) => set({ name: e.currentTarget.value })} />
          </Field>
          <Field label="Rezept">
            <div class="py-1.5 text-sm">
              {recipe === null ? <span class="text-critical">Rezeptversion fehlt</span> : (
                <a class="text-accent hover:underline" href={`/rezepte/${saved.recipeId}`}>
                  {recipe?.name ?? '…'} · v{saved.version}
                </a>
              )}
            </div>
          </Field>
          <Field label="Brautag">
            <input type="date" class={`${inp} w-full`} value={draft.brewDate ?? ''}
              onInput={(e) => setDraft(moveBrewDate(draft, e.currentTarget.value || undefined))} />
          </Field>
          <Field label="Sudhaus">
            {planned ? (
              <select class={`${inp} w-full`} value={draft.brewhouseId ?? ''}
                onChange={(e) => set({ brewhouseId: e.currentTarget.value || undefined })}>
                <option value="">–</option>
                {brewhouses?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                {draft.brewhouseId && brewhouses && !brewhouse && <option value={draft.brewhouseId}>fehlt</option>}
              </select>
            ) : <div class="py-1.5 text-sm">{brewhouseName} <span class="text-xs text-muted">(Stand Brautag)</span></div>}
          </Field>
          <Field label="Gärplatz">
            {planned ? (
              <select class={`${inp} w-full`} value={draft.fermenterId ?? ''}
                onChange={(e) => set({ fermenterId: e.currentTarget.value || undefined })}>
                <option value="">–</option>
                {fermenters?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                {draft.fermenterId && fermenters && !fermenter && <option value={draft.fermenterId}>fehlt</option>}
              </select>
            ) : <div class="py-1.5 text-sm">{fermenterName} <span class="text-xs text-muted">(Stand Brautag)</span></div>}
          </Field>
          <div class="grid grid-cols-2 gap-3">
            <Field label="Belegt ab">
              <input type="date" class={`${inp} w-full`} value={draft.occupiedFrom ?? ''}
                onInput={(e) => set({ occupiedFrom: e.currentTarget.value || undefined })} />
            </Field>
            <Field label="Belegt bis">
              <input type="date" class={`${inp} w-full`} value={draft.occupiedUntil ?? ''}
                onInput={(e) => set({ occupiedUntil: e.currentTarget.value || undefined })} />
            </Field>
          </div>
        </div>
        {overlaps.length > 0 && (
          <p class="mt-3 text-sm text-caution">
            Der Gärplatz ist in diesem Zeitraum auch belegt von {overlaps.map((o) =>
              `#${o.number} ${o.name}${o.occupiedFrom && o.occupiedUntil ? ` (${formatIsoDate(o.occupiedFrom)}–${formatIsoDate(o.occupiedUntil)})` : ''}`).join(', ')}.
          </p>
        )}
        {draft.occupiedFrom && draft.occupiedUntil && draft.occupiedUntil < draft.occupiedFrom && (
          <p class="mt-3 text-sm text-caution">„Belegt bis“ liegt vor „Belegt ab“.</p>
        )}
        <div class="mt-3">
          <Field label="Notizen">
            <textarea class={`${inp} w-full`} rows={2} value={draft.notes ?? ''}
              onInput={(e) => set({ notes: e.currentTarget.value || undefined })} />
          </Field>
        </div>
      </Card>

      <div class="my-4 flex overflow-x-auto border-b border-border">
        {PHASES.map((p, i) => (
          <TabBtn key={p.id} active={p.id === tab} onClick={() => setTab(p.id)}>{i + 1}. {p.label}</TabBtn>
        ))}
      </div>
      <p class="text-sm text-muted">
        {PHASES.findIndex((p) => p.id === tab) < 3
          ? 'Inhalt folgt mit dem Brautag (Etappe 5b): Soll/Ist-Messwerte, Zutaten abhaken, Kochtimer.'
          : 'Inhalt folgt mit Gärung, Reifung und Abfüllung (Etappe 5c), dazu der Belegungsplan.'}
      </p>

      {dialog === 'start' && recipe && brewery && (
        <StartBrewDialog brew={saved} recipe={recipe} brewhouse={brewhouse} brewery={brewery} fermenter={fermenter}
          onStarted={async (b) => { await persist(b); if (b.status === 'active') setDialog(null); }}
          onClose={() => setDialog(null)} />
      )}
      <ConfirmModal open={dialog === 'delete'} title="Sud löschen?" confirmLabel="Löschen" destructive pending={busy}
        onConfirm={() => remove(false)} onCancel={() => setDialog(null)}
        extraLabel={saved.booked?.length ? 'Löschen und Lager zurückbuchen' : undefined}
        onExtra={saved.booked?.length ? () => remove(true) : undefined}>
        #{saved.number} „{saved.name || 'Ohne Namen'}“ wird dauerhaft entfernt.
        {saved.booked?.length ? ` Er hat ${saved.booked.length === 1 ? 'einen Lagerposten' : `${saved.booked.length} Lagerposten`} abgebucht; „zurückbuchen“ gibt die Mengen den Posten zurück, die es noch gibt.` : ''}
      </ConfirmModal>
    </PageShell>
  );
}
