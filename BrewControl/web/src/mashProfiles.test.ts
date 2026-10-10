import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_MASH_PROFILES, applyMashProfile, deleteMashProfile, duplicateMashProfile, isBuiltinProfile,
  listMashProfiles, mashProfileSummary, newMashProfile, normalizeMashProfile, profileLoadEffects, profileOfPlan, saveMashProfile,
  type MashProfile,
} from './mashProfiles';
import { VALID_ID, chargesOf, normalizeMash, type Ingredient, type MashStep, type Recipe } from './recipes';

afterEach(() => vi.unstubAllGlobals());

const byId = (id: string) => BUILTIN_MASH_PROFILES.find((p) => p.id === id)!;

const grain = (id: string, amount: number, chargeId?: string): Ingredient =>
  ({ id, kind: 'fermentable', name: id, amount, timing: 'mash', chargeId });

// A plan of the fixed steps plus `mash`, 4 kg Pilsner and 1 kg wheat in one charge.
const recipeOf = (mash: MashStep[] = [], p: Partial<Recipe> = {}): Pick<Recipe, 'mash' | 'charges' | 'ingredients'> =>
  ({ mash: [...normalizeMash([]), ...mash], ingredients: [grain('pils', 4), grain('weizen', 1)], ...p });

const kgOf = (r: Pick<Recipe, 'ingredients' | 'charges'>, chargeId: string) => r.ingredients
  .filter((i) => (i.chargeId && chargesOf(r).some((c) => c.id === i.chargeId) ? i.chargeId : chargesOf(r)[0].id) === chargeId)
  .reduce((s, i) => s + i.amount, 0);

describe('shipped profiles', () => {
  it('are the ten of the plan, with valid unique ids', () => {
    expect(BUILTIN_MASH_PROFILES.map((p) => p.name)).toEqual([
      'Hochkurz', 'Einrast-Infusion', 'Weizen mit Ferulasäurerast', 'Weizen nach Herrmann (Maltaserast)',
      'Klassisch mit Eiweißrast', 'Kombirast 66 °C',
      'Einmaischverfahren', 'Zweimaischverfahren', 'Dreimaischverfahren', 'Earls Kochmaische',
    ]);
    expect(new Set(BUILTIN_MASH_PROFILES.map((p) => p.id)).size).toBe(10);
    for (const p of BUILTIN_MASH_PROFILES) {
      expect(VALID_ID.test(p.id)).toBe(true);
      expect(isBuiltinProfile(p)).toBe(true);
      // survives the normalizer unchanged, so every step has numbers and a known kind
      expect(normalizeMashProfile(p)).toEqual(p);
    }
  });

  it('rise in temperature, but where cold water cools for a further charge (Earl, Herrmann)', () => {
    for (const p of BUILTIN_MASH_PROFILES.filter((x) => !x.steps.some((s) => s.kind === 'doughIn'))) {
      const temps = [p.doughIn.tempC, ...p.steps.map((s) => s.tempC!)];
      expect(temps).toEqual([...temps].sort((a, b) => a - b));
    }
  });

  it('the decoction methods have one, two and three decoctions, the last of three thin', () => {
    const decoctions = (id: string) => byId(id).steps.filter((s) => s.kind === 'decoction');
    expect(decoctions('std-einmaisch')).toHaveLength(1);
    expect(decoctions('std-zweimaisch')).toHaveLength(2);
    expect(decoctions('std-dreimaisch').map((s) => !!s.decoction!.thin)).toEqual([false, false, true]);
  });

  it('Herrmann adds the second half of the grist after cooling to the maltase rest', () => {
    const steps = byId('std-herrmann').steps;
    const at = steps.findIndex((s) => s.kind === 'doughIn');
    expect(steps[at]).toMatchObject({ sharePct: 50 });
    expect(steps[at - 1]).toMatchObject({ kind: 'infusion', waterTempC: 12 });
    expect(steps[at + 1]).toMatchObject({ kind: 'rest', name: 'Maltaserast', tempC: 45 });
    expect(steps.some((s) => s.kind === 'decoction')).toBe(false);
  });
});

