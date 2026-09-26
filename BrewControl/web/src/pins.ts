// Client-side view of GET /api/pins for the item form. The firmware checks
// every create/replace itself (PinMap.h) — this only gives early hints and the
// "risky pin" confirmation, which the firmware deliberately does not enforce.
import type { PinsInfo } from './types';

// Config keys that hold a GPIO number (mirrors collectPins() in PinMap.h).
const PIN_KEYS = [
  'pin', 'cs', 'clk', 'miso', 'mosi', 'trig', 'echo', 'dout', 'sck',
  'pin_white', 'pin_yellow', 'pin_interrupt',
] as const;

export type PinShare = 'onewire' | 'spi';

export interface PinStatus {
  level: 'ok' | 'warn' | 'error';
  text: string;
}

// Status of one GPIO for a form field. selfId: the item being edited, whose
// own pins count as free. output: the field drives the pin. share: the field
// may join other users of the same bus kind (DS18B20 OneWire, MAX31865 SPI).
export function pinStatus(
  info: PinsInfo, gpio: number, opts: { selfId?: string; output?: boolean; share?: PinShare } = {},
): PinStatus {
  const p = info.pins.find((x) => x.gpio === gpio);
  if (!p) return { level: 'error', text: `GPIO ${gpio} gibt es auf diesem Board nicht` };
  if (p.class === 'forbidden') return { level: 'error', text: `nicht nutzbar (${p.note})` };
  if (p.class === 'reserved') return { level: 'error', text: `vom Board belegt (${p.note})` };
  if (opts.output && p.inputOnly) return { level: 'error', text: 'nur als Eingang nutzbar' };
  const others = p.users.filter((u) => u.id !== opts.selfId);
  const blocking = others.filter((u) => !opts.share || u.share !== opts.share);
  if (blocking.length) {
    return { level: 'error', text: `belegt von ${blocking.map((u) => `${u.id} (${u.key})`).join(', ')}` };
  }
  if (p.class === 'risky') return { level: 'warn', text: `bedenklich: ${p.note}` };
  if (others.length) return { level: 'ok', text: `gemeinsamer Bus mit ${others.map((u) => u.id).join(', ')}` };
  return { level: 'ok', text: 'frei' };
}

// "GPIO n: reason" for every risky pin in an item config — the user has to
// confirm these before saving.
export function riskyPins(info: PinsInfo | null, cfg: Record<string, unknown>): string[] {
  if (!info) return [];
  const out: string[] = [];
  for (const key of PIN_KEYS) {
    const v = cfg[key];
    if (typeof v !== 'number') continue;
    const p = info.pins.find((x) => x.gpio === v);
    const line = `GPIO ${v}: ${p?.note ?? ''}`;
    if (p?.class === 'risky' && !out.includes(line)) out.push(line);
  }
  return out;
}
