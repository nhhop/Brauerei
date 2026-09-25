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
  | 'Distance'
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
  // Optional display name; falls back to id in the UI when absent.
  label?: string;
  meta: ItemMeta;
  state: ItemState;
  fault?: string;
}

export interface Actuator {
  id: string;
  // Optional display name; falls back to id in the UI when absent.
  label?: string;
  meta: ItemMeta;
  state: ItemState;
  // What was last commanded, as opposed to state.v (what's physically driven
  // right now). The two diverge while the master switch is off or an interval
  // schedule is in its off-phase — controls bind to this, charts to state.v.
  target: number;
  fault?: string;
  // Master on/off switch, independent of the value. Every actuator has one.
  // Binary actuators are controlled through it alone (their target is pinned
  // at 1), so they start disabled — a reboot never closes a relay by itself.
  enabled: boolean;
  // Duty-cycle schedule ("on" for onSec out of every periodSec). Present
  // only when the firmware wrapped this actuator in IntervalActuator.
  interval?: { onSec: number; periodSec: number };
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
  // Display range for the setpoint (e.g. a UI slider's scale), any controller
  // type — construction-time only, not enforced by the controller itself.
  // 0/0 (or rangeMax <= rangeMin) means unset.
  rangeMin?: number;
  rangeMax?: number;
  autotuneMethod?: string;
  autotuneState?: string;
  autotuneCyclesObserved?: number;
  autotuneCyclesTotal?: number;
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
  // Rate limiter (any controller type, decorator-based — optional)
  maxRatePerSec?: number;
  effectiveSetpoint?: number;
  [key: string]: unknown;
}

export interface Controller {
  id: string;
  // Optional display name; falls back to id in the UI when absent.
  label?: string;
  setpoint: number;
  enabled: boolean;
  params?: ControllerParams;
}

export interface Snapshot {
  sensors: Sensor[];
  actuators: Actuator[];
  controllers: Controller[];
  serverTime?: number;  // Unix timestamp (seconds), present only when NTP synced
  // Emergency-stop latch. Always sent by the firmware; optional here so an
  // older build (or the dev mock) simply reads as "not stopped".
  estop?: boolean;
}

// Wire format of GET /api/sensors/:id/calibration. `raw` is the sensor's
// uncalibrated value (what it would show without any calibration), `value`
// the calibrated one. `modes` lists what the channel supports.
export type CalibrationMode = 'offset' | 'gain' | 'twopoint' | 'poly';

export interface CalibrationPoint { raw: number; value: number }

export interface CalibrationChannel {
  key: string;          // '' for single-value sensors
  unit: string;
  valid: boolean;
  raw: number | null;   // ArduinoJson serializes NaN as null
  value: number | null;
  calibrated: boolean;
  mode?: 'linear' | 'poly';   // which form is active (only when calibrated)
  raw_ref?: number;           // linear form
  value_ref?: number;
  gain?: number;
  degree?: number;            // polynomial form
  points?: CalibrationPoint[];
  modes: CalibrationMode[];
}

export interface CalibrationInfo {
  channels: CalibrationChannel[];
}

// Wire format of GET /api/config
export type ItemConfig = Record<string, unknown>;

export interface ConfigSnapshot {
  sensors: ItemConfig[];
  actuators: ItemConfig[];
  controllers: ItemConfig[];
}

// Per-widget dashboard display variant. 'normal' entries are never stored —
// absence from the *Modes map already means 'normal'.
export type WidgetMode = 'normal' | 'compact' | 'gauge';

// Dashboard layout: the elements live in a tree of resizable areas. A leaf holds
// one or more item refs - several refs render as a flowing card grid, a lone ref
// fills its area. Refs carry a kind prefix because charts, programs and timers
// have their own id namespaces (same slash form the alarm refs use).
export type LayoutNode = LayoutSplit | LayoutLeaf;

export interface LayoutSplit {
  split: 'row' | 'col';
  sizes: number[];          // one weight per child, summing to 1
  children: LayoutNode[];
}

