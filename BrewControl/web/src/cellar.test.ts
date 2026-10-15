import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkContainer, checkFermenter, containerLabel, deleteContainer, deleteFermenter, fermenterSummary, listContainers,
  listFermenters, newContainer, newFermenter, normalizeContainer, normalizeFermenter, saveContainer, saveFermenter,
  setTempering, type Container, type Fermenter,
} from './cellar';
import { VALID_ID } from './recipes';
import type { Snapshot } from './types';

afterEach(() => vi.unstubAllGlobals());

function snap(partial: Partial<Snapshot> = {}): Snapshot {
  return { sensors: [], actuators: [], controllers: [], ...partial };
}

function sensor(id: string, unit: string): Snapshot['sensors'][number] {
  return {
    id, meta: { kind: 'Continuous', quantity: 'None', unit, min: 0, max: 100, res: 0.1 },
    state: { v: 0, t: 0 } as Snapshot['sensors'][number]['state'],
  };
}

const actuator = (id: string) => ({ id } as Snapshot['actuators'][number]);

const fermenter = (extra: Partial<Fermenter> = {}): Fermenter => ({ ...newFermenter(), name: 'Gärschrank', volumeL: 60, ...extra });
const container = (extra: Partial<Container> = {}): Container => ({ ...newContainer(), ...extra });

const errorsOf = (f: Fermenter, s: Snapshot | null = snap()) => checkFermenter(f, s).errors;
const hintsOf = (f: Fermenter, s: Snapshot | null = snap()) => checkFermenter(f, s).hints;

describe('new objects', () => {
  it('get valid ids and pass the check once named', () => {
    expect(VALID_ID.test(newFermenter().id)).toBe(true);
    expect(VALID_ID.test(newContainer().id)).toBe(true);
    expect(checkFermenter(fermenter(), snap()).errors).toEqual([]);
    expect(checkContainer(container(), snap()).errors).toEqual([]);
  });

  it('start by hand without tempering', () => {
    const f = newFermenter();
    expect(f.tempering).toBe('none');
    expect(f.manual).toBe(true);
  });
});

describe('checkFermenter errors', () => {
  it('needs a name', () => {
    expect(errorsOf(fermenter({ name: '  ' }))).toEqual(['Der Gärplatz braucht einen Namen.']);
  });

  it('needs a positive volume', () => {
    expect(errorsOf(fermenter({ volumeL: 0 }))).toHaveLength(1);
    expect(errorsOf(fermenter({ volumeL: NaN }))).toHaveLength(1);
  });

  it('rejects a trub loss that is negative or not smaller than the volume', () => {
    expect(errorsOf(fermenter({ trubLossL: -1 }))).toHaveLength(1);
    expect(errorsOf(fermenter({ trubLossL: 60 }))).toHaveLength(1);
    expect(errorsOf(fermenter({ trubLossL: 1.5 }))).toEqual([]);
  });

  it('rejects a negative pressure', () => {
    expect(errorsOf(fermenter({ maxPressureBar: -0.5 }))).toHaveLength(1);
    expect(errorsOf(fermenter({ maxPressureBar: 2 }))).toEqual([]);
  });

  it('blocks a connected tempering without controller or actuator', () => {
    const f = fermenter({ tempering: 'cool', manual: false });
    expect(errorsOf(f)).toEqual(['Die Temperierung ist angeschlossen, aber ohne Regler oder Aktor.']);
    expect(errorsOf({ ...f, controller: 'cool' })).toEqual([]);
    expect(errorsOf({ ...f, actuator: 'fridge' })).toEqual([]);
  });

  it('does not block a tempering done by hand or a sensor alone', () => {
    expect(errorsOf(fermenter({ tempering: 'both', manual: true }))).toEqual([]);
    expect(errorsOf(fermenter({ sensor: 'ispindel.temp' }))).toEqual([]);
  });
});

