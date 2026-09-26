import { describe, it, expect } from 'vitest';
import { pinStatus, riskyPins } from './pins';
import type { PinsInfo } from './types';

const info: PinsInfo = {
  board: 'test',
  caps: { dac: false, rmtTx: 4, rmtUsed: 1 },
  pins: [
    { gpio: 1, class: 'free', users: [{ id: 't1', key: 'pin', share: 'onewire' }] },
    { gpio: 2, class: 'free', users: [{ id: 'pump', key: 'pin' }] },
    { gpio: 3, class: 'risky', note: 'Strapping-Pin', users: [] },
    { gpio: 7, class: 'reserved', note: 'I2C SDA', users: [] },
    { gpio: 8, class: 'free', users: [] },
    { gpio: 30, class: 'forbidden', note: 'Flash', users: [] },
    { gpio: 34, class: 'free', inputOnly: true, users: [] },
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

describe('riskyPins', () => {
  it('lists every risky pin in a config once', () => {
    expect(riskyPins(info, { type: 'HCSR04', trig: 3, echo: 8 })).toEqual(['GPIO 3: Strapping-Pin']);
    expect(riskyPins(info, { type: 'DigitalOutput', pin: 8 })).toEqual([]);
  });

  it('is empty without pin data', () => {
    expect(riskyPins(null, { pin: 3 })).toEqual([]);
  });
});
