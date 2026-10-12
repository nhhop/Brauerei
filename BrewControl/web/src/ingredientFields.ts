// The editable values of each ingredient kind, for the ingredient page: the
// form for own ingredients, the overrides of a stock lot and the detail view
// all read this one table. Values only; name, manufacturer, origin and notes
// are common to every kind and handled by the form itself.
import type { CatalogIngredient, Range } from './ingredientCatalog';

export type FieldType = 'range' | 'number' | 'enum';

export interface FieldDef {
  key: string;      // property, or "group.property" one level deep (oilComposition.myrcene)
  label: string;
  type: FieldType;
  unit?: string;
  options?: { id: string; label: string }[];
  required?: boolean;
  // Shown only when this holds for the entry (role only for malts, …).
  when?: (c: Partial<CatalogIngredient>) => boolean;
}

const opts = (o: Record<string, string>) => Object.entries(o).map(([id, label]) => ({ id, label }));

const typeIs = (...t: string[]) => (c: Partial<CatalogIngredient>) => t.includes((c as { type?: string }).type ?? '');
const organismIs = (...o: string[]) => (c: Partial<CatalogIngredient>) =>
  o.includes((c as { organism?: string }).organism ?? '');

const OIL: [string, string][] = [
  ['myrcene', 'Myrcen'], ['humulene', 'Humulen'], ['betaCaryophyllene', 'β-Caryophyllen'],
  ['farnesene', 'Farnesen'], ['linalool', 'Linalool'], ['geraniol', 'Geraniol'],
  ['betaPinene', 'β-Pinen'], ['selinene', 'Selinen'], ['other', 'Sonstige'],
];

export const INGREDIENT_FIELDS: Record<CatalogIngredient['kind'], FieldDef[]> = {
  fermentable: [
    { key: 'type', label: 'Art', type: 'enum', required: true,
      options: opts({ malt: 'Malz', 'raw-grain': 'Rohfrucht', sugar: 'Zucker', extract: 'Malzextrakt' }) },
    { key: 'role', label: 'Malztyp', type: 'enum', required: true, when: typeIs('malt'),
      options: opts({ base: 'Basismalz', caramel: 'Karamellmalz', roasted: 'Röstmalz', specialty: 'Spezialmalz' }) },
    { key: 'grain', label: 'Getreide', type: 'enum', required: true, when: typeIs('raw-grain'),
      options: opts({ barley: 'Gerste', wheat: 'Weizen', rye: 'Roggen', oats: 'Hafer', spelt: 'Dinkel', corn: 'Mais', rice: 'Reis', other: 'Sonstiges' }) },
    { key: 'form', label: 'Form', type: 'enum', required: true, when: typeIs('raw-grain'),
      options: opts({ raw: 'roh', flaked: 'Flocken', torrefied: 'gepufft' }) },
    { key: 'form', label: 'Form', type: 'enum', required: true, when: typeIs('extract'),
      options: opts({ dry: 'trocken', liquid: 'flüssig' }) },
    { key: 'colorEbc', label: 'Farbe', type: 'range', unit: 'EBC', required: true },
    { key: 'extractDryPct', label: 'Extrakt (wasserfrei)', type: 'range', unit: '%', required: true },
    { key: 'moisturePct', label: 'Wassergehalt', type: 'range', unit: '%' },
    { key: 'diastaticPowerWk', label: 'Diastatische Kraft', type: 'range', unit: '°WK', when: typeIs('malt') },
    { key: 'maxSharePct', label: 'Max. Anteil', type: 'number', unit: '%' },
  ],
  hop: [
    { key: 'purpose', label: 'Verwendung', type: 'enum', options: opts({ bittering: 'Bitter', aroma: 'Aroma', dual: 'Dual' }) },
    { key: 'alphaPct', label: 'Alphasäure', type: 'range', unit: '%', required: true },
    { key: 'betaPct', label: 'Betasäure', type: 'range', unit: '%' },
    { key: 'cohumulonePct', label: 'Cohumulon', type: 'range', unit: '% der α' },
    { key: 'oilMlPer100g', label: 'Gesamtöl', type: 'range', unit: 'ml/100 g', required: true },
    ...OIL.map(([k, label]): FieldDef => ({ key: `oilComposition.${k}`, label, type: 'range', unit: '% des Öls' })),
  ],
  culture: [
    { key: 'organism', label: 'Organismus', type: 'enum', required: true,
      options: opts({ saccharomyces: 'Saccharomyces', brettanomyces: 'Brettanomyces', 'other-yeast': 'Andere Hefe', bacteria: 'Bakterien', blend: 'Mischkultur' }) },
    { key: 'form', label: 'Form', type: 'enum', required: true, options: opts({ dry: 'trocken', liquid: 'flüssig', slurry: 'Hefebrei' }) },
    { key: 'tempRangeC', label: 'Temperatur', type: 'range', unit: '°C', required: true },
    { key: 'attenuationPct', label: 'Vergärungsgrad (scheinbar)', type: 'range', unit: '%', required: true,
      when: organismIs('saccharomyces', 'brettanomyces', 'other-yeast') },
    { key: 'acidProduction', label: 'Säurebildung', type: 'enum', required: true, when: organismIs('bacteria'),
      options: opts({ low: 'gering', medium: 'mittel', high: 'hoch' }) },
    { key: 'alcoholTolerancePct', label: 'Alkoholtoleranz', type: 'number', unit: '% vol' },
    { key: 'pitchRateGPerL', label: 'Dosage', type: 'range', unit: 'g/l' },
  ],
  aroma: [
    { key: 'category', label: 'Kategorie', type: 'enum', required: true,
      options: opts({ fruit: 'Frucht', spice: 'Gewürz', herb: 'Kraut', wood: 'Holz', cocoa: 'Kakao', coffee: 'Kaffee', other: 'Sonstiges' }) },
    { key: 'defaultUnit', label: 'Einheit', type: 'enum', required: true, options: opts({ g: 'g', kg: 'kg', l: 'l' }) },
  ],
  auxiliary: [
    { key: 'category', label: 'Kategorie', type: 'enum', required: true,
      options: opts({ 'water-salt': 'Brauwassersalz', acid: 'Säure', fining: 'Klärmittel', 'yeast-nutrient': 'Hefenährstoff', enzyme: 'Enzym', other: 'Sonstiges' }) },
    { key: 'defaultUnit', label: 'Einheit', type: 'enum', required: true, options: opts({ g: 'g', ml: 'ml' }) },
    { key: 'acidStrengthPct', label: 'Konzentration', type: 'number', unit: '%' },
  ],
};

