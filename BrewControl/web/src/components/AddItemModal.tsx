import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, ScannedDevice } from '../types';
import { createSensor, createActuator, createController, scanOneWireBus } from '../api';

type Role = 'sensor' | 'actuator' | 'controller';

export function AddItemModal({ open, snap, onClose }: {
  open: boolean;
  snap: Snapshot | null;
  onClose: () => void;
}) {
  const [role, setRole] = useState<Role>('sensor');
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'Binary' | 'TimeProportional'>('TimeProportional');
  const [sensorId, setSensorId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [setpoint, setSetpoint] = useState('65');
  const [kp, setKp] = useState('8');
  const [ki, setKi] = useState('0.2');
  const [kd, setKd] = useState('0.5');
  const [minOut, setMinOut] = useState('0');
  const [maxOut, setMaxOut] = useState('1');
  const [scanning, setScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setId('');
      setPin('');
      setErr(null);
      setScanning(false);
      setScannedDevices([]);
      setSelectedAddress('');
      setSensorId(snap?.sensors[0]?.id ?? '');
      setActuatorId(snap?.actuators[0]?.id ?? '');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const trimId = id.trim();
    if (!trimId) { setErr('ID required'); return; }
    setPending(true);
    setErr(null);
    try {
      if (role === 'sensor') {
        const p = parseInt(pin, 10);
        if (isNaN(p)) throw new Error('invalid pin');
        await createSensor({
          type: 'DS18B20', id: trimId, pin: p,
          ...(selectedAddress ? { address: selectedAddress } : {}),
        });
      } else if (role === 'actuator') {
        const p = parseInt(pin, 10);
        if (isNaN(p)) throw new Error('invalid pin');
        await createActuator({ type: 'DigitalOutput', id: trimId, pin: p, mode });
      } else {
        if (!sensorId || !actuatorId) throw new Error('select sensor and actuator');
        await createController({
          type: 'PID', id: trimId,
          sensor: sensorId, actuator: actuatorId,
          setpoint: parseFloat(setpoint) || 0,
          Kp: parseFloat(kp) || 8,
          Ki: parseFloat(ki) || 0.2,
          Kd: parseFloat(kd) || 0.5,
          min: parseFloat(minOut) || 0,
          max: parseFloat(maxOut) || 1,
        });
      }
      onClose();
    } catch (e) {
      setErr(String(e));
    }
    setPending(false);
  }

  const inp = 'w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm';
  const lbl = 'block text-xs text-stone-500 mb-1';

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        class="w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 class="text-base font-medium text-stone-900">Add Item</h2>

        <form onSubmit={handleSubmit} class="mt-4 space-y-4">
          <div>
            <label class={lbl}>Type</label>
            <div class="flex gap-2">
              {(['sensor', 'actuator', 'controller'] as Role[]).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  class={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    role === r
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label class={lbl}>ID</label>
            <input type="text" value={id}
              onInput={(e) => setId((e.target as HTMLInputElement).value)}
              placeholder="e.g. kettle_temp" class={inp} required />
          </div>

          {role === 'sensor' && (
            <>
              <div>
                <label class={lbl}>OneWire Pin (GPIO)</label>
                <div class="flex gap-2">
                  <input type="number" value={pin}
                    onInput={(e) => {
                      setPin((e.target as HTMLInputElement).value);
                      setScannedDevices([]);
                      setSelectedAddress('');
                    }}
                    placeholder="e.g. 4" class={`${inp} flex-1`} required />
                  <button type="button"
                    disabled={scanning || !pin}
                    onClick={async () => {
                      setScanning(true);
                      setScannedDevices([]);
                      setSelectedAddress('');
                      setErr(null);
                      try {
                        const r = await scanOneWireBus(parseInt(pin, 10));
                        setScannedDevices(r.devices);
                        if (r.devices.length === 1) setSelectedAddress(r.devices[0].address);
                      } catch (e) { setErr(String(e)); }
                      setScanning(false);
                    }}
                    class="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50">
                    {scanning ? '…' : 'Scan'}
                  </button>
                </div>
              </div>
              {scannedDevices.length > 0 && (
                <div>
                  <label class={lbl}>Device on Bus ({scannedDevices.length} found)</label>
                  <div class="space-y-1">
                    {scannedDevices.map((d) => (
                      <label key={d.address} class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="addr" value={d.address}
                          checked={selectedAddress === d.address}
                          onChange={() => setSelectedAddress(d.address)} />
                        <span class="font-mono text-xs text-stone-700">
                          {d.address.match(/.{2}/g)!.join(':')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {scannedDevices.length === 0 && pin && !scanning && (
                <p class="text-xs text-stone-400">Scan to find devices on this bus.</p>
              )}
            </>
          )}

          {role === 'actuator' && (
            <>
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={pin}
                  onInput={(e) => setPin((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 16" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Mode</label>
                <select value={mode}
                  onChange={(e) => setMode((e.target as HTMLSelectElement).value as typeof mode)}
                  class={inp}>
                  <option value="Binary">Binary (on/off)</option>
                  <option value="TimeProportional">Time-Proportional (TPO/SSR)</option>
                </select>
              </div>
            </>
          )}

          {role === 'controller' && (
            <>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class={lbl}>Sensor</label>
                  <select value={sensorId}
                    onChange={(e) => setSensorId((e.target as HTMLSelectElement).value)}
                    class={inp}>
                    {snap?.sensors.map((s) => (
                      <option key={s.id} value={s.id}>{s.id}</option>
                    ))}
                    {!snap?.sensors.length && <option value="">— no sensors —</option>}
                  </select>
                </div>
                <div>
                  <label class={lbl}>Actuator</label>
                  <select value={actuatorId}
                    onChange={(e) => setActuatorId((e.target as HTMLSelectElement).value)}
                    class={inp}>
                    {snap?.actuators.map((a) => (
                      <option key={a.id} value={a.id}>{a.id}</option>
                    ))}
                    {!snap?.actuators.length && <option value="">— no actuators —</option>}
                  </select>
                </div>
              </div>
              <div>
                <label class={lbl}>Setpoint</label>
                <input type="number" step="any" value={setpoint}
                  onInput={(e) => setSetpoint((e.target as HTMLInputElement).value)}
                  class={inp} />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class={lbl}>Kp</label>
                  <input type="number" step="any" value={kp}
                    onInput={(e) => setKp((e.target as HTMLInputElement).value)} class={inp} />
                </div>
                <div>
                  <label class={lbl}>Ki</label>
                  <input type="number" step="any" value={ki}
                    onInput={(e) => setKi((e.target as HTMLInputElement).value)} class={inp} />
                </div>
                <div>
                  <label class={lbl}>Kd</label>
                  <input type="number" step="any" value={kd}
                    onInput={(e) => setKd((e.target as HTMLInputElement).value)} class={inp} />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>Min output</label>
                  <input type="number" step="any" value={minOut}
                    onInput={(e) => setMinOut((e.target as HTMLInputElement).value)} class={inp} />
                </div>
                <div>
                  <label class={lbl}>Max output</label>
                  <input type="number" step="any" value={maxOut}
                    onInput={(e) => setMaxOut((e.target as HTMLInputElement).value)} class={inp} />
                </div>
              </div>
            </>
          )}

          {err && <p class="text-xs text-red-600">{err}</p>}

          <div class="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={pending}
              class="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={pending}
              class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
