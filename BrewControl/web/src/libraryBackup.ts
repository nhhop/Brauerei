// One backup file for the documents of the brewery that GET /api/backup, the
// recipe file and the brew file leave out: brewhouses, brewery, profiles, the
// cellar, own ingredients and the stock. Read and written raw (no normalize,
// no new updatedAt), one request at a time like docBundle.ts.
import { VALID_ID } from './docBundle';

const TYPE = 'brewcontrol-library';

interface Collection {
  key: string;     // property of the bundle
  base: string;    // API route of the collection
  name: string;    // German name for the errors
}

// Ingredients before stock: stock lots point to them by `ref`.
const COLLECTIONS: Collection[] = [
  { key: 'brewhouses', base: '/api/brewhouses', name: 'Sudhäuser' },
  { key: 'mashProfiles', base: '/api/mash-profiles', name: 'Maischprofile' },
  { key: 'fermenters', base: '/api/fermenters', name: 'Gärplätze' },
  { key: 'containers', base: '/api/containers', name: 'Gebinde' },
  { key: 'ingredients', base: '/api/ingredients', name: 'Zutaten' },
  { key: 'stock', base: '/api/stock', name: 'Lagerposten' },
  { key: 'waterProfiles', base: '/api/water-profiles', name: 'Wasserprofile' },
  { key: 'fermentationProfiles', base: '/api/fermentation-profiles', name: 'Gärprofile' },
  { key: 'styles', base: '/api/styles', name: 'Bierstile' },
];

type Doc = { id: string } & Record<string, unknown>;
type Library = Record<string, Doc[]> & { brewery?: Record<string, unknown> };

async function failed(r: Response): Promise<never> {
  throw new Error(`${r.status} ${(await r.text()).trim()}`.trim());
}

async function putJson(url: string, body: unknown): Promise<void> {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) await failed(r);
}

export async function exportLibrary(): Promise<string> {
  const bundle: Record<string, unknown> = { type: TYPE, version: 1 };
  for (const c of COLLECTIONS) {
    const r = await fetch(c.base);
    if (!r.ok) await failed(r);
    bundle[c.key] = await r.json();
  }
  // 404 until the brewery was first saved: no key then.
  const b = await fetch('/api/brewery');
  if (b.ok) bundle.brewery = await b.json();
  else if (b.status !== 404) await failed(b);
  return JSON.stringify(bundle);
}

export function parseLibrary(text: string): Library {
  let bundle: Record<string, unknown>;
  try { bundle = JSON.parse(text); } catch { throw new Error('keine gültige JSON-Datei'); }
  if (bundle?.type !== TYPE) throw new Error('keine Brauanlage-Sicherung');
  if (bundle.version !== 1) throw new Error('nicht unterstützte Version');
  const lib: Library = {};
  // A collection missing from the file is fine; one that is there must be sound.
  for (const c of COLLECTIONS) {
    const docs = bundle[c.key];
    if (docs === undefined) continue;
    if (!Array.isArray(docs)) throw new Error(`${c.name}liste ist keine Liste`);
    for (const d of docs as Doc[]) {
      if (typeof d?.id !== 'string' || !VALID_ID.test(d.id)) throw new Error(`${c.name}: Dokument mit ungültiger ID`);
    }
    lib[c.key] = docs as Doc[];
  }
  if (bundle.brewery !== undefined) {
    if (typeof bundle.brewery !== 'object' || bundle.brewery === null || Array.isArray(bundle.brewery)) {
      throw new Error('Brauerei ist kein Objekt');
    }
    lib.brewery = bundle.brewery as Record<string, unknown>;
  }
  return lib;
}

// Same id → overwritten; nothing is deleted. Stops at the first failure and
// says how far it got — running it again is safe.
export async function importLibrary(
  text: string, onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const lib = parseLibrary(text);
  const total = COLLECTIONS.reduce((n, c) => n + (lib[c.key]?.length ?? 0), 0) + (lib.brewery ? 1 : 0);
  let done = 0;
  onProgress?.(0, total);
  const step = async (what: string, put: () => Promise<void>) => {
    try { await put(); } catch (e) {
      throw new Error(`${done} von ${total} Dokumenten eingespielt, dann bei ${what}: ${e}`);
    }
    done++;
    onProgress?.(done, total);
  };
  for (const c of COLLECTIONS) {
    for (const d of lib[c.key] ?? []) {
      await step(`${c.name} ${d.id}`, () => putJson(`${c.base}/${encodeURIComponent(d.id)}`, d));
    }
    // The brewery goes in after the brewhouses, before the profiles.
    if (c.key === 'brewhouses' && lib.brewery) {
      await step('der Brauerei', () => putJson('/api/brewery', lib.brewery));
    }
  }
  return done;
}