// The fields that apply to `c` (its kind, and `when`).
export function fieldsOf(c: Partial<CatalogIngredient> & Pick<CatalogIngredient, 'kind'>): FieldDef[] {
  return INGREDIENT_FIELDS[c.kind].filter((f) => !f.when || f.when(c));
}

// A stock lot overrides measured values only, not what the ingredient is.
export const isLotField = (f: FieldDef) => f.type !== 'enum';

export function getField(obj: object | undefined, key: string): unknown {
  const [a, b] = key.split('.');
  const v = (obj as Record<string, unknown> | undefined)?.[a];
  return b === undefined ? v : (v as Record<string, unknown> | undefined)?.[b];
}

// Returns a copy with `key` set; undefined removes it (and an emptied group).
export function setField<T extends object>(obj: T, key: string, value: unknown): T {
  const [a, b] = key.split('.');
  const out = { ...obj } as Record<string, unknown>;
  if (b === undefined) {
    if (value === undefined) delete out[a]; else out[a] = value;
    return out as T;
  }
  const group = { ...(out[a] as Record<string, unknown> | undefined) };
  if (value === undefined) delete group[b]; else group[b] = value;
  if (Object.keys(group).length === 0) delete out[a]; else out[a] = group;
  return out as T;
}

const num = (n: number) => String(n).replace('.', ',');

export function formatRange(r: Range): string {
  const [lo, hi] = r;
  if (lo !== null && hi !== null) return lo === hi ? num(lo) : `${num(lo)}–${num(hi)}`;
  if (lo !== null) return `min. ${num(lo)}`;
  return hi !== null ? `max. ${num(hi)}` : '';
}

// The value as text with its unit, '' when unset.
export function formatField(f: FieldDef, v: unknown): string {
  if (v === undefined || v === null) return '';
  let text: string;
  if (f.type === 'enum') return f.options?.find((o) => o.id === v)?.label ?? String(v);
  if (f.type === 'range') text = Array.isArray(v) ? formatRange(v as Range) : '';
  else text = typeof v === 'number' ? num(v) : '';
  return text && f.unit ? `${text} ${f.unit}` : text;
}

// Required fields of `c` without a value; empty = ready to save.
export function missingFields(c: Partial<CatalogIngredient> & Pick<CatalogIngredient, 'kind'>): FieldDef[] {
  return fieldsOf(c).filter((f) => {
    if (!f.required) return false;
    const v = getField(c, f.key);
    return f.type === 'range' ? !Array.isArray(v) || (v[0] === null && v[1] === null) : v === undefined || v === '';
  });
}
