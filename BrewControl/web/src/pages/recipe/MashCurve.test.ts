import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../../brewhouse';
import { calcMash, outlineMash } from '../../mashPlan';
import { calcWater } from '../../recipeWater';
import { newRecipe, type Recipe } from '../../recipes';
import { curveOf } from './MashCurve';

describe('curveOf', () => {
  it('draws a decoction as its own series while the mash line shows the mash left behind', () => {
    const bh = TEMPLATES.find((t) => t.key === 'kettle-lauter')!.build();
    const r: Recipe = {
      ...newRecipe(), volumeL: 20, brewhouseId: bh.id,
      ingredients: [{ id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' }],
    };
    r.mash = [
      { ...r.mash[0] }, { ...r.mash[1], tempC: 50, durationMin: 15 },
      { id: 'dek', kind: 'decoction', name: 'Kochmaische', tempC: 64, durationMin: 30, decoction: { lead: 'temp', rests: [], boilMin: 15 } },
    ];
    const plan = calcMash(r, bh, null, calcWater(r, bh).water!);
    const row = plan.rows[2];
    const c = curveOf(plan.rows);
    const dec = c.xs.map((x, i) => [x, c.decs[i]]).filter(([, y]) => y !== null);
    // Pulled, heated, boiled, then down into the mash it is put back into.
    expect(dec.map(([, y]) => y)).toEqual([50, 100, 100, row.tempC]);
    expect(dec[0][0]).toBeCloseTo(plan.rows[1].startMin + 15, 6);
    expect(dec[2][0]).toBeCloseTo(row.startMin, 6);
    expect(dec[3][0]).toBe(row.startMin);
    // While the decoction runs the mash line has no points of its own; then the
    // mash left behind, the jump to the target and its mark.
    const at = c.xs.findIndex((x, i) => x === row.startMin && c.ys[i] === row.tempC);
    expect(c.ys[at - 1]).toBeCloseTo(row.decoction!.restMashC, 6);
    expect(c.marks[at]).toBe(row.tempC);
    expect(c.labels[at]).toBe('Kochmaische');
    expect(c.decs.every((y, i) => y === null || c.ys[i] === null)).toBe(true);
  });

  it('draws the outline without a brewhouse from mashing in, as steps', () => {
    const r: Recipe = { ...newRecipe(), ingredients: [{ id: 'm', kind: 'fermentable', name: 'Pilsner', amount: 5, timing: 'mash' }] };
    r.mash = [
      { ...r.mash[0] }, { ...r.mash[1], tempC: 50, durationMin: 15 },
      { id: 'dek', kind: 'decoction', name: 'Kochmaische', tempC: 64, durationMin: 30, decoction: { lead: 'temp', rests: [], boilMin: 15 } },
    ];
    const c = curveOf(outlineMash(r, null));
    expect(c.xs).toEqual([0, 0, 15, 15, 45]);
    expect(c.ys).toEqual([50, 50, 50, 64, 64]);
    expect(c.labels[1]).toBe('Einmaischen');  // the grain marks it
    expect(c.decs.every((y) => y === null)).toBe(true);
  });
});
