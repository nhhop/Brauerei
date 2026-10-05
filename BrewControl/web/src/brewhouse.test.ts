import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OUT, TEMPLATES, addDevice, anchor, assignStep, brewhouseSummary, checkBrewhouse, getBrewery, heatingOf, heatingText,
  listBrewhouses, newDevice, removeDevice, removeVessel, saveBrewhouse, schemaOf, vesselLabel,
  type Brewhouse, type Device, type Vessel,
} from './brewhouse';
import type { Snapshot } from './types';

const template = (key: string) => TEMPLATES.find((t) => t.key === key)!.build();

function vessel(id: string, name = id): Vessel {
  return { id, name, volumeL: 50, deadSpaceL: 1 };
}

function device(id: string, kind: Device['kind'], vesselId?: string, extra: Partial<Device> = {}): Device {
  return { ...newDevice(kind, vesselId), id, name: id, ...extra };
}

// One vessel doing mash, lauter and boil with a direct heater: the smallest valid brewhouse.
function minimal(): Brewhouse {
  return {
    id: 'bh1', name: 'Test', description: '', updatedAt: 0, mashEfficiencyPct: 75, coolingShrinkPct: 4,
    vessels: [vessel('pot', 'Topf')],
    devices: [device('heat', 'heater', 'pot')],
    steps: {
      mash: { vesselId: 'pot', heaterId: 'heat' },
      lauter: { vesselId: 'pot' },
      boil: { vesselId: 'pot', heaterId: 'heat' },
    },
    transfers: [],
    measurements: {},
  };
}

function snap(partial: Partial<Snapshot> = {}): Snapshot {
  return { sensors: [], actuators: [], controllers: [], ...partial };
}

function sensor(id: string, unit: string): Snapshot['sensors'][number] {
  return {
    id, meta: { kind: 'Continuous', quantity: 'None', unit, min: 0, max: 100, res: 0.1 },
    state: { v: 0, t: 0 } as Snapshot['sensors'][number]['state'],
  };
}

const errorsOf = (bh: Brewhouse, s: Snapshot | null = snap()) => checkBrewhouse(bh, s).errors.map((e) => e.text);
const hintsOf = (bh: Brewhouse, s: Snapshot | null = snap()) => checkBrewhouse(bh, s).hints.map((e) => e.text);

describe('templates', () => {
  it.each(TEMPLATES.filter((t) => t.key !== 'empty').map((t) => [t.key]))('%s passes the check', (key) => {
    const { errors, hints } = checkBrewhouse(template(key), snap());
    expect(errors).toEqual([]);
    expect(hints).toEqual([]);
  });

  it('"Leer" only lacks the vessels for the required steps', () => {
    expect(errorsOf(template('empty'))).toEqual([
      'Kein Behälter übernimmt „Maischen“.',
      'Kein Behälter übernimmt „Läutern“.',
      'Kein Behälter übernimmt „Kochen“.',
    ]);
  });

  it('every device starts by hand', () => {
    for (const t of TEMPLATES) expect(t.build().devices.every((d) => d.manual)).toBe(true);
  });

  it('builds fresh ids each time', () => {
    expect(template('herms3').id).not.toBe(template('herms3').id);
  });
});

