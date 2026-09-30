// Display helpers for bus definitions (GET /api/buses).
import type { BusStored, BusType } from './types';

export const BUS_TYPE_LABEL: Record<BusType, string> = {
  onewire: 'OneWire',
  spi: 'SPI',
  i2c: 'I²C',
};

// Upper-case pin names in the order the firmware lists them.
const PIN_LABEL: Record<string, string> = {
  pin: 'Pin', clk: 'CLK', miso: 'MISO', mosi: 'MOSI', sda: 'SDA', scl: 'SCL',
};

export function pinLabel(key: string): string {
  return PIN_LABEL[key] ?? key.toUpperCase();
}

const PIN_KEYS: Record<BusType, string[]> = {
  onewire: ['pin'],
  spi: ['clk', 'miso', 'mosi'],
  i2c: ['sda', 'scl'],
};

// "SDA 1 · SCL 2", "GPIO 4"
export function busPinsText(b: BusStored): string {
  const keys = PIN_KEYS[b.type];
  const pins = b as unknown as Record<string, number | undefined>;
  if (keys.length === 1) return `GPIO ${pins[keys[0]]}`;
  return keys.map((k) => `${pinLabel(k)} ${pins[k]}`).join(' · ');
}

// "Zweitbus (SDA 1 · SCL 2)" or, without a label, "i2c-1-2 (SDA 1 · SCL 2)".
export function busTitle(b: BusStored): string {
  return `${b.label || b.id} (${busPinsText(b)})`;
}
