// The BJCP style data is switched off in builds until the BJCP has allowed its
// use (PLAN.md): visible in `pnpm dev`, which needs the local, untracked
// web/public/modules/recipes/bjcp-2021.json. For a local test build set
// VITE_STYLE_COMPARISON=1 (shell or .env.local); vite.config.ts then keeps the
// data file in dist/, otherwise it removes it. Own styles work without it.
export const STYLE_COMPARISON = import.meta.env.DEV || import.meta.env.VITE_STYLE_COMPARISON === '1';

// Beer styles from two sources: the BJCP 2021 guidelines (a static, versioned
// JSON file, converted on load) and the user's own styles (one document each on
// the SD card, /api/styles). This module is the only place that knows where
// they come from, like `loadCatalog` for the ingredients.
import { useEffect, useState } from 'preact/hooks';
import { EBC_PER_SRM } from './brewMath';
import { deleteDoc, listDocs, saveDoc } from './docStore';
import { sgToPlato } from './gravityUnits';

export type Span = [number, number];
export type StyleGuideId = 'bjcp-2021' | 'own';

// A style in the units of the app: OG/FG in °P, colour in EBC, ABV in % vol.
// A missing range is left out of the comparison (own styles may have gaps).
export interface BeerStyle {
  id: string;                                     // BJCP: its number ("7B"); own: a uid
  guide: StyleGuideId;
  name: string;
  category: string;                               // family, for the dialog's filter
  description?: string;
  og?: Span;
  fg?: Span;
  abv?: Span;
  ibu?: Span;
  ebc?: Span;
  updatedAt?: number;
}

// The BJCP file as stored: OG/FG in SG, colour in SRM, as the BJCP prints them.
export interface BjcpStyle {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  og: Span;
  fg: Span;
  ibu: Span;
  srm: Span;
  abv: Span;
}

export interface BjcpFile {
  guide: string;                                  // "BJCP 2021"
  source: string;
  copyright: string;
  styles: BjcpStyle[];
}

export interface StyleSource {
  guide: StyleGuideId;
  label: string;
  styles: BeerStyle[];
  copyright?: string;
  failed?: boolean;                               // own styles: the list could not be loaded
}

export const OWN_LABEL = 'Eigene';

const STYLES_URL = '/modules/recipes/bjcp-2021.json';
const BASE = '/api/styles';

const plato = (sg: Span): Span => [sgToPlato(sg[0]), sgToPlato(sg[1])];
const ebc = (srm: Span): Span => [srm[0] * EBC_PER_SRM, srm[1] * EBC_PER_SRM];

export function fromBjcp(s: BjcpStyle): BeerStyle {
  return {
    id: s.id, guide: 'bjcp-2021', name: s.name, category: s.category,
    og: plato(s.og), fg: plato(s.fg), abv: s.abv, ibu: s.ibu, ebc: ebc(s.srm),
  };
}

// The number shown before the name: the BJCP's, none for own styles.
export const styleCode = (s: BeerStyle) => (s.guide === 'own' ? '' : s.id);

// Case-insensitive match on number, name or family; prefix matches on number or
// name first.
export function findStyles(all: BeerStyle[], query: string, limit = 8): BeerStyle[] {
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const hits = all.filter((s) => `${styleCode(s)} ${s.name} ${s.category}`.toLowerCase().includes(q));
  const starts = (s: BeerStyle) => (styleCode(s).toLowerCase().startsWith(q) || s.name.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}

let cached: Promise<StyleSource | null> | null = null;

// The BJCP source, or null when the comparison is switched off or the file is
// missing (it is not in the repository).
export function loadStyles(): Promise<StyleSource | null> {
  if (!STYLE_COMPARISON) return Promise.resolve(null);
  cached ??= fetch(STYLES_URL)
    .then((r) => (r.ok ? (r.json() as Promise<BjcpFile>) : null))
    .then((f): StyleSource | null => f && {
      guide: 'bjcp-2021', label: f.guide, copyright: f.copyright, styles: f.styles.map(fromBjcp),
    })
    .catch(() => { cached = null; return null; });
  return cached;
}

export const listStyles = () => listDocs<BeerStyle>(BASE, (s) => ({ ...s, guide: 'own' }), (s) => s.name);
export const saveStyle = (s: BeerStyle) => saveDoc(BASE, { ...s, guide: 'own' as const });
export const deleteStyle = (id: string) => deleteDoc(BASE, id);

// Own styles always (empty and `failed` without the route, e.g. on boards
// without SD), BJCP 2021 only with its data. `null` while loading; `reload`
// after saving or deleting an own style.
export function useStyleSources(): { sources: StyleSource[] | null; reload: () => void } {
  const [sources, setSources] = useState<StyleSource[] | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([
      listStyles().then((styles) => ({ styles, failed: false })).catch(() => ({ styles: [], failed: true })),
      loadStyles(),
    ]).then(([own, bjcp]) => {
      if (!live) return;
      const mine: StyleSource = { guide: 'own', label: OWN_LABEL, ...own };
      setSources(bjcp ? [bjcp, mine] : [mine]);
    });
    return () => { live = false; };
  }, [round]);
  return { sources, reload: () => setRound((r) => r + 1) };
}

// The style a recipe links to: `styleGuide` unset means BJCP 2021.
export function resolveStyle(
  sources: StyleSource[] | null, link: { styleId?: string; styleGuide?: 'own' },
): { style: BeerStyle; source: StyleSource } | undefined {
  if (!link.styleId) return undefined;
  const source = sources?.find((s) => s.guide === (link.styleGuide ?? 'bjcp-2021'));
  const style = source?.styles.find((s) => s.id === link.styleId);
  return source && style ? { style, source } : undefined;
}