describe('checkBrewhouse errors', () => {
  it('passes the minimal brewhouse', () => {
    expect(errorsOf(minimal())).toEqual([]);
  });

  it('empty name', () => {
    expect(errorsOf({ ...minimal(), name: '  ' })).toEqual(['Das Sudhaus braucht einen Namen.']);
  });

  it('required step without vessel', () => {
    const bh = minimal();
    delete bh.steps.lauter;
    expect(errorsOf(bh)).toEqual(['Kein Behälter übernimmt „Läutern“.']);
  });

  it('reference to a deleted vessel', () => {
    const bh = minimal();
    bh.steps.lauter = { vesselId: 'gone' };
    bh.devices.push(device('pump', 'pump', 'gone'));
    expect(errorsOf(bh)).toEqual([
      'pump: Den Behälter gibt es nicht mehr.',
      'Läutern: Den Behälter gibt es nicht mehr.',
    ]);
  });

  it('reference to a deleted or wrong-kind device', () => {
    const bh = minimal();
    bh.steps.mash = { ...bh.steps.mash!, pumpId: 'gone' };
    bh.steps.boil = { ...bh.steps.boil!, condenserId: 'heat' };
    expect(errorsOf(bh)).toEqual([
      'Maischen: Ein ausgewähltes Gerät gibt es nicht mehr.',
      'Kochen: Ein ausgewähltes Gerät gibt es nicht mehr.',
    ]);
  });

  it('mash or boil without heater', () => {
    const bh = minimal();
    bh.steps.mash = { vesselId: 'pot' };
    bh.steps.boil = { vesselId: 'pot' };
    expect(errorsOf(bh)).toEqual(['Maischen braucht eine Heizquelle.', 'Kochen braucht eine Heizquelle.']);
  });

  it('indirect heating without recirculation pump', () => {
    const bh = minimal();
    bh.devices.push(device('rims', 'heater'));
    bh.steps.mash = { vesselId: 'pot', heaterId: 'rims' };
    expect(errorsOf(bh)).toEqual(['Maischen: Die indirekte Heizung (indirekt über RIMS-Rohr) braucht eine Umwälzpumpe.']);
    bh.devices.push(device('p', 'pump'));
    bh.steps.mash.pumpId = 'p';
    expect(errorsOf(bh)).toEqual([]);
  });

  it('pump transfer without pump', () => {
    const bh = minimal();
    bh.transfers.push({ id: 't', step: 'boil', from: 'pot', to: 'out', drive: 'pump', lossL: 1, recovered: false });
    expect(errorsOf(bh)).toEqual(['Transfer mit Pumpe, aber ohne ausgewählte Pumpe.']);
    bh.transfers[0].drive = 'gravity';
    expect(errorsOf(bh)).toEqual([]);
  });

  it('transfer from or to a deleted vessel', () => {
    const bh = minimal();
    bh.transfers.push({ id: 't', step: 'boil', from: '', to: 'gone', drive: 'manual', lossL: 0, recovered: false });
    expect(errorsOf(bh)).toEqual(['Transfer ohne Quelle.', 'Transfer ohne Ziel.']);
  });

  it('connected device without its required link', () => {
    const bh = minimal();
    bh.devices[0].manual = false;
    bh.devices.push(device('chill', 'chiller', 'pot', { manual: false }));
    expect(errorsOf(bh)).toEqual([
      'heat ist angeschlossen, aber ohne Regler oder Aktor.',
      'chill ist angeschlossen, aber ohne Kühlwasserventil.',
    ]);
    bh.devices[0].controller = 'mash';
    bh.devices[1].actuator = 'valve1';
    const s = snap({ controllers: [{ id: 'mash', setpoint: 0, enabled: false }], actuators: [{ id: 'valve1' } as Snapshot['actuators'][number]] });
    expect(errorsOf(bh, s)).toEqual([]);
  });
});

describe('checkBrewhouse hints', () => {
  it('linked id missing in the snapshot', () => {
    const bh = minimal();
    bh.devices[0] = { ...bh.devices[0], manual: false, actuator: 'IDS1' };
    expect(hintsOf(bh)).toEqual(['heat: Aktor „IDS1“ fehlt in der Registry.']);
    expect(hintsOf(bh, null)).toEqual(['heat: Aktor „IDS1“ fehlt in der Registry.']);
  });

  it('condenser while boiling at full power', () => {
    const bh = minimal();
    bh.devices.push(device('cond', 'condenser', 'pot'));
    bh.steps.boil = { ...bh.steps.boil!, condenserId: 'cond' };
    expect(hintsOf(bh)).toHaveLength(1);
    bh.steps.boil.powerPct = 100;
    expect(hintsOf(bh)).toHaveLength(1);
    bh.steps.boil.powerPct = 70;
    expect(hintsOf(bh)).toEqual([]);
  });

  it('chill step without chiller', () => {
    const bh = minimal();
    bh.steps.chill = { vesselId: 'pot' };
    expect(hintsOf(bh)).toEqual(['Kühlen ohne Kühler.']);
  });

  it('measurement sensor whose unit does not fit', () => {
    const bh = minimal();
    bh.steps.strike = { vesselId: 'pot', heaterId: 'heat' };
    bh.measurements = { mashTemp: 'pt100', strikeVolume: 'scale', preBoilGravity: 'spindel' };
    const s = snap({ sensors: [sensor('pt100', '°C'), sensor('scale', 'kg'), sensor('spindel', 'SG')] });
    expect(hintsOf(bh, s)).toEqual(['Hauptgussmenge: Sensor „scale“ misst in kg, erwartet ist l.']);
  });

  it('measurement of a step the brewhouse lacks is ignored', () => {
    const bh = { ...minimal(), measurements: { spargeTemp: 'gone' } };
    expect(hintsOf(bh)).toEqual([]);
  });
});

