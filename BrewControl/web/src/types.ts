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
}

export interface Actuator {
  id: string;
  meta: ItemMeta;
  state: ItemState;
}

export interface Controller {
  id: string;
  setpoint: number;
  // Nested object; absent if the controller has no exposed params.
  params?: Record<string, unknown>;
}

export interface Snapshot {
  sensors: Sensor[];
  actuators: Actuator[];
  controllers: Controller[];
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
