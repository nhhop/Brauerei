// The style comparison is switched off in builds until the BJCP has allowed the
// use of its style data (PLAN.md): visible in `pnpm dev`, which needs the local,
// untracked web/public/modules/recipes/bjcp-2021.json.
export const STYLE_COMPARISON = import.meta.env.DEV;

// BJCP style data. A static, versioned JSON file today; `loadStyles` is the only
// place that knows where it comes from, like `loadCatalog` for the ingredients.
import { useEffect, useState } from 'preact/hooks';

// Ranges as the BJCP prints them: OG/FG in SG, colour in SRM, ABV in % vol.
export type Span = [number, number];

export interface BjcpStyle {
  id: string;                                     // "7B"
  name: string;
  category: string;
  categoryId: string;
  og: Span;
  fg: Span;
  ibu: Span;
  srm: Span;
  abv: Span;
}

export interface StyleGuide {
  guide: string;                                  // "BJCP 2021"
  source: string;
  copyright: string;
  styles: BjcpStyle[];
}

const STYLES_URL = '/modules/recipes/bjcp-2021.json';

// Case-insensitive match on number, name or category; prefix matches on number or
// name first.
export function findStyles(all: BjcpStyle[], query: string, limit = 8): BjcpStyle[] {
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const hits = all.filter((s) => `${s.id} ${s.name} ${s.category}`.toLowerCase().includes(q));
  const starts = (s: BjcpStyle) => (s.id.toLowerCase().startsWith(q) || s.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}

let cached: Promise<StyleGuide> | null = null;
let loaded: StyleGuide | null = null; // lets a remounting component start with the data instead of null

export function loadStyles(): Promise<StyleGuide> {
  cached ??= fetch(STYLES_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<StyleGuide>;
    })
    .then((g) => (loaded = g))
    .catch((e) => { cached = null; throw e; });
  return cached;
}

// `null` while loading or if the file is missing; the style field then stays free text.
export function useStyles(): StyleGuide | null {
  const [guide, setGuide] = useState<StyleGuide | null>(loaded);
  useEffect(() => {
    let live = true;
    loadStyles().then((g) => { if (live) setGuide(g); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return guide;
}