export interface LayoutLeaf {
  // "sensor/<baseId>" | "sensor/<baseId>.<channel>" | "actuator/<id>" | "controller/<id>" | "chart/<logId>"
  // | "program/<id>" | "timer/<id>"
  items: string[];
}

// Wire format of GET /api/dashboards
export interface DashboardConfig {
  id: string;
  name: string;
  sensors: string[];      // base IDs (all channels) or channel IDs ("tank.distance")
  actuators: string[];
  controllers: string[];
  charts: string[];       // referenced log/chart IDs (see LogConfig); always present, may be empty
  programs: string[];     // referenced setpoint-program IDs (see ProgramConfig); always present, may be empty
  layout?: LayoutNode;    // saved arrangement; absent means the derived default
  timers: string[];       // referenced timer IDs (see TimerConfig); always present, may be empty
  sensorModes: Record<string, WidgetMode>;      // sensor base-id -> display mode, may be empty
  controllerModes: Record<string, WidgetMode>;  // controller id -> display mode, may be empty
  timerModes: Record<string, WidgetMode>;       // timer id -> display mode, may be empty
}

// ── Setpoint programs (mash profiles) ────────────────────────────────────────
// Wire format of GET /api/programs. A program drives controllers and actuators
// through a list of steps. Mirrors ProgramRunner in the firmware.

export type ProgramStatus = 'idle' | 'running' | 'awaiting' | 'paused' | 'done';

export type ProgramAction = 'start' | 'pause' | 'resume' | 'stop' | 'next' | 'prev';

// What a step does to one controller or actuator — the same body as
// POST /api/actuators/<id>. Every field is optional; one left out keeps its
// value, and nothing is enabled implicitly. On a controller v is the setpoint.
// On a pulse actuator (meta.kind 'Discrete') v queues that many pulses, fired
// once on the first forward entry into the step per run (see reachedStep).
export interface StepTarget {
  v?: number;
  enabled?: boolean;
  interval?: { onSec: number; periodSec: number };
}

export interface ProgramStep {
  name?: string;          // optional, cosmetic
  // Keyed by controller/actuator id. Only what this step changes — an id left
  // out keeps its value. Always present, {} for a step that changes nothing.
  targets: Record<string, StepTarget>;
  holdSec: number;
  // Step-end trigger. Absent = 'hold' (ends when holdSec elapses). 'sensor'
  // ends the step once `cond` is met (holdSec ignored).
  end?: 'hold' | 'sensor';
  cond?: Condition;       // present only when end === 'sensor'
  confirm?: boolean;      // true → wait for a manual "next" once the trigger fires
}

export interface ProgramConfig {
  id: string;
  name: string;
  steps: ProgramStep[];
  // Runtime state (always present, persisted across reboots):
  status: ProgramStatus;
  currentStep: number;
  reachedStep: number;        // highest step entered forward this run, -1 before start; its pulses have fired
  stepStartedEpoch: number;   // epoch (s) the current step started; 0 while idle
  elapsedAtPauseSec: number;  // seconds already elapsed in the step when paused; 0 otherwise
  // Derived live fields (read-only, present in GET /api/programs):
  stepRemainingSec?: number;
}

// ── Timer ─────────────────────────────────────────────────────────────────────
// Wire format of GET /api/timers. A freestanding countdown — hop additions,
// stirring intervals, rests outside a formal program. Each timer is its own
// dashboard element, not grouped. Mirrors TimerStore in the firmware.

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export type TimerAction = 'start' | 'pause' | 'resume' | 'stop';

export type TimerMode = 'duration' | 'clock';

export type TimerTargetKind = 'actuator' | 'controller' | 'program';

export type TimerTargetAction = 'start' | 'stop';

// Fired once, directly against the target, when the timer expires — before a
// repeat re-arm, if any. Coarse start/stop only, no value/setpoint.
export interface TimerExpireAction {
  targetType: TimerTargetKind;
  targetId: string;
  action: TimerTargetAction;
}

