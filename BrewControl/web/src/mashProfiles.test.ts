import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_MASH_PROFILES, applyMashProfile, deleteMashProfile, droppedChargeSteps, duplicateMashProfile, isBuiltinProfile,
  listMashProfiles, mashProfileSummary, newMashProfile, normalizeMashProfile, profileOfPlan, saveMashProfile,
} from './mashProfiles';
import { VALID_ID, normalizeMash, type MashStep } from './recipes';

afterEach(() => vi.unstubAllGlobals());

const byId = (id: string) => BUILTIN_MASH_PROFILES.find((p) => p.id === id)!;

describe('shipped profiles', () => {
  it('are the five of the plan, with valid unique ids', () => {
    expect(BUILTIN_MASH_PROFILES.map((p) => p.name)).toEqual([
      'Hochkurz', 'Einrast-Infusion', 'Weizen mit Ferulasäurerast', 'Klassisch mit Eiweißrast', 'Kombirast 66 °C',
    ]);
    expect(new Set(BUILTIN_MASH_PROFILES.map((p) => p.id)).size).toBe(5);
    for (const p of BUILTIN_MASH_PROFILES) {
      expect(VALID_ID.test(p.id)).toBe(true);
      expect(isBuiltinProfile(p)).toBe(true);
      // survives the normalizer unchanged, so every step has numbers and a known kind
      expect(normalizeMashProfile(p)).toEqual(p);
    }
  });

  it('rise in temperature', () => {
    for (const p of BUILTIN_MASH_PROFILES) {
      const temps = [p.doughIn.tempC, ...p.steps.map((s) => s.tempC)];
      expect(temps).toEqual([...temps].sort((a, b) => a - b));
    }
  });
});

describe('applyMashProfile', () => {
  const plan = (): MashStep[] => [
    ...normalizeMash([]),
    { id: 'r1', kind: 'rest', name: 'alt', tempC: 72, durationMin: 20 },
    { id: 'd2', kind: 'doughIn', name: 'Schüttung 2 zugeben', chargeId: 'c2' },
  ];

  it('keeps the two fixed steps and replaces the rest', () => {
    const before = plan();
    const after = applyMashProfile(before, byId('std-weizen'));
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toMatchObject({ id: before[1].id, kind: 'doughIn', tempC: 45, durationMin: 20 });
    expect(after.slice(2).map((s) => [s.kind, s.name, s.tempC, s.durationMin])).toEqual([
      ['rest', 'Maltoserast', 63, 45], ['rest', 'Verzuckerungsrast', 72, 20], ['rest', 'Abmaischen', 78, 5],
    ]);
    expect(new Set(after.map((s) => s.id)).size).toBe(after.length);
  });

  it('gives infusion steps a temperature lead', () => {
    const p = { ...newMashProfile(), steps: [{ kind: 'infusion' as const, name: 'Zubrühen', tempC: 72, durationMin: 10 }] };
    expect(applyMashProfile(plan(), p)[2].infusion).toEqual({ lead: 'temp' });
  });

  it('reports the doughIn steps of further charges it drops', () => {
    expect(droppedChargeSteps(plan()).map((s) => s.id)).toEqual(['d2']);
    expect(droppedChargeSteps(normalizeMash([]))).toEqual([]);
  });
});

describe('profileOfPlan', () => {
  it('takes doughIn temperature and hold plus rests and infusions', () => {
    const mash: MashStep[] = [
      ...normalizeMash([{ id: 'k', kind: 'doughIn', name: 'Einmaischen', tempC: 57, durationMin: 15 }]),
      { id: 'r', kind: 'rest', name: 'Maltoserast', tempC: 63, durationMin: 40 },
      { id: 'd2', kind: 'doughIn', name: 'Schüttung 2 zugeben', chargeId: 'c2', durationMin: 10 },
      { id: 'i', kind: 'infusion', name: 'Zubrühen', tempC: 72, durationMin: 10, infusion: { lead: 'volume', volumeL: 3 } },
    ];
    expect(profileOfPlan(mash)).toEqual({
      doughIn: { tempC: 57, durationMin: 15 },
      steps: [
        { kind: 'rest', name: 'Maltoserast', tempC: 63, durationMin: 40 },
        { kind: 'infusion', name: 'Zubrühen', tempC: 72, durationMin: 10 },
      ],
    });
  });

  it('round-trips through apply', () => {
    const p = byId('std-eiweiss');
    const again = profileOfPlan(applyMashProfile(normalizeMash([]), p));
    expect(again).toEqual({ doughIn: p.doughIn, steps: p.steps });
  });

  it('lets a rest without a temperature keep the previous one', () => {
    const mash = [...normalizeMash([]), { id: 'r', kind: 'rest' as const, name: 'x', durationMin: 5 }];
    expect(profileOfPlan(mash).steps[0].tempC).toBe(67);
  });
});

describe('normalizeMashProfile', () => {
  it('fills in a sparse file and drops unusable steps', () => {
    const p = normalizeMashProfile({
      id: 'a', steps: [
        { kind: 'rest', name: 'ok', tempC: 63, durationMin: 30 },
        { kind: 'decoction', name: 'später', tempC: 70, durationMin: 10 },
        { kind: 'rest', name: 'ohne Zahl' },
      ] as never,
    });
    expect(p).toMatchObject({ name: '', method: '', description: '', doughIn: { tempC: 67, durationMin: 60 } });
    expect(p.steps).toEqual([{ kind: 'rest', name: 'ok', tempC: 63, durationMin: 30 }]);
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

  it('summarizes the sequence', () => {
    expect(mashProfileSummary(byId('std-hochkurz'))).toBe('62 °C 35 min → 72 °C 20 min → 78 °C 5 min');
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
