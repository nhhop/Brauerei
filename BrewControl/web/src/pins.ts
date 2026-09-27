// Client-side view of GET /api/pins for the item form. The firmware checks
// every create/replace itself (PinMap.h) — this only gives early hints and the
// "risky pin" confirmation, which the firmware deliberately does not enforce.
import type { PinInfo, PinsInfo } from './types';

// Config keys that hold a GPIO number (mirrors collectPins() in PinMap.h).
const PIN_KEYS = [
  'pin', 'cs', 'clk', 'miso', 'mosi', 'trig', 'echo', 'dout', 'sck',
  'pin_white', 'pin_yellow', 'pin_interrupt',
] as const;

export type PinShare = 'onewire' | 'spi';

// What a field needs from its pin beyond plain digital I/O.
export interface PinNeeds {
  analog?: boolean; // analogRead()
  pullup?: boolean; // relies on the internal pull-up
  irq?: boolean; // attachInterrupt()
}

// Needs per config key of an item config (mirrors the flags collectPins() in
// PinMap.h sets).
function needsOf(cfg: Record<string, unknown>): Record<string, PinNeeds> {
  switch (cfg.type) {
    case 'AnalogInput': return { pin: { analog: true } };
    case 'YF-S201': return { pin: { pullup: true, irq: true } };
    case 'DigitalInput': return { pin: { pullup: cfg.pullup === true } };
    case 'HCSR04': return { echo: { irq: true } };
    case 'IDS1':
    case 'IDS2': return { pin_interrupt: { pullup: true, irq: true } };
    default: return {};
  }
}

// Reasons a pin cannot serve an analog input (same texts as the firmware).
function adcError(info: PinsInfo, p: PinInfo): string | null {
  if (!p.adc) return 'kein ADC-Pin';
  if (p.adc === 2 && info.caps.adc2Wifi === 'blocked') return 'ADC2 – bei WLAN nicht nutzbar';
  return null;
}

// Warnings for a pin that works, but not reliably for these needs.
function weakPoints(info: PinsInfo, p: PinInfo, needs: PinNeeds): string[] {
  const out: string[] = [];
  if (p.class === 'risky' && p.note) out.push(p.note);
  if (needs.analog && p.adc === 2 && info.caps.adc2Wifi === 'shared') {
    out.push('ADC2 – Messung kann bei WLAN-Verkehr ausfallen');
  }
  if (needs.pullup && p.noPullup) out.push('kein interner Pull-up – externen Widerstand vorsehen');
  if (needs.irq && p.irqGlitch) out.push('Fehlauslöser möglich (ESP32-Errata)');
  return out;
}

export interface PinStatus {
  level: 'ok' | 'warn' | 'error';
  text: string;
}

// Status of one GPIO for a form field. selfId: the item being edited, whose
// own pins count as free. output: the field drives the pin. share: the field
// may join other users of the same bus kind (DS18B20 OneWire, MAX31865 SPI).
export function pinStatus(
  info: PinsInfo, gpio: number,
  opts: { selfId?: string; output?: boolean; share?: PinShare } & PinNeeds = {},
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
  const adc = opts.analog ? adcError(info, p) : null;
  if (adc) return { level: 'error', text: adc };
  const weak = weakPoints(info, p, opts);
  if (weak.length) return { level: 'warn', text: `bedenklich: ${weak.join('; ')}` };
  if (others.length) return { level: 'ok', text: `gemeinsamer Bus mit ${others.map((u) => u.id).join(', ')}` };
  return { level: 'ok', text: 'frei' };
}

// "GPIO n: reason" for every risky pin and every weak capability in an item
// config — the user has to confirm these before saving.
export function riskyPins(info: PinsInfo | null, cfg: Record<string, unknown>): string[] {
  if (!info) return [];
  const needs = needsOf(cfg);
  const out: string[] = [];
  for (const key of PIN_KEYS) {
    const v = cfg[key];
    if (typeof v !== 'number') continue;
    const p = info.pins.find((x) => x.gpio === v);
    if (!p) continue;
    for (const reason of weakPoints(info, p, needs[key] ?? {})) {
      const line = `GPIO ${v}: ${reason}`;
      if (!out.includes(line)) out.push(line);
    }
  }
  return out;
}
