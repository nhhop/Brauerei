import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays, exportBrews, fermentationDays, importBrews, moveBrewDate, newBrew, occupancyOverlaps, todayIso,
  type Brew, type BrewSummary,
} from './brews';
import { bookStock, freezeEntries, startBrew, stockPlan, unbookStock } from './brewStart';
import type { CatalogIngredient, Hop, StockLot } from './ingredientCatalog';
import { newRecipe, type Ingredient, type Recipe } from './recipes';
import { withLotEntries } from './stockLots';
import { DEFAULT_BREWERY } from './brewhouse';

const recipe = (p: Partial<Recipe> = {}): Recipe => ({ ...newRecipe(), id: 'r2', rootId: 'r1', version: 2, name: 'Pils', ...p });
const row = (p: Partial<Ingredient>): Ingredient => ({ id: Math.random().toString(36), kind: 'hop', name: 'x', amount: 0, timing: 'boil', ...p });

describe('dates', () => {
  it('adds days across month and daylight saving changes', () => {
    expect(addDays('2026-10-20', 14)).toBe('2026-11-03');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('gives today as a local ISO date', () => {
    expect(todayIso(new Date(2026, 9, 12, 23, 30))).toBe('2026-10-12');
  });
});

describe('newBrew', () => {
  const r = recipe({
    brewhouseId: 'bh1',
    fermentation: [{ id: 'a', name: 'Haupt', tempC: 12, duration: 10 }, { id: 'b', name: 'Reife', tempC: 2, duration: 4.5 }],
  });

  it('numbers on from the highest brew and links the recipe version', () => {
    const b = newBrew(r, [{ number: 3 }, { number: 7 }], '2026-10-20');
    expect(b).toMatchObject({ number: 8, name: 'Pils', recipeId: 'r2', rootId: 'r1', version: 2, status: 'planned', brewhouseId: 'bh1' });
  });

  it('books the fermenter from the brew day for the fermentation phases', () => {
    expect(fermentationDays(r)).toBe(15);
    const b = newBrew(r, [], '2026-10-20');
    expect([b.number, b.brewDate, b.occupiedFrom, b.occupiedUntil]).toEqual([1, '2026-10-20', '2026-10-20', '2026-11-04']);
  });

  it('moves the booked period with the brew day', () => {
    const b = moveBrewDate(newBrew(r, [], '2026-10-20'), '2026-10-25');
    expect([b.brewDate, b.occupiedFrom, b.occupiedUntil]).toEqual(['2026-10-25', '2026-10-25', '2026-11-09']);
  });
});

describe('occupancyOverlaps', () => {
  const b = (id: string, fermenterId: string | undefined, from: string, until: string): BrewSummary =>
    ({ id, number: 1, name: id, recipeId: 'r', rootId: 'r', version: 1, status: 'planned', updatedAt: 0, fermenterId, occupiedFrom: from, occupiedUntil: until });
  const me = b('me', 'f1', '2026-10-10', '2026-10-20');

  it('finds brews on the same fermenter whose period touches', () => {
    const all = [me, b('a', 'f1', '2026-10-20', '2026-10-30'), b('c', 'f1', '2026-10-21', '2026-10-30'),
      b('d', 'f2', '2026-10-12', '2026-10-14'), b('e', 'f1', '2026-09-01', '2026-10-09')];
    expect(occupancyOverlaps(me, all).map((x) => x.id)).toEqual(['a']);
  });

  it('has nothing to say without a fermenter', () => {
    expect(occupancyOverlaps({ ...me, fermenterId: undefined }, [me, b('a', undefined, '2026-10-10', '2026-10-20')])).toEqual([]);
  });
});

describe('freezeEntries', () => {
  const motueka = { id: 'hop:motueka', kind: 'hop', owner: 'catalog', name: 'Motueka', alphaPct: [6.5, 7.5], oilMlPer100g: [1, 1],
    notes: 'lang', source: { name: 'NZ Hops' }, flavors: [{ id: 'lime' }] } as Hop;
  const other = { id: 'hop:other', kind: 'hop', owner: 'catalog', name: 'Other', alphaPct: [10, 10] } as CatalogIngredient;
  const entries = withLotEntries([motueka, other], [{ id: 'l1', ref: 'hop:motueka', amount: 100, overrides: { alphaPct: [9, 9] } }]);

  it('keeps only the entries the rows hit, a lot with its values, without texts', () => {
    const frozen = freezeEntries({ ingredients: [
      row({ ingredientId: 'hop:motueka', stockLotId: 'l1' }), row({ ingredientId: 'hop:motueka', stockLotId: 'l1' }),
      row({ ingredientId: 'hop:motueka' }), row({ name: 'Freitext' }),
    ] }, entries) as (Hop & { lotId?: string })[];
    expect(frozen.map((e) => [e.id, e.lotId, e.alphaPct[0]])).toEqual([['hop:motueka', 'l1', 9], ['hop:motueka', undefined, 6.5]]);
    expect(frozen[0].notes).toBeUndefined();
    expect(frozen[0].source).toBeUndefined();
    expect(frozen[0].flavors).toBeUndefined();
    expect(frozen[0].oilMlPer100g).toEqual([1, 1]);
  });
});

describe('stock', () => {
  const lot = (p: Partial<StockLot> = {}): StockLot => ({ id: 'l1', ref: 'hop:motueka', amount: 100, ...p });
  const catalog = {
    stock: [lot()],
    ingredients: [{ id: 'hop:motueka', kind: 'hop', name: 'Motueka' } as CatalogIngredient],
  };

  it('sums the rows of one lot and flags short and missing lots', () => {
    const plan = stockPlan({ ingredients: [
      row({ stockLotId: 'l1', ingredientId: 'hop:motueka', amount: 60 }), row({ stockLotId: 'l1', ingredientId: 'hop:motueka', amount: 50 }),
      row({ stockLotId: 'gone', name: 'Weg', amount: 5 }), row({ ingredientId: 'hop:motueka', amount: 20 }),
    ] }, catalog);
    expect(plan.map((l) => [l.lotId, l.name, l.amount, l.unit, l.short, !!l.lot])).toEqual([
      ['l1', 'Motueka', 110, 'g', true, true],
      ['gone', 'Weg', 5, 'g', false, false],
    ]);
  });

  it('takes at most what is there and gives back exactly that', () => {
    const { lot: after, taken } = bookStock(lot({ amount: 30 }), 50);
    expect([after.amount, taken]).toEqual([0, 30]);
    expect(unbookStock(after, taken).amount).toBe(30);
    expect(bookStock(lot({ amount: 0.3 }), 0.1).lot.amount).toBe(0.2);
  });

  it('starts a brew with its copies and bookings', () => {
    const b = startBrew(newBrew(recipe(), [], '2026-10-20'), { brewery: DEFAULT_BREWERY, entries: [] }, [{ lotId: 'l1', amount: 30 }], 5);
    expect([b.status, b.startedAt, b.booked]).toEqual(['active', 5, [{ lotId: 'l1', amount: 30 }]]);
  });
});

describe('brew backup file', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through export and import', async () => {
    const files = new Map<string, Brew>([['b1', { ...newBrew(recipe(), [], '2026-10-20'), id: 'b1' }]]);
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const id = url.split('/').pop()!;
      if (url === '/api/brews') return new Response(JSON.stringify([...files.values()].map(({ id, number }) => ({ id, number }))));
      if (init?.method === 'PUT') { files.set(id, JSON.parse(init.body as string)); return new Response(null, { status: 204 }); }
      return files.has(id) ? new Response(JSON.stringify(files.get(id))) : new Response('not found', { status: 404 });
    }));
    const text = await exportBrews();
    files.clear();
    expect(await importBrews(text)).toBe(1);
    expect(files.get('b1')!.recipeId).toBe('r2');
  });

  it('rejects a recipe backup', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(importBrews(JSON.stringify({ type: 'brewcontrol-recipes', version: 1, recipes: [] }))).rejects.toThrow('keine Sud-Sicherung');
  });
});