export interface TimerConfig {
  id: string;
  name: string;
  mode: TimerMode;
  // duration mode: the configured value. clock mode: computed for the
  // current/most recent run, 0 before the first start.
  durationSec: number;
  timeOfDay?: string;         // "HH:MM", present when mode === 'clock'
  repeat: boolean;
  onExpire?: TimerExpireAction;
  // Runtime state (always present, persisted across reboots):
  status: TimerStatus;
  startedEpoch: number;       // epoch (s) the timer started; 0 while idle
  elapsedAtPauseSec: number;  // seconds already elapsed when paused; 0 otherwise
  // Derived live field (read-only, present in GET /api/timers):
  remainingSec: number;
}

// ── Alarme & Meldungen ───────────────────────────────────────────────────────
// Wire format of GET /api/alarms and GET /api/alerts. Mirrors AlarmStore in the
// firmware. A rule is user config; an alert is a point-in-time edge, kept in a
// RAM ring on the device and therefore lost on reboot.

export type Severity = 'info' | 'warning' | 'critical';

export type CondOp = 'gt' | 'lt';

// Shared threshold primitive. `ref` is the same "<role>/<snapshotId>" form the
// log series and chart config use — resolveRef() in api.ts resolves it against
// a snapshot. Note role "controller" means its *setpoint*, not a process value.
export interface Condition {
  ref: string;
  op: CondOp;
  value: number;
  hyst: number;   // release band; gt clears only below value - hyst. 0 = plain compare
}

export interface AlarmConfig {
  id: string;
  name: string;
  enabled: boolean;
  severity: Severity;
  forSec: number;         // condition must hold this long before firing
  cond: Condition;
  // Runtime state (read-only, not persisted on the device):
  active: boolean;        // firing right now
  since: number;          // epoch (s) it started firing; 0 while idle or pre-NTP
  resolved: boolean;      // false → cond.ref points at nothing; rule is dormant
}

export type AlertKind = 'threshold' | 'fault' | 'program' | 'autotune' | 'timer';

export type AlertState = 'raised' | 'cleared';

// Carries no prose: the firmware emits structured fields, alertText() in
// AlertCenter.tsx composes the German sentence.
export interface Alert {
  seq: number;            // monotonic since boot, starts at 1; also the ?since= cursor
  ts: number;             // epoch (s), or 0 when raised before NTP synced
  sev: Severity;
  state: AlertState;
  kind: AlertKind;
  src: string;            // sensor/<id> | actuator/<id> | controller/<id> | program/<id> | timer/<id>
  name?: string;          // rule name, program name or item id
  rule?: string;          // originating rule id, kind === 'threshold' only
  detail?: string;        // fault() text, program status, or the breached comparison
  v?: number;             // measured value at the edge
}

// ── Profile library ──────────────────────────────────────────────────────────
// Wire format of GET /api/profiles. Reusable step templates, grouped into
// user-defined categories. Steps are ProgramStep, target ids included —
// applying a profile copies them into a program. A profile from before
// multi-target steps carries the unbound id "" until the user binds it.
// Mirrors ProfileStore in the firmware.

export interface ProfileCategory {
  id: string;
  name: string;
}

export interface ProfileConfig {
  id: string;
  name: string;
  category: string;       // ProfileCategory id; mandatory
  steps: ProgramStep[];
}

