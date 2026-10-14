import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './brewhouse';
import type { CatalogIngredient } from './ingredientCatalog';
import { deriveRecipe, diffRecipes, matchRows, type DiffRow, type DiffSection } from './recipeDiff';
import { addCharge, newRecipe, type Ingredient, type MashStep, type Recipe } from './recipes';

const catalog = [
  { id: 'malt:pils', kind: 'fermentable', type: 'malt', name: 'Pilsner', colorEbc: [2.5, 4.5], extractDryPct: [80.5, null], moisturePct: [null, 5] },
  { id: 'hop:saaz', kind: 'hop', name: 'Saazer', alphaPct: [3, 4] },
  { id: 'yeast:us05', kind: 'culture', organism: 'saccharomyces', name: 'US-05', attenuationPct: [78, 82] },
] as CatalogIngredient[];

const bh = { ...TEMPLATES.find((t) => t.key === 'kettle-lauter')!.build(), id: 'bh1' };

const ing = (p: Partial<Ingredient> & { id: string }): Ingredient =>
  ({ kind: 'fermentable', name: 'x', amount: 1, timing: 'mash', ...p });
const pils = ing({ id: 'i1', name: 'Pilsner', ingredientId: 'malt:pils', amount: 4.5 });
const saaz = ing({ id: 'i2', kind: 'hop', name: 'Saazer', ingredientId: 'hop:saaz', amount: 30, timing: 'boil', timeMin: 60 });
const us05 = ing({ id: 'i3', kind: 'yeast', name: 'US-05', ingredientId: 'yeast:us05', amount: 11.5, timing: 'pitch' });

const base: Recipe = {
  ...newRecipe(), id: 'r1', name: 'Pils', brewhouseId: 'bh1', ingredients: [pils, saaz, us05],
  fermentation: [{ id: 'p1', name: 'Hauptgärung', tempC: 12, duration: 7 }],
};
const rest = (id: string, tempC: number): MashStep => ({ id, kind: 'rest', name: `Rast ${tempC}`, tempC, durationMin: 20 });

function diff(a: Recipe, b: Recipe, withBrewhouse = true): DiffSection[] {
  const brewhouses = withBrewhouse ? [bh] : [];
  return diffRecipes(a, b, deriveRecipe(a, catalog, brewhouses, null), deriveRecipe(b, catalog, brewhouses, null),
    { brewhouses, brewery: null });
}
const rowsOf = (sections: DiffSection[], id: string): DiffRow[] =>
  sections.find((s) => s.id === id)!.groups.flatMap((g) => g.rows);
const rowOf = (sections: DiffSection[], id: string, title: string): DiffRow =>
  rowsOf(sections, id).find((r) => r.title === title)!;
const changedTitles = (sections: DiffSection[], id: string) =>
  rowsOf(sections, id).filter((r) => r.state !== 'same').map((r) => `${r.title}:${r.state}`);

describe('matchRows', () => {
  const key = (i: Ingredient) => `${i.ingredientId}|${i.timing}`;

  it('pairs by id, also when the key changed', () => {
    const moved = { ...saaz, timing: 'whirlpool' as const };
    expect(matchRows([pils, saaz], [pils, moved], key)).toEqual([[pils, pils], [saaz, moved]]);
  });

  it('pairs a row that was deleted and added again by its key', () => {
    const again = { ...saaz, id: 'new', amount: 40 };
    expect(matchRows([pils, saaz], [pils, again], key)).toEqual([[pils, pils], [saaz, again]]);
  });

  it('leaves rows without id or key match unpaired', () => {
    const other = ing({ id: 'new', kind: 'hop', ingredientId: 'hop:other', timing: 'boil' });
    expect(matchRows([pils, saaz], [pils, other], key)).toEqual([[pils, pils], [saaz, undefined], [undefined, other]]);
    expect(matchRows([saaz], [{ ...saaz, id: 'new' }])).toEqual([[saaz, undefined], [undefined, { ...saaz, id: 'new' }]]);
  });

  it('pairs equal rows in list order', () => {
    const a1 = { ...saaz, id: 'a1', amount: 10 }, a2 = { ...saaz, id: 'a2', amount: 20 };
    const b1 = { ...saaz, id: 'b1', amount: 11 }, b2 = { ...saaz, id: 'b2', amount: 21 };
    expect(matchRows([a1, a2], [b1, b2], key)).toEqual([[a1, b1], [a2, b2]]);
  });

  it('keeps the order of b and puts removed rows after their predecessor in a', () => {
    const [s1, s2, s3, s4] = ['1', '2', '3', '4'].map((id) => ({ id }));
    const n = { id: 'n' };
    expect(matchRows([s1, s2, s3, s4], [s1, n, s4])).toEqual([[s1, s1], [s2, undefined], [s3, undefined], [undefined, n], [s4, s4]]);
    expect(matchRows([s1, s2], [s2])).toEqual([[s1, undefined], [s2, s2]]);
  });
});

