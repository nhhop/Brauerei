// Ingredient catalog schema (draft). Types only, nothing consumes them yet.
//
// Units are fixed per field and never stored with the value; FIELD_UNITS at the
// bottom is the single place that names them. A source that delivers another
// unit is converted when it is imported into the catalog.
// Everything not marked required is optional on purpose: many suppliers do not
// publish it, and a missing value means "unknown", never "no" or 0.

import type { WaterAgentId } from './waterChem';

// [min, max]. A single value is [x, x]; a data sheet with only a limit is
// [min, null] ("min. 80.5") or [null, max] ("max. 5"). At least one end is set.
// Calculations use the midpoint, or the one end that is set.
export type Range = [number | null, number | null];
export type Level = 'very-low' | 'low' | 'medium' | 'high' | 'very-high';
export type Capability = 'no' | 'partial' | 'yes';
export type Rating = 'low' | 'medium' | 'high';
export type Activity = 'none' | 'low' | 'medium' | 'high';

// Where a value came from, e.g. { name: 'Hopsteiner', url: '…' }. Matters most
// for values that vary by harvest, such as thiols.
export interface Source {
  name: string;
  url?: string;                                   // https
}

// A flavour of an ingredient. `id` comes from Vocabulary.flavors; `intensity` is
// 0–5 as on the Weyermann aroma wheel and is left out when the source only names
// the flavour.
export interface Flavor {
  id: string;
  intensity?: number;
}

export interface IngredientBase {
  id: string;                                     // catalog: "malt:…", user: "user:…"
  kind: 'fermentable' | 'hop' | 'culture' | 'aroma' | 'auxiliary';
  owner: 'catalog' | 'user';
  name: string;
  manufacturer?: string;
  productCode?: string;                           // e.g. "US-05"
  productUrl?: string;                            // https, informational only
  origin?: string;                                // country / region
  notes?: string;
  flavors?: Flavor[];
  source?: Source;
  catalogVersion?: string;                        // catalog entries only
}

// Core shared by all fermentables; the calculations (gravity, colour) only need this.
// Whether a type is mashed follows from `type` and is not stored: malt and raw
// grain yes, sugar and extract no.
interface FermentableBase extends IngredientBase {
  kind: 'fermentable';
  colorEbc: Range;                                // e.g. [2.5, 4.5]; calculations use the midpoint
  extractDryPct: Range;                           // extract, dry basis
  moisturePct?: Range;
  maxSharePct?: number;                           // recommended maximum share
  fermentabilityPct?: number;
}

export type Grain = 'barley' | 'wheat' | 'rye' | 'oats' | 'spelt' | 'corn' | 'rice' | 'other';

// Malted grain. `role` is a classification for display and grouping only;
// whether a malt brings enzymes is stated by diastaticPowerWk or, as many data
// sheets only do, by enzymaticActivity.
export interface Malt extends FermentableBase {
  type: 'malt';
  role: 'base' | 'caramel' | 'roasted' | 'specialty';
  grain?: Grain;
  diastaticPowerWk?: Range;                       // °WK
  enzymaticActivity?: Activity;                   // qualitative, as on e.g. Weyermann sheets
  smokedWith?: string;                            // wood, e.g. "beech"
  kolbachPct?: Range;
  proteinPct?: Range;
  // Mash pH (mashPh.ts, Troester 2009); without them it is estimated from role
  // and colour. Base malts state the first, specialty malts the second.
  distilledWaterPh?: Range;                       // pH of a distilled water mash
  acidityMeqPerKg?: Range;                        // titratable acidity to pH 5.7
  lacticAcidPct?: Range;                          // acidulated malt
  // Further data-sheet values, informational (not used by the calculations).
  colorBoiledEbc?: Range;                         // colour of the wort after boiling
  saccharificationMin?: Range;                    // min
  viscosityMpas?: Range;                          // mPa·s
  friabilityPct?: Range;
  glassyKernelsPct?: Range;                       // Ganzglasigkeit
}

// Unmalted grain (Rohfrucht), also flaked
export interface RawGrain extends FermentableBase {
  type: 'raw-grain';
  grain: Grain;
  form: 'raw' | 'flaked' | 'torrefied';
  gelatinizationTempC?: Range;
}

