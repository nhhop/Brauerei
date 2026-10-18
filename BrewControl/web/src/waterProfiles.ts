// Water profiles of the profile page: analyses (source waters) and own target
// profiles (`target`), one document each on the SD card
// (/waterprofiles/<id>.json), global for all recipes. VE water and the shipped
// target profiles (waterSolver.TARGET_PROFILES) live in the web UI only.
//
// Until 2026-10 the profiles lived in /brewery.json (`Brewery.waters`).
// getBrewery moves them into the collection (migrateWaters) and puts the
// collection back into `waters` in memory, so the recipe code and a brew's
// frozen brewery keep reading them from there; saveBrewery drops the field.
import type { Brewery } from './brewhouse';
import { deleteDoc, listDocs, saveDoc } from './docStore';
import type { WaterProfile } from './waterChem';

const BASE = '/api/water-profiles';

export const listWaterProfiles = () => listDocs<WaterProfile>(BASE, (p) => p, (p) => p.name);
export const saveWaterProfile = (p: WaterProfile) => saveDoc(BASE, p);
export const deleteWaterProfile = (id: string) => deleteDoc(BASE, id);

export interface WaterStore {
  list: () => Promise<WaterProfile[]>;
  save: (p: WaterProfile) => Promise<WaterProfile>;
  saveBrewery: (b: Brewery) => Promise<void>;
}

const byName = (a: WaterProfile, b: WaterProfile) => a.name.localeCompare(b.name);

// The brewery with `waters` filled from the collection. Profiles still in the
// brewery document are written to the collection first (same id, so recipes
// keep their references), then the brewery is saved without them. Recipes
// without a source water used the first profile of the old list; that one
// becomes the default water, because the collection is sorted by name.
// Idempotent: a failed step leaves the brewery document as it was and is
// retried on the next load. Without the route (older firmware) the legacy
// field stays as it is.
export async function migrateWaters(b: Brewery, store: WaterStore): Promise<Brewery> {
  let stored: WaterProfile[];
  try {
    stored = await store.list();
  } catch {
    return b;
  }
  const legacy = b.waters ?? [];
  const missing = legacy.filter((w) => !stored.some((s) => s.id === w.id));
  if (legacy.length === 0) return { ...b, waters: stored };
  try {
    for (const w of missing) stored = [...stored, await store.save(w)];
    const firstSource = legacy.find((w) => !w.target);
    const rest: Brewery = { ...b, defaultWaterId: b.defaultWaterId ?? firstSource?.id };
    delete rest.waters;
    await store.saveBrewery(rest);
    return { ...rest, waters: stored.sort(byName) };
  } catch {
    return { ...b, waters: [...stored, ...missing.filter((w) => !stored.some((s) => s.id === w.id))].sort(byName) };
  }
}
