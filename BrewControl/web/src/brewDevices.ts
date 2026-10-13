// The brewhouse's devices a brew day switches (Sud 5b-4): the pumps of the
// transfers and what the steps use (recirculation pump, agitator, water inlet
// valves, chiller, condenser). One row per device with what it is used for.
// Only devices linked to an actuator; the heater stays with its controller. Pure.
import { OUT, STEPS, stepShort, type Brewhouse, type Device, type StepKey } from './brewhouse';

export interface BrewDevice { device: Device; uses: string[] }

// The devices of `steps`, in process order.
export function brewDevices(bh: Brewhouse, steps: StepKey[]): BrewDevice[] {
  const rows: BrewDevice[] = [];
  const vesselName = (id: string) => (id === OUT ? 'Gärbehälter' : bh.vessels.find((v) => v.id === id)?.name || '?');
  const add = (id: string | undefined, use: string) => {
    const device = bh.devices.find((d) => d.id === id);
    if (!device || device.manual || !device.actuator) return;
    const row = rows.find((r) => r.device.id === device.id);
    if (!row) rows.push({ device, uses: [use] });
    else if (!row.uses.includes(use)) row.uses.push(use);
  };
  for (const { key } of STEPS) {
    if (!steps.includes(key)) continue;
    const step = stepShort(key);
    for (const t of bh.transfers) {
      if (t.step === key && t.drive === 'pump') add(t.pumpId, `${step} ${vesselName(t.from)} → ${vesselName(t.to)}`);
    }
    const cfg = bh.steps[key];
    if (!cfg) continue;
    add(cfg.pumpId, `Umwälzung ${step}`);
    add(cfg.agitatorId, step);
    for (const id of cfg.valveIds ?? []) add(id, `Wasserzulauf ${step}`);
    add(cfg.chillerId, step);
    add(cfg.condenserId, step);
  }
  return rows;
}
