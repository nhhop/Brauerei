import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addReading, entryToReading, fitsLimit, getReadings, lastGravity, readingPlato, readingText, removeReading, saveReadings, type BrewReadings,
} from './brewReadings';
import { apparentExtractFromRefractometer } from './brewMath';

const doc = (...at: number[]): BrewReadings => ({
  id: 'b1', readings: at.map((t) => ({ at: t, kind: 'gravity' as const, v: 10 })),
});

describe('readings list', () => {
  it('keeps the readings in time order whatever order they are added in', () => {
    const d = addReading(addReading(doc(10, 30), { at: 20, kind: 'temp', v: 18 }), { at: 5, kind: 'ph', v: 4.5 });
    expect(d.readings.map((r) => r.at)).toEqual([5, 10, 20, 30]);
  });

  it('does not change the document it is given', () => {
    const d = doc(1, 2);
    addReading(d, { at: 3, kind: 'temp', v: 1 });
    removeReading(d, 0);
    expect(d.readings).toHaveLength(2);
  });

  it('removes one reading by its place', () => {
    expect(removeReading(doc(1, 2, 3), 1).readings.map((r) => r.at)).toEqual([1, 3]);
  });
});

describe('size limit', () => {
  it('fits the 300 readings the device is meant to take, but not many more', () => {
    const many = (n: number): BrewReadings => ({
      id: 'b1', readings: Array.from({ length: n }, (_, i) => ({ at: 1760000000000 + i, kind: 'gravity' as const, v: 12.345 })),
    });
    expect(fitsLimit(many(300))).toBe(true);
    expect(fitsLimit(many(600))).toBe(false);
  });

  it('counts the bytes of umlauts in a note, not their characters', () => {
    const note = 'ä'.repeat(7600);
    expect(fitsLimit({ id: 'b1', readings: [{ at: 1, kind: 'ph', v: 5, note }] })).toBe(false);
  });
});

describe('readingPlato', () => {
  it('takes a gravity as it is', () => {
    expect(readingPlato({ at: 1, kind: 'gravity', v: 4.2 }, undefined)).toBe(4.2);
  });

  it('turns a refractometer reading into the gravity a hydrometer would show, with the original extract', () => {
    const r = { at: 1, kind: 'brix' as const, v: 8 };
    expect(readingPlato(r, 12)).toBe(apparentExtractFromRefractometer(12, 8));
    expect(readingPlato(r, undefined)).toBeNull();
  });

  it('has no gravity for a temperature or a pH', () => {
    expect(readingPlato({ at: 1, kind: 'temp', v: 18 }, 12)).toBeNull();
    expect(readingPlato({ at: 1, kind: 'ph', v: 4.5 }, 12)).toBeNull();
  });
});

describe('lastGravity', () => {
  const doc = (readings: BrewReadings['readings']): BrewReadings => ({ id: 'b', readings });

  it('takes the newest reading that gives a gravity', () => {
    const d = doc([{ at: 1, kind: 'gravity', v: 6 }, { at: 2, kind: 'gravity', v: 3.456 }, { at: 3, kind: 'temp', v: 20 }, { at: 4, kind: 'ph', v: 4.4 }]);
    expect(lastGravity(d, 12)).toEqual({ plato: 3.46, reading: d.readings[1] });
  });

  it('counts a refractometer reading with the original gravity, and skips it without', () => {
    const d = doc([{ at: 1, kind: 'gravity', v: 6 }, { at: 2, kind: 'brix', v: 8 }]);
    expect(lastGravity(d, 12)!.plato).toBeCloseTo(apparentExtractFromRefractometer(12, 8), 2);
    expect(lastGravity(d, undefined)!.reading.at).toBe(1);
  });

  it('is unset without a reading', () => {
    expect(lastGravity(doc([{ at: 1, kind: 'temp', v: 20 }]), 12)).toBeUndefined();
    expect(lastGravity(null, 12)).toBeUndefined();
  });
});

describe('entryToReading', () => {
  it('keeps a °P as typed, with a decimal comma as well', () => {
    expect(entryToReading('gravity', 'plato', '4,5', 10)).toEqual({ at: 10, kind: 'gravity', v: 4.5 });
  });

  it('turns an SG into °P and keeps a refractometer reading raw', () => {
    const sg = entryToReading('gravity', 'sg', '1.012', 10)!;
    expect(sg.kind).toBe('gravity');
    expect(sg.v).toBeCloseTo(3.1, 1);  // 1.012 SG is about 3,1 °P
    expect(entryToReading('gravity', 'brix', '8.4', 10)).toEqual({ at: 10, kind: 'brix', v: 8.4 });
  });

  it('takes a temperature and a pH, and a trimmed note only when there is one', () => {
    expect(entryToReading('temp', 'plato', '18.5', 1, '  im Keller ')).toEqual({ at: 1, kind: 'temp', v: 18.5, note: 'im Keller' });
    expect(entryToReading('ph', 'plato', '4.45', 1, '  ')).toEqual({ at: 1, kind: 'ph', v: 4.45 });
  });

  it('refuses what is no number or far out of range', () => {
    expect(entryToReading('gravity', 'plato', '', 1)).toBeNull();
    expect(entryToReading('gravity', 'plato', 'abc', 1)).toBeNull();
    expect(entryToReading('gravity', 'sg', '12', 1)).toBeNull();
    expect(entryToReading('ph', 'plato', '15', 1)).toBeNull();
    expect(entryToReading('temp', 'plato', '500', 1)).toBeNull();
  });
});

describe('readingText', () => {
  it('writes each kind with its unit', () => {
    expect(readingText({ at: 1, kind: 'gravity', v: 9.5 }, undefined)).toBe('9,5 °P');
    expect(readingText({ at: 1, kind: 'temp', v: 18 }, undefined)).toBe('18,0 °C');
    expect(readingText({ at: 1, kind: 'ph', v: 4.5 }, undefined)).toBe('4,50');
  });

  it('adds the gravity of a refractometer reading when the original extract is known', () => {
    const r = { at: 1, kind: 'brix' as const, v: 8 };
    expect(readingText(r, undefined)).toBe('8,0 °Bx');
    expect(readingText(r, 12)).toMatch(/^8,0 °Bx \(≙ \d+,\d °P\)$/);
  });
});

describe('store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads a brew without a file as no readings', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await getReadings('b1')).toEqual({ id: 'b1', readings: [] });
  });

  it('copes with a document that has no list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'b1' }))));
    expect(await getReadings('b1')).toEqual({ id: 'b1', readings: [] });
  });

  it('puts the document under the brew', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', f);
    await saveReadings(doc(1));
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect([url, init.method]).toEqual(['/api/brews/b1/readings', 'PUT']);
    expect(JSON.parse(init.body as string)).toEqual(doc(1));
  });

  it('refuses a document the device would not take, without asking it', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const big: BrewReadings = { id: 'b1', readings: [{ at: 1, kind: 'ph', v: 5, note: 'x'.repeat(16000) }] };
    await expect(saveReadings(big)).rejects.toThrow('Zu viele Messungen');
    await expect(saveReadings({ ...doc(1), id: '../x' })).rejects.toThrow('ungültige ID');
    expect(f).not.toHaveBeenCalled();
  });
});
