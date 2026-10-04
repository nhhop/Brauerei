import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteRecipe, exportRecipes, getRecipe, importLocalRecipes, importRecipes, listRecipes, newRecipe, saveRecipe,
  type Recipe,
} from './recipes';

// A tiny stand-in for /api/recipes: ids → stored recipes.
function mockDevice(initial: Recipe[] = []) {
  const files = new Map(initial.map((r) => [r.id, r]));
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (url === '/api/recipes') {
      return new Response(JSON.stringify([...files.values()].map(({ id, name, style, volumeL, status, updatedAt }) =>
        ({ id, name, style, volumeL, status, updatedAt }))));
    }
    const id = decodeURIComponent(url.slice('/api/recipes/'.length));
    if (method === 'PUT') { files.set(id, JSON.parse(init!.body as string)); return new Response(null, { status: 204 }); }
    if (method === 'DELETE') {
      return files.delete(id) ? new Response(null, { status: 204 }) : new Response('not found', { status: 404 });
    }
    return files.has(id) ? new Response(JSON.stringify(files.get(id))) : new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { files, calls };
}

function stubLocalStorage(data: Record<string, string>) {
  const store = new Map(Object.entries(data));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k); },
  });
  return store;
}

const recipe = (id: string, patch: Partial<Recipe> = {}): Recipe => ({ ...newRecipe(), id, name: id, ...patch });

beforeEach(() => { stubLocalStorage({}); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('recipe store', () => {
  it('lists newest first', async () => {
    mockDevice([recipe('old', { updatedAt: 1 }), recipe('new', { updatedAt: 3 }), recipe('mid', { updatedAt: 2 })]);
    expect((await listRecipes()).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('saves with PUT under the recipe id and stamps updatedAt', async () => {
    const { files, calls } = mockDevice();
    const saved = await saveRecipe(recipe('a1', { updatedAt: 1 }));
    expect(calls).toEqual(['PUT /api/recipes/a1']);
    expect(saved.updatedAt).toBeGreaterThan(1);
    expect(files.get('a1')).toEqual(saved);
  });

  it('answers null for a recipe the device does not have', async () => {
    mockDevice([recipe('a1')]);
    expect((await getRecipe('a1'))?.id).toBe('a1');
    expect(await getRecipe('nope')).toBeNull();
  });

  it('rejects when the device refuses the write', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('write failed', { status: 500 })));
    await expect(saveRecipe(recipe('a1'))).rejects.toThrow('500');
  });

  it('deletes by id', async () => {
    const { files } = mockDevice([recipe('a1')]);
    await deleteRecipe('a1');
    expect(files.size).toBe(0);
  });
});

describe('recipe backup file', () => {
  it('round-trips through export and import, overwriting by id and keeping updatedAt', async () => {
    const { files } = mockDevice([recipe('a', { updatedAt: 4 }), recipe('b', { updatedAt: 7 })]);
    const text = await exportRecipes();
    files.clear();
    files.set('a', recipe('a', { name: 'changed', updatedAt: 99 }));
    expect(await importRecipes(text)).toBe(2);
    expect(files.get('a')!.name).toBe('a');
    expect(files.get('a')!.updatedAt).toBe(4);
    expect(files.get('b')!.updatedAt).toBe(7);
  });

  it.each([
    ['not json', 'not json', 'keine gültige JSON-Datei'],
    ['wrong type', JSON.stringify({ type: 'brewcontrol-backup' }), 'keine Rezept-Sicherung'],
    ['wrong version', JSON.stringify({ type: 'brewcontrol-recipes', version: 2, recipes: [] }), 'nicht unterstützte Version'],
    ['missing list', JSON.stringify({ type: 'brewcontrol-recipes', version: 1 }), 'Rezeptliste fehlt'],
    ['bad id', JSON.stringify({ type: 'brewcontrol-recipes', version: 1, recipes: [recipe('ok'), recipe('../x')] }), 'ungültiger ID'],
  ])('rejects %s without touching the device', async (_name, text, message) => {
    const { calls } = mockDevice();
    await expect(importRecipes(text)).rejects.toThrow(message);
    expect(calls).toEqual([]);
  });

  it('reports progress after every written recipe', async () => {
    mockDevice();
    const steps: string[] = [];
    const text = JSON.stringify({ type: 'brewcontrol-recipes', version: 1, recipes: [recipe('a'), recipe('b')] });
    await importRecipes(text, (done, total) => steps.push(`${done}/${total}`));
    expect(steps).toEqual(['0/2', '1/2', '2/2']);
  });

  it('reports how far it got when a write fails', async () => {
    let puts = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++puts === 2 ? new Response('write failed', { status: 500 }) : new Response(null, { status: 204 }))));
    const text = JSON.stringify({ type: 'brewcontrol-recipes', version: 1, recipes: [recipe('a'), recipe('b'), recipe('c')] });
    await expect(importRecipes(text)).rejects.toThrow('1 von 3');
    expect(puts).toBe(2);
  });
});

describe('importLocalRecipes', () => {
  it('uploads only recipes the device lacks, keeps their timestamp and drops the local copy', async () => {
    const { files, calls } = mockDevice([recipe('on-device', { name: 'device wins', updatedAt: 9 })]);
    const store = stubLocalStorage({
      'bc.recipes': JSON.stringify([recipe('on-device', { name: 'stale', updatedAt: 1 }), recipe('local', { updatedAt: 5 })]),
    });
    await importLocalRecipes();
    expect(calls).toEqual(['GET /api/recipes', 'PUT /api/recipes/local']);
    expect(files.get('on-device')!.name).toBe('device wins');
    expect(files.get('local')!.updatedAt).toBe(5);
    expect(store.has('bc.recipes')).toBe(false);
  });

  it('keeps the local copy when an upload fails, so it can be retried', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? new Response('write failed', { status: 500 }) : new Response('[]')));
    const store = stubLocalStorage({ 'bc.recipes': JSON.stringify([recipe('local')]) });
    await expect(importLocalRecipes()).rejects.toThrow('500');
    expect(store.has('bc.recipes')).toBe(true);
  });

  it('does not touch the device when there is nothing local', async () => {
    const { calls } = mockDevice();
    await importLocalRecipes();
    expect(calls).toEqual([]);
  });
});
