// Water automation (dialog "Automatisch" in the card "Aufbereitung"): target
// profiles, and the share of blend water, salts and acid that bring the strike
// water close to one. Pure, builds on recipeTreatment.ts.
//
// The salts fit Ca, Mg, Na, Cl and SO₄ by non-negative least squares
// (Lawson-Hanson) in mEq/l, for every share of blend water from 0 to 100 %; the
// closest wins. The target's HCO₃ is not fitted (decision 2026-10-07): the
// mash's alkalinity is set by its target pH, so the acid takes care of it
// afterwards, in the mash after the pH measurement. Under the model kolbach,
// with no pH, the acid brings the mash's residual alkalinity to the middle of
// Palmer's range for the beer colour.
import type { Brewery } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { DEFAULT_MASH_PH } from './mashPh';
import { calcTreatment, catalogAgent, phOf, type Agent, type Column } from './recipeTreatment';
import type { Water } from './recipeWater';
import { uid, type Ingredient, type Recipe, type WaterSource, type WaterTarget } from './recipes';
import {
  CHARGE, MOLAR, WATER_AGENTS, agentAmount, agentMmol, amountForPh, applyAgents, figuresOf,
  type Ion, type TargetIons, type WaterAgentId, type WaterProfile, type WaterState,
} from './waterChem';

// Brewer's Friend, "Summary of Target Water Profiles" (brewersfriend.com/brewing-
// water-target-profiles), Dortmund and Burton after decarbonation; Vienna from
// Palmer, How to Brew, Table 21 (howtobrew.com, chapter 15), which Brewer's
// Friend lacks.
const BF = "Brewer's Friend";
const target = (id: string, name: string, note: string, ca: number, mg: number, na: number, cl: number, so4: number, hco3: number):
  WaterProfile => ({ id: `target:${id}`, name, note, ca, mg, na, cl, so4, hco3, target: true });
export const TARGET_PROFILES: WaterProfile[] = [
  target('balanced', 'Ausgewogen', `${BF}, Balanced Profile: goldgelb bis bernstein`, 80, 5, 25, 75, 80, 100),
  target('pale-malty', 'Hell, malzig', `${BF}, Light colored and malty`, 60, 5, 10, 95, 55, 0),
  target('pale-hoppy', 'Hell, hopfig', `${BF}, Light colored and hoppy`, 75, 5, 10, 50, 150, 0),
  target('pilsen', 'Pilsen', `${BF}: Pils, Helles`, 7, 3, 2, 5, 5, 25),
  target('dortmund', 'Dortmund', `${BF}, entcarbonisiert: Export`, 155, 23, 10, 100, 300, 53),
  target('munich', 'München', `${BF}, Wasserbericht 2013: Dunkel, Schwarzbier, Bock`, 82, 20, 4, 2, 16, 320),
  target('vienna', 'Wien', 'Palmer, How to Brew, Tab. 21: Wiener Lager', 200, 60, 8, 12, 125, 120),
  target('duesseldorf', 'Düsseldorf', `${BF}, Wasserbericht 2013: Altbier`, 90, 12, 45, 82, 65, 223),
  target('burton', 'Burton', `${BF}, entcarbonisiert: Pale Ale, IPA`, 187, 41, 113, 85, 720, 20),
  target('london', 'London', `${BF}: Porter, dunkle Ales`, 100, 5, 35, 60, 50, 265),
  target('dublin', 'Dublin', `${BF}: Stout`, 110, 4, 12, 19, 53, 280),
  target('edinburgh', 'Edinburgh', `${BF}: Scottish Ale`, 100, 18, 20, 45, 105, 235),
];

// The brewery's own target profiles first, then the built-in ones.
export const targetProfiles = (brewery: Brewery | null): WaterProfile[] =>
  [...(brewery?.waters ?? []).filter((w) => w.target), ...TARGET_PROFILES];

export const OWN_TARGET = 'Eigene Werte';

// What a recipe's target stands for; undefined while none is picked or its profile is gone.
export function resolveTarget(t: WaterTarget | undefined, brewery: Brewery | null):
  { name: string; note?: string; ions: TargetIons } | undefined {
  if (t?.ions) return { name: OWN_TARGET, ions: t.ions };
  const p = t?.id ? targetProfiles(brewery).find((x) => x.id === t.id) : undefined;
  return p && { name: p.name || 'Ohne Namen', note: p.note, ions: { ca: p.ca, mg: p.mg, na: p.na, cl: p.cl, so4: p.so4, hco3: p.hco3 } };
}

