import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportLibrary, importLibrary, parseLibrary } from './libraryBackup';

const BASES: Record<string, string> = {
  brewhouses: '/api/brewhouses', mashProfiles: '/api/mash-profiles', fermenters: '/api/fermenters',
  containers: '/api/containers', ingredients: '/api/ingredients', stock: '/api/stock',
  waterProfiles: '/api/water-profiles', fermentationProfiles: '/api/fermentation-profiles', styles: '/api/styles',
};

type Doc = { id: string; updatedAt?: number; name?: string };

// A stand-in for the device: one id → document map per collection, plus /api/brewery.
function mockDevice(initial: Record<string, Doc[]> = {}, brewery?: object) {
  const files = new Map<string, Map<string, Doc>>();
  for (const base of Object.values(BASES)) files.set(base, new Map((initial[base] ?? []).map((d) => [d.id, d])));
  const state = { brewery, calls: [] as string[] };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    state.calls.push(`${method} ${url}`);
    if (url === '/api/brewery') {
      if (method === 'PUT') { state.brewery = JSON.parse(init!.body as string); return new Response(null, { status: 204 }); }
      return state.brewery ? new Response(JSON.stringify(state.brewery)) : new Response('not found', { status: 404 });
    }
    const base = [...files.keys()].find((b) => url === b || url.startsWith(`${b}/`))!;
    if (url === base) return new Response(JSON.stringify([...files.get(base)!.values()]));
    const id = decodeURIComponent(url.slice(base.length + 1));
    files.get(base)!.set(id, JSON.parse(init!.body as string));
    return new Response(null, { status: 204 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { files, state };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('library backup file', () => {
  it('round-trips every collection and the brewery, keeping updatedAt', async () => {
    const full = Object.fromEntries(Object.values(BASES).map((b, i) => [b, [{ id: `d${i}`, updatedAt: 10 + i }]]));
    const src = mockDevice(full, { name: 'Keller' });
    const text = await exportLibrary();

    const dst = mockDevice();
    expect(await importLibrary(text)).toBe(10);
    for (const [base, docs] of Object.entries(full)) {
      expect([...dst.files.get(base)!.values()]).toEqual(docs);
    }
    expect(dst.state.brewery).toEqual({ name: 'Keller' });
    expect(src.state.calls.filter((c) => c.startsWith('PUT'))).toEqual([]);
  });

  it('leaves the brewery out when the device has none yet, and imports without it', async () => {
    mockDevice({ '/api/styles': [{ id: 's1' }] });
    const text = await exportLibrary();
    expect(JSON.parse(text)).not.toHaveProperty('brewery');
    const dst = mockDevice();
    expect(await importLibrary(text)).toBe(1);
    expect(dst.state.brewery).toBeUndefined();
  });

  it('overwrites a document with the same id and deletes nothing', async () => {
    const text = JSON.stringify({ type: 'brewcontrol-library', version: 1, stock: [{ id: 'a', name: 'file' }] });
    const { files } = mockDevice({ '/api/stock': [{ id: 'a', name: 'device' }, { id: 'b' }] });
    await importLibrary(text);
    expect([...files.get('/api/stock')!.values()]).toEqual([{ id: 'a', name: 'file' }, { id: 'b' }]);
  });

  it('accepts a file that lacks some collections', async () => {
    mockDevice();
    expect(await importLibrary(JSON.stringify({ type: 'brewcontrol-library', version: 1, fermenters: [{ id: 'f' }] }))).toBe(1);
  });

  it('puts the brewery in after the brewhouses and the ingredients before the stock', async () => {
    const { state } = mockDevice();
    await importLibrary(JSON.stringify({
      type: 'brewcontrol-library', version: 1, brewery: { n: 1 },
      stock: [{ id: 's' }], ingredients: [{ id: 'i' }], brewhouses: [{ id: 'b' }],
    }));
    expect(state.calls).toEqual([
      'PUT /api/brewhouses/b', 'PUT /api/brewery', 'PUT /api/ingredients/i', 'PUT /api/stock/s',
    ]);
  });

  it.each([
    ['not json', 'not json', 'keine gültige JSON-Datei'],
    ['wrong type', JSON.stringify({ type: 'brewcontrol-recipes' }), 'keine Brauanlage-Sicherung'],
    ['wrong version', JSON.stringify({ type: 'brewcontrol-library', version: 2 }), 'nicht unterstützte Version'],
    ['not a list', JSON.stringify({ type: 'brewcontrol-library', version: 1, stock: {} }), 'keine Liste'],
    ['bad id', JSON.stringify({ type: 'brewcontrol-library', version: 1, styles: [{ id: 'ok' }, { id: '../x' }] }), 'ungültiger ID'],
    ['bad brewery', JSON.stringify({ type: 'brewcontrol-library', version: 1, brewery: [] }), 'Brauerei ist kein Objekt'],
  ])('rejects %s without touching the device', async (_name, text, message) => {
    const { state } = mockDevice();
    await expect(importLibrary(text)).rejects.toThrow(message);
    expect(() => parseLibrary(text)).toThrow(message);
    expect(state.calls).toEqual([]);
  });

  it('reports progress after every written document', async () => {
    mockDevice();
    const steps: string[] = [];
    const text = JSON.stringify({ type: 'brewcontrol-library', version: 1, styles: [{ id: 'a' }], containers: [{ id: 'b' }] });
    await importLibrary(text, (done, total) => steps.push(`${done}/${total}`));
    expect(steps).toEqual(['0/2', '1/2', '2/2']);
  });

  it('reports how far it got when a write fails', async () => {
    let puts = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (++puts === 2 ? new Response('write failed', { status: 500 }) : new Response(null, { status: 204 }))));
    const text = JSON.stringify({ type: 'brewcontrol-library', version: 1, styles: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    await expect(importLibrary(text)).rejects.toThrow('1 von 3');
    expect(puts).toBe(2);
  });
});
