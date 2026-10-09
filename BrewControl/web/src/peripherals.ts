// Display helpers for peripheral devices (GET /api/peripherals).

export const DEVICE_TYPE_LABEL: Record<string, string> = {
  mcp4728: 'MCP4728',
};

export const DEVICE_TYPE_HINT: Record<string, string> = {
  mcp4728: '4 × 12-Bit-DAC (0 V bis Versorgungsspannung) für Analogausgänge.',
};

// 96 → "0x60", the form GET /api/bus/scan reports I2C addresses in.
export function hexAddr(a: number): string {
  return `0x${a.toString(16).padStart(2, '0')}`;
}
