import { describe, expect, it } from 'vitest';
import type { CatalogIngredient, Hop, StockLot } from './ingredientCatalog';
import { effectiveIngredient, entryOf, withLotEntries } from './stockLots';

const motueka = {
  id: 'hop:motueka', kind: 'hop', owner: 'catalog', name: 'Motueka',
  alphaPct: [6.5, 7.5], oilMlPer100g: [0.8, 1.2], oilComposition: { myrcene: [35, 40], linalool: [0.6, 1] },
} as Hop;
const lot = (p: Partial<StockLot> = {}): StockLot => ({ id: 'l1', ref: 'hop:motueka', amount: 250, ...p });

describe('effectiveIngredient', () => {
  it('lays the overrides over the ingredient', () => {
    const e = effectiveIngredient(motueka, lot({ overrides: { alphaPct: [8.1, 8.1] } })) as Hop;
    expect(e.alphaPct).toEqual([8.1, 8.1]);
    expect(e.oilMlPer100g).toEqual([0.8, 1.2]);
    expect(e.name).toBe('Motueka');
  });

  it('merges a group one level deep', () => {
    const e = effectiveIngredient(motueka, lot({ overrides: { oilComposition: { myrcene: [50, 50] } } as Partial<Hop> })) as Hop;
    expect(e.oilComposition).toEqual({ myrcene: [50, 50], linalool: [0.6, 1] });
    expect(motueka.oilComposition!.myrcene).toEqual([35, 40]);
  });

  it('keeps the ingredient without overrides', () => {
    expect(effectiveIngredient(motueka, lot())).toEqual(motueka);
  });
});

describe('entryOf', () => {
  const other = { id: 'hop:hbc-630', kind: 'hop', name: 'HBC 630', alphaPct: [10, 10] } as CatalogIngredient;
  const entries = withLotEntries([motueka, other], [
    lot({ overrides: { alphaPct: [9, 9] } }),
    lot({ id: 'orphan', ref: 'hop:gone' }),
  ]);
  const alpha = (c?: CatalogIngredient) => (c as Hop | undefined)?.alphaPct;

  it('appends one entry per lot whose ingredient exists', () => {
    expect(entries).toHaveLength(3);
  });

  it('finds the plain entry without a lot', () => {
    expect(alpha(entryOf({ ingredientId: 'hop:motueka' }, entries))).toEqual([6.5, 7.5]);
  });

  it('finds the lot entry of a linked row', () => {
    expect(alpha(entryOf({ ingredientId: 'hop:motueka', stockLotId: 'l1' }, entries))).toEqual([9, 9]);
  });

  it('falls back to the ingredient when the lot is gone or belongs to another one', () => {
    expect(alpha(entryOf({ ingredientId: 'hop:motueka', stockLotId: 'gone' }, entries))).toEqual([6.5, 7.5]);
    expect(alpha(entryOf({ ingredientId: 'hop:hbc-630', stockLotId: 'l1' }, entries))).toEqual([10, 10]);
  });

  it('leaves free text and a missing catalog unlinked', () => {
    expect(entryOf({}, entries)).toBeUndefined();
    expect(entryOf({ ingredientId: 'hop:motueka' }, null)).toBeUndefined();
  });

  it('lets a plain id lookup still find the ingredient first', () => {
    expect(alpha(entries.find((e) => e.id === 'hop:motueka'))).toEqual([6.5, 7.5]);
  });
});
