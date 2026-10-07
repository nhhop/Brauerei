import { describe, expect, it } from 'vitest';
import type { CatalogIngredient, Malt } from './ingredientCatalog';
import {
  MALT_BUFFER, alkalinitySlope, distilledWaterPh, gristOf, gristPart, mashPh, raRangeForColor, type GristPart,
} from './mashPh';
import { newRecipe, type Ingredient } from './recipes';
import { VE_WATER, WATER_AGENTS, agentMmol, applyAgents, stateOf } from './waterChem';

// Reference data: Troester 2009, appendix (pulverised grist, 4 l/kg).
const base = (ph: number, kg = 1): GristPart => ({ name: 'b', kg, ph, estimated: false });
const malt = (p: Partial<Malt>): Malt => ({
  id: 'malt:x', kind: 'fermentable', owner: 'catalog', type: 'malt', role: 'base', name: 'x',
  colorEbc: [3.5, 3.5], extractDryPct: [80, 80], ...p,
});

// Water with alkalinity from baking soda, or negative from hydrochloric acid, in mEq/l (Table 3).
const water = (meq: number) => meq >= 0
  ? applyAgents(stateOf(VE_WATER), 1, [{ agent: WATER_AGENTS.nahco3, mmol: meq }])
  : applyAgents(stateOf(VE_WATER), 1, [{ agent: WATER_AGENTS.hydrochloric, mmol: -meq }]);

