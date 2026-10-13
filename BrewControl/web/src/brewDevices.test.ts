import { describe, expect, it } from 'vitest';
import { brewDevices } from './brewDevices';
import { TEMPLATES, addDevice, newDevice, type Brewhouse, type StepKey } from './brewhouse';

const MASH: StepKey[] = ['strike', 'mash', 'lauter', 'sparge'];
const BOIL: StepKey[] = ['sparge', 'lauter', 'boil', 'whirlpool', 'hopback', 'chill'];

// The 3-vessel HERMS with the devices named in `linked` on an actuator.
function herms3(linked: string[]): Brewhouse {
  const bh = TEMPLATES.find((t) => t.key === 'herms3')!.build();
  return {
    ...bh,
    devices: bh.devices.map((d) => (linked.includes(d.name) ? { ...d, manual: false, actuator: `act-${d.name}` } : d)),
  };
}

const names = (bh: Brewhouse, steps: StepKey[]) => brewDevices(bh, steps).map((r) => r.device.name);

describe('brewDevices', () => {
  it('lists a pump once with all it is used for, in process order', () => {
    const rows = brewDevices(herms3(['Pumpe 1', 'Pumpe 2']), MASH);
    expect(rows.map((r) => r.device.name)).toEqual(['Pumpe 2', 'Pumpe 1']);
    expect(rows[0].uses).toEqual(['Hauptguss HLT → Maisch-/Läuterbottich', 'Nachguss HLT → Maisch-/Läuterbottich']);
    expect(rows[1].uses).toEqual(['Umwälzung Maischen', 'Läutern Maisch-/Läuterbottich → Würzepfanne']);
  });

  it('shows lautering and sparging with the boil as well, and knocking out', () => {
    const rows = brewDevices(herms3(['Pumpe 1', 'Pumpe 2', 'Plattenkühler']), BOIL);
    expect(rows.map((r) => r.device.name)).toEqual(['Pumpe 1', 'Pumpe 2', 'Plattenkühler']);
    expect(rows[0].uses).toEqual(['Läutern Maisch-/Läuterbottich → Würzepfanne']);
    expect(rows[1].uses).toEqual(['Nachguss HLT → Maisch-/Läuterbottich', 'Kühlen Würzepfanne → Gärbehälter']);
    expect(rows[2].uses).toEqual(['Kühlen']);
  });

  it('leaves out devices worked by hand and the heaters', () => {
    expect(names(herms3([]), MASH)).toEqual([]);
    expect(names(herms3(['Pumpe 1', 'Heizstab HLT']), MASH)).toEqual(['Pumpe 1']);
  });

  it('adds the agitator and the water inlet valves of a step', () => {
    let bh = herms3([]);
    const tun = bh.steps.mash!.vesselId;
    bh = addDevice(bh, { ...newDevice('agitator', tun), manual: false, actuator: 'stir' });
    const valve = { ...newDevice('valve', tun), name: 'Zulauf', manual: false, actuator: 'inlet' };
    bh = { ...addDevice(bh, valve), steps: { ...bh.steps, mash: { ...bh.steps.mash!, valveIds: [valve.id] } } };
    const rows = brewDevices(bh, MASH);
    expect(rows.map((r) => [r.device.name, r.uses])).toEqual([['Rührwerk', ['Maischen']], ['Zulauf', ['Wasserzulauf Maischen']]]);
  });
});