export interface ProfileLibrary {
  categories: ProfileCategory[];
  profiles: ProfileConfig[];
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

// One entry of GET /api/remote/discover — an item a remote device publishes.
export interface DiscoveredItem {
  device: string;
  prefix: string;
  kind: 'sensor' | 'actuator';
  id: string;
  channel_key: string; // "" for flat single-channel items
  quantity: string;
  unit: string;
}

// One entry of GET /api/remote/peers — another board found via mDNS
// (_sensactctrl._tcp). ws_port is its WebSocket hub port, 0 when it runs none.
// Never contains this device itself: the ESP32 mDNS responder does not answer
// its own queries.
export interface DiscoveredPeer {
  hostname: string;
  ip: string;
  device: string;
  prefix: string;
  ws_port: number;
}

// GET /api/remote/pair — outcome of the last pairing attempt. code/message are
// only present once state is "done".
export interface PairResult {
  state: 'idle' | 'running' | 'done';
  host: string;
  code?: number;
  message?: string;
}

export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  accent: string;
  // Second series color — controller output bar and percentage. Older devices
  // omit it; the UI falls back to the default green.
  secondary?: string;
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

export interface MqttSettings {
  enabled: boolean;
  mode: 'external' | 'embedded';
  host: string;
  port: number;
  username: string;
  password: string;                   // write-only: GET returns ""; POST with "" keeps the stored value
  passwordSet: boolean;               // read-only, server-computed; true when a password is stored
  tls: boolean;
  clientId: string;
  topicPrefix: string;
  embeddedBrokerSupported: boolean;   // read-only, server-computed; always present
  connected?: boolean;                // read-only, live transport state
  error?: string;                     // read-only, reason when !connected (external mode only)
}

export interface WebhookSettings {
  enabled: boolean;
  listenPort: number;
  peerUrl: string;
  clientId: string;
  topicPrefix: string;
  connected?: boolean;  // read-only, live transport state (reflects WiFi only)
  error?: string;        // read-only, always "" — WebhookTransport has nothing specific to say
}

export interface WebSocketSettings {
  hubEnabled: boolean;      // this device runs the WebSocket server leaves connect to
  hubPort: number;
  publishEnabled: boolean;  // this device publishes its registry to a hub as a client
  hubUrl: string;           // ws://host[:port][/path]
  clientId: string;
  topicPrefix: string;
  connected?: boolean;      // read-only, live state of the publish connection to the hub
  error?: string;           // read-only, reason when !connected
  hubClients?: number;      // read-only, leaves currently connected to this device's hub
}

export interface EspNowSettings {
  enabled: boolean;
  clientId: string;
  topicPrefix: string;
  connected?: boolean;  // read-only, live transport state
  error?: string;        // read-only, always "" — EspNowTransport has nothing specific to say
}

// Burn-in protection of the device's own round display. 0 means "never".
export interface DisplaySettings {
  brightness: number;    // 1..100, share of the panel's maximum
  dimAfterSec: number;   // 0..86400
  dimPercent: number;    // 1..100, share of `brightness` while dimmed
  offAfterSec: number;   // 0..86400
  pixelShift: boolean;   // move the picture a few pixels every minute
  supported: boolean;    // read-only, server-computed: this build drives a display
}

// GET /api/settings always returns all eight sections; SettingsStore::serialize()
// emits every one unconditionally.
export interface AppSettings {
  theme: ThemeSettings;
  firmware: FirmwareSettings;
  time: TimeSettings;
  mqtt: MqttSettings;
  webhook: WebhookSettings;
  websocket: WebSocketSettings;
  espnow: EspNowSettings;
  display: DisplaySettings;
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

// ── SD file manager ─────────────────────────────────────────────────────────
// Wire format of GET /api/files.
export interface FileEntry {
  name: string;
  dir: boolean;
  size: number;
}

export interface FileListing {
  path: string;
  entries: FileEntry[];
}

// GET /api/auth/status. `enabled` is false until a device password is set —
// there is no separate on/off flag on the device either. `uiProtected` is a
// further, separately-toggled step (only settable once `enabled` is true)
// that also gates reads and the UI itself, not just writes.
export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  uiProtected: boolean;
}

// ── Web Push ────────────────────────────────────────────────────────────────
// GET /api/push. `publicKey` is the installation's VAPID public key, passed on
// to the bootstrap page as ?k= so a second browser subscribes against the same
// key instead of starting its own. The private key is never served.
export interface PushSubscriptionInfo {
  id: number;      // slot index, also the DELETE path segment
  host: string;    // push service host, so two browsers are tellable apart
  addedAt: number; // unix seconds, 0 if the clock was unset
}

export interface PushStatus {
  configured: boolean;
  publicKey: string;
  maxSubscriptions: number;
  lastError: string;
  subscriptions: PushSubscriptionInfo[];
}
