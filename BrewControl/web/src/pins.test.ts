import { describe, it, expect } from 'vitest';
import {
  availableCaps, channelStatus, dacOutputs, gpioChannels, isChannelRef, pinStatus, riskyPins, suggestPins,
} from './pins';
import type { PinsInfo } from './types';

const info: PinsInfo = {
  board: 'test',
  caps: { dac: false, rmtTx: 4, rmtUsed: 1, adc2Wifi: 'shared' },
  pins: [
    { gpio: 1, class: 'free', users: [{ id: 'onewire-1', key: 'pin', bus: true }] },
    { gpio: 2, class: 'free', users: [{ id: 'pump', key: 'pin' }] },
    { gpio: 3, class: 'risky', note: 'Strapping-Pin', rtc: true, users: [] },
    { gpio: 7, class: 'reserved', note: 'I2C SDA', users: [] },
    { gpio: 5, class: 'free', adc: 1, users: [] },
    { gpio: 8, class: 'free', users: [] },
    { gpio: 18, class: 'free', adc: 2, users: [] },
    { gpio: 30, class: 'forbidden', note: 'Flash', users: [] },
    { gpio: 34, class: 'free', inputOnly: true, noPullup: true, rtc: true, users: [] },
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

  it('names a bus as the owner of its lines', () => {
    expect(pinStatus(info, 1)).toEqual({ level: 'error', text: 'belegt von Bus onewire-1 (pin)' });
    // Editing the bus itself: its own line is free.
    expect(pinStatus(info, 1, { selfId: 'onewire-1' }).level).toBe('ok');
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

describe('wake pin', () => {
  it('needs an RTC GPIO and warns about a missing pull-up', () => {
    expect(pinStatus(info, 8, { rtc: true }))
      .toEqual({ level: 'error', text: 'kein RTC-Pin – kann nicht wecken' });
    expect(pinStatus(info, 34, { rtc: true }).level).toBe('ok');
    expect(pinStatus(info, 34, { rtc: true, pullup: true }).level).toBe('warn');
    expect(suggestPins(info, { rtc: true }).map((x) => x.gpio)).toEqual([34, 3]);
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

  it('covers the lines of a bus definition', () => {
    expect(riskyPins(info, { type: 'i2c', sda: 3, scl: 8 })).toEqual(['GPIO 3: Strapping-Pin']);
  });

  it('is empty without pin data', () => {
    expect(riskyPins(null, { pin: 3 })).toEqual([]);
  });
});

describe('suggestPins', () => {
  it('suggests only ADC pins for an analog field, free ones before risky', () => {
    const s = suggestPins(info, { analog: true });
    expect(s.map((x) => x.gpio)).toEqual([5, 36, 18]);
    expect(s.map((x) => x.level)).toEqual(['ok', 'ok', 'warn']);
  });

  it('excludes input-only pins for an output field', () => {
    const s = suggestPins(info, { output: true });
    expect(s.map((x) => x.gpio)).not.toContain(34);
    expect(s.map((x) => x.gpio)).not.toContain(36);
    expect(s.map((x) => x.gpio)).toEqual([5, 8, 18, 3]);
  });

  it('never suggests a bus line or another item\'s pin', () => {
    const s = suggestPins(info);
    expect(s.map((x) => x.gpio)).not.toContain(1);
    expect(s.map((x) => x.gpio)).not.toContain(2);
  });

  it('treats the edited item\'s own pin as suggestible', () => {
    const s = suggestPins(info, { selfId: 'pump' });
    expect(s.map((x) => x.gpio)).toContain(2);
  });

  it('drops pins a sibling field of the same item already picked', () => {
    const s = suggestPins(info, { output: true, exclude: [5, 8] });
    expect(s.map((x) => x.gpio)).not.toContain(5);
    expect(s.map((x) => x.gpio)).not.toContain(8);
  });

  it('is empty without pin data', () => {
    expect(suggestPins(null)).toEqual([]);
  });
});

describe('DAC outputs', () => {
  const dacBoard: PinsInfo = {
    ...info,
    caps: { ...info.caps, dac: true },
    pins: [
      { gpio: 25, class: 'free', dac: true, users: [{ id: 'valve', key: 'pin' }] },
      { gpio: 26, class: 'free', dac: true, users: [] },
      { gpio: 27, class: 'free', users: [] },
    ],
  };
  const device = (users: { id: string; key: string }[][]): PinsInfo => ({
    ...info,
    virtual: users.map((u, i) => ({
      ref: `mcp4728-i2c-board-60:${i}`, device: 'mcp4728-i2c-board-60', deviceLabel: 'DAC Kessel',
      index: i, label: 'ABCD'[i], dac: true, users: u,
    })),
  });

  it('offers DAC from the board or from a device channel', () => {
    expect(availableCaps(null).has('dac')).toBe(false);
    expect(availableCaps(info).has('dac')).toBe(false);
    expect(availableCaps(dacBoard).has('dac')).toBe(true);
    expect(availableCaps(device([[]])).has('dac')).toBe(true);
    expect(availableCaps({ ...info, virtual: [] }).has('dac')).toBe(false);
  });

  it('lists board DAC pins, then device channels, taken ones with their owner', () => {
    expect(dacOutputs(dacBoard)).toEqual([
      { value: '25', label: 'GPIO 25 (Board-DAC)', taken: 'belegt von valve (pin)' },
      { value: '26', label: 'GPIO 26 (Board-DAC)', taken: undefined },
    ]);
    expect(dacOutputs(device([[], [{ id: 'pump', key: 'pin' }]]))).toEqual([
      { value: 'mcp4728-i2c-board-60:0', label: 'DAC Kessel · Kanal A', taken: undefined },
      { value: 'mcp4728-i2c-board-60:1', label: 'DAC Kessel · Kanal B', taken: 'belegt von pump (pin)' },
    ]);
  });

  it('treats the edited item\'s own output as free', () => {
    expect(dacOutputs(dacBoard, 'valve')[0].taken).toBeUndefined();
    expect(dacOutputs(device([[{ id: 'pump', key: 'pin' }]]), 'pump')[0].taken).toBeUndefined();
  });

  it('falls back to the device id without a label', () => {
    const v = device([[]]);
    delete v.virtual![0].deviceLabel;
    expect(dacOutputs(v)[0].label).toBe('mcp4728-i2c-board-60 · Kanal A');
  });
});

describe('port-expander pins', () => {
  const names = ['P00', 'P01', 'P02', 'P03'];
  const expander = (users: { id: string; key: string }[][]): PinsInfo => ({
    ...info,
    virtual: [
      {
        ref: 'mcp4728-i2c-board-60:0', device: 'mcp4728-i2c-board-60', index: 0, label: 'A',
        dac: true, users: [],
      },
      ...users.map((u, i) => ({
        ref: `pcf8575-i2c-board-20:${i}`, device: 'pcf8575-i2c-board-20', deviceLabel: 'IO',
        index: i, label: names[i], gpio: true, users: u,
      })),
    ],
  });

  it('offers gpio only when an expander exists', () => {
    expect(availableCaps(info).has('gpio')).toBe(false);
    expect(availableCaps(expander([])).has('gpio')).toBe(false);  // only the DAC
    expect(availableCaps(expander([[]])).has('gpio')).toBe(true);
  });

  it('lists expander pins only, taken ones with their owner', () => {
    const opts = gpioChannels(expander([[{ id: 'pump', key: 'pin' }], [], []]));
    expect(opts.map((o) => o.value)).toEqual([
      'pcf8575-i2c-board-20:0', 'pcf8575-i2c-board-20:1', 'pcf8575-i2c-board-20:2',
    ]);
    expect(opts[1].label).toBe('IO · P01');
    expect(opts[0].taken).toBe('belegt von pump (pin)');
    expect(gpioChannels(expander([[{ id: 'pump', key: 'pin' }]]), 'pump')[0].taken).toBeUndefined();
    expect(gpioChannels(null)).toEqual([]);
  });

  it('reports the status of a channel ref', () => {
    const v = expander([[{ id: 'pump', key: 'pin' }], []]);
    expect(channelStatus(v, 'pcf8575-i2c-board-20:1')).toEqual({ level: 'ok', text: 'frei – IO · P01' });
    expect(channelStatus(v, 'pcf8575-i2c-board-20:0').text).toBe('belegt von pump (pin)');
    expect(channelStatus(v, 'pcf8575-i2c-board-20:0', 'pump').level).toBe('ok');
    expect(channelStatus(v, 'pcf8575-i2c-board-21:0').level).toBe('error');
  });

  it('tells refs from GPIO numbers and leaves refs out of the risky-pin check', () => {
    expect(isChannelRef('pcf8575-i2c-board-20:3')).toBe(true);
    expect(isChannelRef('3')).toBe(false);
    expect(riskyPins(info, { type: 'DigitalOutput', pin: 'pcf8575-i2c-board-20:3' })).toEqual([]);
  });
});
