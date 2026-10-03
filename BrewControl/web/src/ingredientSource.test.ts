import { describe, expect, it } from 'vitest';
import { findIngredients } from './ingredientSource';
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
