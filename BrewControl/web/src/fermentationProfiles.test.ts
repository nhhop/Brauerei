import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_FERMENTATION_PROFILES, applyFermentationProfile, deleteFermentationProfile, duplicateFermentationProfile,
  fermentationProfileSummary, isBuiltinFermentationProfile, listFermentationProfiles, maxPressureBar,
  newFermentationProfile, normalizeFermentationProfile, profileOfFermentation, saveFermentationProfile, totalDays,
} from './fermentationProfiles';
import { VALID_ID, type Phase } from './recipes';

afterEach(() => vi.unstubAllGlobals());

const byId = (id: string) => BUILTIN_FERMENTATION_PROFILES.find((p) => p.id === id)!;

const phases: Phase[] = [
  { id: 'a', name: 'Hauptgärung', tempC: 12, duration: 7, pressureBar: 0.8 },
  { id: 'b', name: 'Lagerung', tempC: 2, duration: 21, rampDays: 2, pressureBar: 1 },
];

describe('shipped profiles', () => {
  it('have valid unique ids and survive the normalizer unchanged', () => {
    expect(BUILTIN_FERMENTATION_PROFILES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(BUILTIN_FERMENTATION_PROFILES.map((p) => p.id)).size).toBe(BUILTIN_FERMENTATION_PROFILES.length);
    for (const p of BUILTIN_FERMENTATION_PROFILES) {
      expect(p.id.startsWith('std-')).toBe(true);
      expect(VALID_ID.test(p.id)).toBe(true);
      expect(isBuiltinFermentationProfile(p)).toBe(true);
      expect(normalizeFermentationProfile(p)).toEqual(p);
      // a ramp is part of its phase
      for (const x of p.phases) expect(x.rampDays ?? 0).toBeLessThan(x.duration);
    }
  });

  it('only the pressure profile has pressures', () => {
    for (const p of BUILTIN_FERMENTATION_PROFILES) {
      expect(p.phases.some((x) => x.pressureBar !== undefined)).toBe(!!p.pressureFermentation);
    }
    expect(maxPressureBar(byId('std-druck'))).toBe(1.5);
  });
});

describe('applyFermentationProfile', () => {
  it('replaces the phases with new ids and sets pressure fermentation', () => {
    const p = byId('std-druck');
    const r = applyFermentationProfile({ fermentation: phases }, p);
    expect(r.pressureFermentation).toBe(true);
    expect(r.fermentation.map(({ id: _id, ...x }) => x)).toEqual(p.phases);
    expect(new Set(r.fermentation.map((x) => x.id)).size).toBe(p.phases.length);
    expect(r.fermentation.some((x) => x.id === 'a' || x.id === 'b')).toBe(false);
    // the recipe's phases are copies, editing them leaves the profile alone
    r.fermentation[0].tempC = 99;
    expect(p.phases[0].tempC).toBe(18);
  });

  it('clears pressure fermentation for a profile without it', () => {
    const r = applyFermentationProfile({ fermentation: phases, pressureFermentation: true }, byId('std-ale'));
    expect(r.pressureFermentation).toBeUndefined();
    expect(r.fermentation.map((x) => x.name)).toEqual(['Hauptgärung', 'Nachgärung', 'Cold Crash']);
  });
});

describe('profileOfFermentation', () => {
  it('drops the ids and keeps the pressures under pressure', () => {
    expect(profileOfFermentation({ fermentation: phases, pressureFermentation: true })).toEqual({
      pressureFermentation: true,
      phases: [
        { name: 'Hauptgärung', tempC: 12, duration: 7, pressureBar: 0.8 },
        { name: 'Lagerung', tempC: 2, duration: 21, rampDays: 2, pressureBar: 1 },
      ],
    });
  });

  it('leaves out the pressures without pressure fermentation', () => {
    const out = profileOfFermentation({ fermentation: phases });
    expect(out.pressureFermentation).toBeUndefined();
    expect(out.phases.every((x) => x.pressureBar === undefined)).toBe(true);
    expect(phases[0].pressureBar).toBe(0.8);
  });

  it('round-trips through a profile', () => {
    const p = { ...newFermentationProfile(profileOfFermentation({ fermentation: phases, pressureFermentation: true })), name: 'X' };
    const back = applyFermentationProfile({ fermentation: [] }, p);
    expect(profileOfFermentation(back)).toEqual(profileOfFermentation({ fermentation: phases, pressureFermentation: true }));
  });
});

describe('normalizeFermentationProfile', () => {
  it('fills defaults and drops phases without numbers', () => {
    const p = normalizeFermentationProfile({
      id: 'x',
      phases: [
        { name: 'ok', tempC: 10, duration: 5, rampDays: 0, pressureBar: -1 },
        { name: 'kein Wert', tempC: Number.NaN, duration: 3 },
        null as never,
      ],
    });
    expect(p).toEqual({ id: 'x', name: '', description: '', updatedAt: 0, phases: [{ name: 'ok', tempC: 10, duration: 5 }] });
  });
});

describe('copies and summary', () => {
  it('duplicate has a new id, a suffix and is not shipped', () => {
    const copy = duplicateFermentationProfile(byId('std-lager'));
    expect(isBuiltinFermentationProfile(copy)).toBe(false);
    expect(copy.name).toBe('Untergärig klassisch (Kopie)');
    copy.phases[0].tempC = 1;
    expect(byId('std-lager').phases[0].tempC).toBe(9);
  });

  it('summarizes the phases and counts the days', () => {
    const plain = (p: Parameters<typeof fermentationProfileSummary>[0]) => fermentationProfileSummary(p).replace(/ /g, ' ');
    expect(plain(byId('std-lager'))).toBe('9 °C 8 d → 1 °C 28 d');
    expect(plain(byId('std-druck'))).toBe('18 °C 7 d 1 bar → 18 °C 3 d 1,5 bar → 1 °C 14 d 1 bar');
    // breaks only around the arrows
    expect(fermentationProfileSummary(byId('std-lager'))).toBe('9 °C 8 d → 1 °C 28 d');
    expect(totalDays(byId('std-lager'))).toBe(36);
  });
});

describe('API', () => {
  it('lists with defaults, sorted by name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'b', name: 'Zwei' }, { id: 'a', name: 'Eins' }]))));
    const list = await listFermentationProfiles();
    expect(list.map((p) => p.id)).toEqual(['a', 'b']);
    expect(list[0].phases).toEqual([]);
  });

  it('save and delete use the collection route', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await saveFermentationProfile({ ...newFermentationProfile(), id: 'fp1', name: 'X' });
    expect(fetchMock).toHaveBeenCalledWith('/api/fermentation-profiles/fp1', expect.objectContaining({ method: 'PUT' }));
    await deleteFermentationProfile('fp1');
    expect(fetchMock).toHaveBeenCalledWith('/api/fermentation-profiles/fp1', { method: 'DELETE' });
  });
});
