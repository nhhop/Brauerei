import { useState, useEffect } from 'preact/hooks';
import { Check } from 'lucide-preact';
import type { Snapshot, ScannedDevice, ItemConfig, PinsInfo } from '../types';
import {
  createSensor, createActuator, createController,
  replaceSensor, replaceActuator, replaceController,
  setSensorLabel, setActuatorLabel, setControllerLabel,
  scanOneWireBus, startAutotune, stopAutotune, getPins,
} from '../api';
import { riskyPins } from '../pins';
import { PinHint } from './PinHint';
import { btnPrimary, btnSecondary, dialogFrame, dialogScrim, dialogSheet, dialogFooter, dialogBtnRow, inp as inpBase } from '../ui';
import { pickIntervalUnit, intervalUnitMultiplier, type IntervalUnit } from '../intervalUnit';
import {
  ITEM_TYPES, ROLE_LABEL, ROLE_META, CATEGORY_ICON,
  type ItemPrefill, type ItemTypeEntry,
} from '../itemTypes';
import { AutotuneProgress } from './AutotuneProgress';
import { AddItemWizard, ChoiceCard, type WizardStep } from './AddItemWizard';

const AUTOTUNE_METHODS = [
  'ZieglerNichols', 'CohenCoon', 'IMC', 'TyreusLuyben', 'LambdaTuning',
] as const;

type Role = 'sensor' | 'actuator' | 'controller';
type SensorType = 'DS18B20' | 'MAX31865' | 'YF-S201' | 'BME280' | 'GY521' | 'HCSR04' | 'HX711' | 'DigitalInput' | 'AnalogInput' | 'MqttGeneric' | 'Remote';
type ControllerType = 'PID' | 'TwoPoint' | 'DualStage' | 'SplitRangePID';
type Wires = 2 | 3 | 4;
type RtdType = 'PT100' | 'PT1000';
type ActuatorType = 'DigitalOutput' | 'AnalogOutput' | 'PulseOutput' | 'IDS1' | 'IDS2' | 'MqttGeneric' | 'Remote';
type MqttKind = 'Binary' | 'Continuous';
type RemoteTransport = 'mqtt' | 'webhook' | 'websocket' | 'espnow';
type Step = 1 | 2 | 3 | 4;

const DEFAULT_RREF: Record<RtdType, string> = { PT100: '430', PT1000: '4300' };

// Deep-equal via a key-sorted JSON dump, so object key order (cfg is built
// fresh via object literals; editConfig comes back in whatever order the
// firmware wrote it) never causes a false "changed".
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// Whether cfg (freshly built, id already confirmed unchanged) differs from
// the persisted editConfig in anything other than "label" — if not, the
// caller can update just the label instead of replacing the item.
function onlyLabelDiffers(cfg: Record<string, unknown>, editConfig: Record<string, unknown>): boolean {
  const a = { ...cfg }; delete a.label;
  const b = { ...editConfig }; delete b.label;
  return stableStringify(a) === stableStringify(b);
}

const STEP_TEXT: Record<Step, { label: string; title: string; sub: string }> = {
  1: { label: 'Art des Geräts', title: 'Was möchtest du hinzufügen?',
       sub: 'Sensoren messen, Aktoren schalten, Regler verbinden beides.' },
  2: { label: 'Kategorie', title: 'Welche Kategorie?',
       sub: 'Grenzt die Liste der Gerätetypen im nächsten Schritt ein.' },
  3: { label: 'Gerätetyp', title: 'Welcher Gerätetyp?',
       sub: 'Bestimmt, welche Anschlüsse und Parameter du gleich einstellst.' },
  4: { label: 'Konfiguration', title: 'Gerät einrichten',
       sub: 'Name und Anschluss festlegen — danach ist das Gerät sofort aktiv.' },
};

