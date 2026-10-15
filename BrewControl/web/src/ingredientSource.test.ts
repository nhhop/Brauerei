import { afterEach, describe, expect, it, vi } from 'vitest';
import { findIngredients, findLots, loadCatalog, lotSummary, reloadCatalog, saveStockLot, saveUserIngredient, type Catalog } from './ingredientSource';
import type { CatalogIngredient } from './ingredientCatalog';

const all = [
  { id: 'malt:weyermann-pilsner', kind: 'fermentable', name: 'Pilsner Malz', manufacturer: 'Weyermann' },
  { id: 'malt:weyermann-carafa-3', kind: 'fermentable', name: 'Carafa Typ 3', manufacturer: 'Weyermann' },
  { id: 'hop:motueka', kind: 'hop', name: 'Motueka' },
  { id: 'hop:hbc-630', kind: 'hop', name: 'HBC 630' },
  { id: 'yeast:lalbrew-novalager', kind: 'culture', name: 'LalBrew NovaLager', manufacturer: 'Lallemand' },
] as CatalogIngredient[];

describe('findIngredients', () => {
  it('maps the recipe kind "yeast" to catalog cultures', () => {
    expect(findIngredients(all, 'yeast', '').map((i) => i.id)).toEqual(['yeast:lalbrew-novalager']);
  });

  it('filters by kind', () => {
    expect(findIngredients(all, 'hop', '').map((i) => i.id)).toEqual(['hop:motueka', 'hop:hbc-630']);
  });

  it('matches name case-insensitively', () => {
    expect(findIngredients(all, 'hop', 'MOTUEKA').map((i) => i.id)).toContain('hop:motueka');
  });

  it('matches the manufacturer', () => {
    expect(findIngredients(all, 'fermentable', 'weyermann')).toHaveLength(2);
  });

  it('returns nothing for an unknown query', () => {
    expect(findIngredients(all, 'hop', 'zzzz')).toEqual([]);
  });

  it('ranks prefix matches before substring matches', () => {
    const list = [
      { id: 'a', kind: 'hop', name: 'Super Citra' },
      { id: 'b', kind: 'hop', name: 'Citra' },
    ] as CatalogIngredient[];
    expect(findIngredients(list, 'hop', 'citra').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('respects the limit', () => {
    expect(findIngredients(all, 'fermentable', '', 2)).toHaveLength(2);
  });
});

describe('findLots and lotSummary', () => {
  const catalog = { ingredients: all, stock: [
    { id: 'l1', ref: 'hop:motueka', amount: 250, cropYear: 2025 },
    { id: 'l2', ref: 'malt:weyermann-pilsner', amount: 12.5 },
  ] } as Catalog;

  it('finds the lots of a kind by their ingredient', () => {
    expect(findLots(catalog, 'hop', 'mot').map((x) => x.lot.id)).toEqual(['l1']);
    expect(findLots(catalog, 'hop', 'citra')).toEqual([]);
  });

  it('summarizes crop year and amount in the unit of the kind', () => {
    const [hop] = findLots(catalog, 'hop', '');
    const [malt] = findLots(catalog, 'fermentable', '');
    expect(lotSummary(hop.lot, hop.entry)).toBe('2025 · 250 g');
    expect(lotSummary(malt.lot, malt.entry)).toBe('12,5 kg');
  });
});

describe('device storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const json = (body: unknown) => new Response(JSON.stringify(body));
  const routes = (map: Record<string, () => Response>) =>
    vi.fn(async (url: string) => (map[url] ?? (() => new Response('not found', { status: 404 })))());

  it('merges own ingredients and lots into the catalog', async () => {
    vi.stubGlobal('fetch', routes({
      '/modules/recipes/zutaten-datenblaetter.json': () => json({ catalogVersion: 'v1', vocab: {}, catalog: all }),
      '/api/ingredients': () => json([{ id: 'user-a', kind: 'hop', owner: 'user', name: 'Eigener', alphaPct: [5, 5] }]),
      '/api/stock': () => json([{ id: 'l1', ref: 'user-a', amount: 10, overrides: { alphaPct: [6, 6] } }]),
    }));
    const c = await reloadCatalog();
    expect(c.storeFailed).toBe(false);
    expect(c.ingredients.map((i) => i.id)).toContain('user-a');
    expect(c.stock).toHaveLength(1);
    expect(c.entries).toHaveLength(all.length + 2);
  });

  it('keeps the catalog when the device store fails', async () => {
    vi.stubGlobal('fetch', routes({
      '/modules/recipes/zutaten-datenblaetter.json': () => json({ catalogVersion: 'v1', vocab: {}, catalog: all }),
    }));
    const c = await reloadCatalog();
    expect(c.storeFailed).toBe(true);
    expect(c.ingredients).toHaveLength(all.length);
    expect(await loadCatalog()).toBe(c);
  });

  it('writes own ingredients and lots by id', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveUserIngredient({ id: 'user-a', kind: 'hop', owner: 'user', name: 'x' } as CatalogIngredient);
    await saveStockLot({ id: 'l1', ref: 'user-a', amount: 1 });
    expect(fetchMock).toHaveBeenCalledWith('/api/ingredients/user-a', expect.objectContaining({ method: 'PUT' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/stock/l1', expect.objectContaining({ method: 'PUT' }));
  });

  it('refuses an id that cannot be a file name', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(saveUserIngredient({ id: 'user:a' } as CatalogIngredient)).rejects.toThrow('ungültige ID');
  });
});