describe('heatingOf', () => {
  it('direct', () => {
    const h = heatingOf(minimal(), 'mash');
    expect(h.direct).toBe(true);
    expect(heatingText(h)).toBe('direkt');
  });

  it('indirect through a coil in the heater vessel (HERMS)', () => {
    const bh = template('herms3');
    const h = heatingOf(bh, 'mash');
    expect(h).toMatchObject({ direct: false, via: 'coil' });
    expect(h.coil?.kind).toBe('coil');
    expect(heatingText(h)).toBe('indirekt über Spirale im HLT');
    expect(brewhouseSummary(bh)).toBe('3 Behälter · HERMS');
  });

  it('indirect through another vessel without coil (Kettle-RIMS)', () => {
    const bh = minimal();
    bh.vessels.push(vessel('kettle', 'Würzepfanne'));
    bh.devices.push(device('kheat', 'heater', 'kettle'));
    bh.steps.mash = { vesselId: 'pot', heaterId: 'kheat' };
    const h = heatingOf(bh, 'mash');
    expect(h).toMatchObject({ direct: false, via: 'vessel' });
    expect(heatingText(h)).toBe('indirekt über Würzepfanne');
    expect(brewhouseSummary(bh)).toBe('2 Behälter · Kettle-RIMS');
  });

  it('inline (RIMS tube)', () => {
    const bh = minimal();
    bh.devices.push(device('rims', 'heater'));
    bh.steps.mash = { vesselId: 'pot', heaterId: 'rims' };
    expect(heatingOf(bh, 'mash')).toMatchObject({ direct: false, via: 'inline' });
  });

  it('no heater', () => {
    expect(heatingOf(minimal(), 'lauter')).toEqual({ direct: false });
  });
});

describe('coil as chiller', () => {
  it('a coil can be the chiller of the chill step', () => {
    const bh = minimal();
    bh.devices.push(device('coil', 'coil', 'pot', { manual: false, actuator: 'cw' }));
    bh.steps.chill = { vesselId: 'pot', chillerId: 'coil' };
    const s = snap({ actuators: [{ id: 'cw' } as Snapshot['actuators'][number]] });
    expect(checkBrewhouse(bh, s)).toEqual({ errors: [], hints: [] });
  });

  it('a connected coil needs its cooling water valve', () => {
    const bh = minimal();
    bh.devices.push(device('coil', 'coil', 'pot', { manual: false }));
    expect(errorsOf(bh)).toEqual(['coil ist angeschlossen, aber ohne Kühlwasserventil.']);
  });
});

describe('vesselLabel', () => {
  it('recognises a preset', () => {
    const bh = template('herms3');
    expect(bh.vessels.map((v) => vesselLabel(bh, v))).toEqual(['HLT', 'Maisch-/Läuterbottich', 'Würzepfanne']);
  });

  it('ignores strike and chill when nothing matches exactly', () => {
    const bh = template('pot');
    expect(vesselLabel(bh, bh.vessels[0])).toBe('All-in-One');
  });

  it('lists the steps without a matching preset', () => {
    const bh = minimal();
    bh.vessels.push(vessel('x'));
    bh.steps.sparge = { vesselId: 'x' };
    bh.steps.hopback = { vesselId: 'x' };
    expect(vesselLabel(bh, bh.vessels[1])).toBe('Nachguss bereiten · Hop Back');
  });

  it('a vessel without steps is a Zwischenbehälter', () => {
    const bh = minimal();
    bh.vessels.push(vessel('x'));
    expect(vesselLabel(bh, bh.vessels[1])).toBe('Zwischenbehälter');
  });

  it('…pfanne when heated directly while mashing, else …bottich', () => {
    const bh = minimal();
    bh.vessels = [vessel('mt'), vessel('k')];
    bh.devices = [device('heat', 'heater', 'mt'), device('kh', 'heater', 'k'), device('p', 'pump')];
    bh.steps = {
      mash: { vesselId: 'mt', heaterId: 'heat' }, lauter: { vesselId: 'k' }, boil: { vesselId: 'k', heaterId: 'kh' },
    };
    expect(vesselLabel(bh, bh.vessels[0])).toBe('Maischpfanne');
    bh.steps.mash = { vesselId: 'mt', heaterId: 'kh', pumpId: 'p' };
    expect(vesselLabel(bh, bh.vessels[0])).toBe('Maischbottich');
  });
});

