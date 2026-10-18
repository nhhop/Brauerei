import { describe, expect, it } from 'vitest';
import { DEFAULT_BREWERY, type Brewery } from './brewhouse';
import type { WaterProfile } from './waterChem';
import { migrateWaters, type WaterStore } from './waterProfiles';

const water = (id: string, name: string, target?: true): WaterProfile =>
  ({ id, name, ca: 50, mg: 10, na: 5, cl: 20, so4: 30, hco3: 150, ...(target ? { target } : {}) });

function fakeStore(stored: WaterProfile[], fail?: 'list' | 'save' | 'brewery') {
  const saved: WaterProfile[] = [];
  const breweries: Brewery[] = [];
  const store: WaterStore = {
    list: async () => { if (fail === 'list') throw new Error('404'); return [...stored]; },
    save: async (p) => { if (fail === 'save') throw new Error('500'); saved.push(p); return p; },
    saveBrewery: async (b) => { if (fail === 'brewery') throw new Error('500'); breweries.push(b); },
  };
  return { store, saved, breweries };
}

describe('migrateWaters', () => {
  it('moves the legacy profiles into the collection and saves the brewery without them', async () => {
    const tap = water('tap', 'Zapfhahn');
    const goal = water('goal', 'Mein Ziel', true);
    const { store, saved, breweries } = fakeStore([]);
    const b = await migrateWaters({ ...DEFAULT_BREWERY, waters: [goal, tap] }, store);
    expect(saved.map((w) => w.id)).toEqual(['goal', 'tap']);
    expect(breweries).toHaveLength(1);
    expect(breweries[0].waters).toBeUndefined();
    // the first source water of the old list stays the default
    expect(breweries[0].defaultWaterId).toBe('tap');
    expect(b.waters!.map((w) => w.id)).toEqual(['goal', 'tap']);
  });

  it('writes only what the collection lacks and keeps a chosen default', async () => {
    const { store, saved, breweries } = fakeStore([water('a', 'A')]);
    const b = await migrateWaters({ ...DEFAULT_BREWERY, defaultWaterId: 've', waters: [water('a', 'A'), water('b', 'B')] }, store);
    expect(saved.map((w) => w.id)).toEqual(['b']);
    expect(breweries[0].defaultWaterId).toBe('ve');
    expect(b.waters!.map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('is a no-op once migrated', async () => {
    const { store, saved, breweries } = fakeStore([water('a', 'A')]);
    const b = await migrateWaters({ ...DEFAULT_BREWERY }, store);
    expect(saved).toEqual([]);
    expect(breweries).toEqual([]);
    expect(b.waters!.map((w) => w.id)).toEqual(['a']);
  });

  it('keeps the brewery document when a write fails', async () => {
    const { store, breweries } = fakeStore([], 'save');
    const b = await migrateWaters({ ...DEFAULT_BREWERY, waters: [water('a', 'A')] }, store);
    expect(breweries).toEqual([]);
    expect(b.waters!.map((w) => w.id)).toEqual(['a']);
  });

  it('leaves the legacy field without the route', async () => {
    const legacy = { ...DEFAULT_BREWERY, waters: [water('a', 'A')] };
    const { store } = fakeStore([], 'list');
    expect(await migrateWaters(legacy, store)).toBe(legacy);
  });
});