export function AddItemModal({ open, snap, onClose, editConfig, editRole, initialRole, prefill, onCreated, onRenamed }: {
  open: boolean;
  snap: Snapshot | null;
  onClose: () => void;
  editConfig?: ItemConfig;
  editRole?: Role;
  // Role the type picker starts on (the caller knows which kind of item the
  // user set out to create). Only the starting point -- the picker's own
  // segmented control still switches roles freely.
  initialRole?: Role;
  // A device picked in DiscoverDevicesModal. Only read while the dialog opens
  // (the hydration effect keys on `open` alone), so the caller must set it in
  // the same handler that opens the dialog and clear it in onClose.
  prefill?: ItemPrefill;
  // dashboardIds: what to add to a dashboard (channel ids for multi-channel sensors).
  onCreated?: (role: Role, id: string, dashboardIds: string[]) => void;
  onRenamed?: (role: Role, oldId: string, newId: string) => void;
}) {
  const isEdit = !!(editConfig && editRole);

  // Wizard state — only used for "create from scratch"; edit and prefill render
  // the compact single pane instead. Steps: 1 Art, 2 Kategorie, 3 Typ, 4 Konfig.
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<Step>(1);
  const [category, setCategory] = useState('');
  // sensorType & co. always hold a default, so "has the user picked a type yet?"
  // cannot be read off them.
  const [typeChosen, setTypeChosen] = useState(false);
  const [created, setCreated] = useState<{ role: Role; id: string } | null>(null);
  const [role, setRole] = useState<Role>('sensor');

  // shared
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // sensor sub-type
  const [sensorType, setSensorType] = useState<SensorType>('DS18B20');

  // DS18B20
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');

  // BME280
  const [i2cAddr, setI2cAddr] = useState<number>(0x76);

  // GY521
  const [gy521Addr, setGy521Addr] = useState<number>(0x68);

  // HCSR04
  const [trigPin, setTrigPin] = useState('');
  const [echoPin, setEchoPin] = useState('');
  // Channel selection: showScale = "derived" channel enabled (needs factor).
  const [chDistance, setChDistance] = useState(true);
  const [showScale, setShowScale] = useState(false);
  // YF-S201 channel selection
  const [chRate, setChRate] = useState(true);
  const [chVolume, setChVolume] = useState(true);
  const [scaleFactor, setScaleFactor] = useState('');
  const [scaleOffset, setScaleOffset] = useState('');
  const [scaleUnit, setScaleUnit] = useState('');

  // HX711
  const [hx711Dout, setHx711Dout] = useState('');
  const [hx711Sck,  setHx711Sck]  = useState('');

  // DigitalInput
  const [diPin, setDiPin] = useState('');
  const [diInvert, setDiInvert] = useState(false);
  const [diPullup, setDiPullup] = useState(false);
  const [diDebounce, setDiDebounce] = useState('0');

  // AnalogInput — display range (aiMin/aiMax). Calibration lives in CalibrateModal.
  const [aiPin, setAiPin] = useState('');
  const [aiMin, setAiMin] = useState('0');
  const [aiMax, setAiMax] = useState('14');
  const [aiUnit, setAiUnit] = useState('');
  const [aiSmoothing, setAiSmoothing] = useState('1');

  // MqttGeneric (sensor) — shares mqttTopic/mqttUnit/mqttMin/mqttMax/mqttResolution
  // with the actuator's Continuous fields below (same meaning); only the
  // JSON-field extractor is sensor-specific.
  const [mqttJsonField, setMqttJsonField] = useState('');

  // Remote (SensActCtrl-Knoten) — shared by sensor + actuator role.
  const [remoteDevice, setRemoteDevice] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [remotePrefix, setRemotePrefix] = useState('');
  const [remoteChannelKey, setRemoteChannelKey] = useState('');
  const [remoteTransport, setRemoteTransport] = useState<RemoteTransport>('mqtt');
  const [remoteListenPort, setRemoteListenPort] = useState('8080');
  const [remotePeerUrl, setRemotePeerUrl] = useState('');

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
  // PulseOutput
  const [pulsePin, setPulsePin] = useState('');
  const [pulseWidthMs, setPulseWidthMs] = useState('50');
  const [pulseGapMs, setPulseGapMs] = useState('50');
  const [pulseInvert, setPulseInvert] = useState(false);
  // MqttGeneric
  const [mqttTopic, setMqttTopic] = useState('');
  const [mqttRetained, setMqttRetained] = useState(false);
  const [mqttKind, setMqttKind] = useState<MqttKind>('Binary');
  const [mqttOnPayload, setMqttOnPayload] = useState('ON');
  const [mqttOffPayload, setMqttOffPayload] = useState('OFF');
  const [mqttTemplate, setMqttTemplate] = useState('{value}');
  const [mqttMin, setMqttMin] = useState('0');
  const [mqttMax, setMqttMax] = useState('100');
  const [mqttResolution, setMqttResolution] = useState('1');
  const [mqttUnit, setMqttUnit] = useState('');
  // Interval / duty-cycle scheduling (DigitalOutput + AnalogOutput, decorator-
  // based) — empty period = disabled (no wrap). Wire format is always seconds.
  const [intervalShow, setIntervalShow] = useState(false);
  const [intervalPeriod, setIntervalPeriod] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('min');
  const [intervalOn, setIntervalOn] = useState('0');

  // controller
  const [ctrlType, setCtrlType] = useState<ControllerType>('PID');
  const [sensorId, setSensorId] = useState('');
  const [actuatorId, setActuatorId] = useState('');
  const [setpoint, setSetpoint] = useState('65');
  // Rate limiter (any controller type, decorator-based) — empty = unbegrenzt.
  // Displayed in °/min, stored as max_rate_per_sec (÷60) — see submit below.
  const [maxRatePerMin, setMaxRatePerMin] = useState('');
  // Regelbereich (any controller type) — scale for the setpoint slider in the
  // dashboard. Empty = fall back to the linked sensor's measurement range.
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
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

  // Board pin table + occupancy (GET /api/pins). null until loaded, or for a
  // firmware without the route — the form then works without pin hints.
  const [pins, setPins] = useState<PinsInfo | null>(null);
  // Risky pins of the last submit attempt, and the set the user confirmed.
  const [riskyWarn, setRiskyWarn] = useState<string[]>([]);
  const [riskyAck, setRiskyAck] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setRiskyWarn([]); setRiskyAck('');
    getPins().then(setPins).catch(() => setPins(null));
    setAtErr(null); setAtBusy(false); setAtMethod('ZieglerNichols');
    setScanning(false); setScanned(false); setScannedDevices([]); setSelectedAddress('');

    if (isEdit && editConfig && editRole) {
      setRole(editRole);
      setId(String(editConfig.id ?? ''));
      setLabel(String(editConfig.label ?? ''));

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
          const chs = editConfig.channels as string[] | undefined;
          setChRate(!chs || chs.includes('rate'));
          setChVolume(!chs || chs.includes('volume'));
        } else if (t === 'BME280') {
          setI2cAddr((editConfig.address ?? 0x76) as number);
        } else if (t === 'GY521') {
          setGy521Addr((editConfig.address ?? 0x68) as number);
        } else if (t === 'HX711') {
          setHx711Dout(String(editConfig.dout ?? ''));
          setHx711Sck(String(editConfig.sck ?? ''));
        } else if (t === 'HCSR04') {
          setTrigPin(String(editConfig.trig ?? ''));
          setEchoPin(String(editConfig.echo ?? ''));
          const chs = editConfig.channels as string[] | undefined;
          setChDistance(!chs || chs.includes('distance'));
          const hasDeriv = editConfig.factor != null;
          setShowScale(chs ? chs.includes('derived') : hasDeriv);
          setScaleFactor(hasDeriv ? String(editConfig.factor) : '');
          setScaleOffset(hasDeriv ? String(editConfig.offset ?? '0') : '');
          setScaleUnit(hasDeriv ? String(editConfig.unit ?? '') : '');
        } else if (t === 'DigitalInput') {
          setDiPin(String(editConfig.pin ?? ''));
          setDiInvert(Boolean(editConfig.invert ?? false));
          setDiPullup(Boolean(editConfig.pullup ?? false));
          setDiDebounce(String(editConfig.debounce_ms ?? '0'));
        } else if (t === 'AnalogInput') {
          setAiPin(String(editConfig.pin ?? ''));
          setAiMin(String(editConfig.value_min ?? '0'));
          setAiMax(String(editConfig.value_max ?? '14'));
          setAiUnit(String(editConfig.unit ?? ''));
          setAiSmoothing(String(editConfig.smoothing ?? '1'));
        } else if (t === 'MqttGeneric') {
          setMqttTopic(String(editConfig.topic ?? ''));
          setMqttJsonField(String(editConfig.json_field ?? ''));
          setMqttUnit(String(editConfig.unit ?? ''));
          setMqttMin(String(editConfig.value_min ?? '0'));
          setMqttMax(String(editConfig.value_max ?? '100'));
          setMqttResolution(String(editConfig.resolution ?? '0.1'));
        } else if (t === 'Remote') {
          setRemoteDevice(String(editConfig.device ?? ''));
          setRemoteId(String(editConfig.remote_id ?? ''));
          setRemotePrefix(String(editConfig.prefix ?? ''));
          setRemoteChannelKey(String(editConfig.channel_key ?? ''));
          setRemoteTransport((editConfig.transport ?? 'mqtt') as RemoteTransport);
          setRemoteListenPort(String(editConfig.listen_port ?? '8080'));
          setRemotePeerUrl(String(editConfig.peer_url ?? ''));
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
        } else if (t === 'PulseOutput') {
          setPulsePin(String(editConfig.pin ?? ''));
          setPulseWidthMs(String(editConfig.pulse_width_ms ?? '50'));
          setPulseGapMs(String(editConfig.gap_ms ?? '50'));
          setPulseInvert(Boolean(editConfig.invert ?? false));
        } else if (t === 'IDS1' || t === 'IDS2') {
          setPinWhite(String(editConfig.pin_white ?? '14'));
          setPinYellow(String(editConfig.pin_yellow ?? '12'));
          setPinInterrupt(String(editConfig.pin_interrupt ?? '13'));
        } else if (t === 'MqttGeneric') {
          setMqttTopic(String(editConfig.topic ?? ''));
          setMqttRetained(Boolean(editConfig.retained ?? false));
          const k = (editConfig.kind ?? 'Binary') as MqttKind;
          setMqttKind(k);
          setMqttOnPayload(String(editConfig.on_payload ?? 'ON'));
          setMqttOffPayload(String(editConfig.off_payload ?? 'OFF'));
          setMqttTemplate(String(editConfig.payload_template ?? '{value}'));
          setMqttMin(String(editConfig.value_min ?? '0'));
          setMqttMax(String(editConfig.value_max ?? '100'));
          setMqttResolution(String(editConfig.resolution ?? '1'));
          setMqttUnit(String(editConfig.unit ?? ''));
        } else if (t === 'Remote') {
          setRemoteDevice(String(editConfig.device ?? ''));
          setRemoteId(String(editConfig.remote_id ?? ''));
          setRemotePrefix(String(editConfig.prefix ?? ''));
          setRemoteTransport((editConfig.transport ?? 'mqtt') as RemoteTransport);
          setRemoteListenPort(String(editConfig.listen_port ?? '8080'));
          setRemotePeerUrl(String(editConfig.peer_url ?? ''));
        }
        if (t === 'DigitalOutput' || t === 'AnalogOutput' || t === 'MqttGeneric') {
          const periodSec = Number(editConfig.interval_period_sec ?? 0);
          const hasInterval = periodSec > 0;
          setIntervalShow(hasInterval);
          if (hasInterval) {
            const unit = pickIntervalUnit(periodSec);
            const mult = intervalUnitMultiplier(unit);
            setIntervalUnit(unit);
            setIntervalPeriod(String(periodSec / mult));
            setIntervalOn(String(Number(editConfig.interval_on_sec ?? 0) / mult));
          } else {
            setIntervalUnit('min'); setIntervalPeriod(''); setIntervalOn('0');
          }
        }
      } else if (editRole === 'controller') {
        const t = String(editConfig.type ?? 'PID') as ControllerType;
        setCtrlType(t);
        setSensorId(String(editConfig.sensor ?? ''));
        setActuatorId(String(editConfig.actuator ?? ''));
        setSetpoint(String(editConfig.setpoint ?? '0'));
        if (editConfig.max_rate_per_sec != null) {
          const perMin = Number(editConfig.max_rate_per_sec) * 60;
          setMaxRatePerMin(String(Math.round(perMin * 10000) / 10000));
        } else {
          setMaxRatePerMin('');
        }
        const rMin = editConfig.range_min, rMax = editConfig.range_max;
        if (rMin != null && rMax != null && Number(rMax) > Number(rMin)) {
          setRangeMin(String(rMin));
          setRangeMax(String(rMax));
        } else {
          setRangeMin(''); setRangeMax('');
        }
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
      setRole(initialRole ?? 'sensor'); setId(''); setLabel(''); setPin('');
      setSensorType('DS18B20');
      setI2cAddr(0x76);
      setCsPin(''); setWiresCount(2); setRtdType('PT100');
      setRref(DEFAULT_RREF.PT100); setRrefTouched(false);
      setShowCustomSpi(false); setClkPin(''); setMisoPin(''); setMosiPin('');
      setTrigPin(''); setEchoPin('');
      setChDistance(true); setChRate(true); setChVolume(true);
      setShowScale(false); setScaleFactor(''); setScaleOffset(''); setScaleUnit('');
      setHx711Dout(''); setHx711Sck('');
      setDiPin(''); setDiInvert(false); setDiPullup(false); setDiDebounce('0');
      setAiPin(''); setAiMin('0'); setAiMax('14'); setAiUnit(''); setAiSmoothing('1');
      setMqttJsonField('');
      setRemoteDevice(''); setRemoteId(''); setRemotePrefix(''); setRemoteChannelKey('');
      setRemoteTransport('mqtt'); setRemoteListenPort('8080'); setRemotePeerUrl('');
      setActuatorType('DigitalOutput');
      setMode('TimeProportional');
      setInvertOut(false);
      setPinWhite('14'); setPinYellow('12'); setPinInterrupt('13');
      setAnalogPin(''); setAnalogMode('pwm'); setAnalogShowRange(false);
      setAnalogMin('0'); setAnalogMax('1'); setAnalogUnit('');
      setPulsePin(''); setPulseWidthMs('50'); setPulseGapMs('50'); setPulseInvert(false);
      setMqttTopic(''); setMqttRetained(false); setMqttKind('Binary');
      setMqttOnPayload('ON'); setMqttOffPayload('OFF'); setMqttTemplate('{value}');
      setMqttMin('0'); setMqttMax('100'); setMqttResolution('1'); setMqttUnit('');
      setIntervalShow(false); setIntervalPeriod(''); setIntervalUnit('min'); setIntervalOn('0');
      setCtrlType('PID');
      setSensorId(snap?.sensors[0]?.id ?? '');
      setActuatorId(snap?.actuators[0]?.id ?? '');
      setSetpoint('65');
      setMaxRatePerMin('');
      setRangeMin(''); setRangeMax('');
      setKp('8'); setKi('0.2'); setKd('0.5'); setMinOut('0'); setMaxOut('1');
      setHystLow('-0.5'); setHystHigh('0.5'); setInverted(false);
      setHeatActuatorId(snap?.actuators[0]?.id ?? '');
      setCoolActuatorId(snap?.actuators[1]?.id ?? '');
      setHeatDiff('0.5'); setCoolDiff('0.5');
      setCoolMinOnS('0'); setCoolMinOffS('0');
      setSrDeadband('0.05'); setChangeoverS('0');

      if (prefill) {
        setRole(prefill.role);
        setId(prefill.id);
        if (prefill.type === 'DS18B20') {
          setSensorType('DS18B20');
          setPin(String(prefill.pin));
          setSelectedAddress(prefill.address);
          // Seed the bus list too — it only renders after a scan, and without
          // it the picked address would be invisible.
          setScannedDevices([{ address: prefill.address, index: 0 }]);
          setScanned(true);
        } else {
          if (prefill.role === 'sensor') setSensorType('Remote'); else setActuatorType('Remote');
          setRemoteDevice(prefill.device); setRemoteId(prefill.remoteId);
          setRemotePrefix(prefill.prefix); setRemoteChannelKey(prefill.channelKey);
          setRemoteTransport(prefill.transport);
        }
      }
    }
    setStep(1); setMaxStep(1); setCategory(''); setTypeChosen(false); setCreated(null);
  }, [open]);

  if (!open) return null;

  const currentType = role === 'sensor' ? sensorType : role === 'actuator' ? actuatorType : ctrlType;
  const typeLabel = ITEM_TYPES.find((t) => t.role === role && t.type === currentType)?.label ?? currentType;

  // Editing and a discovery prefill both know the type already — they get the
  // compact pane, the wizard is the "create from scratch" path only.
  const wizard = !isEdit && !prefill;

  // Categories of the current role, in ITEM_TYPES order.
  const categories = ITEM_TYPES.reduce<{ group: string; count: number }[]>((acc, t) => {
    if (t.role !== role) return acc;
    const hit = acc.find((c) => c.group === t.group);
    if (hit) hit.count++; else acc.push({ group: t.group, count: 1 });
    return acc;
  }, []);
  const typesInCategory = ITEM_TYPES.filter((t) => t.role === role && t.group === category);

  function applyType(e: ItemTypeEntry) {
    if (e.role === 'sensor') setSensorType(e.type as SensorType);
    else if (e.role === 'actuator') setActuatorType(e.type as ActuatorType);
    else setCtrlType(e.type as ControllerType);
    setTypeChosen(true);
    setErr(null);
  }

  // Picking further up invalidates everything below it.
  function pickRole(r: Role) {
    if (r === role) return;
    setRole(r); setCategory(''); setTypeChosen(false); setMaxStep(1); setErr(null);
  }

  function pickCategory(g: string) {
    if (g === category) return;
    setCategory(g); setMaxStep(2);
    const list = ITEM_TYPES.filter((t) => t.role === role && t.group === g);
    // Most sensor categories hold exactly one type — preselect it so step 3 is
    // a "Weiter" instead of a click with no alternative.
    if (list.length === 1) applyType(list[0]); else setTypeChosen(false);
  }

  const canNext = step === 1 ? true
    : step === 2 ? category !== ''
    : step === 3 ? typeChosen
    : id.trim() !== '' && !pending;

  const closeWizard = () => { setCreated(null); onClose(); };

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

  // False (and shows the confirmation box) while cfg uses risky pins the user
  // has not confirmed yet. The firmware accepts them either way.
  function risksConfirmed(cfg: Record<string, unknown>): boolean {
    const risky = riskyPins(pins, cfg);
    setRiskyWarn(risky);
    return risky.length === 0 || riskyAck === risky.join('|');
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const trimId = id.trim();
    if (!trimId) { setErr('ID required'); return; }
    setPending(true); setErr(null);

    try {
      let cfg: Record<string, unknown>;
      // Dashboard entries a new sensor brings along: one per selected channel.
      let createdIds = [trimId];

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
          const channels = [chRate && 'rate', chVolume && 'volume'].filter(Boolean) as string[];
          if (!channels.length) throw new Error('Mindestens einen Kanal wählen');
          cfg = { type: 'YF-S201', id: trimId, pin: p, channels };
        } else if (sensorType === 'BME280') {
          cfg = { type: 'BME280', id: trimId, address: i2cAddr };
        } else if (sensorType === 'GY521') {
          cfg = { type: 'GY521', id: trimId, address: gy521Addr };
        } else if (sensorType === 'HX711') {
          const dout = parseInt(hx711Dout, 10);
          const sck  = parseInt(hx711Sck,  10);
          if (isNaN(dout) || dout < 0) throw new Error('DOUT Pin ungültig');
          if (isNaN(sck)  || sck  < 0) throw new Error('SCK Pin ungültig');
          cfg = { type: 'HX711', id: trimId, dout, sck };
        } else if (sensorType === 'DigitalInput') {
          const p = parseInt(diPin, 10);
          if (isNaN(p) || p < 0) throw new Error('Pin ungültig');
          cfg = {
            type: 'DigitalInput', id: trimId, pin: p,
            invert: diInvert, pullup: diPullup,
            debounce_ms: parseInt(diDebounce, 10) || 0,
          };
        } else if (sensorType === 'AnalogInput') {
          const p = parseInt(aiPin, 10);
          if (isNaN(p) || p < 0) throw new Error('Pin ungültig');
          const vmin = parseFloat(aiMin);
          const vmax = parseFloat(aiMax);
          if (isNaN(vmin) || isNaN(vmax) || vmin >= vmax) throw new Error('Ungültiger Wertebereich (Min muss < Max sein)');
          const sm = parseInt(aiSmoothing, 10);
          if (isNaN(sm) || sm < 1 || sm > 32) throw new Error('Glättung muss zwischen 1 und 32 liegen');
          cfg = { type: 'AnalogInput', id: trimId, pin: p, value_min: vmin, value_max: vmax, smoothing: sm };
          if (aiUnit.trim()) cfg.unit = aiUnit.trim();
        } else if (sensorType === 'MqttGeneric') {
          const topic = mqttTopic.trim();
          if (!topic) throw new Error('Topic erforderlich');
          const vmin = parseFloat(mqttMin);
          const vmax = parseFloat(mqttMax);
          if (isNaN(vmin) || isNaN(vmax) || vmin >= vmax) throw new Error('Ungültiger Wertebereich (Min muss < Max sein)');
          cfg = { type: 'MqttGeneric', id: trimId, topic, value_min: vmin, value_max: vmax };
          const res = parseFloat(mqttResolution);
          if (!isNaN(res) && res > 0) cfg.resolution = res;
          if (mqttUnit.trim()) cfg.unit = mqttUnit.trim();
          if (mqttJsonField.trim()) cfg.json_field = mqttJsonField.trim();
        } else if (sensorType === 'Remote') {
          const device = remoteDevice.trim();
          const rid = remoteId.trim();
          if (!device) throw new Error('Geräte-ID erforderlich');
          if (!rid) throw new Error('Remote-ID erforderlich');
          cfg = { type: 'Remote', id: trimId, device, remote_id: rid, transport: remoteTransport };
          if (remoteChannelKey.trim()) cfg.channel_key = remoteChannelKey.trim();
          if (remotePrefix.trim()) cfg.prefix = remotePrefix.trim();
          if (remoteTransport === 'webhook') {
            const port = parseInt(remoteListenPort, 10);
            if (isNaN(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port');
            const peerUrl = remotePeerUrl.trim();
            if (!peerUrl) throw new Error('Peer-URL erforderlich');
            cfg.listen_port = port;
            cfg.peer_url = peerUrl;
          }
        } else { // HCSR04
          const trig = parseInt(trigPin, 10);
          const echo = parseInt(echoPin, 10);
          if (isNaN(trig) || trig < 0) throw new Error('TRIG Pin ungültig');
          if (isNaN(echo) || echo < 0) throw new Error('ECHO Pin ungültig');
          const channels = [chDistance && 'distance', showScale && 'derived'].filter(Boolean) as string[];
          if (!channels.length) throw new Error('Mindestens einen Kanal wählen');
          if (showScale && scaleFactor === '') throw new Error('Faktor für den umgerechneten Kanal erforderlich');
          cfg = { type: 'HCSR04', id: trimId, trig, echo, channels };
          if (showScale) {
            const f = parseFloat(scaleFactor);
            if (isNaN(f)) throw new Error('Faktor ungültig');
            cfg.factor = f;
            if (scaleOffset !== '') { const o = parseFloat(scaleOffset); if (isNaN(o)) throw new Error('Offset ungültig'); cfg.offset = o; }
            if (scaleUnit !== '') cfg.unit = scaleUnit;
          }
        }
        // Editing re-creates the sensor: carry its calibration over, it isn't part of this form.
        if (isEdit && editConfig?.calibrations) cfg.calibrations = editConfig.calibrations;
        const trimmedLabel = label.trim();
        if (trimmedLabel) cfg.label = trimmedLabel;
        if (!risksConfirmed(cfg)) { setPending(false); return; }
        if (isEdit && trimId === String(editConfig!.id) &&
            onlyLabelDiffers(cfg, editConfig!)) {
          await setSensorLabel(trimId, trimmedLabel);
        } else if (isEdit) {
          await replaceSensor(String(editConfig!.id), cfg);
        } else {
          await createSensor(cfg);
        }
        if (Array.isArray(cfg.channels)) createdIds = (cfg.channels as string[]).map((c) => `${trimId}.${c}`);

      } else if (role === 'actuator') {
        if (actuatorType === 'IDS1' || actuatorType === 'IDS2') {
          const pw = parseInt(pinWhite, 10);
          const py = parseInt(pinYellow, 10);
          const pi = parseInt(pinInterrupt, 10);
          if (isNaN(pw) || isNaN(py) || isNaN(pi)) throw new Error('invalid pin');
          cfg = { type: actuatorType, id: trimId, pin_white: pw, pin_yellow: py, pin_interrupt: pi };
        } else if (actuatorType === 'PulseOutput') {
          const p = parseInt(pulsePin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          const width = parseInt(pulseWidthMs, 10);
          const gap = parseInt(pulseGapMs, 10);
          if (isNaN(width) || width <= 0) throw new Error('Pulsbreite ungültig');
          if (isNaN(gap) || gap <= 0) throw new Error('Pause ungültig');
          cfg = {
            type: 'PulseOutput', id: trimId, pin: p,
            pulse_width_ms: width, gap_ms: gap, invert: pulseInvert,
          };
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
        } else if (actuatorType === 'MqttGeneric') {
          const topic = mqttTopic.trim();
          if (!topic) throw new Error('Topic erforderlich');
          cfg = { type: 'MqttGeneric', id: trimId, topic, retained: mqttRetained, kind: mqttKind };
          if (mqttKind === 'Binary') {
            if (!mqttOnPayload.trim() || !mqttOffPayload.trim())
              throw new Error('An/Aus-Payload erforderlich');
            cfg.on_payload = mqttOnPayload;
            cfg.off_payload = mqttOffPayload;
          } else {
            if (!mqttTemplate.includes('{value}'))
              throw new Error('Payload-Template muss {value} enthalten');
            const vmin = parseFloat(mqttMin);
            const vmax = parseFloat(mqttMax);
            if (isNaN(vmin) || isNaN(vmax) || vmin >= vmax) throw new Error('Ungültiger Wertebereich (Min muss < Max sein)');
            cfg.payload_template = mqttTemplate;
            cfg.value_min = vmin; cfg.value_max = vmax;
            const res = parseFloat(mqttResolution);
            if (!isNaN(res) && res > 0) cfg.resolution = res;
            if (mqttUnit.trim()) cfg.unit = mqttUnit.trim();
          }
        } else if (actuatorType === 'Remote') {
          const device = remoteDevice.trim();
          const rid = remoteId.trim();
          if (!device) throw new Error('Geräte-ID erforderlich');
          if (!rid) throw new Error('Remote-ID erforderlich');
          cfg = { type: 'Remote', id: trimId, device, remote_id: rid, transport: remoteTransport };
          if (remotePrefix.trim()) cfg.prefix = remotePrefix.trim();
          if (remoteTransport === 'webhook') {
            const port = parseInt(remoteListenPort, 10);
            if (isNaN(port) || port < 1 || port > 65535) throw new Error('Ungültiger Port');
            const peerUrl = remotePeerUrl.trim();
            if (!peerUrl) throw new Error('Peer-URL erforderlich');
            cfg.listen_port = port;
            cfg.peer_url = peerUrl;
          }
        } else {
          const p = parseInt(pin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          cfg = { type: 'DigitalOutput', id: trimId, pin: p, mode, invert: invertOut };
        }
        if ((actuatorType === 'DigitalOutput' || actuatorType === 'AnalogOutput' || actuatorType === 'MqttGeneric') && intervalShow) {
          const period = parseFloat(intervalPeriod);
          const onAmt = parseFloat(intervalOn);
          if (isNaN(period) || period <= 0) throw new Error('Zykluslänge ungültig');
          if (isNaN(onAmt) || onAmt < 0 || onAmt > period) throw new Error('An-Anteil ungültig');
          const mult = intervalUnitMultiplier(intervalUnit);
          cfg.interval_period_sec = Math.round(period * mult);
          cfg.interval_on_sec = Math.round(onAmt * mult);
        }
        {
          const trimmedLabel = label.trim();
          if (trimmedLabel) cfg.label = trimmedLabel;
          if (!risksConfirmed(cfg)) { setPending(false); return; }
          if (isEdit && trimId === String(editConfig!.id) &&
              onlyLabelDiffers(cfg, editConfig!)) {
            await setActuatorLabel(trimId, trimmedLabel);
          } else if (isEdit) {
            await replaceActuator(String(editConfig!.id), cfg);
          } else {
            await createActuator(cfg);
          }
        }

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
        if (maxRatePerMin.trim()) {
          const perMin = parseFloat(maxRatePerMin);
          if (!isNaN(perMin) && perMin > 0) cfg.max_rate_per_sec = perMin / 60;
        }
        if (rangeMin.trim() && rangeMax.trim()) {
          const rMin = parseFloat(rangeMin), rMax = parseFloat(rangeMax);
          if (!isNaN(rMin) && !isNaN(rMax) && rMax > rMin) {
            cfg.range_min = rMin; cfg.range_max = rMax;
          }
        }
        const trimmedLabel = label.trim();
        if (trimmedLabel) cfg.label = trimmedLabel;
        if (isEdit && trimId === String(editConfig!.id) &&
            onlyLabelDiffers(cfg, editConfig!)) {
          await setControllerLabel(trimId, trimmedLabel);
        } else if (isEdit) {
          await replaceController(String(editConfig!.id), cfg);
        } else {
          await createController(cfg);
        }
      }

      if (wizard) {
        // Fire onCreated as soon as the item exists, so the parent stays
        // consistent even if the success screen is dismissed via the backdrop.
        onCreated?.(role, trimId, createdIds);
        setCreated({ role: role, id: trimId });
      } else {
        onClose();
        if (!isEdit) onCreated?.(role, trimId, createdIds);
        else if (trimId !== String(editConfig!.id)) onRenamed?.(role, String(editConfig!.id), trimId);
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes('referenced by a controller')) {
        setErr('Solange dieses Gerät mit einem Regler verbunden ist, lassen sich ID und Anschlüsse nicht ändern — den Regler zuerst umhängen oder löschen. Das Gerät bleibt unverändert; der Anzeigename lässt sich unabhängig davon jederzeit ändern.');
      } else {
        setErr(msg);
      }
    }
    setPending(false);
  }

  const inp = `${inpBase} w-full font-mono`;
  const lbl = 'block text-xs text-muted mb-1';
  // The edited item's own pins show as free in the hints.
  const selfId = isEdit ? String(editConfig!.id) : undefined;
  const segBtn = (active: boolean, disabled = false) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' :
      active ? 'bg-accent text-accent-fg' : 'bg-fg/5 text-muted hover:bg-fg/10'
    }`;

  // Shared by DigitalOutput + AnalogOutput + MqttGeneric — decorator-based, any actuator kind.
  function intervalFields() {
    const period = parseFloat(intervalPeriod);
    const maxOn = !isNaN(period) && period > 0 ? period : 0;
    return (
      <div>
        <button type="button" onClick={() => setIntervalShow(!intervalShow)}
          class="text-xs text-muted hover:text-fg">
          {intervalShow ? '▼' : '▶'} Intervallbetrieb (optional)
        </button>
        {intervalShow && (
          <div class="mt-2 space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class={lbl}>Zykluslänge</label>
                <input type="number" step="any" min="0" value={intervalPeriod}
                  onInput={(e) => setIntervalPeriod((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 60" class={inp} />
              </div>
              <div>
                <label class={lbl}>Einheit</label>
                <select value={intervalUnit} title="Einheit"
                  onChange={(e) => setIntervalUnit((e.target as HTMLSelectElement).value as IntervalUnit)}
                  class={inp}>
                  <option value="s">Sekunden</option>
                  <option value="min">Minuten</option>
                  <option value="h">Stunden</option>
                </select>
              </div>
            </div>
            {maxOn > 0 && (
              <div>
                <label class={lbl}>An-Anteil: {intervalOn} / {intervalPeriod} {intervalUnit}</label>
                <input type="range" min="0" max={maxOn} step="any" value={intervalOn}
                  onInput={(e) => setIntervalOn((e.target as HTMLInputElement).value)}
                  class="w-full accent-accent" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Every field block of the chosen type — identical in step 4 of the
  // wizard and in the compact edit pane. Expects a `space-y-4` container.
  function fieldBlocks() {
    return (<>
          {/* ID field (all roles) */}
          <div>
            <label class={lbl}>ID</label>
            <input type="text" value={id}
              onInput={(e) => setId((e.target as HTMLInputElement).value)}
              placeholder="z.B. maische_temp" class={inp} required />
          </div>

          {/* Anzeigename (all roles) — separate from id, editable even while
              the item is wired to a controller (see handleSubmit). */}
          <div>
            <label class={lbl}>Anzeigename (optional)</label>
            <input type="text" value={label}
              onInput={(e) => setLabel((e.target as HTMLInputElement).value)}
              placeholder={id || 'z.B. Maische-Temperatur'} class={inp} />
          </div>

          {/* DS18B20 fields */}
          {role === 'sensor' && sensorType === 'DS18B20' && (
            <>
              <div>
                <label class={lbl}>OneWire Pin (GPIO)</label>
                <div class="flex gap-2">
                  <input type="number" value={pin}
                    onInput={(e) => { setPin((e.target as HTMLInputElement).value); setScanned(false); setScannedDevices([]); setSelectedAddress(''); }}
                    placeholder="z.B. 4" class={`${inp} flex-1`} required />
                  <button type="button" disabled={scanning || !pin}
                    onClick={async () => {
                      setScanning(true); setScanned(false); setScannedDevices([]); setSelectedAddress(''); setErr(null);
                      try {
                        const r = await scanOneWireBus(parseInt(pin, 10));
                        setScannedDevices(r.devices);
                        setScanned(true);
                        if (r.devices.length === 1) setSelectedAddress(r.devices[0].address);
                      } catch (e) { setErr(String(e)); }
                      setScanning(false);
                    }}
                    class="rounded-md bg-fg/5 px-3 py-1.5 text-xs font-medium text-muted hover:bg-fg/10 disabled:opacity-50">
                    {scanning ? '…' : 'Scan'}
                  </button>
                </div>
                <PinHint pins={pins} value={pin} selfId={selfId} share="onewire" />
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
              {scannedDevices.length === 0 && pin && !scanning && !scanned && (
                <p class="text-xs text-faint">Scan ausführen um Geräte auf diesem Bus zu finden.</p>
              )}
              {scannedDevices.length === 0 && pin && !scanning && scanned && (
                <p class="text-xs text-caution">Kein Gerät auf diesem Bus gefunden — Verkabelung und Pull-up prüfen, dann erneut scannen.</p>
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
                <PinHint pins={pins} value={csPin} selfId={selfId} output />
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
                          <PinHint pins={pins} value={val} selfId={selfId} share="spi" output={label !== 'MISO'} />
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
                <PinHint pins={pins} value={pin} selfId={selfId} />
              </div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={chRate} class="accent-accent"
                    onChange={(e) => setChRate((e.target as HTMLInputElement).checked)} />
                  Durchfluss (L/min)
                </label>
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={chVolume} class="accent-accent"
                    onChange={(e) => setChVolume((e.target as HTMLInputElement).checked)} />
                  Volumen (L)
                </label>
              </div>
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
                  <PinHint pins={pins} value={hx711Dout} selfId={selfId} />
                </div>
                <div>
                  <label class={lbl}>SCK Pin (GPIO)</label>
                  <input type="number" value={hx711Sck}
                    onInput={(e) => setHx711Sck((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 5" class={inp} required />
                  <PinHint pins={pins} value={hx711Sck} selfId={selfId} output />
                </div>
              </div>
              <p class="text-xs text-faint">
                Tara und Umrechnung in Gramm stellst du nach dem Anlegen über „Kalibrieren“ ein.
              </p>
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
                <PinHint pins={pins} value={diPin} selfId={selfId} />
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

          {/* AnalogInput fields */}
          {role === 'sensor' && sensorType === 'AnalogInput' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>ADC Pin</label>
                <input type="number" value={aiPin}
                  onInput={(e) => setAiPin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 34" class={inp} required />
                <PinHint pins={pins} value={aiPin} selfId={selfId} />
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div><label class={lbl}>Min</label>
                  <input type="number" step="any" value={aiMin}
                    onInput={(e) => setAiMin((e.target as HTMLInputElement).value)}
                    class={inp} /></div>
                <div><label class={lbl}>Max</label>
                  <input type="number" step="any" value={aiMax}
                    onInput={(e) => setAiMax((e.target as HTMLInputElement).value)}
                    class={inp} /></div>
                <div><label class={lbl}>Einheit</label>
                  <input type="text" value={aiUnit}
                    onInput={(e) => setAiUnit((e.target as HTMLInputElement).value)}
                    placeholder="z.B. pH" class={inp} /></div>
              </div>
              <p class="text-xs text-faint">
                Min/Max = Wertebereich der Anzeige. Der volle ADC-Bereich (0–4095) wird
                darauf abgebildet; genauer wird es über „Kalibrieren“ nach dem Anlegen.
              </p>
              <div>
                <label class={lbl}>Glättung (Mittelwert über N Messungen, 1 = aus)</label>
                <input type="number" min="1" max="32" value={aiSmoothing}
                  onInput={(e) => setAiSmoothing((e.target as HTMLInputElement).value)}
                  class={inp} />
              </div>
            </div>
          )}

          {/* MqttGeneric (sensor) fields */}
          {role === 'sensor' && sensorType === 'MqttGeneric' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>MQTT Topic</label>
                <input type="text" value={mqttTopic}
                  onInput={(e) => setMqttTopic((e.target as HTMLInputElement).value)}
                  placeholder="z.B. zigbee2mqtt/aussensensor" class={inp} required />
              </div>
              <div>
                <label class={lbl}>JSON-Feld (optional)</label>
                <input type="text" value={mqttJsonField}
                  onInput={(e) => setMqttJsonField((e.target as HTMLInputElement).value)}
                  placeholder="leer = Payload ist die Zahl direkt" class={`${inp} font-mono`} />
                <p class="mt-1 text-xs text-faint">
                  Bei JSON-Payload (z.B. {'{"temperature":23.5}'}) hier den Feldnamen angeben.
                </p>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div><label class={lbl}>Min</label>
                  <input type="number" step="any" value={mqttMin}
                    onInput={(e) => setMqttMin((e.target as HTMLInputElement).value)}
                    class={inp} /></div>
                <div><label class={lbl}>Max</label>
                  <input type="number" step="any" value={mqttMax}
                    onInput={(e) => setMqttMax((e.target as HTMLInputElement).value)}
                    class={inp} /></div>
                <div><label class={lbl}>Schritt</label>
                  <input type="number" step="any" value={mqttResolution}
                    onInput={(e) => setMqttResolution((e.target as HTMLInputElement).value)}
                    class={inp} /></div>
              </div>
              <div>
                <label class={lbl}>Einheit (optional)</label>
                <input type="text" value={mqttUnit}
                  onInput={(e) => setMqttUnit((e.target as HTMLInputElement).value)}
                  placeholder="z.B. °C" class={inp} />
              </div>
            </div>
          )}

          {/* Remote (sensor) fields */}
          {role === 'sensor' && sensorType === 'Remote' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>Geräte-ID (Leaf-Knoten)</label>
                <input type="text" value={remoteDevice}
                  onInput={(e) => setRemoteDevice((e.target as HTMLInputElement).value)}
                  placeholder="z.B. node-a" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Remote-ID (Sensor auf dem Leaf)</label>
                <input type="text" value={remoteId}
                  onInput={(e) => setRemoteId((e.target as HTMLInputElement).value)}
                  placeholder="z.B. mash_temp" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Kanal-Key (optional, Multi-Channel-Sensoren)</label>
                <input type="text" value={remoteChannelKey}
                  onInput={(e) => setRemoteChannelKey((e.target as HTMLInputElement).value)}
                  placeholder="leer = flacher Sensor" class={inp} />
              </div>
              <div>
                <label class={lbl}>Topic-Prefix (optional)</label>
                <input type="text" value={remotePrefix}
                  onInput={(e) => setRemotePrefix((e.target as HTMLInputElement).value)}
                  placeholder="sensactctrl" class={inp} />
              </div>
              <div>
                <label class={lbl}>Transport</label>
                <div class="flex gap-2">
                  {(['mqtt', 'webhook', 'websocket', 'espnow'] as RemoteTransport[]).map((t) => (
                    <button key={t} type="button" onClick={() => setRemoteTransport(t)}
                      class={segBtn(remoteTransport === t)}>
                      {t === 'mqtt' ? 'MQTT' : t === 'webhook' ? 'Webhook' : t === 'websocket' ? 'WebSocket' : 'ESP-NOW'}
                    </button>
                  ))}
                </div>
              </div>
              {remoteTransport === 'webhook' && (
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class={lbl}>Lokaler Port</label>
                    <input type="number" value={remoteListenPort}
                      onInput={(e) => setRemoteListenPort((e.target as HTMLInputElement).value)}
                      placeholder="8080" class={inp} required />
                  </div>
                  <div>
                    <label class={lbl}>Peer-URL (Leaf-Knoten)</label>
                    <input type="text" value={remotePeerUrl}
                      onInput={(e) => setRemotePeerUrl((e.target as HTMLInputElement).value)}
                      placeholder="http://192.168.1.50:8080" class={inp} required />
                  </div>
                </div>
              )}
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
                  <PinHint pins={pins} value={trigPin} selfId={selfId} output />
                </div>
                <div>
                  <label class={lbl}>ECHO Pin (GPIO)</label>
                  <input type="number" value={echoPin}
                    onInput={(e) => setEchoPin((e.target as HTMLInputElement).value)}
                    placeholder="z.B. 18" class={inp} required />
                  <PinHint pins={pins} value={echoPin} selfId={selfId} />
                </div>
              </div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={chDistance} class="accent-accent"
                    onChange={(e) => setChDistance((e.target as HTMLInputElement).checked)} />
                  Distanz (cm)
                </label>
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={showScale} class="accent-accent"
                    onChange={(e) => setShowScale((e.target as HTMLInputElement).checked)} />
                  Umgerechneter Kanal (z. B. Füllstand)
                </label>
              </div>
              <div>
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
                    <p class="col-span-3 text-xs text-faint">
                      Zweiter Kanal mit eigener Einheit: Wert = Distanz × Faktor + Offset
                      (z. B. Füllstand in Litern). Kein Ersatz für die Kalibrierung —
                      jeder Kanal wird über „Kalibrieren“ einzeln abgeglichen.
                    </p>
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

          {/* GY521 fields */}
          {role === 'sensor' && sensorType === 'GY521' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>I²C Address</label>
                <div class="flex gap-2">
                  {[0x68, 0x69].map((a) => (
                    <button key={a} type="button" onClick={() => setGy521Addr(a)}
                      class={segBtn(gy521Addr === a)}>0x{a.toString(16)}</button>
                  ))}
                </div>
              </div>
              <p class="text-xs text-faint">
                1 Kanal: <strong>id</strong> — Neigungswinkel in °, per Kalibrierung
                (Modus „poly") auf Stammwürze/SG umrechenbar.
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
                <PinHint pins={pins} value={pin} selfId={selfId} output />
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
              {intervalFields()}
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
                <PinHint pins={pins} value={analogPin} selfId={selfId} output />
              </div>
              {/* DAC only where the board has one (the ESP32-S3 has none); an
                  existing DAC item keeps the option so its mode stays visible. */}
              {(!pins || pins.caps.dac || analogMode === 'dac') && (
                <div>
                  <label class={lbl}>Mode</label>
                  <div class="flex gap-2">
                    {(['pwm', 'dac'] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setAnalogMode(m)}
                        class={segBtn(analogMode === m)}>{m.toUpperCase()}</button>
                    ))}
                  </div>
                  {analogMode === 'dac' && pins && (
                    <p class="mt-1 text-xs text-faint">
                      {pins.caps.dac
                        ? `DAC-Pins: ${pins.pins.filter((p) => p.dac).map((p) => p.gpio).join(', ')}`
                        : 'Dieses Board hat keinen DAC.'}
                    </p>
                  )}
                </div>
              )}
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
              {intervalFields()}
            </div>
          )}

          {/* PulseOutput fields */}
          {role === 'actuator' && actuatorType === 'PulseOutput' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={pulsePin}
                  onInput={(e) => setPulsePin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 17" class={inp} required />
                <PinHint pins={pins} value={pulsePin} selfId={selfId} output />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class={lbl}>Pulsbreite (ms)</label>
                  <input type="number" min="1" value={pulseWidthMs}
                    onInput={(e) => setPulseWidthMs((e.target as HTMLInputElement).value)}
                    class={inp} required />
                </div>
                <div>
                  <label class={lbl}>Pause (ms)</label>
                  <input type="number" min="1" value={pulseGapMs}
                    onInput={(e) => setPulseGapMs((e.target as HTMLInputElement).value)}
                    class={inp} required />
                </div>
              </div>
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" checked={pulseInvert} class="accent-accent"
                  onChange={(e) => setPulseInvert((e.target as HTMLInputElement).checked)} />
                Invertieren (active-low)
              </label>
              <p class="text-xs text-faint">
                Ein Programmschritt mit „v" queued so viele Impulse, einmal pro Lauf beim ersten Vorwärts-Eintritt.
              </p>
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
                  <PinHint pins={pins} value={val} selfId={selfId} output={label !== 'Interrupt'} />
                </div>
              ))}
            </div>
          )}

          {/* MqttGeneric fields */}
          {role === 'actuator' && actuatorType === 'MqttGeneric' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>MQTT Topic</label>
                <input type="text" value={mqttTopic}
                  onInput={(e) => setMqttTopic((e.target as HTMLInputElement).value)}
                  placeholder="z.B. cmnd/sonoff1/POWER" class={inp} required />
              </div>
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" checked={mqttRetained} class="accent-accent"
                  onChange={(e) => setMqttRetained((e.target as HTMLInputElement).checked)} />
                Retained
              </label>
              <div>
                <label class={lbl}>Art</label>
                <div class="flex gap-2">
                  {(['Binary', 'Continuous'] as MqttKind[]).map((k) => (
                    <button key={k} type="button" onClick={() => setMqttKind(k)}
                      class={segBtn(mqttKind === k)}>
                      {k === 'Binary' ? 'An/Aus' : 'Wert'}
                    </button>
                  ))}
                </div>
              </div>
              {mqttKind === 'Binary' ? (
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class={lbl}>Payload „An"</label>
                    <input type="text" value={mqttOnPayload}
                      onInput={(e) => setMqttOnPayload((e.target as HTMLInputElement).value)}
                      placeholder="ON" class={inp} required />
                  </div>
                  <div>
                    <label class={lbl}>Payload „Aus"</label>
                    <input type="text" value={mqttOffPayload}
                      onInput={(e) => setMqttOffPayload((e.target as HTMLInputElement).value)}
                      placeholder="OFF" class={inp} required />
                  </div>
                </div>
              ) : (
                <div class="space-y-3">
                  <div>
                    <label class={lbl}>Payload-Template (muss {'{value}'} enthalten)</label>
                    <input type="text" value={mqttTemplate}
                      onInput={(e) => setMqttTemplate((e.target as HTMLInputElement).value)}
                      placeholder="{value}" class={`${inp} font-mono`} required />
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div><label class={lbl}>Min</label>
                      <input type="number" step="any" value={mqttMin}
                        onInput={(e) => setMqttMin((e.target as HTMLInputElement).value)}
                        class={inp} /></div>
                    <div><label class={lbl}>Max</label>
                      <input type="number" step="any" value={mqttMax}
                        onInput={(e) => setMqttMax((e.target as HTMLInputElement).value)}
                        class={inp} /></div>
                    <div><label class={lbl}>Schritt</label>
                      <input type="number" step="any" value={mqttResolution}
                        onInput={(e) => setMqttResolution((e.target as HTMLInputElement).value)}
                        class={inp} /></div>
                  </div>
                  <div>
                    <label class={lbl}>Einheit (optional)</label>
                    <input type="text" value={mqttUnit}
                      onInput={(e) => setMqttUnit((e.target as HTMLInputElement).value)}
                      placeholder="z.B. %" class={inp} />
                  </div>
                </div>
              )}
              {intervalFields()}
            </div>
          )}

          {/* Remote (actuator) fields */}
          {role === 'actuator' && actuatorType === 'Remote' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>Geräte-ID (Leaf-Knoten)</label>
                <input type="text" value={remoteDevice}
                  onInput={(e) => setRemoteDevice((e.target as HTMLInputElement).value)}
                  placeholder="z.B. node-b" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Remote-ID (Aktor auf dem Leaf)</label>
                <input type="text" value={remoteId}
                  onInput={(e) => setRemoteId((e.target as HTMLInputElement).value)}
                  placeholder="z.B. heater" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Topic-Prefix (optional)</label>
                <input type="text" value={remotePrefix}
                  onInput={(e) => setRemotePrefix((e.target as HTMLInputElement).value)}
                  placeholder="sensactctrl" class={inp} />
              </div>
              <div>
                <label class={lbl}>Transport</label>
                <div class="flex gap-2">
                  {(['mqtt', 'webhook', 'websocket', 'espnow'] as RemoteTransport[]).map((t) => (
                    <button key={t} type="button" onClick={() => setRemoteTransport(t)}
                      class={segBtn(remoteTransport === t)}>
                      {t === 'mqtt' ? 'MQTT' : t === 'webhook' ? 'Webhook' : t === 'websocket' ? 'WebSocket' : 'ESP-NOW'}
                    </button>
                  ))}
                </div>
              </div>
              {remoteTransport === 'webhook' && (
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class={lbl}>Lokaler Port</label>
                    <input type="number" value={remoteListenPort}
                      onInput={(e) => setRemoteListenPort((e.target as HTMLInputElement).value)}
                      placeholder="8080" class={inp} required />
                  </div>
                  <div>
                    <label class={lbl}>Peer-URL (Leaf-Knoten)</label>
                    <input type="text" value={remotePeerUrl}
                      onInput={(e) => setRemotePeerUrl((e.target as HTMLInputElement).value)}
                      placeholder="http://192.168.1.50:8080" class={inp} required />
                  </div>
                </div>
              )}
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
                      {snap?.sensors.map((s) => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
                      {!snap?.sensors.length && <option value="">— keine Sensoren —</option>}
                    </select>
                  </div>
                  <div>
                    <label class={lbl}>Aktor</label>
                    <select value={actuatorId} title="Aktor"
                      onChange={(e) => setActuatorId((e.target as HTMLSelectElement).value)}
                      class={inp}>
                      {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
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
                      {snap?.sensors.map((s) => <option key={s.id} value={s.id}>{s.label || s.id}</option>)}
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
                        {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
                      </select>
                    </div>
                    <div>
                      <label class={lbl}>Kühl-Aktor</label>
                      <select value={coolActuatorId} title="Kühl-Aktor"
                        onChange={(e) => setCoolActuatorId((e.target as HTMLSelectElement).value)}
                        class={inp}>
                        <option value="">— keiner —</option>
                        {snap?.actuators.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label class={lbl}>Max. Änderungsrate (°/min, leer = unbegrenzt)</label>
                <input type="number" step="any" min="0" value={maxRatePerMin}
                  onInput={(e) => setMaxRatePerMin((e.target as HTMLInputElement).value)}
                  placeholder="unbegrenzt" class={inp} />
              </div>
              <div>
                <label class={lbl}>
                  Regelbereich (Skala für den Sollwert-Slider im Dashboard, leer = Messbereich des Sensors)
                </label>
                <div class="grid grid-cols-2 gap-2">
                  {(() => {
                    const selSensor = snap?.sensors.find((s) => s.id === sensorId);
                    const phMin = selSensor ? String(selSensor.meta.min) : 'min';
                    const phMax = selSensor ? String(selSensor.meta.max) : 'max';
                    return (
                      <>
                        <input type="number" step="any" value={rangeMin}
                          onInput={(e) => setRangeMin((e.target as HTMLInputElement).value)}
                          placeholder={phMin} class={inp} />
                        <input type="number" step="any" value={rangeMax}
                          onInput={(e) => setRangeMax((e.target as HTMLInputElement).value)}
                          placeholder={phMax} class={inp} />
                      </>
                    );
                  })()}
                </div>
              </div>
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
                <div class="space-y-2">
                  <div class="flex items-center justify-end">
                    <button type="button" onClick={onStopAutotune} disabled={atBusy}
                      class="rounded bg-fg/5 px-2 py-1 text-xs text-fg hover:bg-fg/10 disabled:opacity-50">
                      Abbrechen
                    </button>
                  </div>
                  <AutotuneProgress params={liveController?.params} />
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

          {riskyWarn.length > 0 && (
            <div class="rounded-md border border-caution/40 bg-caution/10 p-3 text-xs">
              <p class="font-medium text-fg">Bedenkliche Pins</p>
              <ul class="mt-1 list-disc pl-4 text-muted">
                {riskyWarn.map((w) => <li key={w}>{w}</li>)}
              </ul>
              <p class="mt-1 text-muted">
                Funktioniert, der Pin hat aber eine Zweitaufgabe — z. B. kann ein Ausgang beim
                Booten kurz schalten oder das Board nicht mehr starten.
              </p>
              <label class="mt-2 flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" class="accent-accent"
                  checked={riskyAck === riskyWarn.join('|')}
                  onChange={(e) => setRiskyAck((e.target as HTMLInputElement).checked ? riskyWarn.join('|') : '')} />
                Trotzdem verwenden
              </label>
            </div>
          )}
          {err && <p class="text-xs text-critical">{err}</p>}
    </>);
  }

  if (wizard) {
    const wizardSteps: WizardStep[] = [
      { label: STEP_TEXT[1].label, value: ROLE_LABEL[role] },
      { label: STEP_TEXT[2].label, value: category },
      { label: STEP_TEXT[3].label, value: typeChosen ? typeLabel : '' },
      { label: STEP_TEXT[4].label, value: id.trim() },
    ];

    if (created) return (
      <AddItemWizard steps={wizardSteps} step={5} maxStep={4} onStep={() => {}}
        title="Gerät hinzugefügt" subtitle=""
        next={{ label: 'Fertig' }} onNext={closeWizard}>
        <div class="flex h-full flex-col items-center justify-center px-8 text-center">
          <span class="flex size-16 items-center justify-center rounded-full bg-accent text-accent-fg">
            <Check size={32} />
          </span>
          <h4 class="mt-6 text-base font-medium text-fg">Gerät hinzugefügt</h4>
          <p class="mt-1 text-sm text-muted">
            {ROLE_LABEL[created.role]} „{created.id}“ wurde angelegt.
          </p>
        </div>
      </AddItemWizard>
    );

    return (
      <form onSubmit={(e) => { if (step !== 4) { e.preventDefault(); return; } void handleSubmit(e); }}>
        <AddItemWizard
          steps={wizardSteps} step={step} maxStep={maxStep}
          onStep={(s) => { if (!pending) setStep(s as Step); }}
          title={STEP_TEXT[step].title} subtitle={STEP_TEXT[step].sub}
          onCancel={() => { if (!pending) closeWizard(); }}
          onBack={() => setStep((s) => Math.max(1, s - 1) as Step)}
          backDisabled={step === 1 || pending}
          next={{
            label: step === 4 ? (pending ? 'Hinzufügen…' : 'Hinzufügen') : 'Weiter',
            disabled: !canNext,
            submit: step === 4,
          }}
          onNext={() => { const n = (step + 1) as Step; setStep(n); setMaxStep((m) => (n > m ? n : m)); }}
        >
          {step === 1 && (
            <div role="radiogroup" aria-label="Art des Geräts"
              class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {(['sensor', 'actuator', 'controller'] as Role[]).map((r) => (
                <ChoiceCard key={r} icon={ROLE_META[r].icon} label={ROLE_LABEL[r]}
                  desc={ROLE_META[r].desc} selected={role === r} onPick={() => pickRole(r)} />
              ))}
            </div>
          )}

          {step === 2 && (
            <div role="radiogroup" aria-label="Kategorie"
              class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <ChoiceCard key={c.group} icon={CATEGORY_ICON[c.group] ?? ROLE_META[role].icon}
                  label={c.group} desc={`${c.count} ${c.count === 1 ? 'Typ' : 'Typen'}`}
                  selected={category === c.group} onPick={() => pickCategory(c.group)} />
              ))}
            </div>
          )}

          {step === 3 && (
            <div role="radiogroup" aria-label="Gerätetyp" class="space-y-2">
              {typesInCategory.map((t) => {
                // Each IDS cooker needs an RMT TX channel; without a free one
                // the firmware refuses it (409), so don't offer it.
                const noRmt = !!pins && (t.type === 'IDS1' || t.type === 'IDS2') &&
                  pins.caps.rmtUsed >= pins.caps.rmtTx;
                return (
                  <ChoiceCard key={t.type} row icon={CATEGORY_ICON[t.group] ?? ROLE_META[role].icon}
                    label={t.label}
                    desc={noRmt ? `Kein RMT-Kanal mehr frei (${pins!.caps.rmtUsed} von ${pins!.caps.rmtTx} belegt)` : t.hint}
                    disabled={noRmt}
                    selected={typeChosen && currentType === t.type} onPick={() => applyType(t)} />
                );
              })}
            </div>
          )}

          {step === 4 && <div class="space-y-4">{fieldBlocks()}</div>}
        </AddItemWizard>
      </form>
    );
  }

  return (
    <div
      class={dialogScrim}
      onClick={() => { if (!pending) onClose(); }}
    >
      <div
        class={`max-h-[90vh] w-full max-w-md ${dialogFrame} ${dialogSheet}`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Compact header — the subline is the only place the chosen type is
              named. There is no back affordance: editing cannot change the type,
              and a discovered device has its type fixed by the scan. */}
          <div class="min-w-0">
            <h2 class="text-base font-medium text-fg">
              {isEdit ? 'Item bearbeiten' : 'Gerät hinzufügen'}
            </h2>
            <p class="truncate text-xs text-muted">{ROLE_LABEL[role]} · {typeLabel}</p>
          </div>

          {fieldBlocks()}
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
