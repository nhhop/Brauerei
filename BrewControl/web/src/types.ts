// Wire format of GET /api/snapshot and the "snapshot" SSE event.
// Mirrors SensActCtrl/src/core/RegistrySnapshot.cpp 1:1.

export type ValueKind = 'Binary' | 'Discrete' | 'Continuous' | 'Cumulative';

export type Quantity =
  | 'None'
  | 'Temperature'
  | 'Humidity'
  | 'Pressure'
  | 'pH'
  | 'Voltage'
  | 'Current'
  | 'Power'
  | 'Energy'
  | 'Mass'
  | 'Volume'
  | 'FlowRate'
  | 'Frequency'
  | 'Duration'
  | 'DutyCycle'
  | 'Count'
  | 'Custom';

export interface ItemMeta {
  kind: ValueKind;
  quantity: Quantity;
  unit: string;
  min: number;
  max: number;
  res: number;
}

export interface ItemState {
  // ArduinoJson serializes NaN as null — handle both at the read site.
  v: number | null;
  // millis() at the time of the read (uint32_t, wraps after ~49 days).
  t: number;
  ok: boolean;
}

export interface Sensor {
  id: string;
  meta: ItemMeta;
  state: ItemState;
  fault?: string;
}

export interface Actuator {
  id: string;
  meta: ItemMeta;
  state: ItemState;
  fault?: string;
}

export interface ControllerParams {
  // Both PID and TwoPoint
  sensor?: string;
  actuator?: string;
  enabled?: boolean;
  // PID
  Kp?: number;
  Ki?: number;
  Kd?: number;
  Ku?: number;
  Tu?: number;
  min?: number;
  max?: number;
  autotuneMethod?: string;
  autotuneState?: string;
  // TwoPoint
  hystLow?: number;
  hystHigh?: number;
  inverted?: boolean;
  // DualStage / SplitRangePID (dual-output heat/cool controllers)
  heatActuator?: string;
  coolActuator?: string;
  heatDiff?: number;
  coolDiff?: number;
  coolMinOnMs?: number;
  coolMinOffMs?: number;
  deadband?: number;
  changeoverMs?: number;
  heatOut?: number;
  coolOut?: number;
  [key: string]: unknown;
}

export interface Controller {
  id: string;
  setpoint: number;
  enabled: boolean;
  params?: ControllerParams;
}

export interface Snapshot {
  sensors: Sensor[];
  actuators: Actuator[];
  controllers: Controller[];
  serverTime?: number;  // Unix timestamp (seconds), present only when NTP synced
}

// Wire format of GET /api/config
export type ItemConfig = Record<string, unknown>;

export interface ConfigSnapshot {
  sensors: ItemConfig[];
  actuators: ItemConfig[];
  controllers: ItemConfig[];
}

// Wire format of GET /api/dashboards
export interface DashboardConfig {
  id: string;
  name: string;
  sensors: string[];      // base IDs (without sub-channel suffix)
  actuators: string[];
  controllers: string[];
  charts?: string[];      // referenced log/chart IDs (see LogConfig)
  programs?: string[];    // referenced setpoint-program IDs (see ProgramConfig)
}

// ── Setpoint programs (mash profiles) ────────────────────────────────────────
// Wire format of GET /api/programs. A program drives a controller's setpoint
// through a list of timed steps. Mirrors ProgramRunner in the firmware.

export type ProgramStatus = 'idle' | 'running' | 'awaiting' | 'paused' | 'done';

export type ProgramAction = 'start' | 'pause' | 'resume' | 'stop' | 'next' | 'prev';

export interface ProgramStep {
  name?: string;          // optional, cosmetic
  setpoint: number;
  holdSec: number;
  confirm?: boolean;      // true → wait for manual "next" after the hold elapses
}

export interface ProgramConfig {
  id: string;
  name: string;
  controller: string;     // bound controller id
  steps: ProgramStep[];
  // Runtime state:
  status: ProgramStatus;
  currentStep: number;
  // Derived live fields (read-only, present in GET /api/programs):
  stepRemainingSec?: number;
  currentSetpoint?: number;
}

// One plotted/logged channel. ref is "<role>/<snapshotId>", e.g.
// "sensor/bme280.temp", "actuator/heizung", "controller/maische".
export interface LogSeries {
  ref: string;
  tol: number;            // dead-band tolerance (0 = log every change)
}

// Online data-reduction algorithm applied before writing to the CSV.
//   none          — write every sampled row.
//   linear        — drop points on the chord between their neighbours (±tol).
//   swingingdoor  — bounded-slope corridor; long runs collapse to one segment.
export type CompAlgo = 'none' | 'linear' | 'swingingdoor';

// Wire format of GET /api/logs. A log config doubles as the chart config:
// the series list drives both the CSV columns and the plotted lines.
export interface LogConfig {
  id: string;
  name: string;
  intervalSec: number;
  series: LogSeries[];
  algo: CompAlgo;
  maxGapSec: number;      // safety point: force a row after this gap (s)
  enabled: boolean;       // background logging on/off
  bindEnableTo?: string;  // controller id; if set, enabled follows it
  session?: number;       // start epoch (s) of the current session, if any
}

// One CSV session of a log (GET /api/logs/:id/sessions).
export interface LogSession {
  start: number;          // session start epoch (s) = filename
  size: number;           // bytes on disk
  active: boolean;        // true for the currently-written session
}

// Wire format of GET /api/network
export interface NetworkStatus {
  connected: boolean;
  ssid: string;
  ip: string;
  rssi: number;     // dBm; 0 when not connected
  mac: string;
  hostname: string; // configured mDNS host (".local" appended in UI)
}

// One entry of GET /api/network/scan
export interface ScanNetwork {
  ssid: string;
  rssi: number;
  open: boolean;
}

// Wire format of GET /api/bus/scan
export interface ScannedDevice {
  address: string; // 16 hex chars, e.g. "28ff64c8815604ef"
  index: number;
}

export interface BusScanResult {
  type: string; // "onewire"
  pin: number;
  devices: ScannedDevice[];
}

export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  accent: string;
  background: 'neutral' | 'warm' | 'cool';
}

export interface FirmwareSettings {
  channel: 'stable' | 'preview';
  autoCheck: boolean;
}

export interface TimeSettings {
  ntpServer: string;
  utcOffsetSec: number;
  dstOffsetSec: number;
  timeFormat: '24h' | '12h';
  dateFormat: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}

export interface AppSettings {
  theme: ThemeSettings;
  firmware?: FirmwareSettings;
  time?: TimeSettings;
}

export type UpdateState =
  | 'idle' | 'checking' | 'updateAvailable' | 'noUpdate'
  | 'downloading' | 'flashing' | 'success' | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  variant: string;
  channel: 'stable' | 'preview';
  autoCheck: boolean;
  progress: number;
  error: string;
  available: { version: string; notes: string } | null;
}