describe('edits', () => {
  it('a ticked step moves from the other vessel and keeps only its numbers', () => {
    let bh = minimal();
    bh.vessels.push(vessel('k'));
    bh.steps.boil = { ...bh.steps.boil!, powerPct: 80 };
    bh = assignStep(bh, 'k', 'boil', true);
    expect(bh.steps.boil).toEqual({ vesselId: 'k', powerPct: 80 });
    bh = assignStep(bh, 'k', 'boil', false);
    expect(bh.steps.boil).toBeUndefined();
  });

  it('pre-selects the agitator only for mashing and the condenser only for boiling', () => {
    let bh = minimal();
    bh = addDevice(bh, device('stir', 'agitator', 'pot'));
    bh = addDevice(bh, device('cond', 'condenser', 'pot'));
    expect(bh.steps.mash?.agitatorId).toBe('stir');
    expect(bh.steps.boil?.agitatorId).toBeUndefined();
    expect(bh.steps.boil?.condenserId).toBe('cond');
    expect(bh.steps.mash?.condenserId).toBeUndefined();
  });

  it('removing a vessel drops its steps and transfer ends, and flags its devices', () => {
    let bh = minimal();
    bh.transfers.push({ id: 't', step: 'boil', from: 'pot', to: 'out', drive: 'gravity', lossL: 0, recovered: false });
    bh = removeVessel(bh, 'pot');
    expect(bh.vessels).toEqual([]);
    expect(bh.steps).toEqual({});
    expect(bh.transfers[0].from).toBe('');
    // not silently turned into an inline heater
    expect(errorsOf(bh)).toContain('heat: Den Behälter gibt es nicht mehr.');
  });

  it('removing a device clears it from steps and transfers', () => {
    let bh = minimal();
    bh.devices.push(device('p', 'pump'));
    bh.steps.lauter = { vesselId: 'pot', pumpId: 'p', valveIds: ['p'] };
    bh.transfers.push({ id: 't', step: 'boil', from: 'pot', to: 'out', drive: 'pump', pumpId: 'p', lossL: 1, recovered: false });
    bh = removeDevice(bh, 'heat');
    bh = removeDevice(bh, 'p');
    expect(bh.devices).toEqual([]);
    expect(bh.steps.mash).toEqual({ vesselId: 'pot' });
    expect(bh.steps.lauter).toEqual({ vesselId: 'pot', valveIds: [] });
    expect(bh.transfers[0].pumpId).toBeUndefined();
  });
});

describe('schemaOf', () => {
  it('orders the vessels by their first step and merges transfers on the same route', () => {
    const bh = template('herms3');
    const { nodes, edges } = schemaOf(bh);
    expect(nodes.map((id) => bh.vessels.find((v) => v.id === id)?.name ?? id))
      .toEqual(['HLT', 'Maisch-/Läuterbottich', 'Würzepfanne', OUT]);
    expect(edges.map((e) => [e.kind, e.label, e.detail])).toEqual([
      ['transfer', 'Hauptguss & Nachguss', 'Pumpe 2 · 0,5 l'],
      ['transfer', 'Läutern', 'Pumpe 1 · 0,5 l'],
      ['transfer', 'Kühlen', 'Plattenkühler · Pumpe 2 · 1 l'],
      ['recirc', 'Umwälzung', 'Pumpe 1 · über HERMS-Spirale'],
    ]);
    const recirc = edges[3];
    expect([recirc.from, recirc.to]).toEqual([bh.vessels[1].id, bh.vessels[0].id]);
    expect(recirc.at).toBe(anchor.step('mash'));
  });

  it('a directly heated vessel recirculates into itself', () => {
    const bh = template('pot-pipe');
    const { nodes, edges } = schemaOf(bh);
    const pot = bh.vessels[0].id;
    expect(nodes).toEqual([pot, OUT]);
    expect(edges.find((e) => e.kind === 'recirc')).toMatchObject({ from: pot, to: pot, detail: 'Umwälzpumpe' });
    expect(edges.find((e) => e.kind === 'transfer')).toMatchObject({ label: 'Kühlen', detail: 'Schwerkraft' });
  });

  it('leaves out transfers whose vessel is gone and the fermenter when nothing is knocked out', () => {
    const bh = minimal();
    bh.transfers.push({ id: 't', step: 'boil', from: '', to: 'pot', drive: 'manual', lossL: 0, recovered: false });
    expect(schemaOf(bh)).toEqual({ nodes: ['pot'], edges: [] });
  });

  it('a vessel without steps comes last', () => {
    const bh = minimal();
    bh.vessels.unshift(vessel('tmp', 'Eimer'));
    expect(schemaOf(bh).nodes).toEqual(['pot', 'tmp']);
  });
});

describe('API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fills in missing fields when listing and sorts by name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ id: 'b', name: 'Zwei' }, { id: 'a', name: 'Eins' }]))));
    const list = await listBrewhouses();
    expect(list.map((b) => b.id)).toEqual(['a', 'b']);
    expect(list[0]).toMatchObject({ vessels: [], devices: [], steps: {}, transfers: [], measurements: {} });
  });

  it('save sets updatedAt and refuses ids the firmware would reject', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const saved = await saveBrewhouse(minimal());
    expect(saved.updatedAt).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('/api/brewhouses/bh1', expect.objectContaining({ method: 'PUT' }));
    await expect(saveBrewhouse({ ...minimal(), id: '../x' })).rejects.toThrow();
  });

  it('brewery falls back to the defaults while the file is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await getBrewery()).toEqual({ grainTempC: 18, tapWaterTempC: 12 });
  });
});