describe('checkFermenter hints', () => {
  it('say when a linked id is missing in the registry, and still allow saving', () => {
    const f = fermenter({ tempering: 'both', manual: false, controller: 'glycol', actuator: 'pump', sensor: 'probe' });
    const r = checkFermenter(f, snap());
    expect(r.errors).toEqual([]);
    expect(r.hints).toEqual([
      'Regler „glycol“ fehlt in der Registry.',
      'Aktor „pump“ fehlt in der Registry.',
      'Fühler „probe“ fehlt in der Registry.',
    ]);
  });

  it('are silent for ids that exist, remote proxies included', () => {
    const s = snap({
      controllers: [{ id: 'cool', setpoint: 0, enabled: false, params: { sensor: 'probe' } }],
      actuators: [actuator('fridge')], sensors: [sensor('probe', '°C')],
    });
    const f = fermenter({ tempering: 'cool', manual: false, controller: 'cool', actuator: 'fridge', sensor: 'probe' });
    expect(hintsOf(f, s)).toEqual([]);
  });

  it('warn about a sensor or controller input that does not measure °C', () => {
    const s = snap({
      sensors: [sensor('weight', 'kg'), sensor('probe', '°C')],
      controllers: [{ id: 'c', setpoint: 0, enabled: false, params: { sensor: 'weight' } }],
    });
    expect(hintsOf(fermenter({ sensor: 'weight' }), s)).toEqual(['Fühler „weight“ misst in kg, erwartet ist °C.']);
    expect(hintsOf(fermenter({ tempering: 'cool', manual: false, controller: 'c' }), s))
      .toEqual(['Regler „c“ regelt auf kg, erwartet ist °C.']);
  });

  it('warn about a density sensor that is missing or does not measure gravity', () => {
    const s = snap({ sensors: [sensor('tilt', '°'), sensor('spindel', 'SG'), sensor('refr', '°Bx'), sensor('plato', '°P')] });
    expect(hintsOf(fermenter({ densitySensor: 'ghost' }), s)).toEqual(['Dichtesensor „ghost“ fehlt in der Registry.']);
    expect(hintsOf(fermenter({ densitySensor: 'tilt' }), s)).toEqual([
      'Dichtesensor „tilt“ misst in °, erwartet ist °P, SG oder °Bx; der Gärverlauf zeichnet ihn nicht.',
    ]);
    for (const id of ['spindel', 'refr', 'plato']) expect(hintsOf(fermenter({ densitySensor: id }), s)).toEqual([]);
  });

  it('skip the checks without a snapshot', () => {
    expect(hintsOf(fermenter({ sensor: 'probe' }), null)).toEqual([]);
  });
});

describe('setTempering', () => {
  it('drops controller and actuator on "none" but keeps the sensor', () => {
    const f = fermenter({ tempering: 'cool', manual: false, controller: 'c', actuator: 'a', sensor: 's' });
    const g = setTempering(f, 'none');
    expect(g).toMatchObject({ tempering: 'none', sensor: 's' });
    expect(g.controller).toBeUndefined();
    expect(g.actuator).toBeUndefined();
  });

  it('keeps the links when switching between active temperings', () => {
    const f = fermenter({ tempering: 'cool', manual: false, controller: 'c' });
    expect(setTempering(f, 'both')).toMatchObject({ tempering: 'both', controller: 'c', manual: false });
  });
});

describe('checkContainer', () => {
  it('needs a positive size', () => {
    expect(checkContainer(container({ sizeL: 0 }), snap()).errors).toHaveLength(1);
  });

  it('needs a whole, non-negative count', () => {
    expect(checkContainer(container({ count: -1 }), snap()).errors).toHaveLength(1);
    expect(checkContainer(container({ count: 2.5 }), snap()).errors).toHaveLength(1);
    expect(checkContainer(container({ count: 0 }), snap()).errors).toEqual([]);
  });

  it('rejects a fill loss that is negative or not smaller than the size', () => {
    expect(checkContainer(container({ fillLossL: -0.1 }), snap()).errors).toHaveLength(1);
    expect(checkContainer(container({ sizeL: 0.5, fillLossL: 0.5 }), snap()).errors).toHaveLength(1);
    expect(checkContainer(container({ fillLossL: 0.2 }), snap()).errors).toEqual([]);
  });

  it('rejects a negative pressure', () => {
    expect(checkContainer(container({ maxPressureBar: -1 }), snap()).errors).toHaveLength(1);
  });

  it('hints at a keg without pressure and at a count of zero, without blocking', () => {
    const r = checkContainer(container({ kind: 'keg', sizeL: 19, count: 0 }), snap());
    expect(r.errors).toEqual([]);
    expect(r.hints).toEqual(['Keg ohne Angabe „druckfest bis“.', 'Anzahl 0: Das Gebinde ist nicht vorrätig.']);
    expect(checkContainer(container({ kind: 'keg', sizeL: 19, maxPressureBar: 3 }), snap()).hints).toEqual([]);
  });
});

