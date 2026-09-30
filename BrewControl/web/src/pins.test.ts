import { describe, it, expect } from 'vitest';
import { pinStatus, riskyPins, suggestPins } from './pins';
import type { PinsInfo } from './types';

const info: PinsInfo = {
  board: 'test',
  caps: { dac: false, rmtTx: 4, rmtUsed: 1, adc2Wifi: 'shared' },
  pins: [
    { gpio: 1, class: 'free', users: [{ id: 't1', key: 'pin', share: 'onewire' }] },
    { gpio: 2, class: 'free', users: [{ id: 'pump', key: 'pin' }] },
    { gpio: 3, class: 'risky', note: 'Strapping-Pin', users: [] },
    { gpio: 7, class: 'reserved', note: 'I2C SDA', users: [] },
    { gpio: 5, class: 'free', adc: 1, users: [] },
    { gpio: 8, class: 'free', users: [] },
    { gpio: 18, class: 'free', adc: 2, users: [] },
    { gpio: 30, class: 'forbidden', note: 'Flash', users: [] },
    { gpio: 34, class: 'free', inputOnly: true, noPullup: true, users: [] },
    { gpio: 36, class: 'free', inputOnly: true, noPullup: true, irqGlitch: true, adc: 1, users: [] },
  ],
  conflicts: [],
};

describe('pinStatus', () => {
  it('reports free, risky, reserved, forbidden and missing pins', () => {
    expect(pinStatus(info, 8)).toEqual({ level: 'ok', text: 'frei' });
    expect(pinStatus(info, 3).level).toBe('warn');
    expect(pinStatus(info, 7).text).toContain('I2C SDA');
    expect(pinStatus(info, 30).level).toBe('error');
    expect(pinStatus(info, 22).text).toContain('gibt es auf diesem Board nicht');
  });

  it('names the owner of a taken pin', () => {
    const s = pinStatus(info, 2);
    expect(s.level).toBe('error');
    expect(s.text).toContain('pump');
  });

  it('treats the edited item\'s own pin as free', () => {
    expect(pinStatus(info, 2, { selfId: 'pump' }).level).toBe('ok');
  });

  it('lets a DS18B20 join an existing OneWire bus, but nothing else', () => {
    expect(pinStatus(info, 1, { share: 'onewire' }).text).toContain('gemeinsamer Bus');
    expect(pinStatus(info, 1).level).toBe('error');
    expect(pinStatus(info, 1, { share: 'spi' }).level).toBe('error');
  });

  it('rejects outputs on input-only pins', () => {
    expect(pinStatus(info, 34).level).toBe('ok');
    expect(pinStatus(info, 34, { output: true }).level).toBe('error');
  });
});

describe('pin capabilities', () => {
  it('requires an ADC for analog inputs', () => {
    expect(pinStatus(info, 5, { analog: true })).toEqual({ level: 'ok', text: 'frei' });
    expect(pinStatus(info, 8, { analog: true })).toEqual({ level: 'error', text: 'kein ADC-Pin' });
    expect(pinStatus(info, 8).level).toBe('ok');
  });

  it('warns about ADC2 when shared with Wi-Fi and rejects it when blocked', () => {
    expect(pinStatus(info, 18, { analog: true }).level).toBe('warn');
    const blocked: PinsInfo = { ...info, caps: { ...info.caps, adc2Wifi: 'blocked' } };
    expect(pinStatus(blocked, 18, { analog: true }))
      .toEqual({ level: 'error', text: 'ADC2 – bei WLAN nicht nutzbar' });
  });

  it('warns about missing pull-ups and interrupt glitches only when needed', () => {
    expect(pinStatus(info, 34).level).toBe('ok');
    expect(pinStatus(info, 34, { pullup: true }).text).toContain('kein interner Pull-up');
    const s = pinStatus(info, 36, { pullup: true, irq: true });
    expect(s.level).toBe('warn');
    expect(s.text).toContain('Fehlauslöser');
  });
});

describe('riskyPins', () => {
  it('lists weak capabilities per type', () => {
    expect(riskyPins(info, { type: 'YF-S201', pin: 36 })).toEqual([
      'GPIO 36: kein interner Pull-up – externen Widerstand vorsehen',
      'GPIO 36: Fehlauslöser möglich (ESP32-Errata)',
    ]);
    expect(riskyPins(info, { type: 'DigitalInput', pin: 34, pullup: false })).toEqual([]);
    expect(riskyPins(info, { type: 'DigitalInput', pin: 34, pullup: true })).toHaveLength(1);
    expect(riskyPins(info, { type: 'AnalogInput', pin: 18 }))
      .toEqual(['GPIO 18: ADC2 – Messung kann bei WLAN-Verkehr ausfallen']);
    expect(riskyPins(info, { type: 'Voltage', pin: 18, r1: 100, r2: 100 }))
      .toEqual(['GPIO 18: ADC2 – Messung kann bei WLAN-Verkehr ausfallen']);
    expect(riskyPins(info, { type: 'DigitalInput', pin: 18 })).toEqual([]);
  });


  it('lists every risky pin in a config once', () => {
    expect(riskyPins(info, { type: 'HCSR04', trig: 3, echo: 8 })).toEqual(['GPIO 3: Strapping-Pin']);
    expect(riskyPins(info, { type: 'DigitalOutput', pin: 8 })).toEqual([]);
  });

  it('is empty without pin data', () => {
    expect(riskyPins(null, { pin: 3 })).toEqual([]);
  });
});

describe('suggestPins', () => {
  it('suggests only ADC pins for an analog field, free ones before risky', () => {
    const s = suggestPins(info, 'pin', { analog: true });
    expect(s.map((x) => x.gpio)).toEqual([5, 36, 18]);
    expect(s.map((x) => x.level)).toEqual(['ok', 'ok', 'warn']);
    expect(s.every((x) => !x.bus)).toBe(true);
  });

  it('excludes input-only pins for an output field', () => {
    const s = suggestPins(info, 'pin', { output: true });
    expect(s.map((x) => x.gpio)).not.toContain(34);
    expect(s.map((x) => x.gpio)).not.toContain(36);
    expect(s.map((x) => x.gpio)).toEqual([5, 8, 18, 3]);
  });

  it('puts an existing OneWire bus pin first, ahead of plain free pins', () => {
    const s = suggestPins(info, 'pin', { share: 'onewire' });
    expect(s[0]).toEqual({ gpio: 1, level: 'ok', bus: true });
    expect(s.map((x) => x.gpio)).not.toContain(2); // taken, not a compatible bus
  });

  it('treats the edited item\'s own pin as suggestible', () => {
    const s = suggestPins(info, 'pin', { selfId: 'pump' });
    expect(s.map((x) => x.gpio)).toContain(2);
  });

  it('drops pins a sibling field of the same item already picked', () => {
    const s = suggestPins(info, 'pin', { output: true, exclude: [5, 8] });
    expect(s.map((x) => x.gpio)).not.toContain(5);
    expect(s.map((x) => x.gpio)).not.toContain(8);
  });

  it('is empty without pin data', () => {
    expect(suggestPins(null, 'pin')).toEqual([]);
  });
});
