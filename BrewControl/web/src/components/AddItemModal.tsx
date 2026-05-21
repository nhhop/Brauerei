import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, ScannedDevice } from '../types';
import { createSensor, createActuator, createController, scanOneWireBus } from '../api';

type Role = 'sensor' | 'actuator' | 'controller';
type SensorType = 'DS18B20' | 'MAX31865';
type Wires = 2 | 3 | 4;
type RtdType = 'PT100' | 'PT1000';

const DEFAULT_RREF: Record<RtdType, string> = { PT100: '430', PT1000: '4300' };

export function AddItemModal({ open, snap, onClose }: {
  open: boolean;
  snap: Snapshot | null;
  onClose: () => void;
}) {
  const [role, setRole] = useState<Role>('sensor');

  // shared
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sensor sub-type
  const [sensorType, setSensorType] = useState<SensorType>('DS18B20');

  // DS18B20
  const [scanning, setScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  // MAX31865
  const [csPin, setCsPin] = useState('');
  const [wiresCount, setWiresCount] = useState<Wires>(2);
  const [rtdType, setRtdType] = useState<RtdType>('PT100');
  const [rref, setRref] = useState(DEFAULT_RREF.PT100);
  const [rrefTouched, setRrefTouched] = useState(false);
  const [showCustomSpi, setShowCustomSpi] = useState(false);
  const [clkPin, setClkPin] = useState('');
  const [misoPin, setMisoPin] = useState('');
  const [mosiPin, setMosiPin] = useState('');

  // actuator
  const [mode, setMode] = useState<'Binary' | 'TimeProportional'>('TimeProportional');

  // controller
  const [sensorId, setSensorId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [setpoint, setSetpoint] = useState('65');
  const [kp, setKp] = useState('8');
  const [ki, setKi] = useState('0.2');
  const [kd, setKd] = useState('0.5');
  const [minOut, setMinOut] = useState('0');
  const [maxOut, setMaxOut] = useState('1');

  useEffect(() => {
    if (open) {
      setId(''); setPin(''); setErr(null);
      setScanning(false); setScannedDevices([]); setSelectedAddress('');
      setSensorType('DS18B20');
      setCsPin(''); setWiresCount(2); setRtdType('PT100');
      setRref(DEFAULT_RREF.PT100); setRrefTouched(false);
      setShowCustomSpi(false); setClkPin(''); setMisoPin(''); setMosiPin('');
      setSensorId(snap?.sensors[0]?.id ?? '');
      setActuatorId(snap?.actuators[0]?.id ?? '');
    }
  }, [open]);

  if (!open) return null;

  function handleRtdChange(rt: RtdType) {
    setRtdType(rt);
    if (!rrefTouched) setRref(DEFAULT_RREF[rt]);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const trimId = id.trim();
    if (!trimId) { setErr('ID required'); return; }
    setPending(true); setErr(null);
    try {
      if (role === 'sensor') {
        if (sensorType === 'DS18B20') {
          const p = parseInt(pin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          await createSensor({
            type: 'DS18B20', id: trimId, pin: p,
            ...(selectedAddress ? { address: selectedAddress } : {}),
          });
        } else {
          const cs = parseInt(csPin, 10);
          if (isNaN(cs)) throw new Error('CS pin required');
          const rrefVal = parseFloat(rref);
          if (isNaN(rrefVal) || rrefVal <= 0) throw new Error('invalid Rref');
          const customSpi = clkPin
            ? { clk: parseInt(clkPin, 10), miso: parseInt(misoPin, 10), mosi: parseInt(mosiPin, 10) }
            : {};
          if (clkPin && (isNaN((customSpi as any).miso) || isNaN((customSpi as any).mosi)))
            throw new Error('CLK set but MISO/MOSI missing');
          await createSensor({
            type: 'MAX31865', id: trimId, cs,
            wires: wiresCount, rtd: rtdType, rref: rrefVal,
            ...customSpi,
          });
        }
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
          Kp: parseFloat(kp) || 8, Ki: parseFloat(ki) || 0.2, Kd: parseFloat(kd) || 0.5,
          min: parseFloat(minOut) || 0, max: parseFloat(maxOut) || 1,
        });
      }
      onClose();
    } catch (e) { setErr(String(e)); }
    setPending(false);
  }

  const inp = 'w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm';
  const lbl = 'block text-xs text-stone-500 mb-1';
  const segBtn = (active: boolean) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
      active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
    }`;

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

          {/* Role selector */}
          <div>
            <label class={lbl}>Type</label>
            <div class="flex gap-2">
              {(['sensor', 'actuator', 'controller'] as Role[]).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  class={segBtn(role === r)}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sensor sub-type dropdown */}
          {role === 'sensor' && (
            <div>
              <label class={lbl}>Sensor Type</label>
              <select value={sensorType}
                onChange={(e) => setSensorType((e.target as HTMLSelectElement).value as SensorType)}
                class={inp}>
                <optgroup label="Temperatur">
                  <option value="DS18B20">DS18B20 (OneWire)</option>
                  <option value="MAX31865">MAX31865 (PT100/PT1000, SPI)</option>
                </optgroup>
                <optgroup label="Feuchte / Druck">
                  <option disabled>BME280 (I²C)</option>
                </optgroup>
                <optgroup label="Analog / Digital">
                  <option disabled>AnalogInput</option>
                  <option disabled>DigitalInput</option>
                </optgroup>
                <optgroup label="Durchfluss">
                  <option disabled>PulseCounter</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* ID field (all roles) */}
          <div>
            <label class={lbl}>ID</label>
            <input type="text" value={id}
              onInput={(e) => setId((e.target as HTMLInputElement).value)}
              placeholder="e.g. kettle_temp" class={inp} required />
          </div>

          {/* DS18B20 fields */}
          {role === 'sensor' && sensorType === 'DS18B20' && (
            <>
              <div>
                <label class={lbl}>OneWire Pin (GPIO)</label>
                <div class="flex gap-2">
                  <input type="number" value={pin}
                    onInput={(e) => {
                      setPin((e.target as HTMLInputElement).value);
                      setScannedDevices([]); setSelectedAddress('');
                    }}
                    placeholder="e.g. 4" class={`${inp} flex-1`} required />
                  <button type="button"
                    disabled={scanning || !pin}
                    onClick={async () => {
                      setScanning(true); setScannedDevices([]); setSelectedAddress(''); setErr(null);
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

          {/* MAX31865 fields */}
          {role === 'sensor' && sensorType === 'MAX31865' && (
            <>
              <div>
                <label class={lbl}>CS Pin (GPIO)</label>
                <input type="number" value={csPin}
                  onInput={(e) => setCsPin((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 5" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Wires</label>
                <div class="flex gap-2">
                  {([2, 3, 4] as Wires[]).map((w) => (
                    <button key={w} type="button" onClick={() => setWiresCount(w)}
                      class={segBtn(wiresCount === w)}>{w}-Wire</button>
                  ))}
                </div>
              </div>
              <div>
                <label class={lbl}>RTD Type</label>
                <div class="flex gap-2">
                  {(['PT100', 'PT1000'] as RtdType[]).map((rt) => (
                    <button key={rt} type="button" onClick={() => handleRtdChange(rt)}
                      class={segBtn(rtdType === rt)}>{rt}</button>
                  ))}
                </div>
              </div>
              <div>
                <label class={lbl}>Rref (Ω)</label>
                <input type="number" step="any" value={rref}
                  onInput={(e) => { setRref((e.target as HTMLInputElement).value); setRrefTouched(true); }}
                  class={inp} required />
              </div>
              <div>
                <button type="button"
                  onClick={() => setShowCustomSpi(!showCustomSpi)}
                  class="text-xs text-stone-500 hover:text-stone-700">
                  {showCustomSpi ? '▼' : '▶'} Custom SPI Pins (CLK / MISO / MOSI)
                </button>
                {showCustomSpi && (
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    {([['CLK', clkPin, setClkPin], ['MISO', misoPin, setMisoPin], ['MOSI', mosiPin, setMosiPin]] as const).map(
                      ([label, val, setter]) => (
                        <div key={label}>
                          <label class={lbl}>{label}</label>
                          <input type="number" value={val}
                            onInput={(e) => (setter as (v: string) => void)((e.target as HTMLInputElement).value)}
                            placeholder="GPIO" class={inp} />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actuator fields */}
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

          {/* Controller fields */}
          {role === 'controller' && (
            <>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class={lbl}>Sensor</label>
                  <select value={sensorId}
                    onChange={(e) => setSensorId((e.target as HTMLSelectElement).value)}
                    class={inp}>
                    {snap?.sensors.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                    {!snap?.sensors.length && <option value="">— no sensors —</option>}
                  </select>
                </div>
                <div>
                  <label class={lbl}>Actuator</label>
                  <select value={actuatorId}
                    onChange={(e) => setActuatorId((e.target as HTMLSelectElement).value)}
                    class={inp}>
                    {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                    {!snap?.actuators.length && <option value="">— no actuators —</option>}
                  </select>
                </div>
              </div>
              <div>
                <label class={lbl}>Setpoint</label>
                <input type="number" step="any" value={setpoint}
                  onInput={(e) => setSetpoint((e.target as HTMLInputElement).value)} class={inp} />
              </div>
              <div class="grid grid-cols-3 gap-2">
                {([['Kp', kp, setKp], ['Ki', ki, setKi], ['Kd', kd, setKd]] as const).map(
                  ([label, val, setter]) => (
                    <div key={label}>
                      <label class={lbl}>{label}</label>
                      <input type="number" step="any" value={val}
                        onInput={(e) => (setter as (v: string) => void)((e.target as HTMLInputElement).value)}
                        class={inp} />
                    </div>
                  )
                )}
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
