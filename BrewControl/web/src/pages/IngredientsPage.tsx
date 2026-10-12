import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { Info, PackagePlus, Pencil, Plus, Trash2 } from 'lucide-preact';
import type { CatalogIngredient, StockLot } from '../ingredientCatalog';
import {
  CATALOG_KIND, deleteStockLot, deleteUserIngredient, findIngredients, loadCatalog, lotSummary, recipeKindOf,
  reloadCatalog, saveStockLot, saveUserIngredient, useCatalog, type Catalog,
} from '../ingredientSource';
import { KINDS, uid, type IngredientKind } from '../recipes';
import { PageShell } from '../components/PageShell';
import { TabBtn } from '../components/TabBtn';
import { ConfirmModal } from '../components/ConfirmModal';
import { Fab } from '../components/Fab';
import { badge, badgeAccent, badgeCaution, btnPrimary, inp } from '../ui';
import { Card } from './recipe/fields';
import { IngredientDetail } from './ingredients/IngredientDetail';
import { IngredientForm } from './ingredients/IngredientForm';
import { StockLotForm } from './ingredients/StockLotForm';

// One tab per kind (its stock above, catalog and own ingredients below) and one
// for the whole stock. The tab is part of the path: /zutaten/<slug>.
const SLUG: Record<IngredientKind, string> = {
  fermentable: 'vergaerbares', hop: 'hopfen', yeast: 'hefen', aroma: 'aroma', auxiliary: 'hilfsstoffe',
};
const STOCK_TAB = 'lager';

const iconBtn = 'rounded-md border border-border px-2 py-1 text-muted hover:bg-fg/10';

type Dialog =
  | { kind: 'detail'; entry: CatalogIngredient }
  | { kind: 'ingredient'; entry: CatalogIngredient }
  | { kind: 'lot'; lot: StockLot; entry: CatalogIngredient; isNew: boolean }
  | { kind: 'deleteIngredient'; entry: CatalogIngredient; lots: StockLot[] }
  | { kind: 'deleteLot'; lot: StockLot; entry?: CatalogIngredient };

const today = () => new Date().toISOString().slice(0, 10);