describe('applyMashProfile', () => {
  const plan = () => recipeOf([
    { id: 'r1', kind: 'rest', name: 'alt', tempC: 72, durationMin: 20 },
    { id: 'd2', kind: 'doughIn', name: 'Schüttung 2 zugeben', chargeId: 'c2' },
  ]);

  it('keeps the two fixed steps and replaces the rest', () => {
    const before = plan();
    const after = applyMashProfile(before, byId('std-weizen')).mash;
    expect(after[0]).toBe(before.mash[0]);
    expect(after[1]).toMatchObject({ id: before.mash[1].id, kind: 'doughIn', tempC: 45, durationMin: 20 });
    expect(after.slice(2).map((s) => [s.kind, s.name, s.tempC, s.durationMin])).toEqual([
      ['rest', 'Maltoserast', 63, 45], ['rest', 'Verzuckerungsrast', 72, 20], ['rest', 'Abmaischen', 78, 5],
    ]);
    expect(new Set(after.map((s) => s.id)).size).toBe(after.length);
  });

  it('gives infusion steps a temperature lead, with the profile\'s water temperature', () => {
    const p = {
      ...newMashProfile(), steps: [
        { kind: 'infusion' as const, name: 'Zubrühen', tempC: 72, durationMin: 10 },
        { kind: 'infusion' as const, name: 'kalt', tempC: 60, durationMin: 0, waterTempC: 12 },
      ],
    };
    const mash = applyMashProfile(plan(), p).mash;
    expect(mash[2].infusion).toEqual({ lead: 'temp' });
    expect(mash[3].infusion).toEqual({ lead: 'temp', waterTempC: 12 });
  });

  it('loads decoctions led by temperature', () => {
    const mash = applyMashProfile(plan(), byId('std-dreimaisch')).mash;
    expect(mash[2]).toMatchObject({
      kind: 'decoction', tempC: 52, durationMin: 15, decoction: { lead: 'temp', rests: [{ tempC: 72, durationMin: 10 }], boilMin: 20 },
    });
    expect(mash[4].decoction).toEqual({ lead: 'temp', thin: true, rests: [], boilMin: 10 });
  });

  it('splits the first charge for a profile charge the recipe lacks; the kg stay', () => {
    const before = recipeOf();
    const after = applyMashProfile(before, byId('std-earl'));
    const charges = chargesOf(after);
    expect(charges).toHaveLength(2);
    expect(kgOf(after, charges[1].id)).toBeCloseTo(1, 6);       // 20 % of 5 kg
    expect(kgOf(after, charges[0].id)).toBeCloseTo(4, 6);
    expect(after.ingredients.filter((i) => i.name === 'pils').reduce((s, i) => s + i.amount, 0)).toBeCloseTo(4, 6);
    const doughIns = after.mash.filter((s) => s.kind === 'doughIn');
    expect(doughIns[1]).toMatchObject({ chargeId: charges[1].id, name: 'Schüttung 2 zugeben', durationMin: 10 });
    expect(profileLoadEffects(before, byId('std-earl'))).toEqual({ created: [{ name: 'Schüttung 2', pct: 20 }], unplaced: [] });
  });

  it('takes an existing further charge without touching the grain', () => {
    const before = recipeOf([], {
      charges: [{ id: 'c1', name: 'Schüttung 1' }, { id: 'c2', name: 'Weizen' }],
      ingredients: [grain('pils', 4), grain('weizen', 1, 'c2')],
    });
    const after = applyMashProfile(before, byId('std-earl'));
    expect(after.charges).toBe(before.charges);
    expect(after.ingredients).toBe(before.ingredients);
    expect(after.mash.filter((s) => s.kind === 'doughIn')[1].chargeId).toBe('c2');
    expect(profileLoadEffects(before, byId('std-earl'))).toEqual({ created: [], unplaced: [] });
  });

  it('reports further charges left without a doughIn step', () => {
    const before = recipeOf([], { charges: [{ id: 'c1', name: 'Schüttung 1' }, { id: 'c2', name: 'Weizen' }] });
    expect(profileLoadEffects(before, byId('std-weizen'))).toEqual({ created: [], unplaced: ['Weizen'] });
    expect(profileLoadEffects(recipeOf(), byId('std-weizen'))).toEqual({ created: [], unplaced: [] });
  });
});

