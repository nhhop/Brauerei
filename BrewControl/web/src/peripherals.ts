// Display helpers for peripheral devices (GET /api/peripherals).

export const DEVICE_TYPE_LABEL: Record<string, string> = {
  mcp4728: 'MCP4728',
  pcf8575: 'PCF8575',
};

export const DEVICE_TYPE_HINT: Record<string, string> = {
  mcp4728: '4 × 12-Bit-DAC (0 V bis Versorgungsspannung) für Analogausgänge.',
  pcf8575: '16 digitale Pins (P00–P17) für Schaltausgänge und Eingänge. Ein Pin zieht nur ' +
    'hart nach Masse, High ist ein schwacher Pull-up — Relaismodule aktiv-low anschließen.',
};

// How a chip gets an address other than its factory one.
export const DEVICE_ADDRESS_HINT: Record<string, string> = {
  mcp4728: 'Eine andere Adresse muss vorher im Baustein programmiert sein — die Firmware trägt sie nur ein.',
  pcf8575: 'Andere Adressen über die Lötbrücken A0–A2 des Moduls einstellen.',
};

// 96 → "0x60", the form GET /api/bus/scan reports I2C addresses in.
export function hexAddr(a: number): string {
  return `0x${a.toString(16).padStart(2, '0')}`;
}