describe('labels', () => {
  it('names a container by its name, else by kind and size', () => {
    expect(containerLabel(container({ kind: 'bottle', sizeL: 0.5 }))).toBe('Flasche 0,5 l');
    expect(containerLabel(container({ kind: 'keg', sizeL: 19 }))).toBe('Keg 19 l');
    expect(containerLabel(container({ name: 'Bügelflaschen' }))).toBe('Bügelflaschen');
  });

  it('summarises a fermenter', () => {
    expect(fermenterSummary(fermenter())).toBe('60 l · ohne Temperierung');
    expect(fermenterSummary(fermenter({ tempering: 'both', manual: false, controller: 'glycol', maxPressureBar: 1.5 })))
      .toBe('60 l · kühlen und heizen · Regler glycol · bis 1,5 bar');
    expect(fermenterSummary(fermenter({ volumeL: 25.5, tempering: 'cool' }))).toBe('25,5 l · kühlen · von Hand');
  });
});

describe('normalize', () => {
  it('fills in what an older or hand-edited file lacks', () => {
    const f = normalizeFermenter({ id: 'g1', name: 'Alt' });
    expect(f).toMatchObject({ id: 'g1', name: 'Alt', kind: 'other', tempering: 'none', manual: true, volumeL: 0 });
    const c = normalizeContainer({ id: 'c1' });
    expect(c).toMatchObject({ id: 'c1', kind: 'bottle', sizeL: 0, count: 0 });
  });

  it('keeps optional values, and the saved object survives a round trip', () => {
    const f = fermenter({ trubLossL: 1, maxPressureBar: 2, tempering: 'heat', manual: false, controller: 'c' });
    expect(normalizeFermenter(JSON.parse(JSON.stringify(f)))).toEqual(f);
    const c = container({ name: 'Keg', kind: 'keg', sizeL: 19, count: 3, fillLossL: 0.3, maxPressureBar: 3 });
    expect(normalizeContainer(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
});

describe('API', () => {
  function stub(responses: { status?: number; body?: unknown }[]) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const r = responses.shift() ?? {};
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200 });
    }));
    return calls;
  }

  it('lists fermenters sorted by name and normalised', async () => {
    stub([{ body: [{ id: 'b', name: 'Zeta' }, { id: 'a', name: 'Alpha', volumeL: 30 }] }]);
    const list = await listFermenters();
    expect(list.map((f) => f.name)).toEqual(['Alpha', 'Zeta']);
    expect(list[1].tempering).toBe('none');
  });

  it('saves a fermenter with PUT, stamps updatedAt and returns it', async () => {
    const calls = stub([{ status: 204 }]);
    const saved = await saveFermenter(fermenter({ id: 'g1' }));
    expect(calls[0].url).toBe('/api/fermenters/g1');
    expect(calls[0].init?.method).toBe('PUT');
    expect(JSON.parse(calls[0].init!.body as string)).toMatchObject({ id: 'g1', name: 'Gärschrank' });
    expect(saved.updatedAt).toBeGreaterThan(0);
  });

  it('saves, lists and deletes containers on their own path', async () => {
    const calls = stub([{ status: 204 }, { body: [{ id: 'k', kind: 'keg', sizeL: 19 }] }, { status: 204 }]);
    await saveContainer(container({ id: 'c1' }));
    expect((await listContainers())[0].kind).toBe('keg');
    await deleteContainer('c1');
    expect(calls.map((c) => `${c.init?.method ?? 'GET'} ${c.url}`))
      .toEqual(['PUT /api/containers/c1', 'GET /api/containers', 'DELETE /api/containers/c1']);
  });

  it('refuses an invalid id without a request, and reports a failing device', async () => {
    const calls = stub([{ status: 500, body: undefined }]);
    await expect(saveFermenter(fermenter({ id: 'a.b' }))).rejects.toThrow('ungültige ID');
    expect(calls).toHaveLength(0);
    await expect(deleteFermenter('g1')).rejects.toThrow('500');
  });
});