// The fitted ions; HCO₃ is left to the acid.
export const FIT_IONS = ['ca', 'mg', 'na', 'cl', 'so4'] as const satisfies readonly Ion[];
// The salts the automation may use: neutral ones, no bases.
export const AUTO_SALTS: WaterAgentId[] = ['gypsum', 'cacl2', 'cacl2-solution', 'epsom', 'mgcl2', 'nacl'];
export const AUTO_ACIDS: WaterAgentId[] = ['lactic', 'phosphoric', 'hydrochloric', 'sulfuric'];

const meq = (ion: Ion, mg: number) => (mg / MOLAR[ion]) * CHARGE[ion];
// Sum of squares in (mEq/l)²; 1e-4 is about 0.005 mEq/l per ion, well below
// what a scale can dose.
const MISS_TOLERANCE = 1e-4;

// ── NNLS ───────────────────────────────────────────────────────────────────────

// Solves the small system M·z = v by Gaussian elimination with partial pivoting;
// a vanishing pivot leaves its variable at 0.
function solve(M: number[][], v: number[]): number[] {
  const n = v.length;
  const a = M.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

// min ‖A·x − b‖ with x ≥ 0 (Lawson and Hanson, "Solving Least Squares
// Problems", 1974, chapter 23); A has a row per equation, a column per variable.
export function nnls(A: number[][], b: number[]): number[] {
  const n = A[0]?.length ?? 0;
  const x: number[] = new Array(n).fill(0);
  const passive = new Set<number>();
  const gradient = () => {
    const r = b.map((bi, i) => bi - A[i].reduce((s, a, j) => s + a * x[j], 0));
    return x.map((_, j) => A.reduce((s, row, i) => s + row[j] * r[i], 0));
  };
  // Least squares on the passive columns, by the normal equations.
  const unconstrained = (P: number[]) => solve(
    P.map((j) => P.map((k) => A.reduce((s, row) => s + row[j] * row[k], 0))),
    P.map((j) => A.reduce((s, row, i) => s + row[j] * b[i], 0)),
  );
  const TOL = 1e-10;
  for (let iter = 0; iter < 3 * n + 10; iter++) {
    const w = gradient();
    let next = -1;
    for (let j = 0; j < n; j++) if (!passive.has(j) && w[j] > TOL && (next < 0 || w[j] > w[next])) next = j;
    if (next < 0) break;
    passive.add(next);
    for (;;) {
      const P = [...passive];
      const z = unconstrained(P);
      if (z.every((v) => v > TOL)) {
        P.forEach((j, k) => { x[j] = z[k]; });
        break;
      }
      // Step back to the first variable that would turn negative, and drop it.
      let alpha = 1;
      P.forEach((j, k) => { if (z[k] <= TOL) alpha = Math.min(alpha, x[j] / (x[j] - z[k])); });
      P.forEach((j, k) => {
        x[j] += alpha * (z[k] - x[j]);
        if (x[j] <= TOL) { x[j] = 0; passive.delete(j); }
      });
      if (passive.size === 0) break;
    }
  }
  return x;
}

// ── Automation ─────────────────────────────────────────────────────────────────

export interface AutoOptions {
  target: TargetIons;
  salts: WaterAgentId[];
  acid?: WaterAgentId;
  blendPct?: number;   // fixed share of the blend water; unset = searched
}

export interface AutoResult {
  recipe: Recipe;       // the recipe as "Übernehmen" would leave it
  blendPct: number;
  rows: Ingredient[];   // the new automatic additions
  notes: string[];
}

const setBlend = (s: WaterSource | undefined, pct: number): WaterSource | undefined => {
  const next = { ...s, blendPct: pct > 0 ? pct : undefined };
  return Object.values(next).some((v) => v !== undefined) ? next : undefined;
};

// Strike and sparge get the same share, so "Brauwasser" gives both the same
// water; additions laid out by an earlier run are replaced, hand-made ones stay.
export function autoTreat(recipe: Recipe, w: Water, brewery: Brewery | null, catalog: CatalogIngredient[] | null,
  o: AutoOptions): AutoResult {
  const notes: string[] = [];
  const kept = recipe.ingredients.filter((i) => !i.auto);
  const settings = recipe.water ?? {};
  const withBlend = (pct: number, ingredients: Ingredient[]): Recipe => ({
    ...recipe, ingredients,
    water: {
      ...settings,
      sources: {
        ...settings.sources,
        strike: setBlend(settings.sources?.strike, pct),
        sparge: w.sparge ? setBlend(settings.sources?.sparge, pct) : settings.sources?.sparge,
      },
    },
  });
  const columnsOf = (r: Recipe) => calcTreatment(r, w, brewery, catalog);
  const strikeOf = (r: Recipe) => columnsOf(r).columns.find((c) => c.key === 'strike')!;

  const salts = o.salts.flatMap((id) => {
    const a = catalogAgent(catalog, id);
    if (!a) notes.push(`${WATER_AGENTS[id].formula} fehlt im Katalog, nicht verwendet.`);
    return a ? [a] : [];
  });
  // mEq/l of each fitted ion per mmol/l of salt
  const A = FIT_IONS.map((ion) => salts.map((s) => (s.agent.ions[ion] ?? 0) * CHARGE[ion] * (s.agent.efficacy ?? 1)));
  const want = FIT_IONS.map((ion) => meq(ion, o.target[ion]));
  const fit = (pct: number) => {
    const have = strikeOf(withBlend(pct, kept)).after.ions;
    const b = FIT_IONS.map((ion, i) => want[i] - meq(ion, have[ion]));
    const x = salts.length > 0 ? nnls(A, b) : [];
    const miss = b.reduce((s, bi, i) => s + (A[i].reduce((t, a, j) => t + a * x[j], 0) - bi) ** 2, 0);
    return { pct, x, miss };
  };
  // Where the target is met over a range of shares, the least blend water wins.
  const fits = o.blendPct === undefined ? Array.from({ length: 101 }, (_, pct) => fit(pct)) : [fit(o.blendPct)];
  const least = Math.min(...fits.map((f) => f.miss));
  const best = fits.find((f) => f.miss <= least + MISS_TOLERANCE)!;

  // "Brauwasser" shares out by fill volume: concentration × both fills.
  const fillL = w.strikeFillL + (w.sparge ? w.spargeFillL : 0);
  const row = (a: Agent, amount: number, timing: Ingredient['timing']): Ingredient => ({
    id: uid(), kind: 'auxiliary', name: a.entry.name, ingredientId: a.entry.id, amount, timing, auto: true,
  });
  const rows = salts.flatMap((s, j) => {
    const amount = Math.round(agentAmount(s.agent, best.x[j] * fillL, s.strengthPct) * 100) / 100;
    return amount > 0 ? [row(s, amount, 'water')] : [];
  });

  const acid = o.acid ? catalogAgent(catalog, o.acid) : undefined;
  if (o.acid && !acid) notes.push(`${WATER_AGENTS[o.acid].formula} fehlt im Katalog, keine Säure.`);
  if (acid) {
    const salted = columnsOf(withBlend(best.pct, [...kept, ...rows]));
    const amount = mashAcid(salted.columns.find((c) => c.key === 'mash')!, acid, settings.targetPh?.mash, notes);
    if (amount) rows.push(row(acid, Math.round(amount * 100) / 100, 'mashPh'));
  }
  return { recipe: withBlend(best.pct, [...kept, ...rows]), blendPct: best.pct, rows, notes };
}

// Acid in the mash after the pH measurement: to the target pH, or under the
// model kolbach to the middle of the RA range.
function mashAcid(mash: Column, acid: Agent, targetPh: number | undefined, notes: string[]): number | undefined {
  const dosed = (a: number): WaterState =>
    applyAgents(mash.state, mash.volumeL, [{ agent: acid.agent, mmol: agentMmol(acid.agent, a, acid.strengthPct) }]);
  if (mash.basis) {
    const target = targetPh ?? DEFAULT_MASH_PH;
    const amount = amountForPh((a) => phOf(mash, dosed(a)), target);
    if (amount === 0) notes.push('Die Maische liegt schon ohne Säure unter dem Ziel-pH. Eine Base lässt sich mit „Säure/Base berechnen“ geben.');
    return amount;
  }
  if (mash.raTarget) {
    const [lo, hi] = mash.raTarget;
    const amount = amountForPh((a) => figuresOf(dosed(a)).ra, (lo + hi) / 2);
    if (mash.after.ra < lo) notes.push('Die Restalkalität der Maische liegt unter dem Zielbereich. Eine Base bitte von Hand geben.');
    return amount;
  }
  notes.push('Ohne pH-Schätzung bzw. Ziel-RA bleibt die Säure aus.');
  return undefined;
}
