// Catalog of the item types AddItemModal can create — plain data, shared by the
// type picker (step 1 of the add dialog) and the add dialog's step-2 header.
// The authoritative list of config keys per type stays in the firmware's
// DynamicItems::addSensor()/addActuator()/addController(); this file only names
// the types and describes them for the UI.

export type Role = 'sensor' | 'actuator' | 'controller';

export interface ItemTypeEntry {
  role: Role;
  type: string;   // wire value, e.g. 'DS18B20' | 'DigitalOutput' | 'PID'
  label: string;
  group: string;  // section heading in the picker
  hint: string;
}

// Order matters: the picker groups in array order, which keeps the ordering of
// the dropdowns this replaced.
export const ITEM_TYPES: ItemTypeEntry[] = [
  // ── Sensoren ──────────────────────────────────────────────────────────────
  { role: 'sensor', type: 'DS18B20', group: 'Temperatur',
    label: 'DS18B20 (OneWire)',
    hint: 'Digitaler Temperaturfühler am OneWire-Bus — mehrere pro Pin.' },
  { role: 'sensor', type: 'MAX31865', group: 'Temperatur',
    label: 'MAX31865 (PT100/PT1000, SPI)',
    hint: 'PT100/PT1000 über SPI — für Präzisionsfühler.' },
  { role: 'sensor', type: 'BME280', group: 'Feuchte / Druck',
    label: 'BME280 (T/H/P, I²C)',
    hint: 'Temperatur, Feuchte und Druck über I²C — drei Kanäle.' },
  { role: 'sensor', type: 'YF-S201', group: 'Durchfluss',
    label: 'YF-S201 (Durchfluss)',
    hint: 'Impuls-Durchflusssensor — liefert Rate und Volumen.' },
  { role: 'sensor', type: 'HCSR04', group: 'Distanz',
    label: 'HC-SR04 (Ultraschall)',
    hint: 'Ultraschall-Abstand, optional in Füllstand umgerechnet.' },
  { role: 'sensor', type: 'HX711', group: 'Gewicht',
    label: 'HX711 (Wägezelle)',
    hint: 'Wägezellen-Verstärker über DOUT/SCK.' },
  { role: 'sensor', type: 'DigitalInput', group: 'Digital / Schalter',
    label: 'Digitaler Eingang (GPIO)',
    hint: 'GPIO-Eingang für Schalter, Taster oder Endlagen.' },
  { role: 'sensor', type: 'MqttGeneric', group: 'MQTT',
    label: 'MQTT Generic (externes Gerät)',
    hint: 'Messwert eines fremden Geräts aus einem MQTT-Topic.' },
  { role: 'sensor', type: 'Remote', group: 'Remote',
    label: 'Remote (SensActCtrl-Knoten)',
    hint: 'Sensor eines anderen SensActCtrl-Knotens übernehmen.' },

  // ── Aktoren ───────────────────────────────────────────────────────────────
  { role: 'actuator', type: 'DigitalOutput', group: 'GPIO',
    label: 'DigitalOutput (GPIO on/off + TPO)',
    hint: 'GPIO an/aus — auch taktend für SSR (Time-Proportional).' },
  { role: 'actuator', type: 'AnalogOutput', group: 'GPIO',
    label: 'AnalogOutput (PWM / DAC)',
    hint: 'Stufenlose Ausgabe über PWM oder DAC.' },
  { role: 'actuator', type: 'PulseOutput', group: 'GPIO',
    label: 'Pulse (Hopfen-Dropper)',
    hint: 'Kurze Impulse auslösen — z.B. Hopfen-Dropper.' },
  { role: 'actuator', type: 'IDS1', group: 'Induktion',
    label: 'IDS1 – Induktion (10 Stufen)',
    hint: 'Induktionskochfeld mit 10 Leistungsstufen.' },
  { role: 'actuator', type: 'IDS2', group: 'Induktion',
    label: 'IDS2 – Induktion (5 Stufen)',
    hint: 'Induktionskochfeld mit 5 Leistungsstufen.' },
  { role: 'actuator', type: 'MqttGeneric', group: 'MQTT',
    label: 'MQTT Generic (externes Gerät)',
    hint: 'Fremdes Gerät über ein MQTT-Topic schalten oder stellen.' },
  { role: 'actuator', type: 'Remote', group: 'Remote',
    label: 'Remote (SensActCtrl-Knoten)',
    hint: 'Aktor eines anderen SensActCtrl-Knotens fernsteuern.' },

  // ── Regler ────────────────────────────────────────────────────────────────
  { role: 'controller', type: 'TwoPoint', group: 'Zweipunktregler',
    label: 'Einfacher Zweipunktregler',
    hint: 'Schaltet mit Hysterese um den Sollwert — ein Aktor.' },
  { role: 'controller', type: 'DualStage', group: 'Zweipunktregler',
    label: 'Dual-Stage-Regler (Heizen/Kühlen)',
    hint: 'Heizen und Kühlen getrennt, mit Kompressor-Schutzzeiten.' },
  { role: 'controller', type: 'PID', group: 'PID',
    label: 'Einfacher PID-Regler',
    hint: 'Stetige Regelung mit Kp/Ki/Kd — für SSR oder PWM.' },
  { role: 'controller', type: 'SplitRangePID', group: 'PID',
    label: 'Split-Range-PID-Regler (Heizen/Kühlen)',
    hint: 'Ein PID für Heizen und Kühlen, getrennt durch ein Totband.' },
];

export const ROLE_LABEL: Record<Role, string> = {
  sensor: 'Sensor', actuator: 'Aktor', controller: 'Regler',
};

// What the discovery dialog hands to AddItemModal — exactly the two shapes a
// scan can produce. Set it in the same handler that opens the dialog and clear
// it in onClose; see the `prefill` prop in AddItemModal.
export type ItemPrefill =
  | { role: 'sensor'; type: 'DS18B20'; id: string; pin: number; address: string }
  | {
      role: 'sensor' | 'actuator'; type: 'Remote'; id: string;
      transport: 'mqtt' | 'espnow'; device: string; remoteId: string;
      prefix: string; channelKey: string;
    };
