import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, ScannedDevice, ItemConfig } from '../types';
import {
  createSensor, createActuator, createController,
  deleteSensor, deleteActuator, deleteController,
  scanOneWireBus, startAutotune, stopAutotune,
} from '../api';
import { btnPrimary, btnSecondary, dialogFrame, dialogFooter, dialogBtnRow, inp as inpBase } from '../ui';

const AUTOTUNE_METHODS = [
  'ZieglerNichols', 'CohenCoon', 'IMC', 'TyreusLuyben', 'LambdaTuning',
] as const;

type Role = 'sensor' | 'actuator' | 'controller';
type SensorType = 'DS18B20' | 'MAX31865' | 'YF-S201' | 'BME280' | 'HCSR04' | 'HX711' | 'DigitalInput';
type ControllerType = 'PID' | 'TwoPoint' | 'DualStage' | 'SplitRangePID';
type Wires = 2 | 3 | 4;
type RtdType = 'PT100' | 'PT1000';
type ActuatorType = 'DigitalOutput' | 'AnalogOutput' | 'IDS1' | 'IDS2';

const DEFAULT_RREF: Record<RtdType, string> = { PT100: '430', PT1000: '4300' };

export function AddItemModal({ open, snap, onClose, editConfig, editRole, onCreated }: {
  open: boolean;
  snap: Snapshot | null;
  onClose: () => void;
  editConfig?: ItemConfig;
  editRole?: Role;
  onCreated?: (role: Role, id: string) => void;
}) {
  const isEdit = !!(editConfig && editRole);

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

  // BME280
  const [i2cAddr, setI2cAddr] = useState<number>(0x76);

  // HCSR04
  const [trigPin, setTrigPin] = useState('');
  const [echoPin, setEchoPin] = useState('');
  const [showScale, setShowScale] = useState(false);
  const [scaleFactor, setScaleFactor] = useState('');
  const [scaleOffset, setScaleOffset] = useState('');
  const [scaleUnit, setScaleUnit] = useState('');

  // HX711
  const [hx711Dout, setHx711Dout] = useState('');
  const [hx711Sck,  setHx711Sck]  = useState('');
  const [hx711Scale, setHx711Scale] = useState('');

  // DigitalInput
  const [diPin, setDiPin] = useState('');
  const [diInvert, setDiInvert] = useState(false);
  const [diPullup, setDiPullup] = useState(false);
  const [diDebounce, setDiDebounce] = useState('0');

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
  const [actuatorType, setActuatorType] = useState<ActuatorType>('DigitalOutput');
  const [mode, setMode] = useState<'Binary' | 'TimeProportional'>('TimeProportional');
  const [pinWhite, setPinWhite] = useState('14');
  const [pinYellow, setPinYellow] = useState('12');
  const [pinInterrupt, setPinInterrupt] = useState('13');
  const [analogPin, setAnalogPin] = useState('');
  const [analogMode, setAnalogMode] = useState<'pwm' | 'dac'>('pwm');
  const [analogShowRange, setAnalogShowRange] = useState(false);
  const [analogMin, setAnalogMin] = useState('0');
  const [analogMax, setAnalogMax] = useState('1');
  const [analogUnit, setAnalogUnit] = useState('');
  const [invertOut, setInvertOut] = useState(false);

  // controller
  const [ctrlType, setCtrlType] = useState<ControllerType>('PID');
  const [sensorId, setSensorId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [setpoint, setSetpoint] = useState('65');
  // PID
  const [kp, setKp] = useState('8');
  const [ki, setKi] = useState('0.2');
  const [kd, setKd] = useState('0.5');
  const [minOut, setMinOut] = useState('0');
  const [maxOut, setMaxOut] = useState('1');
  // TwoPoint
  const [hystLow, setHystLow] = useState('-0.5');
  const [hystHigh, setHystHigh] = useState('0.5');
  const [inverted, setInverted] = useState(false);
  // DualStage / SplitRangePID (dual-output heat/cool) — time fields in seconds
  const [heatActuatorId, setHeatActuatorId] = useState('');
  const [coolActuatorId, setCoolActuatorId] = useState('');
  const [heatDiff, setHeatDiff] = useState('0.5');
  const [coolDiff, setCoolDiff] = useState('0.5');
  const [coolMinOnS, setCoolMinOnS] = useState('0');
  const [coolMinOffS, setCoolMinOffS] = useState('0');
  const [srDeadband, setSrDeadband] = useState('0.05');
  const [changeoverS, setChangeoverS] = useState('0');

  // autotune (edit-only, PID/SplitRangePID)
  const [atMethod, setAtMethod] = useState('ZieglerNichols');
  const [atBusy, setAtBusy] = useState(false);
  const [atErr, setAtErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setAtErr(null); setAtBusy(false); setAtMethod('ZieglerNichols');
    setScanning(false); setScannedDevices([]); setSelectedAddress('');

    if (isEdit && editConfig && editRole) {
      setRole(editRole);
      setId(String(editConfig.id ?? ''));

      if (editRole === 'sensor') {
        const t = String(editConfig.type ?? 'DS18B20') as SensorType;
        setSensorType(t);
        if (t === 'DS18B20') {
          setPin(String(editConfig.pin ?? ''));
          setSelectedAddress(String(editConfig.address ?? ''));
        } else if (t === 'MAX31865') {
          setCsPin(String(editConfig.cs ?? ''));
          setWiresCount((editConfig.wires ?? 2) as Wires);
          const rt = (editConfig.rtd ?? 'PT100') as RtdType;
          setRtdType(rt);
          setRref(String(editConfig.rref ?? DEFAULT_RREF[rt]));
          setRrefTouched(true);
          const hasCustomSpi = editConfig.clk != null;
          setShowCustomSpi(hasCustomSpi);
          setClkPin(hasCustomSpi ? String(editConfig.clk) : '');
          setMisoPin(hasCustomSpi ? String(editConfig.miso) : '');
          setMosiPin(hasCustomSpi ? String(editConfig.mosi) : '');
        } else if (t === 'YF-S201') {
          setPin(String(editConfig.pin ?? ''));
        } else if (t === 'BME280') {
          setI2cAddr((editConfig.address ?? 0x76) as number);
        } else if (t === 'HX711') {
          setHx711Dout(String(editConfig.dout ?? ''));
          setHx711Sck(String(editConfig.sck ?? ''));
          setHx711Scale(editConfig.scale != null ? String(editConfig.scale) : '');
        } else if (t === 'HCSR04') {
          setTrigPin(String(editConfig.trig ?? ''));
          setEchoPin(String(editConfig.echo ?? ''));
          const hasDeriv = editConfig.factor != null;
          setShowScale(hasDeriv);
          setScaleFactor(hasDeriv ? String(editConfig.factor) : '');
          setScaleOffset(hasDeriv ? String(editConfig.offset ?? '0') : '');
          setScaleUnit(hasDeriv ? String(editConfig.unit ?? '') : '');
        } else if (t === 'DigitalInput') {
          setDiPin(String(editConfig.pin ?? ''));
          setDiInvert(Boolean(editConfig.invert ?? false));
          setDiPullup(Boolean(editConfig.pullup ?? false));
          setDiDebounce(String(editConfig.debounce_ms ?? '0'));
        }
      } else if (editRole === 'actuator') {
        const t = String(editConfig.type ?? 'DigitalOutput') as ActuatorType;
        setActuatorType(t);
        if (t === 'DigitalOutput') {
          setPin(String(editConfig.pin ?? ''));
          setMode((editConfig.mode ?? 'Binary') as 'Binary' | 'TimeProportional');
          setInvertOut(Boolean(editConfig.invert ?? false));
        } else if (t === 'AnalogOutput') {
          setAnalogPin(String(editConfig.pin ?? ''));
          setAnalogMode((editConfig.mode ?? 'pwm') as 'pwm' | 'dac');
          const hasRange = editConfig.value_min != null || editConfig.value_max != null;
          setAnalogShowRange(hasRange);
          setAnalogMin(hasRange ? String(editConfig.value_min ?? '0') : '0');
          setAnalogMax(hasRange ? String(editConfig.value_max ?? '1') : '1');
          setAnalogUnit(hasRange ? String(editConfig.unit ?? '') : '');
        } else if (t === 'IDS1' || t === 'IDS2') {
          setPinWhite(String(editConfig.pin_white ?? '14'));
          setPinYellow(String(editConfig.pin_yellow ?? '12'));
          setPinInterrupt(String(editConfig.pin_interrupt ?? '13'));
        }
      } else if (editRole === 'controller') {
        const t = String(editConfig.type ?? 'PID') as ControllerType;
        setCtrlType(t);
        setSensorId(String(editConfig.sensor ?? ''));
        setActuatorId(String(editConfig.actuator ?? ''));
        setSetpoint(String(editConfig.setpoint ?? '0'));
        if (t === 'PID') {
          setKp(String(editConfig.Kp ?? '8'));
          setKi(String(editConfig.Ki ?? '0.2'));
          setKd(String(editConfig.Kd ?? '0.5'));
          setMinOut(String(editConfig.min ?? '0'));
          setMaxOut(String(editConfig.max ?? '1'));
        } else if (t === 'TwoPoint') {
          setHystLow(String(editConfig.hyst_low ?? '-0.5'));
          setHystHigh(String(editConfig.hyst_high ?? '0.5'));
          setInverted(Boolean(editConfig.inverted ?? false));
        } else if (t === 'DualStage') {
          setHeatActuatorId(String(editConfig.heat_actuator ?? ''));
          setCoolActuatorId(String(editConfig.cool_actuator ?? ''));
          setHeatDiff(String(editConfig.heat_diff ?? '0.5'));
          setCoolDiff(String(editConfig.cool_diff ?? '0.5'));
          setCoolMinOnS(String((Number(editConfig.cool_min_on_ms ?? 0)) / 1000));
          setCoolMinOffS(String((Number(editConfig.cool_min_off_ms ?? 0)) / 1000));
          setChangeoverS(String((Number(editConfig.changeover_ms ?? 0)) / 1000));
        } else if (t === 'SplitRangePID') {
          setHeatActuatorId(String(editConfig.heat_actuator ?? ''));
          setCoolActuatorId(String(editConfig.cool_actuator ?? ''));
          setKp(String(editConfig.Kp ?? '2'));
          setKi(String(editConfig.Ki ?? '0.1'));
          setKd(String(editConfig.Kd ?? '0'));
          setSrDeadband(String(editConfig.deadband ?? '0.05'));
          setChangeoverS(String((Number(editConfig.changeover_ms ?? 0)) / 1000));
        }
      }
    } else {
      // new item — reset to defaults
      setRole('sensor'); setId(''); setPin('');
      setSensorType('DS18B20');
      setI2cAddr(0x76);
      setCsPin(''); setWiresCount(2); setRtdType('PT100');
      setRref(DEFAULT_RREF.PT100); setRrefTouched(false);
      setShowCustomSpi(false); setClkPin(''); setMisoPin(''); setMosiPin('');
      setTrigPin(''); setEchoPin('');
      setShowScale(false); setScaleFactor(''); setScaleOffset(''); setScaleUnit('');
      setHx711Dout(''); setHx711Sck(''); setHx711Scale('');
      setDiPin(''); setDiInvert(false); setDiPullup(false); setDiDebounce('0');
      setActuatorType('DigitalOutput');
      setMode('TimeProportional');
      setInvertOut(false);
      setPinWhite('14'); setPinYellow('12'); setPinInterrupt('13');
      setAnalogPin(''); setAnalogMode('pwm'); setAnalogShowRange(false);
      setAnalogMin('0'); setAnalogMax('1'); setAnalogUnit('');
      setCtrlType('PID');
      setSensorId(snap?.sensors[0]?.id ?? '');
      setActuatorId(snap?.actuators[0]?.id ?? '');
      setSetpoint('65');
      setKp('8'); setKi('0.2'); setKd('0.5'); setMinOut('0'); setMaxOut('1');
      setHystLow('-0.5'); setHystHigh('0.5'); setInverted(false);
      setHeatActuatorId(snap?.actuators[0]?.id ?? '');
      setCoolActuatorId(snap?.actuators[1]?.id ?? '');
      setHeatDiff('0.5'); setCoolDiff('0.5');
      setCoolMinOnS('0'); setCoolMinOffS('0');
      setSrDeadband('0.05'); setChangeoverS('0');
    }
  }, [open]);

  if (!open) return null;

  const liveController = isEdit && editRole === 'controller' && id
    ? snap?.controllers.find((c) => c.id === id)
    : undefined;
  const autotuneState = liveController?.params?.autotuneState as string | undefined;

  async function onStartAutotune() {
    setAtBusy(true); setAtErr(null);
    try { await startAutotune(id, atMethod); }
    catch (e) { setAtErr(String(e)); }
    finally { setAtBusy(false); }
  }

  async function onStopAutotune() {
    setAtBusy(true); setAtErr(null);
    try { await stopAutotune(id); }
    catch (e) { setAtErr(String(e)); }
    finally { setAtBusy(false); }
  }

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
      let cfg: Record<string, unknown>;

      if (role === 'sensor') {
        if (sensorType === 'DS18B20') {
          const p = parseInt(pin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          cfg = { type: 'DS18B20', id: trimId, pin: p,
            ...(selectedAddress ? { address: selectedAddress } : {}) };
        } else if (sensorType === 'MAX31865') {
          const cs = parseInt(csPin, 10);
          if (isNaN(cs)) throw new Error('CS pin required');
          const rrefVal = parseFloat(rref);
          if (isNaN(rrefVal) || rrefVal <= 0) throw new Error('invalid Rref');
          const customSpi = clkPin
            ? { clk: parseInt(clkPin, 10), miso: parseInt(misoPin, 10), mosi: parseInt(mosiPin, 10) }
            : {};
          if (clkPin && (isNaN((customSpi as Record<string,number>).miso) || isNaN((customSpi as Record<string,number>).mosi)))
            throw new Error('CLK set but MISO/MOSI missing');
          cfg = { type: 'MAX31865', id: trimId, cs, wires: wiresCount, rtd: rtdType, rref: rrefVal, ...customSpi };
        } else if (sensorType === 'YF-S201') {
          const p = parseInt(pin, 10);
          if (isNaN(p) || p < 0) throw new Error('Ungültiger Pin');
          cfg = { type: 'YF-S201', id: trimId, pin: p };
        } else if (sensorType === 'BME280') {
          cfg = { type: 'BME280', id: trimId, address: i2cAddr };
        } else if (sensorType === 'HX711') {
          const dout = parseInt(hx711Dout, 10);
          const sck  = parseInt(hx711Sck,  10);
          if (isNaN(dout) || dout < 0) throw new Error('DOUT Pin ungültig');
          if (isNaN(sck)  || sck  < 0) throw new Error('SCK Pin ungültig');
          cfg = { type: 'HX711', id: trimId, dout, sck };
          if (hx711Scale.trim() !== '') {
            const sc = parseFloat(hx711Scale);
            if (isNaN(sc) || sc <= 0) throw new Error('Scale ungültig (muss > 0)');
            cfg.scale = sc;
          }
        } else if (sensorType === 'DigitalInput') {
          const p = parseInt(diPin, 10);
          if (isNaN(p) || p < 0) throw new Error('Pin ungültig');
          cfg = {
            type: 'DigitalInput', id: trimId, pin: p,
            invert: diInvert, pullup: diPullup,
            debounce_ms: parseInt(diDebounce, 10) || 0,
          };
        } else { // HCSR04
          const trig = parseInt(trigPin, 10);
          const echo = parseInt(echoPin, 10);
          if (isNaN(trig) || trig < 0) throw new Error('TRIG Pin ungültig');
          if (isNaN(echo) || echo < 0) throw new Error('ECHO Pin ungültig');
          cfg = { type: 'HCSR04', id: trimId, trig, echo };
          if (scaleFactor !== '') {
            const f = parseFloat(scaleFactor);
            if (isNaN(f)) throw new Error('Faktor ungültig');
            cfg.factor = f;
            if (scaleOffset !== '') { const o = parseFloat(scaleOffset); if (isNaN(o)) throw new Error('Offset ungültig'); cfg.offset = o; }
            if (scaleUnit !== '') cfg.unit = scaleUnit;
          }
        }
        if (isEdit) await deleteSensor(String(editConfig!.id));
        await createSensor(cfg);

      } else if (role === 'actuator') {
        if (actuatorType === 'IDS1' || actuatorType === 'IDS2') {
          const pw = parseInt(pinWhite, 10);
          const py = parseInt(pinYellow, 10);
          const pi = parseInt(pinInterrupt, 10);
          if (isNaN(pw) || isNaN(py) || isNaN(pi)) throw new Error('invalid pin');
          cfg = { type: actuatorType, id: trimId, pin_white: pw, pin_yellow: py, pin_interrupt: pi };
        } else if (actuatorType === 'AnalogOutput') {
          const p = parseInt(analogPin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          cfg = { type: 'AnalogOutput', id: trimId, pin: p, mode: analogMode };
          if (analogShowRange) {
            const vmin = parseFloat(analogMin);
            const vmax = parseFloat(analogMax);
            if (isNaN(vmin) || isNaN(vmax) || vmin >= vmax) throw new Error('invalid range (min must be < max)');
            cfg.value_min = vmin; cfg.value_max = vmax;
            if (analogUnit.trim()) cfg.unit = analogUnit.trim();
          }
        } else {
          const p = parseInt(pin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          cfg = { type: 'DigitalOutput', id: trimId, pin: p, mode, invert: invertOut };
        }
        if (isEdit) await deleteActuator(String(editConfig!.id));
        await createActuator(cfg);

      } else { // controller
        const dualOutput = ctrlType === 'DualStage' || ctrlType === 'SplitRangePID';
        if (!sensorId) throw new Error('Sensor auswählen');
        if (!dualOutput && !actuatorId) throw new Error('Aktor auswählen');
        if (dualOutput && !heatActuatorId && !coolActuatorId)
          throw new Error('Heiz- oder Kühl-Aktor auswählen');
        if (ctrlType === 'PID') {
          cfg = {
            type: 'PID', id: trimId,
            sensor: sensorId, actuator: actuatorId,
            setpoint: parseFloat(setpoint) || 0,
            Kp: parseFloat(kp) || 8, Ki: parseFloat(ki) || 0.2, Kd: parseFloat(kd) || 0.5,
            min: parseFloat(minOut) || 0, max: parseFloat(maxOut) || 1,
          };
        } else if (ctrlType === 'TwoPoint') {
          cfg = {
            type: 'TwoPoint', id: trimId,
            sensor: sensorId, actuator: actuatorId,
            setpoint: parseFloat(setpoint) || 0,
            hyst_low: parseFloat(hystLow) || -0.5,
            hyst_high: parseFloat(hystHigh) || 0.5,
            inverted,
          };
        } else if (ctrlType === 'DualStage') {
          cfg = {
            type: 'DualStage', id: trimId,
            sensor: sensorId,
            heat_actuator: heatActuatorId, cool_actuator: coolActuatorId,
            setpoint: parseFloat(setpoint) || 0,
            heat_diff: parseFloat(heatDiff) || 0.5,
            cool_diff: parseFloat(coolDiff) || 0.5,
            cool_min_on_ms: Math.round((parseFloat(coolMinOnS) || 0) * 1000),
            cool_min_off_ms: Math.round((parseFloat(coolMinOffS) || 0) * 1000),
            changeover_ms: Math.round((parseFloat(changeoverS) || 0) * 1000),
          };
        } else { // SplitRangePID
          cfg = {
            type: 'SplitRangePID', id: trimId,
            sensor: sensorId,
            heat_actuator: heatActuatorId, cool_actuator: coolActuatorId,
            setpoint: parseFloat(setpoint) || 0,
            Kp: parseFloat(kp) || 2, Ki: parseFloat(ki) || 0.1, Kd: parseFloat(kd) || 0,
            deadband: parseFloat(srDeadband) || 0.05,
            changeover_ms: Math.round((parseFloat(changeoverS) || 0) * 1000),
          };
        }
        if (isEdit) await deleteController(String(editConfig!.id));
        await createController(cfg);
      }

      onClose();
      if (!isEdit) onCreated?.(role, trimId);
    } catch (e) { setErr(String(e)); }
    setPending(false);
  }

  const inp = `${inpBase} font-mono`;
  const lbl = 'block text-xs text-muted mb-1';
  const segBtn = (active: boolean, disabled = false) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' :
      active ? 'bg-accent text-accent-fg' : 'bg-fg/5 text-muted hover:bg-fg/10'
    }`;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        class={`max-h-[90vh] w-full max-w-md ${dialogFrame}`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} class="flex min-h-0 flex-col">
          <div class="min-h-0 space-y-4 overflow-y-auto p-5">
          <h2 class="text-base font-medium text-fg">
            {isEdit ? 'Item bearbeiten' : 'Item hinzufügen'}
          </h2>

          {/* Role selector */}
          <div>
            <label class={lbl}>Typ</label>
            <div class="flex gap-2">
              {(['sensor', 'actuator', 'controller'] as Role[]).map((r) => (
                <button key={r} type="button"
                  onClick={() => { if (!isEdit) setRole(r); }}
                  disabled={isEdit}
                  class={segBtn(role === r, isEdit)}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sensor sub-type dropdown */}
          {role === 'sensor' && (
            <div>
              <label class={lbl}>Sensor Type</label>
              <select value={sensorType} disabled={isEdit}
                onChange={(e) => setSensorType((e.target as HTMLSelectElement).value as SensorType)}
                class={`${inp} ${isEdit ? 'opacity-60' : ''}`}>
                <optgroup label="Temperatur">
                  <option value="DS18B20">DS18B20 (OneWire)</option>
                  <option value="MAX31865">MAX31865 (PT100/PT1000, SPI)</option>
                </optgroup>
                <optgroup label="Feuchte / Druck">
                  <option value="BME280">BME280 (T/H/P, I²C)</option>
                </optgroup>
                <optgroup label="Durchfluss">
                  <option value="YF-S201">YF-S201 (Durchfluss)</option>
                </optgroup>
                <optgroup label="Distanz">
                  <option value="HCSR04">HC-SR04 (Ultraschall)</option>
                </optgroup>
                <optgroup label="Gewicht">
                  <option value="HX711">HX711 (Wägezelle)</option>
                </optgroup>
                <optgroup label="Digital / Schalter">
                  <option value="DigitalInput">Digitaler Eingang (GPIO)</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* Actuator sub-type dropdown */}
          {role === 'actuator' && (
            <div>
              <label class={lbl}>Actuator Type</label>
              <select value={actuatorType} disabled={isEdit} title="Actuator Type"
                onChange={(e) => setActuatorType((e.target as HTMLSelectElement).value as ActuatorType)}
                class={`${inp} ${isEdit ? 'opacity-60' : ''}`}>
                <option value="DigitalOutput">DigitalOutput (GPIO on/off + TPO)</option>
                <option value="AnalogOutput">AnalogOutput (PWM / DAC)</option>
                <option value="IDS1">IDS1 – Induktion (10 Stufen)</option>
                <option value="IDS2">IDS2 – Induktion (5 Stufen)</option>
              </select>
            </div>
          )}

          {/* Controller type selector */}
          {role === 'controller' && (
            <div>
              <label class={lbl}>Regler-Typ</label>
              <select value={ctrlType} disabled={isEdit} title="Regler-Typ"
                onChange={(e) => setCtrlType((e.target as HTMLSelectElement).value as ControllerType)}
                class={`${inp} ${isEdit ? 'opacity-60' : ''}`}>
                <optgroup label="Zweipunktregler">
                  <option value="TwoPoint">Einfacher Zweipunktregler</option>
                  <option value="DualStage">Dual-Stage-Regler (Heizen/Kühlen)</option>
                </optgroup>
                <optgroup label="PID">
                  <option value="PID">Einfacher PID-Regler</option>
                  <option value="SplitRangePID">Split-Range-PID-Regler (Heizen/Kühlen)</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* ID field (all roles) */}
          <div>
            <label class={lbl}>ID</label>
            <input type="text" value={id}
              onInput={(e) => setId((e.target as HTMLInputElement).value)}
              placeholder="z.B. maische_temp" class={inp} required />
          </div>

          {/* DS18B20 fields */}
          {role === 'sensor' && sensorType === 'DS18B20' && (
            <>
              <div>
                <label class={lbl}>OneWire Pin (GPIO)</label>
                <div class="flex gap-2">
                  <input type="number" value={pin}
                    onInput={(e) => { setPin((e.target as HTMLInputElement).value); setScannedDevices([]); setSelectedAddress(''); }}
                    placeholder="z.B. 4" class={`${inp} flex-1`} required />
                  <button type="button" disabled={scanning || !pin}
                    onClick={async () => {
                      setScanning(true); setScannedDevices([]); setSelectedAddress(''); setErr(null);
                      try {
                        const r = await scanOneWireBus(parseInt(pin, 10));
                        setScannedDevices(r.devices);
                        if (r.devices.length === 1) setSelectedAddress(r.devices[0].address);
                      } catch (e) { setErr(String(e)); }
                      setScanning(false);
                    }}
                    class="rounded-md bg-fg/5 px-3 py-1.5 text-xs font-medium text-muted hover:bg-fg/10 disabled:opacity-50">
                    {scanning ? '…' : 'Scan'}
                  </button>
                </div>
              </div>
              {scannedDevices.length > 0 && (
                <div>
                  <label class={lbl}>Gerät auf Bus ({scannedDevices.length} gefunden)</label>
                  <div class="space-y-1">
                    {scannedDevices.map((d) => (
                      <label key={d.address} class="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="addr" value={d.address}
                          checked={selectedAddress === d.address}
                          onChange={() => setSelectedAddress(d.address)} />
                        <span class="font-mono text-xs text-fg">
                          {d.address.match(/.{2}/g)!.join(':')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {scannedDevices.length === 0 && pin && !scanning && (
                <p class="text-xs text-faint">Scan ausführen um Geräte auf diesem Bus zu finden.</p>
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
                  placeholder="z.B. 5" class={inp} required />
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
                <label for="rref-input" class={lbl}>Rref (Ω)</label>
                <input id="rref-input" type="number" step="any" value={rref}
                  onInput={(e) => { setRref((e.target as HTMLInputElement).value); setRrefTouched(true); }}
                  class={inp} required />
              </div>
              <div>
                <button type="button" onClick={() => setShowCustomSpi(!showCustomSpi)}
                  class="text-xs text-muted hover:text-fg">
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

          {/* YF-S201 fields */}
          {role === 'sensor' && sensorType === 'YF-S201' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>GPIO-Pin</label>
                <input type="number" placeholder="z.B. 4" value={pin}
                  onInput={(e) => setPin((e.target as HTMLInputElement).value)} class={inp} />
              </div>
              <p class="text-xs text-faint">
                Liefert zwei Kanäle: <strong>flow.rate</strong> (L/min) und <strong>flow.volume</strong> (L).
              </p>
            </div>
          )}

          {/* HX711 fields */}
          {role === 'sensor' && sensorType === 'HX711' && (
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>DOUT Pin (GPIO)</label>
                  <input type="number" value={hx711Dout}
                    onInput={(e) => setHx711Dout((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 4" class={inp} required />
                </div>
                <div>
                  <label class={lbl}>SCK Pin (GPIO)</label>
                  <input type="number" value={hx711Sck}
                    onInput={(e) => setHx711Sck((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 5" class={inp} required />
                </div>
              </div>
              <div>
                <label class={lbl}>Scale (g / count, optional)</label>
                <input type="number" step="any" value={hx711Scale}
                  onInput={(e) => setHx711Scale((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 0.00427" class={inp} />
              </div>
            </div>
          )}

          {/* DigitalInput fields */}
          {role === 'sensor' && sensorType === 'DigitalInput' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={diPin}
                  onInput={(e) => setDiPin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 15" class={inp} required />
              </div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={diInvert} class="accent-accent"
                    onChange={(e) => setDiInvert((e.target as HTMLInputElement).checked)} />
                  Invertieren
                </label>
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={diPullup} class="accent-accent"
                    onChange={(e) => setDiPullup((e.target as HTMLInputElement).checked)} />
                  Pullup aktivieren
                </label>
              </div>
              <div>
                <label class={lbl}>Entprellung (ms)</label>
                <input type="number" value={diDebounce} min="0"
                  onInput={(e) => setDiDebounce((e.target as HTMLInputElement).value)}
                  placeholder="0 = aus" class={inp} />
              </div>
            </div>
          )}

          {/* HCSR04 fields */}
          {role === 'sensor' && sensorType === 'HCSR04' && (
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>TRIG Pin (GPIO)</label>
                  <input type="number" value={trigPin}
                    onInput={(e) => setTrigPin((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 5" class={inp} required />
                </div>
                <div>
                  <label class={lbl}>ECHO Pin (GPIO)</label>
                  <input type="number" value={echoPin}
                    onInput={(e) => setEchoPin((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 18" class={inp} required />
                </div>
              </div>
              <div>
                <button type="button" onClick={() => setShowScale(!showScale)}
                  class="text-xs text-muted hover:text-fg">
                  {showScale ? '▼' : '▶'} Ableitung (optional)
                </button>
                {showScale && (
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <div>
                      <label class={lbl}>Faktor</label>
                      <input type="number" step="any" value={scaleFactor}
                        onInput={(e) => setScaleFactor((e.target as HTMLInputElement).value)}
                        placeholder="1.0" class={inp} />
                    </div>
                    <div>
                      <label class={lbl}>Offset</label>
                      <input type="number" step="any" value={scaleOffset}
                        onInput={(e) => setScaleOffset((e.target as HTMLInputElement).value)}
                        placeholder="0.0" class={inp} />
                    </div>
                    <div>
                      <label class={lbl}>Einheit</label>
                      <input type="text" value={scaleUnit}
                        onInput={(e) => setScaleUnit((e.target as HTMLInputElement).value)}
                        placeholder="cm" class={inp} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BME280 fields */}
          {role === 'sensor' && sensorType === 'BME280' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>I²C Address</label>
                <div class="flex gap-2">
                  {[0x76, 0x77].map((a) => (
                    <button key={a} type="button" onClick={() => setI2cAddr(a)}
                      class={segBtn(i2cAddr === a)}>0x{a.toString(16)}</button>
                  ))}
                </div>
              </div>
              <p class="text-xs text-faint">
                3 Kanäle: <strong>id.temp</strong> (°C), <strong>id.hum</strong> (%RH), <strong>id.pres</strong> (hPa).
              </p>
            </div>
          )}

          {/* DigitalOutput fields */}
          {role === 'actuator' && actuatorType === 'DigitalOutput' && (
            <>
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={pin}
                  onInput={(e) => setPin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 16" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Mode</label>
                <select value={mode} title="Mode"
                  onChange={(e) => setMode((e.target as HTMLSelectElement).value as typeof mode)}
                  class={inp}>
                  <option value="Binary">Binary (on/off)</option>
                  <option value="TimeProportional">Time-Proportional (TPO/SSR)</option>
                </select>
              </div>
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" checked={invertOut} class="accent-accent"
                  onChange={(e) => setInvertOut((e.target as HTMLInputElement).checked)} />
                Invertieren (active-low)
              </label>
            </>
          )}

          {/* AnalogOutput fields */}
          {role === 'actuator' && actuatorType === 'AnalogOutput' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={analogPin}
                  onInput={(e) => setAnalogPin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 25" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Mode</label>
                <div class="flex gap-2">
                  {(['pwm', 'dac'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setAnalogMode(m)}
                      class={segBtn(analogMode === m)}>{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <button type="button" onClick={() => setAnalogShowRange(!analogShowRange)}
                  class="text-xs text-muted hover:text-fg">
                  {analogShowRange ? '▼' : '▶'} Custom Value Range (optional)
                </button>
                {analogShowRange && (
                  <div class="mt-2 grid grid-cols-3 gap-2">
                    <div><label class={lbl}>Min</label>
                      <input type="number" step="any" value={analogMin}
                        onInput={(e) => setAnalogMin((e.target as HTMLInputElement).value)}
                        placeholder="0" class={inp} /></div>
                    <div><label class={lbl}>Max</label>
                      <input type="number" step="any" value={analogMax}
                        onInput={(e) => setAnalogMax((e.target as HTMLInputElement).value)}
                        placeholder="1" class={inp} /></div>
                    <div><label class={lbl}>Unit</label>
                      <input type="text" value={analogUnit}
                        onInput={(e) => setAnalogUnit((e.target as HTMLInputElement).value)}
                        placeholder="z.B. V" class={inp} /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* IDS fields */}
          {role === 'actuator' && (actuatorType === 'IDS1' || actuatorType === 'IDS2') && (
            <div class="grid grid-cols-3 gap-2">
              {([
                ['White (Relais)', pinWhite, setPinWhite],
                ['Yellow (Cmd)',   pinYellow, setPinYellow],
                ['Interrupt',      pinInterrupt, setPinInterrupt],
              ] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label class={lbl}>{label}</label>
                  <input type="number" value={val}
                    onInput={(e) => (setter as (v: string) => void)((e.target as HTMLInputElement).value)}
                    placeholder="GPIO" class={inp} required />
                </div>
              ))}
            </div>
          )}

          {/* Controller: shared Sensor + Setpoint; actuator(s) depend on type */}
          {role === 'controller' && (
            <>
              {(ctrlType === 'PID' || ctrlType === 'TwoPoint') && (
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class={lbl}>Sensor</label>
                    <select value={sensorId} title="Sensor"
                      onChange={(e) => setSensorId((e.target as HTMLSelectElement).value)}
                      class={inp}>
                      {snap?.sensors.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                      {!snap?.sensors.length && <option value="">— keine Sensoren —</option>}
                    </select>
                  </div>
                  <div>
                    <label class={lbl}>Aktor</label>
                    <select value={actuatorId} title="Aktor"
                      onChange={(e) => setActuatorId((e.target as HTMLSelectElement).value)}
                      class={inp}>
                      {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                      {!snap?.actuators.length && <option value="">— keine Aktoren —</option>}
                    </select>
                  </div>
                </div>
              )}
              {(ctrlType === 'DualStage' || ctrlType === 'SplitRangePID') && (
                <>
                  <div>
                    <label class={lbl}>Sensor</label>
                    <select value={sensorId} title="Sensor"
                      onChange={(e) => setSensorId((e.target as HTMLSelectElement).value)}
                      class={inp}>
                      {snap?.sensors.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                      {!snap?.sensors.length && <option value="">— keine Sensoren —</option>}
                    </select>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class={lbl}>Heiz-Aktor</label>
                      <select value={heatActuatorId} title="Heiz-Aktor"
                        onChange={(e) => setHeatActuatorId((e.target as HTMLSelectElement).value)}
                        class={inp}>
                        <option value="">— keiner —</option>
                        {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <label class={lbl}>Kühl-Aktor</label>
                      <select value={coolActuatorId} title="Kühl-Aktor"
                        onChange={(e) => setCoolActuatorId((e.target as HTMLSelectElement).value)}
                        class={inp}>
                        <option value="">— keiner —</option>
                        {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* PID-specific fields */}
          {role === 'controller' && ctrlType === 'PID' && (
            <>
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

          {/* TwoPoint-specific fields */}
          {role === 'controller' && ctrlType === 'TwoPoint' && (
            <>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>Hysterese unten</label>
                  <input type="number" step="any" value={hystLow}
                    onInput={(e) => setHystLow((e.target as HTMLInputElement).value)}
                    placeholder="-0.5" class={inp} />
                </div>
                <div>
                  <label class={lbl}>Hysterese oben</label>
                  <input type="number" step="any" value={hystHigh}
                    onInput={(e) => setHystHigh((e.target as HTMLInputElement).value)}
                    placeholder="0.5" class={inp} />
                </div>
              </div>
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" checked={inverted} class="accent-accent"
                  onChange={(e) => setInverted((e.target as HTMLInputElement).checked)} />
                Invertiert (Kühlung statt Heizung)
              </label>
              <p class="text-xs text-faint">
                Heizbetrieb: Aktor AN wenn Ist &lt; Sollwert + Hysterese unten,
                AUS wenn Ist &gt; Sollwert + Hysterese oben.
              </p>
            </>
          )}

          {/* DualStage-specific fields */}
          {role === 'controller' && ctrlType === 'DualStage' && (
            <>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>Heiz-Differenzial</label>
                  <input type="number" step="any" value={heatDiff}
                    onInput={(e) => setHeatDiff((e.target as HTMLInputElement).value)}
                    placeholder="0.5" class={inp} />
                </div>
                <div>
                  <label class={lbl}>Kühl-Differenzial</label>
                  <input type="number" step="any" value={coolDiff}
                    onInput={(e) => setCoolDiff((e.target as HTMLInputElement).value)}
                    placeholder="0.5" class={inp} />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>Kühl-Mindestlaufzeit (s)</label>
                  <input type="number" step="any" min="0" value={coolMinOnS}
                    onInput={(e) => setCoolMinOnS((e.target as HTMLInputElement).value)}
                    placeholder="0" class={inp} />
                </div>
                <div>
                  <label class={lbl}>Kühl-Mindestpause (s)</label>
                  <input type="number" step="any" min="0" value={coolMinOffS}
                    onInput={(e) => setCoolMinOffS((e.target as HTMLInputElement).value)}
                    placeholder="0" class={inp} />
                </div>
              </div>
              <div>
                <label class={lbl}>Umschalt-Totzeit (s, optional)</label>
                <input type="number" step="any" min="0" value={changeoverS}
                  onInput={(e) => setChangeoverS((e.target as HTMLInputElement).value)}
                  placeholder="0" class={inp} />
              </div>
              <p class="text-xs text-faint">
                Heizen AN unter Sollwert − Heiz-Differenzial, Kühlen AN über
                Sollwert + Kühl-Differenzial; dazwischen beides AUS. Mindestlauf-
                und Mindestpausenzeit schützen einen Kompressor vor Takten.
              </p>
            </>
          )}

          {/* SplitRangePID-specific fields */}
          {role === 'controller' && ctrlType === 'SplitRangePID' && (
            <>
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
                  <label class={lbl}>Totband (Ausgang)</label>
                  <input type="number" step="any" min="0" value={srDeadband}
                    onInput={(e) => setSrDeadband((e.target as HTMLInputElement).value)}
                    placeholder="0.05" class={inp} />
                </div>
                <div>
                  <label class={lbl}>Umschalt-Totzeit (s, optional)</label>
                  <input type="number" step="any" min="0" value={changeoverS}
                    onInput={(e) => setChangeoverS((e.target as HTMLInputElement).value)}
                    placeholder="0" class={inp} />
                </div>
              </div>
              <p class="text-xs text-faint">
                Bipolarer PID: Ausgang positiv heizt, negativ kühlt. Im Totband
                um null bleibt beides AUS. Beide Aktoren müssen modulierbar sein
                (PWM/SSR) — kein Kompressor.
              </p>
            </>
          )}

          {/* AutoTune (PID/SplitRangePID, nur beim Bearbeiten) */}
          {role === 'controller' && isEdit && (ctrlType === 'PID' || ctrlType === 'SplitRangePID') && (
            <div class="border-t border-border/50 pt-3">
              <label class={lbl}>AutoTune</label>
              {autotuneState === 'running' ? (
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-caution">AutoTune läuft…</span>
                  <button type="button" onClick={onStopAutotune} disabled={atBusy}
                    class="rounded bg-fg/5 px-2 py-1 text-xs text-fg hover:bg-fg/10 disabled:opacity-50">
                    Abbrechen
                  </button>
                </div>
              ) : (
                <div class="space-y-2">
                  {autotuneState === 'done' && (
                    <p class="text-xs text-success font-mono">
                      Kp {Number(liveController?.params?.Kp).toFixed(2)} · Ki {Number(liveController?.params?.Ki).toFixed(2)} · Kd {Number(liveController?.params?.Kd).toFixed(2)}
                    </p>
                  )}
                  <div class="flex gap-2">
                    <select value={atMethod} title="AutoTune-Methode"
                      onChange={(e) => setAtMethod((e.target as HTMLSelectElement).value)}
                      class={`flex-1 ${inp}`}>
                      {AUTOTUNE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button type="button" onClick={onStartAutotune} disabled={atBusy}
                      class="rounded bg-accent px-2 py-1 text-xs text-accent-fg hover:bg-accent/90 disabled:opacity-50">
                      Starten
                    </button>
                  </div>
                </div>
              )}
              {atErr && <p class="mt-1 text-xs text-critical">{atErr}</p>}
            </div>
          )}

          {err && <p class="text-xs text-critical">{err}</p>}
          </div>

          <div class={dialogFooter}>
            <div class={`w-full ${dialogBtnRow}`}>
              <button type="button" onClick={onClose} disabled={pending} class={btnSecondary}>
                Abbrechen
              </button>
              <button type="submit" disabled={pending || autotuneState === 'running'}
                title={autotuneState === 'running' ? 'AutoTune läuft — erst abbrechen' : undefined}
                class={btnPrimary}>
                {pending ? (isEdit ? 'Speichern…' : 'Erstellen…') : (isEdit ? 'Speichern' : 'Erstellen')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
