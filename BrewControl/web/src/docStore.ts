// Collections of whole JSON documents, one file each on the SD card
// (firmware: JsonDocDir behind serveJsonDocDir_): GET base lists them all,
// PUT/DELETE base/<id> writes or removes one. The firmware checks only `id`.
import { failed } from './api';
import { VALID_ID } from './recipes';

export async function listDocs<T extends { id: string }>(
  base: string, normalize: (raw: T) => T, sortKey: (t: T) => string,
): Promise<T[]> {
  const r = await fetch(base);
  if (!r.ok) await failed(r);
  return ((await r.json()) as T[]).map(normalize).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export async function saveDoc<T extends { id: string; updatedAt?: number }>(base: string, doc: T): Promise<T> {
  if (!VALID_ID.test(doc.id)) throw new Error('ungültige ID');
  const saved = { ...doc, updatedAt: Date.now() };
  const r = await fetch(`${base}/${encodeURIComponent(doc.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saved),
  });
  if (!r.ok) await failed(r);
  return saved;
}

export async function deleteDoc(base: string, id: string): Promise<void> {
  const r = await fetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) await failed(r);
}