describe('mashPh (Troester)', () => {
  it('follows Troester\'s base malt line over Table 2, and mixes base malts by weight', () => {
    const table2: [number, number][] = [[3.5, 5.76], [25, 5.43], [4.63, 5.77], [15, 5.3], [3.57, 5.79], [3.8, 5.73],
      [4, 6.04], [3.57, 5.56], [17.35, 5.46], [3.5, 5.75], [7.5, 5.56]];
    const diffs = table2.map(([ebc, ph]) => gristPart('x', 1, malt({ colorEbc: [ebc, ebc] }))!.ph! - ph);
    // R² 0.54: single malts scatter (wheat malt 0.3), the line runs through the middle.
    for (const d of diffs) expect(Math.abs(d)).toBeLessThan(0.31);
    expect(Math.abs(diffs.reduce((s, d) => s + d, 0) / diffs.length)).toBeLessThan(0.02);
    // 50 % pilsner (5.76), 50 % Munich I (5.30): Table 3 measured 5.54
    expect(distilledWaterPh([base(5.76), base(5.3)], 4)).toBeCloseTo(5.54, 1);
  });

  it('meets Table 3 for pilsner malt over the whole range, acid on the malt buffer', () => {
    const ra = [-5.61, -3.5, -1.75, 0, 1.79, 3.58, 5.36, 7.15];
    const measured = [5.2, 5.43, 5.59, 5.74, 5.88, 5.99, 6.11, 6.19];
    ra.forEach((r, i) => expect(Math.abs(mashPh(5.76, 4, water(r)) - measured[i])).toBeLessThan(0.05));
  });

  it('meets Table 3 for the mixed grists within 0.1 from −1.75 to 7.15 mEq/l', () => {
    // Below that the darker grists take strong acid more calmly than the buffer
    // says (−0.18 at −5.6 mEq/l); 85/15 CaraMunich II starts 0.06 low (Troester:
    // an outlier in acidity).
    const ra = [-1.75, 0, 1.79, 3.58, 5.36, 7.15];
    const grists: [GristPart[], number[]][] = [
      [[base(5.76, 0.5), base(5.3, 0.5)], [5.4, 5.54, 5.67, 5.81, 5.91, 6.01]],
      [[base(5.76, 0.85), { name: 'CaraMunich II', kg: 0.15, acidity: 49, estimated: false }], [5.4, 5.55, 5.69, 5.81, 5.91, 6.02]],
    ];
    for (const [grist, measured] of grists) {
      const di = distilledWaterPh(grist, 4)!;
      ra.forEach((r, i) => expect(Math.abs(mashPh(di, 4, water(r)) - measured[i])).toBeLessThan(0.1));
    }
  });

  it('meets Table 5: specialty malts by role and colour within 0.05, by measured acidity within 0.065', () => {
    const cases: [Partial<Malt>, number, [number, number][]][] = [
      [{ role: 'roasted', colorEbc: [900, 900] }, 46.4, [[1, 5.71], [2, 5.69], [4, 5.66], [8, 5.61]]],          // Carafa I special
      [{ role: 'caramel', colorEbc: [150, 150] }, 31.2, [[6, 5.66], [12, 5.58], [23, 5.43], [45, 5.21]]],        // CaraMunich III
      [{ role: 'caramel', colorEbc: [400, 400] }, 74.4, [[4, 5.64], [8, 5.54], [17, 5.36]]],                     // CaraAroma
    ];
    for (const [p, acidity, rows] of cases) {
      for (const [pct, measured] of rows) {
        const share = pct / 100;
        const byRole = distilledWaterPh([base(5.75, 1 - share), gristPart('s', share, malt(p))!], 4)!;
        expect(Math.abs(byRole - measured)).toBeLessThan(0.05);
        const byAcidity = distilledWaterPh([base(5.75, 1 - share), { name: 's', kg: share, acidity, estimated: false }], 4)!;
        expect(Math.abs(byAcidity - measured)).toBeLessThan(0.065);
      }
    }
  });

  it('takes the data sheet first, else falls back by role', () => {
    expect(gristPart('x', 1, malt({ distilledWaterPh: [5.6, 5.6] }))).toMatchObject({ ph: 5.6, estimated: false });
    expect(gristPart('x', 1, malt({ role: 'caramel', acidityMeqPerKg: [30, 30] }))).toMatchObject({ acidity: 30, estimated: false });
    // acidulated malt: 3 % lactic acid = 333 mEq/kg (Troester titrated 315–358)
    expect(gristPart('x', 1, malt({ role: 'specialty', lacticAcidPct: [3, 3] }))!.acidity).toBeCloseTo(333, 0);
    expect(gristPart('x', 1, malt({ role: 'base', colorEbc: [15, 15] }))).toMatchObject({ estimated: true });
    expect(gristPart('x', 1, malt({ role: 'base', colorEbc: [15, 15] }))!.ph).toBeCloseTo(5.52, 9);
    expect(gristPart('x', 1, malt({ role: 'caramel', colorEbc: [100, 100] }))!.acidity).toBeCloseTo(27, 9);
    expect(gristPart('x', 1, malt({ role: 'roasted', colorEbc: [1300, 1500] }))!.acidity).toBe(40);
    // specialty malt: up to 25 EBC on the base line, darker as caramel malt
    expect(gristPart('x', 1, malt({ role: 'specialty', colorEbc: [6, 6] }))!.ph).toBeCloseTo(5.70, 9);
    expect(gristPart('x', 1, malt({ role: 'specialty', colorEbc: [70, 70] }))!.acidity).toBeCloseTo(23.1, 9);
  });

  it('notes unlinked, estimated and acidulated malts', () => {
    const catalog = [
      malt({ id: 'malt:pils', name: 'Pils' }),
      malt({ id: 'malt:sauer', name: 'Sauermalz', role: 'specialty', lacticAcidPct: [3, 3] }),
      { id: 'sugar:x', kind: 'fermentable', owner: 'catalog', type: 'sugar', name: 'Zucker', colorEbc: [0, 0], extractDryPct: [100, 100] },
    ] as CatalogIngredient[];
    const f = (p: Partial<Ingredient>): Ingredient => ({ id: String(Math.random()), kind: 'fermentable', name: '', amount: 1, timing: 'mash', ...p });
    const recipe = { ...newRecipe(), ingredients: [
      f({ ingredientId: 'malt:pils' }), f({ ingredientId: 'malt:sauer' }), f({ ingredientId: 'sugar:x' }), f({ name: 'Frei' }),
      f({ ingredientId: 'malt:pils', timing: 'boil' }),
    ] };
    const { parts, notes } = gristOf(recipe, catalog);
    expect(parts.map((p) => p.name)).toEqual(['Pils', 'Sauermalz']);
    expect(notes).toEqual([
      '1 von 4 Malzen ohne Katalogverknüpfung, nicht in der pH-Schätzung.',
      'Ohne Malzdaten, aus Rolle und Farbe geschätzt: Pils.',
      'Sauermalz zählt nach Troesters Malzformel und wirkt dort etwa 1,5-mal stärker als dieselbe Milchsäure flüssig.',
    ]);
  });

  it('lets acid neutralise the alkalinity first, then work on the malt buffer', () => {
    const lactic = WATER_AGENTS.lactic;
    const tap = applyAgents(stateOf(VE_WATER), 1, [{ agent: WATER_AGENTS.nahco3, mmol: 2 }]);
    const withAcid = (ml: number) => mashPh(5.75, 3.5, applyAgents(tap, 17.5, [{ agent: lactic, mmol: agentMmol(lactic, ml, 80) }]));
    const steps = [0, 2, 4, 6, 8].map(withAcid);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeLessThan(steps[i - 1]);
    // past the alkalinity the slope is the buffer's (R/β), steeper than s
    expect(alkalinitySlope(3.5)).toBeLessThan(3.5 / MALT_BUFFER);
    // calcium lowers it through the RA
    const gypsum = applyAgents(tap, 17.5, [{ agent: WATER_AGENTS.gypsum, mmol: agentMmol(WATER_AGENTS.gypsum, 5) }]);
    expect(mashPh(5.75, 3.5, gypsum)).toBeLessThan(withAcid(0));
  });

  it('gives Palmer\'s RA range for the beer colour', () => {
    const [lo, hi] = raRangeForColor(10 * 1.97);   // 10 SRM
    expect(lo).toBeCloseTo((122 - 122.4) / 50, 9);
    expect(hi).toBeCloseTo((12.2 * 4.8) / 50, 9);
  });
});