describe('deriveRecipe', () => {
  it('computes figures, water and the mash duration', () => {
    const d = deriveRecipe(base, catalog, [bh], null);
    expect(d.stats?.ogPlato).toBeGreaterThan(8);
    expect(d.water?.strikeL).toBeGreaterThan(0);
    expect(d.mashMin).toBeGreaterThan(60);
  });

  it('leaves out what needs the catalog or the brewhouse', () => {
    expect(deriveRecipe(base, null, null, null)).toEqual({ stats: null, water: undefined, mashMin: undefined });
    const d = deriveRecipe({ ...base, brewhouseId: 'gone' }, catalog, [bh], null);
    expect(d.water).toBeUndefined();
    expect(d.mashMin).toBeUndefined();
  });
});

describe('diffRecipes', () => {
  it('marks nothing between equal recipes', () => {
    const sections = diff(base, structuredClone(base));
    expect(sections.map((s) => s.id)).toEqual(['recipe', 'ingredients', 'water', 'mash', 'boil', 'fermentation']);
    expect(sections.flatMap((s) => changedTitles(sections, s.id))).toEqual([]);
  });

  it('compares the recipe fields and the computed figures', () => {
    const b = { ...base, name: 'Pils 2', volumeL: 25, status: 'final' as const };
    const s = diff(base, b);
    expect(rowOf(s, 'recipe', 'Name').lines[0]).toEqual({ label: undefined, a: 'Pils', b: 'Pils 2', changed: true });
    expect(rowOf(s, 'recipe', 'Ausschlagmenge').lines[0]).toMatchObject({ a: '20 l', b: '25 l', delta: '+5 l' });
    expect(rowOf(s, 'recipe', 'Status').state).toBe('changed');
    expect(rowOf(s, 'recipe', 'Sudhaus').lines[0]).toMatchObject({ a: bh.name, b: bh.name, changed: false });
    const og = rowOf(s, 'recipe', 'Stammwürze');
    expect(og).toMatchObject({ state: 'changed', computed: true });
    expect(og.lines[0].delta).toMatch(/^−\d+,\d °P$/);
    expect(rowOf(s, 'water', 'Pfannevoll').state).toBe('changed');
  });

  it('names a brewhouse that is gone and leaves its figures empty', () => {
    const s = diff(base, { ...base, brewhouseId: 'gone' });
    expect(rowOf(s, 'recipe', 'Sudhaus').lines[0]).toMatchObject({ b: 'gone (fehlt)', changed: true });
    expect(rowOf(s, 'water', 'Hauptguss').lines[0].b).toBeUndefined();
    expect(rowOf(s, 'mash', 'Maischdauer').lines[0]).toMatchObject({ b: undefined, changed: true });
  });

  it('does not mark a difference below the rounding', () => {
    const s = diff({ ...base, volumeL: 20.01 }, { ...base, volumeL: 20.04 });
    expect(rowOf(s, 'recipe', 'Ausschlagmenge').state).toBe('same');
    expect(rowOf(s, 'recipe', 'Stammwürze').state).toBe('same');
  });

  it('marks ingredients as changed, added and removed, grouped by kind', () => {
    const cascade = ing({ id: 'i9', kind: 'hop', name: 'Cascade', amount: 20, timing: 'whirlpool' });
    const b = { ...base, ingredients: [{ ...pils, amount: 4.8 }, { ...saaz, timeMin: undefined }, cascade] };
    const s = diff(base, b);
    expect(s.find((x) => x.id === 'ingredients')!.groups.map((g) => g.title)).toEqual(['Vergärbares', 'Hopfen', 'Hefen & Kulturen']);
    expect(changedTitles(s, 'ingredients')).toEqual(['Pilsner:changed', 'Cascade:added', 'US-05:removed']);
    expect(rowOf(s, 'ingredients', 'Pilsner').lines).toEqual([
      { label: 'Menge', a: '4,5 kg', b: '4,8 kg', delta: '+0,3 kg', changed: true },
      { label: 'Zeitpunkt', a: 'Maische', b: 'Maische', changed: false },
    ]);
    // An unset boil time is the whole boil, as in the editor.
    expect(rowOf(s, 'ingredients', 'Saazer').state).toBe('same');
    expect(rowOf(s, 'ingredients', 'Cascade').lines).toEqual([
      { label: 'Menge', a: undefined, b: '20 g', changed: false },
      { label: 'Zeitpunkt', a: undefined, b: 'Whirlpool', changed: false },
    ]);
  });

  it('shows a changed name of a row paired by id', () => {
    const s = diff(base, { ...base, ingredients: [{ ...pils, name: 'Pilsner Bio' }, saaz, us05] });
    expect(rowOf(s, 'ingredients', 'Pilsner Bio').lines[0]).toEqual({ label: 'Name', a: 'Pilsner', b: 'Pilsner Bio', changed: true });
  });

  it('compares the water settings and leaves out what does not apply', () => {
    const b = { ...base, water: { sparge: false, targetPh: { mash: 5.3 }, target: { ions: { ca: 80, mg: 5, na: 10, cl: 60, so4: 120, hco3: 30 } } } };
    const s = diff(base, b);
    expect(rowOf(s, 'water', 'Mit Nachguss').lines[0]).toMatchObject({ a: 'ja', b: 'nein' });
    expect(rowOf(s, 'water', 'Nachguss-Temperatur').lines[0]).toMatchObject({ a: '78 °C', b: undefined });
    expect(rowOf(s, 'water', 'Maische').lines[0]).toMatchObject({ a: '5,4', b: '5,3', delta: '−0,1' });
    expect(rowOf(s, 'water', 'Profil').lines.slice(0, 2)).toEqual([
      { label: undefined, a: '—', b: 'Eigene Werte', changed: true },
      { label: 'Ca', a: undefined, b: '80 mg/l', changed: true },
    ]);
    expect(rowOf(s, 'water', 'Nachguss').lines[0].b).toBeUndefined();
    // No dilution on either side, no rows for it.
    expect(s.find((x) => x.id === 'water')!.groups.map((g) => g.title)).not.toContain('Verschnitt');
  });

  it('marks only an inserted mash step as added', () => {
    const a = { ...base, mash: [...base.mash, rest('s3', 72), rest('s4', 78)] };
    const b = { ...a, mash: [a.mash[0], a.mash[1], rest('s9', 62), { ...a.mash[2], durationMin: 30 }, a.mash[3]] };
    const s = diff(a, b);
    expect(changedTitles(s, 'mash')).toEqual(['Rast 62:added', 'Rast 72:changed', 'Maischdauer:changed']);
    expect(rowOf(s, 'mash', 'Rast 72').lines.find((l) => l.changed)).toEqual(
      { label: 'Dauer', a: '20 min', b: '30 min', delta: '+10 min', changed: true });
    expect(rowOf(s, 'mash', 'Maischdauer').lines[0].delta).toMatch(/^\+\d+ min$/);
  });

  it('compares the two switches of the mash plan', () => {
    const dek = (holdRest?: boolean) => ({
      id: 'dk', kind: 'decoction' as const, name: 'Kochmaische', tempC: 64, durationMin: 20,
      decoction: { lead: 'temp' as const, rests: [], boilMin: 15, holdRest },
    });
    const a = { ...base, mash: [...base.mash, dek()] };
    const s = diff(a, { ...a, mashRampInRest: true, mash: [...base.mash, dek(true)] });
    expect(rowOf(s, 'mash', 'Kochmaische').lines.find((l) => l.changed)).toEqual(
      { label: 'Restmaische', a: 'unbeheizt', b: 'gehalten', changed: true });
    expect(rowOf(s, 'mash', 'Aufheizzeit zählt zur Rast').lines[0]).toMatchObject({ a: 'nein', b: 'ja', changed: true });
  });

  it('marks a reordered mash step by its position', () => {
    const a = { ...base, mash: [...base.mash, rest('s3', 62), rest('s4', 72), rest('s5', 78)] };
    const b = { ...a, mash: [a.mash[0], a.mash[1], a.mash[4], a.mash[2], a.mash[3]] };
    const s = diff(a, b);
    expect(changedTitles(s, 'mash').filter((t) => t.startsWith('Rast'))).toEqual(['Rast 78:changed']);
    expect(rowOf(s, 'mash', 'Rast 78').lines.slice(-1)[0]).toEqual({ label: 'Position', a: '5.', b: '3.', changed: true });
  });

  it('lists charges once a side has more than one', () => {
    const b = { ...base, ...addCharge(base, { fromId: 'c1', pct: 40 }) };
    const s = diff(base, b);
    const groups = s.find((x) => x.id === 'mash')!.groups;
    expect(groups[0].title).toBe('Teilschüttungen');
    expect(groups[0].rows.map((r) => `${r.title}:${r.state}`)).toEqual(['Schüttung 1:changed', 'Schüttung 2:added']);
    expect(groups[0].rows[0].lines[0]).toEqual({ label: 'Malz', a: '4,5 kg', b: '2,7 kg', delta: '−1,8 kg', changed: true });
    expect(rowOf(s, 'mash', 'Schüttung 2 zugeben')).toMatchObject({ state: 'added' });
    // The split-off grain is a row of its own, the rest names its charge.
    expect(rowsOf(s, 'ingredients').filter((r) => r.title === 'Pilsner').map((r) => r.state)).toEqual(['changed', 'added']);
    expect(diff(base, base).find((x) => x.id === 'mash')!.groups.map((g) => g.title)).not.toContain('Teilschüttungen');
  });

  it('compares boil and fermentation', () => {
    const b = { ...base, boil: { ...base.boil, durationMin: 90 },
      fermentation: [{ ...base.fermentation[0], tempC: 10 }, { id: 'p2', name: 'Reifung', tempC: 2, duration: 21 }] };
    const s = diff(base, b);
    expect(changedTitles(s, 'boil')).toEqual(['Kochdauer:changed']);
    expect(changedTitles(s, 'fermentation')).toEqual(['Hauptgärung:changed', 'Reifung:added']);
    expect(rowOf(s, 'fermentation', 'Hauptgärung').lines[0]).toEqual(
      { label: 'Temperatur', a: '12 °C', b: '10 °C', delta: '−2 °C', changed: true });
  });
});
