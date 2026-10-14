import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Ellipsis } from 'lucide-preact';
import {
  PHASES, STATUS_LABEL, deleteBrew, getBrew, headOf, listBrews, moveBrewDate, occupancyOverlaps, patchBrew, saveBrew,
  summaryOf, withHead, type Brew, type BrewSummary, type HeadField,
} from '../brews';
import { brewInputs, brewTargets, withResults } from '../brewDay';
import { unbookStock } from '../brewStart';
import { getBrewery, listBrewhouses, type Brewery, type Brewhouse } from '../brewhouse';
import { listFermenters, type Fermenter } from '../cellar';
import { reloadCatalog, saveStockLot, useCatalog } from '../ingredientSource';
import { getRecipe, type Recipe } from '../recipes';
import type { Snapshot } from '../types';
import { Breadcrumb } from '../components/Breadcrumb';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { btnPrimary, btnSecondary, inp } from '../ui';
import { Card, Field, MenuItem } from './recipe/fields';
import { BoilTab } from './brew/BoilTab';
import { dropProgram } from './brew/BrewTimer';
import { FermentTab } from './brew/FermentTab';
import { MashTab } from './brew/MashTab';
import { PrepTab, type Patch } from './brew/PrepTab';
import { StartBrewDialog } from './brew/StartBrewDialog';
import { formatIsoDate } from './brew/format';
import { statusBadge } from './BrewsPage';

// One brew. The head stays in a draft until "Speichern", as in the recipe
// editor; brew day values save at once. Both write onto a fresh copy of the
// brew (patchBrew), so two devices on the brew day keep each other's values.
// Until the start the brew uses today's brewhouse and fermenter; from then on
// its frozen copies.
export function BrewPage({ id, snap }: { path?: string; id?: string; snap: Snapshot | null }) {
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
  const catalog = useCatalog();
  // Brew day saves of this page run one after the other: each reads the brew
  // fresh, so two started together would drop the first one's change.
  const saving = useRef<Promise<void>>(Promise.resolve());
  // The recipe chain is heavy; the page re-renders with every live snapshot.
  const day = useMemo(() => {
    if (!recipe || !saved) return undefined;
    const inputs = brewInputs(saved, { brewhouses, brewery, entries: catalog?.entries ?? null, fermenters });
    return { inputs, targets: brewTargets(recipe, inputs) };
  }, [recipe, saved?.frozen, saved?.brewhouseId, saved?.fermenterId, brewhouses, fermenters, brewery, catalog]);

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

  const dirty = JSON.stringify(headOf(draft)) !== JSON.stringify(headOf(saved));
  const planned = saved.status === 'planned';
  const set = (patch: Partial<Brew>) => setDraft({ ...draft, ...patch });
  const overlaps = occupancyOverlaps(summaryOf(draft), all);
  const brewhouse = brewhouses?.find((b) => b.id === saved.brewhouseId);
  const fermenter = fermenters?.find((f) => f.id === saved.fermenterId);

  // Every save carries the results the lists show (the brew's index line).
  const results = (b: Brew) => (day ? withResults(b, day.targets) : b);

  async function persist(b: Brew) {
    const s = await saveBrew(results(b));
    setSaved(s);
    setDraft(s);
    setAll((l) => [...l.filter((x) => x.id !== s.id), summaryOf(s)]);
  }

  // Takes what the server has and keeps the head edits not saved yet, except
  // the head fields the change itself set (`fresh`).
  function adopt(s: Brew, fresh: HeadField[] = []) {
    setSaved(s);
    setDraft((d) => (d ? withHead(s, { ...d, ...Object.fromEntries(fresh.map((k) => [k, s[k]])) }) : s));
    setAll((l) => [...l.filter((x) => x.id !== s.id), summaryOf(s)]);
  }

  const patch: Patch = (change, fresh) => {
    saving.current = saving.current.then(async () => {
      setError(null);
      try { adopt(await patchBrew(saved.id, async (b) => results(await change(b))), fresh); } catch { setError('Speichern fehlgeschlagen.'); }
    });
    return saving.current;
  };

  const save = () => patch((fresh) => withHead(fresh, draft!));

  async function run(what: () => Promise<void>, failure: string) {
    setMenuOpen(false);
    setBusy(true);
    setError(null);
    try { await what(); } catch { setError(failure); }
    setBusy(false);
  }

  // The brew's programs on the device go with it; one already gone is fine.
  const dropPrograms = async () => {
    for (const id of [saved.mashProgramId, saved.boilProgramId]) if (id) await dropProgram(id);
  };

  // Gives the taken amounts back to lots that still exist, then deletes.
  const remove = (giveBack: boolean) => run(async () => {
    setDialog(null);
    await dropPrograms();
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
                      onClick={() => run(async () => {
                        await dropPrograms();
                        adopt(await patchBrew(saved.id, (b) => {
                          const { mashProgramId: _, boilProgramId: __, ...rest } = b;
                          return results({ ...rest, status: 'done' });
                        }));
                      }, 'Abschließen fehlgeschlagen.')} />
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
            ) : <div class="py-1.5 text-sm">{fermenterName} <span class="text-xs text-muted">(Wahl im Tab Gärung)</span></div>}
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
      {tab === 'prep' ? (
        !recipe || !day ? <p class="text-sm text-muted">{recipe === null ? 'Die Rezeptversion fehlt.' : 'Lädt …'}</p> : (
          <PrepTab brew={saved} recipe={recipe} inputs={day.inputs} targets={day.targets}
            stock={catalog?.stock ?? null} snap={snap} editable={!planned} patch={patch}
            notes={draft.phaseNotes?.prep} onNotes={(t) => set({ phaseNotes: { ...draft.phaseNotes, prep: t } })} />
        )
      ) : tab === 'mash' ? (
        !recipe || !day ? <p class="text-sm text-muted">{recipe === null ? 'Die Rezeptversion fehlt.' : 'Lädt …'}</p> : (
          <MashTab brew={saved} recipe={recipe} inputs={day.inputs} targets={day.targets}
            liveEntries={catalog?.entries ?? null} snap={snap} editable={!planned} patch={patch}
            notes={draft.phaseNotes?.mash} onNotes={(t) => set({ phaseNotes: { ...draft.phaseNotes, mash: t } })} />
        )
      ) : tab === 'boil' ? (
        !recipe || !day ? <p class="text-sm text-muted">{recipe === null ? 'Die Rezeptversion fehlt.' : 'Lädt …'}</p> : (
          <BoilTab brew={saved} recipe={recipe} inputs={day.inputs} targets={day.targets}
            snap={snap} editable={!planned} patch={patch}
            notes={draft.phaseNotes?.boil} onNotes={(t) => set({ phaseNotes: { ...draft.phaseNotes, boil: t } })} />
        )
      ) : tab === 'fermentation' ? (
        !recipe || !day ? <p class="text-sm text-muted">{recipe === null ? 'Die Rezeptversion fehlt.' : 'Lädt …'}</p> : (
          <FermentTab brew={saved} recipe={recipe} inputs={day.inputs} targets={day.targets}
            snap={snap} editable={!planned} patch={patch} fermenters={fermenters} all={all}
            notes={draft.phaseNotes?.fermentation} onNotes={(t) => set({ phaseNotes: { ...draft.phaseNotes, fermentation: t } })} />
        )
      ) : (
        <p class="text-sm text-muted">Inhalt folgt mit Reifung und Abfüllung (Etappe 5c).</p>
      )}

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
