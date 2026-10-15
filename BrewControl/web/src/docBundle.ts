// Backup files of device documents (recipes, brews) that GET /api/backup does
// not cover: a typed JSON bundle, built and replayed one request at a time (the
// SD read/write costs ~60 ms per document).

// The firmware's isValidRecipeId (RecipeFiles.h): the id becomes a file name.
export const VALID_ID = /^[0-9a-zA-Z_-]{1,32}$/;

export interface BundleKind {
  type: string;    // "brewcontrol-recipes"
  key: string;     // property holding the documents: "recipes"
  // German texts for the errors: "keine Rezept-Sicherung", "Rezeptliste fehlt",
  // "Rezept mit ungültiger ID", "… von 3 Rezepten eingespielt".
  backup: string;  // "Rezept-Sicherung"
  list: string;    // "Rezeptliste"
  one: string;     // "Rezept"
  many: string;    // "Rezepten" (dative plural)
}

// `extra`: further properties of the bundle (the brews' readings), which an
// older reader of the file leaves alone.
export function makeBundle<T>(kind: BundleKind, docs: T[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: kind.type, version: 1, [kind.key]: docs, ...extra });
}

export function parseBundle<T extends { id: string }>(kind: BundleKind, text: string): T[] {
  let bundle: Record<string, unknown>;
  try { bundle = JSON.parse(text); } catch { throw new Error('keine gültige JSON-Datei'); }
  if (bundle?.type !== kind.type) throw new Error(`keine ${kind.backup}`);
  if (bundle.version !== 1) throw new Error('nicht unterstützte Version');
  const docs = bundle[kind.key];
  if (!Array.isArray(docs)) throw new Error(`${kind.list} fehlt`);
  for (const d of docs as T[]) {
    if (typeof d?.id !== 'string' || !VALID_ID.test(d.id)) throw new Error(`${kind.one} mit ungültiger ID`);
  }
  return docs as T[];
}

// Same id → overwritten. Stops at the first failure; running it again is safe,
// so the message says how far it got.
export async function importBundle<T extends { id: string }>(
  kind: BundleKind, text: string, put: (doc: T) => Promise<void>,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const docs = parseBundle<T>(kind, text);
  let done = 0;
  onProgress?.(0, docs.length);
  for (const d of docs) {
    try { await put(d); } catch (e) {
      throw new Error(`${done} von ${docs.length} ${kind.many} eingespielt, dann: ${e}`);
    }
    done++;
    onProgress?.(done, docs.length);
  }
  return done;
}