export function IngredientsPage({ tab }: { path?: string; tab?: string }) {
  const catalog = useCatalog();
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kind = KINDS.find((k) => SLUG[k.id] === tab)?.id;
  const stockTab = tab === STOCK_TAB;

  useEffect(() => { loadCatalog().catch(() => setLoadFailed(true)); }, []);
  // An unknown tab (or none) opens the first kind.
  useEffect(() => { if (!kind && !stockTab) route(`/zutaten/${SLUG[KINDS[0].id]}`, true); }, [tab]);

  const close = () => setDialog(null);
  const done = async () => { await reloadCatalog(); setDialog(null); };

  async function run(what: string, action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await action(); await done(); } catch { setError(`${what} fehlgeschlagen.`); setDialog(null); }
    setBusy(false);
  }

  const newIngredient = (k: IngredientKind) => setDialog({ kind: 'ingredient', entry: {
    id: `user-${uid()}`, kind: CATALOG_KIND[k], owner: 'user', name: '',
  } as CatalogIngredient });
  const newLot = (entry: CatalogIngredient) =>
    setDialog({ kind: 'lot', lot: { id: uid(), ref: entry.id, amount: 0 }, entry, isNew: true });

  const ownDisabled = !catalog || catalog.storeFailed;

  return (
    <PageShell>
      <header class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold tracking-tight">Zutaten</h1>
        {kind && (
          <button type="button" class={`${btnPrimary} hidden md:inline-flex`} disabled={ownDisabled}
            onClick={() => newIngredient(kind)}>
            + Eigene Zutat
          </button>
        )}
      </header>
      {kind && !ownDisabled && <Fab icon={Plus} label="Eigene Zutat" onClick={() => newIngredient(kind)} />}

      <div class="my-4 flex overflow-x-auto border-b border-border">
        {KINDS.map((k) => (
          <TabBtn key={k.id} active={k.id === kind} onClick={() => route(`/zutaten/${SLUG[k.id]}`)}>{k.label}</TabBtn>
        ))}
        <TabBtn active={stockTab} onClick={() => route(`/zutaten/${STOCK_TAB}`)}>Lager gesamt</TabBtn>
      </div>

      {error && <p class="mb-3 text-sm text-critical">{error}</p>}
      {catalog?.storeFailed && (
        <p class="mb-3 text-sm text-critical">
          Eigene Zutaten und Lager konnten nicht geladen werden. Der Katalog ist trotzdem verfügbar.
        </p>
      )}
      {!catalog ? (
        <p class="text-sm text-muted">{loadFailed ? 'Der Zutatenkatalog konnte nicht geladen werden.' : 'Lädt …'}</p>
      ) : stockTab ? (
        <StockAll catalog={catalog} onEdit={(lot, entry) => setDialog({ kind: 'lot', lot, entry, isNew: false })}
          onDelete={(lot, entry) => setDialog({ kind: 'deleteLot', lot, entry })} />
      ) : kind ? (
        <KindTab catalog={catalog} kind={kind} ownDisabled={ownDisabled}
          onDetail={(entry) => setDialog({ kind: 'detail', entry })}
          onEdit={(entry) => setDialog({ kind: 'ingredient', entry })}
          onDeleteIngredient={(entry) => setDialog({
            kind: 'deleteIngredient', entry, lots: catalog.stock.filter((l) => l.ref === entry.id),
          })}
          onAddLot={newLot}
          onEditLot={(lot, entry) => setDialog({ kind: 'lot', lot, entry, isNew: false })}
          onDeleteLot={(lot, entry) => setDialog({ kind: 'deleteLot', lot, entry })} />
      ) : null}

      {dialog?.kind === 'detail' && <IngredientDetail entry={dialog.entry} onClose={close} />}
      {dialog?.kind === 'ingredient' && (
        <IngredientForm initial={dialog.entry} onClose={close}
          onSave={async (c) => { await saveUserIngredient(c); await done(); }} />
      )}
      {dialog?.kind === 'lot' && (
        <StockLotForm initial={dialog.lot} entry={dialog.entry} onClose={close}
          onSave={async (lot) => { await saveStockLot(lot); await done(); }}
          onDelete={dialog.isNew ? undefined : () => setDialog({ kind: 'deleteLot', lot: dialog.lot, entry: dialog.entry })} />
      )}
      <ConfirmModal open={dialog?.kind === 'deleteIngredient'} title="Eigene Zutat löschen?" confirmLabel="Löschen"
        destructive pending={busy} onCancel={close}
        onConfirm={() => {
          if (dialog?.kind !== 'deleteIngredient') return;
          const { entry, lots } = dialog;
          run('Löschen', async () => {
            for (const l of lots) await deleteStockLot(l.id);
            await deleteUserIngredient(entry.id);
          });
        }}>
        {dialog?.kind === 'deleteIngredient' && (
          <>
            „{dialog.entry.name}“ wird gelöscht
            {dialog.lots.length > 0 && <>, dazu {dialog.lots.length === 1 ? 'ein Lagerposten' : `${dialog.lots.length} Lagerposten`}</>}.
            Rezepte behalten den Namen, rechnen aber nicht mehr mit den Werten.
          </>
        )}
      </ConfirmModal>
      <ConfirmModal open={dialog?.kind === 'deleteLot'} title="Lagerposten löschen?" confirmLabel="Löschen"
        destructive pending={busy} onCancel={close}
        onConfirm={() => {
          if (dialog?.kind !== 'deleteLot') return;
          const { lot } = dialog;
          run('Löschen', () => deleteStockLot(lot.id));
        }}>
        {dialog?.kind === 'deleteLot' && (
          <>Rezepte, die diesen Posten nutzen, rechnen danach mit den Werten der Zutat
            {dialog.entry ? ` „${dialog.entry.name}“` : ''}.</>
        )}
      </ConfirmModal>
    </PageShell>
  );
}

