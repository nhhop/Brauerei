// Client-side view of GET /api/pins for the item form. The firmware checks
// every create/replace itself (PinMap.h) — this only gives early hints and the
// "risky pin" confirmation, which the firmware deliberately does not enforce.
import type { PinInfo, PinsInfo, PinUser } from './types';

// Config keys that hold a GPIO number in an item config (mirrors collectPins()
// in PinMap.h) or a bus definition (BusConfig.h).
const PIN_KEYS = [
  'pin', 'cs', 'trig', 'echo', 'dout', 'sck',
  'pin_white', 'pin_yellow', 'pin_interrupt',
  'clk', 'miso', 'mosi', 'sda', 'scl',
] as const;

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

// "pump (pin)" or "Bus i2c-4-5 (sda)".
export function pinUserText(u: PinUser): string {
  return `${u.bus ? `Bus ${u.id}` : u.id} (${u.key})`;
}

// Status of one GPIO for a form field. selfId: the item or bus being edited,
// whose own pins count as free. output: the field drives the pin. Every pin
// has one user — items share bus lines by referencing the bus, not the pins.
export function pinStatus(
  info: PinsInfo, gpio: number,
  opts: { selfId?: string; output?: boolean } & PinNeeds = {},
): PinStatus {
  const p = info.pins.find((x) => x.gpio === gpio);
  if (!p) return { level: 'error', text: `GPIO ${gpio} gibt es auf diesem Board nicht` };
  if (p.class === 'forbidden') return { level: 'error', text: `nicht nutzbar (${p.note})` };
  if (p.class === 'reserved') return { level: 'error', text: `vom Board belegt (${p.note})` };
  if (opts.output && p.inputOnly) return { level: 'error', text: 'nur als Eingang nutzbar' };
  const others = p.users.filter((u) => u.id !== opts.selfId);
  if (others.length) return { level: 'error', text: `belegt von ${others.map(pinUserText).join(', ')}` };
  const adc = opts.analog ? adcError(info, p) : null;
  if (adc) return { level: 'error', text: adc };
  const weak = weakPoints(info, p, opts);
  if (weak.length) return { level: 'warn', text: `bedenklich: ${weak.join('; ')}` };
  return { level: 'ok', text: 'frei' };
}

export interface PinSuggestion {
  gpio: number;
  level: 'ok' | 'warn';
}

// Usable pins, best first: free pins, then risky-but-usable ones — everything
// pinStatus rejects (board class, wrong direction, taken, no ADC, …) is left
// out. exclude drops pins another field of the same item already picked, so
// e.g. HC-SR04's trig and echo never suggest each other's pin.
export function suggestPins(
  info: PinsInfo | null,
  opts: { selfId?: string; output?: boolean; exclude?: number[] } & PinNeeds = {},
): PinSuggestion[] {
  if (!info) return [];
  const exclude = new Set(opts.exclude ?? []);
  const out: PinSuggestion[] = [];
  for (const p of info.pins) {
    if (exclude.has(p.gpio)) continue;
    const s = pinStatus(info, p.gpio, opts);
    if (s.level === 'error') continue;
    out.push({ gpio: p.gpio, level: s.level === 'warn' ? 'warn' : 'ok' });
  }
  out.sort((a, b) => (Number(a.level === 'warn') - Number(b.level === 'warn')) || a.gpio - b.gpio);
  return out;
}

// "GPIO n: reason" for every risky pin and every weak capability in an item
// config or bus definition — the user has to confirm these before saving.
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