describe('profileOfPlan', () => {
  it('takes doughIn temperature and hold plus rests and infusions', () => {
    const r = recipeOf();
    r.mash = [
      ...normalizeMash([{ id: 'k', kind: 'doughIn', name: 'Einmaischen', tempC: 57, durationMin: 15 }]),
      { id: 'r', kind: 'rest', name: 'Maltoserast', tempC: 63, durationMin: 40 },
      { id: 'd2', kind: 'doughIn', name: 'Schüttung 2 zugeben', chargeId: 'c2', durationMin: 10 },
      { id: 'i', kind: 'infusion', name: 'Zubrühen', tempC: 72, durationMin: 10, infusion: { lead: 'volume', volumeL: 3 } },
      { id: 'j', kind: 'infusion', name: 'kalt', tempC: 66, durationMin: 0, infusion: { lead: 'temp', waterTempC: 12 } },
    ];
    // c2 is no charge of the recipe, so that doughIn counts as the first charge and stays out.
    expect(profileOfPlan(r)).toEqual({
      doughIn: { tempC: 57, durationMin: 15 },
      steps: [
        { kind: 'rest', name: 'Maltoserast', tempC: 63, durationMin: 40 },
        { kind: 'infusion', name: 'Zubrühen', tempC: 72, durationMin: 10 },
        { kind: 'infusion', name: 'kalt', tempC: 66, durationMin: 0, waterTempC: 12 },
      ],
    });
  });

  it('stores further charges by their share and decoctions with the reached temperature', () => {
    const r = recipeOf([
      { id: 'dek', kind: 'decoction', name: 'Kochmaische', tempC: 60, durationMin: 30, decoction: { lead: 'share', sharePct: 35, rests: [], boilMin: 20 } },
      { id: 'd2', kind: 'doughIn', name: 'Weizen zugeben', chargeId: 'c2', durationMin: 10 },
    ], {
      charges: [{ id: 'c1', name: 'Schüttung 1' }, { id: 'c2', name: 'Weizen' }],
      ingredients: [grain('pils', 4), grain('weizen', 1, 'c2')],
    });
    expect(profileOfPlan(r, (s) => (s.id === 'dek' ? 64.04 : undefined)).steps).toEqual([
      { kind: 'decoction', name: 'Kochmaische', tempC: 64, durationMin: 30, decoction: { rests: [], boilMin: 20 } },
      { kind: 'doughIn', name: 'Weizen zugeben', durationMin: 10, sharePct: 20 },
    ]);
  });

  it('round-trips through apply', () => {
    for (const id of ['std-eiweiss', 'std-dreimaisch', 'std-earl', 'std-herrmann']) {
      const p: MashProfile = byId(id);
      const again = profileOfPlan(applyMashProfile(recipeOf(), p));
      expect(again).toEqual({ doughIn: p.doughIn, steps: p.steps });
    }
  });

  it('lets a rest without a temperature keep the previous one', () => {
    const r = recipeOf([{ id: 'r', kind: 'rest', name: 'x', durationMin: 5 }]);
    expect(profileOfPlan(r).steps[0].tempC).toBe(67);
  });
});

describe('normalizeMashProfile', () => {
  it('fills in a sparse file and drops unusable steps', () => {
    const p = normalizeMashProfile({
      id: 'a', steps: [
        { kind: 'rest', name: 'ok', tempC: 63, durationMin: 30 },
        { kind: 'steep', name: 'unbekannt', tempC: 70, durationMin: 10 },
        { kind: 'rest', name: 'ohne Zahl' },
        { kind: 'doughIn', name: 'ohne Anteil', durationMin: 10 },
        { kind: 'decoction', tempC: 64, durationMin: 20, decoction: { rests: [{ tempC: 72 }, { tempC: 72, durationMin: 5 }] } },
      ] as never,
    });
    expect(p).toMatchObject({ name: '', method: '', description: '', doughIn: { tempC: 67, durationMin: 60 } });
    expect(p.steps).toEqual([
      { kind: 'rest', name: 'ok', tempC: 63, durationMin: 30 },
      { kind: 'decoction', name: '', tempC: 64, durationMin: 20, decoction: { rests: [{ tempC: 72, durationMin: 5 }], boilMin: 15 } },
    ]);
  });
});

describe('copies and summary', () => {
  it('duplicate has a new id, a suffix and is not shipped', () => {
    const copy = duplicateMashProfile(byId('std-einrast'));
    expect(copy.id).not.toBe('std-einrast');
    expect(isBuiltinProfile(copy)).toBe(false);
    expect(copy.name).toBe('Einrast-Infusion (Kopie)');
    copy.steps[0].tempC = 1;
    expect(byId('std-einrast').steps[0].tempC).toBe(78);
  });

  it('summarizes the sequence, marking decoctions and further charges', () => {
    expect(mashProfileSummary(byId('std-hochkurz'))).toBe('62 °C 35 min → 72 °C 20 min → 78 °C 5 min');
    expect(mashProfileSummary(byId('std-einmaisch'))).toBe('50 °C 15 min → Dekoktion 64 °C 40 min → 72 °C 20 min → 78 °C 5 min');
    expect(mashProfileSummary(byId('std-earl'))).toContain('→ +20 % Schüttung →');
  });
});

describe('API', () => {
  it('lists with defaults, sorted by name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'b', name: 'Zwei' }, { id: 'a', name: 'Eins' }]))));
    const list = await listMashProfiles();
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
    expect(list[0].steps).toEqual([]);
  });

  it('save sets updatedAt and refuses ids the firmware would reject', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const saved = await saveMashProfile({ ...newMashProfile(), id: 'mp1', name: 'X' });
    expect(saved.updatedAt).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/mash-profiles/mp1', expect.objectContaining({ method: 'PUT' }));
    await expect(saveMashProfile({ ...newMashProfile(), id: '../x' })).rejects.toThrow();
  });

  it('delete calls the id route and fails on an error status', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(deleteMashProfile('mp1')).rejects.toThrow('404');
    expect(fetchMock).toHaveBeenCalledWith('/api/mash-profiles/mp1', { method: 'DELETE' });
  });
});