function KindTab({ catalog, kind, ownDisabled, onDetail, onEdit, onDeleteIngredient, onAddLot, onEditLot, onDeleteLot }: {
  catalog: Catalog; kind: IngredientKind; ownDisabled: boolean;
  onDetail: (c: CatalogIngredient) => void;
  onEdit: (c: CatalogIngredient) => void;
  onDeleteIngredient: (c: CatalogIngredient) => void;
  onAddLot: (c: CatalogIngredient) => void;
  onEditLot: (lot: StockLot, entry: CatalogIngredient) => void;
  onDeleteLot: (lot: StockLot, entry: CatalogIngredient) => void;
}) {
  const [query, setQuery] = useState('');
  const lots = lotsWithEntry(catalog).filter((x) => x.entry && recipeKindOf(x.entry.kind) === kind);
  const list = findIngredients(catalog.ingredients, kind, query, Infinity)
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <>
      <Card title="Im Lager">
        {lots.length === 0 ? (
          <p class="text-sm text-muted">Nichts im Lager. „Ins Lager“ an einer Zutat unten legt einen Posten an.</p>
        ) : (
          <div class="space-y-2">
            {lots.map(({ lot, entry }) => (
              <LotRow key={lot.id} lot={lot} entry={entry!} onEdit={onEditLot} onDelete={onDeleteLot} />
            ))}
          </div>
        )}
      </Card>
      <Card title="Katalog & eigene">
        <input class={`${inp} mb-3 w-full`} placeholder="Suchen (Name oder Hersteller)" value={query}
          onInput={(e) => setQuery(e.currentTarget.value)} />
        {list.length === 0 ? (
          <p class="text-sm text-muted">{query ? 'Keine Treffer.' : 'Keine Zutaten dieser Art.'}</p>
        ) : (
          <div class="space-y-2">
            {list.map((c) => {
              const own = c.owner === 'user';
              const inStock = catalog.stock.filter((l) => l.ref === c.id).length;
              return (
                <div key={c.id} class="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
                  <button type="button" class="min-w-0 flex-1 basis-48 text-left" onClick={() => onDetail(c)}>
                    <span class="text-sm">{c.name}</span>
                    {own && <span class={`ml-2 ${badgeAccent}`}>eigene</span>}
                    {inStock > 0 && <span class={`ml-2 ${badge} bg-fg/10 text-muted`}>{inStock} im Lager</span>}
                    {c.manufacturer && <span class="ml-2 text-xs text-muted">{c.manufacturer}</span>}
                  </button>
                  <div class="ml-auto flex items-center gap-2">
                    <button type="button" class={iconBtn} title="Details" aria-label="Details" onClick={() => onDetail(c)}>
                      <Info size={14} />
                    </button>
                    {own && (
                      <>
                        <button type="button" class={iconBtn} title="Bearbeiten" aria-label="Bearbeiten" onClick={() => onEdit(c)}>
                          <Pencil size={14} />
                        </button>
                        <button type="button" class={`${iconBtn} text-critical`} title="Löschen" aria-label="Löschen"
                          onClick={() => onDeleteIngredient(c)}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <button type="button" class={`${iconBtn} flex items-center gap-1 text-xs`} disabled={ownDisabled}
                      onClick={() => onAddLot(c)}>
                      <PackagePlus size={14} /> Ins Lager
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

// The whole stock, grouped by kind. Lots whose ingredient is gone come last.
function StockAll({ catalog, onEdit, onDelete }: {
  catalog: Catalog;
  onEdit: (lot: StockLot, entry: CatalogIngredient) => void;
  onDelete: (lot: StockLot, entry?: CatalogIngredient) => void;
}) {
  const all = lotsWithEntry(catalog);
  const orphans = all.filter((x) => !x.entry);
  if (all.length === 0) return <p class="text-sm text-muted">Das Lager ist leer.</p>;
  return (
    <>
      {KINDS.map((k) => {
        const lots = all.filter((x) => x.entry && recipeKindOf(x.entry.kind) === k.id);
        return lots.length === 0 ? null : (
          <Card key={k.id} title={k.label}>
            <div class="space-y-2">
              {lots.map(({ lot, entry }) => <LotRow key={lot.id} lot={lot} entry={entry!} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          </Card>
        );
      })}
      {orphans.length > 0 && (
        <Card title="Ohne Zutat">
          <div class="space-y-2">
            {orphans.map(({ lot }) => (
              <div key={lot.id} class="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span class="flex-1 text-muted">{lot.ref} (Zutat fehlt) · {lot.amount}</span>
                <button type="button" class={`${iconBtn} text-critical`} title="Löschen" aria-label="Löschen"
                  onClick={() => onDelete(lot)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function LotRow({ lot, entry, onEdit, onDelete }: {
  lot: StockLot; entry: CatalogIngredient;
  onEdit: (lot: StockLot, entry: CatalogIngredient) => void;
  onDelete: (lot: StockLot, entry: CatalogIngredient) => void;
}) {
  const expired = lot.bestBefore !== undefined && lot.bestBefore < today();
  return (
    <div class="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
      <button type="button" class="min-w-0 flex-1 basis-48 text-left" onClick={() => onEdit(lot, entry)}>
        <span class="text-sm">{entry.name}</span>
        <span class="ml-2 text-xs text-muted">{lotSummary(lot, entry)}</span>
        {lot.overrides && <span class={`ml-2 ${badgeAccent}`}>eigene Werte</span>}
        {lot.bestBefore && (
          <span class={`ml-2 ${expired ? badgeCaution : 'text-xs text-muted'}`}>
            MHD {new Date(lot.bestBefore).toLocaleDateString('de-DE')}
          </span>
        )}
      </button>
      <div class="ml-auto flex items-center gap-2">
        <button type="button" class={iconBtn} title="Bearbeiten" aria-label="Bearbeiten" onClick={() => onEdit(lot, entry)}>
          <Pencil size={14} />
        </button>
        <button type="button" class={`${iconBtn} text-critical`} title="Löschen" aria-label="Löschen" onClick={() => onDelete(lot, entry)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// Lots with their ingredient, by ingredient name, then crop year.
function lotsWithEntry(catalog: Catalog): { lot: StockLot; entry?: CatalogIngredient }[] {
  return catalog.stock
    .map((lot) => ({ lot, entry: catalog.ingredients.find((c) => c.id === lot.ref) }))
    .sort((a, b) => (a.entry?.name ?? '').localeCompare(b.entry?.name ?? '', 'de')
      || (a.lot.cropYear ?? 0) - (b.lot.cropYear ?? 0));
}
