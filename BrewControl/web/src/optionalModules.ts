// Optional UI packages. A package is a folder /modules/<name>/ with a
// manifest.json, shipped on the SD boards and left out on the LittleFS boards
// with the small data partition. Present = switched on, so no separate flag.
// The device answers a missing file with 404 (not the SPA start page), but the
// manifest is checked for its content anyway, so a fallback page never counts.
import { useEffect, useState } from 'preact/hooks';

// The recipe pages are unfinished (recipes only live in the browser's
// localStorage): shown in `pnpm dev`, hidden in every build. The package itself
// (Rechner, catalogs) is delivered regardless.
export const RECIPE_PAGES = import.meta.env.DEV;

const checks = new Map<string, Promise<boolean>>();
const known = new Map<string, boolean>();

export function hasModule(name: string): Promise<boolean> {
  let check = checks.get(name);
  if (!check) {
    check = fetch(`/modules/${name}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m?.module === name)
      .catch(() => false)
      .then((present) => { known.set(name, present); return present; });
    checks.set(name, check);
  }
  return check;
}

// `null` while the manifest is being fetched.
export function useModule(name: string): boolean | null {
  const [present, setPresent] = useState<boolean | null>(known.get(name) ?? null);
  useEffect(() => {
    let live = true;
    hasModule(name).then((p) => { if (live) setPresent(p); });
    return () => { live = false; };
  }, [name]);
  return present;
}