export interface Sugar extends FermentableBase {
  type: 'sugar';                                  // sucrose, candi, honey, …
}

export interface MaltExtract extends FermentableBase {
  type: 'extract';
  form: 'dry' | 'liquid';
}

export type Fermentable = Malt | RawGrain | Sugar | MaltExtract;

export interface Hop extends IngredientBase {
  kind: 'hop';
  experimental?: boolean;                         // unreleased variety, data may not be a true average
  alphaPct: Range;                                // required; calculations use the midpoint
  oilMlPer100g: Range;                            // required
  betaPct?: Range;
  cohumulonePct?: Range;                          // % of alpha acids
  polyphenolsPct?: Range;
  xanthohumolPct?: Range;
  oilComposition?: {                              // % of total oil
    betaPinene?: Range;
    myrcene?: Range;
    linalool?: Range;
    betaCaryophyllene?: Range;
    farnesene?: Range;
    humulene?: Range;                             // = alpha-caryophyllene
    geraniol?: Range;
    selinene?: Range;
    other?: Range;
  };
  // Free thiols (not precursors), µg/kg of milled pellets. Vary strongly with
  // variety, growing area, crop year and harvest date. Detection limits: "<10"
  // is stored as [null, 10] and "n.d." as [0, 0].
  thiols?: {
    '4MMP'?: Range;                               // 4-mercapto-4-methylpentan-2-one
    '3MH'?: Range;                                // 3-mercaptohexan-1-ol
    '3M4MP'?: Range;                              // 3-mercapto-4-methylpentan-1-ol
  };
  // Variety class (Hopsteiner/Schmidt et al. 2024): low = no 4MMP and 3MH+3M4MP
  // < 10 µg/kg; high = 3MH+3M4MP > 10 and 4MMP always detectable; else medium.
  thiolImpact?: 'low' | 'medium' | 'high';
  purpose?: 'bittering' | 'aroma' | 'dual';
  substitutes?: string[];                         // ids of similar varieties
}
// The hop form (cone, T90, T45, lupulin, extract) is NOT part of the catalog: it
// sits on the single addition in the recipe, together with its own alpha / oil.

interface CultureBase extends IngredientBase {
  kind: 'culture';
  form: 'dry' | 'liquid' | 'slurry';
  species?: string;                               // "Lachancea thermotolerans", …
  tempRangeC: Range;
  tempOptimalRangeC?: Range;                      // within tempRangeC
  alcoholTolerancePct?: number;
  pitchRateGPerL?: Range;                         // dry yeast and bacteria, per l of wort; shown as g per batch
  finalPhRange?: Range;                           // pH reached by acid-producing cultures
}

// Saccharomyces, Brettanomyces and other yeasts (Lachancea, Torulaspora, …)
export interface YeastCulture extends CultureBase {
  organism: 'saccharomyces' | 'brettanomyces' | 'other-yeast';
  style?: string;                                 // id from Vocabulary.styles
  attenuationPct: Range;                          // apparent
  flocculation?: Level | [Level, Level];          // adapter normalises to the pair
  lineage?: string;                               // lager yeasts: "Group I (Saaz)", "Group III", "pseudo-lager", …
  pitchRateMillionCellsPerMlPerP?: number;        // liquid yeast / slurry
  starterRequired?: boolean;
  rehydration?: { tempC: Range; minutes?: number };  // dry yeast
  h2sProduction?: Activity;                       // tendency to produce sulphur (H2S)
  diacetylTendency?: Activity;                    // diacetyl left without a rest; high = needs a diacetyl rest
  repitchable?: boolean;                          // false = the maker advises against repitching
  bottleConditioningSuitable?: boolean;           // false = not recommended as the strain for bottle conditioning
  // Missing means unknown, not "no".
  ferments?: {
    maltose?: Capability;
    maltotriose?: Capability;
    dextrins?: Capability;
    melibiose?: Capability;                       // alpha-galactosidase (MEL); typical for lager yeasts
  };
  sta1?: boolean;                                 // var. diastaticus
  pof?: boolean;                                  // POF+: 4-vinylguaiacol
  // Biotransformation of hops; Lallemand rates "thiol" and "terpene" potential.
  enzymes?: {
    betaLyase?: Activity;                         // releases thiols from precursors
    betaGlucosidase?: Activity;                   // releases bound terpenes
  };
  acidProduction?: 'none' | 'low' | 'medium' | 'high';   // e.g. Lachancea
}

// Lactobacillus, Pediococcus
export interface BacteriaCulture extends CultureBase {
  organism: 'bacteria';
  acidProduction: 'low' | 'medium' | 'high';
  metabolism?: 'homofermentative' | 'heterofermentative' | 'facultative-heterofermentative';
  hopTolerance?: { alphaPpm?: number; betaPpm?: number };   // ppm = mg/l of the respective acid
}

export interface BlendCulture extends CultureBase {
  organism: 'blend';
  notes: string;                                  // contents as text for now
}

export type Culture = YeastCulture | BacteriaCulture | BlendCulture;

export interface Aroma extends IngredientBase {
  kind: 'aroma';
  category: 'fruit' | 'spice' | 'herb' | 'wood' | 'cocoa' | 'coffee' | 'other';
  defaultUnit: 'g' | 'kg' | 'l';
}

// A water agent's chemistry (formula, ions, density) lives in waterChem.ts;
// the entry only points there. `acidStrengthPct` is the default concentration
// of an acid or solution, changeable per addition.
export interface Auxiliary extends IngredientBase {
  kind: 'auxiliary';
  category: 'water-salt' | 'acid' | 'fining' | 'yeast-nutrient' | 'enzyme' | 'other';
  defaultUnit: 'g' | 'ml';
  waterAgent?: WaterAgentId;
  acidStrengthPct?: number;
}

export type CatalogIngredient = Fermentable | Hop | Culture | Aroma | Auxiliary;

// A stock item ("Lagerposten"): one lot of an ingredient the user actually owns.
// Its values override the catalog's; the effective values are the catalog entry
// with `overrides` laid on top. Stored with the user's data, not in the catalog.
// Types only — the stock itself is not built yet.
export interface StockLot {
  id: string;
  ref: string;                                    // catalog or user ingredient id
  cropYear?: number;                              // harvest / production year
  form?: string;                                  // hops: 'cone' | 't90' | 't45' | 'lupulin' | 'extract'
  amount: number;                                 // current stock, in the ingredient's unit
  bestBefore?: string;                            // ISO date
  overrides?: Partial<CatalogIngredient>;         // exact values from the data sheet
  source?: Source;                                // e.g. the data sheet the values come from
  notes?: string;
}

// vocab.json — shipped and versioned together with the catalog.
export interface Vocabulary {
  styles: { id: string; label: string }[];                       // yeast styles
  flavors: { id: string; label: string; group?: string }[];
}

export const FIELD_UNITS: Record<string, string> = {
  'fermentable.colorEbc': 'EBC',
  'fermentable.extractDryPct': '% (wasserfrei)',
  'malt.diastaticPowerWk': '°WK',
  'malt.colorBoiledEbc': 'EBC',
  'malt.saccharificationMin': 'min',
  'malt.viscosityMpas': 'mPa·s',
  'malt.friabilityPct': '%',
  'malt.glassyKernelsPct': '%',
  'malt.distilledWaterPh': 'pH',
  'malt.acidityMeqPerKg': 'mEq/kg',
  'malt.lacticAcidPct': '%',
  'hop.alphaPct': '%',
  'hop.betaPct': '%',
  'hop.oilMlPer100g': 'ml/100 g',
  'hop.cohumulonePct': '% der α-Säuren',
  'hop.polyphenolsPct': '%',
  'hop.xanthohumolPct': '%',
  'hop.oilComposition.*': '% des Gesamtöls',
  'hop.thiols.*': 'µg/kg',
  'culture.tempRangeC': '°C',
  'culture.attenuationPct': '%',
  'culture.pitchRateGPerL': 'g/l',
  'culture.tempOptimalRangeC': '°C',
  'culture.finalPhRange': 'pH',
  'culture.hopTolerance.*': 'ppm',
  'culture.pitchRateMillionCellsPerMlPerP': 'Mio. Zellen/ml/°P',
  'culture.rehydration.tempC': '°C',
  'culture.rehydration.minutes': 'min',
};
