import { describe, expect, it } from 'vitest';
import { levelBubble, levelChannels, levelStraight, levelStraightMode } from './levelBubble';
import type { Sensor } from './types';

function ch(id: string): Sensor {
  return {
    id,
    meta: { kind: 'Continuous', quantity: 'Custom', unit: '°', min: -90, max: 90, res: 0.1 },
    state: { v: 0, t: 0, ok: true },
  };
}

describe('levelBubble', () => {
  it('sits in the middle when level', () => {
    const b = levelBubble(0, 0);
    expect(b).toMatchObject({ valid: true, x: 0, y: 0, level: true, atRim: false, dirDeg: null });
  });

  it('goes to the high side: Y up (roll > 0) -> right, -X up (pitch > 0) -> up', () => {
    const r = levelBubble(7.5, 0); // half of the fine scale: 0.3 of the radius
    expect(r.x).toBeCloseTo(0.3);
    expect(r.y).toBeCloseTo(0);
    const u = levelBubble(0, 7.5);
    expect(u.x).toBeCloseTo(0);
    expect(u.y).toBeCloseTo(0.3);
  });

  it('the fine scale ends at 60 % of the radius, the rim is 45 degrees', () => {
    expect(levelBubble(15, 0).x).toBeCloseTo(0.6);
    expect(levelBubble(30, 0).x).toBeCloseTo(0.8); // halfway through the outer part
    const rim = levelBubble(45, 0);
    expect(rim.x).toBeCloseTo(1);
    expect(rim.atRim).toBe(false); // exactly at the rim is not beyond it
  });

  it('keeps moving between 15 and 45 degrees instead of sticking', () => {
    const xs = [15, 20, 25, 30, 35, 40, 45].map((a) => levelBubble(a, 0).x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('clamps radially beyond the rim, not per axis', () => {
    const b = levelBubble(50, 50);
    expect(b.atRim).toBe(true);
    expect(Math.hypot(b.x, b.y)).toBeCloseTo(1);
    expect(b.x).toBeCloseTo(b.y);
  });

  it('reports the bearing clockwise from the top', () => {
    expect(levelBubble(0, 5).dirDeg).toBeCloseTo(0);     // -X up
    expect(levelBubble(5, 0).dirDeg).toBeCloseTo(90);    // Y up
    expect(levelBubble(0, -5).dirDeg).toBeCloseTo(180);  // X up
    expect(levelBubble(-5, 0).dirDeg).toBeCloseTo(270);  // -Y up
    expect(levelBubble(5, 5).dirDeg).toBeCloseTo(45);
  });

  it('gives the bearing of the bubble position on screen', () => {
    const b = levelBubble(20, 12); // on the squeezed part of the scale too
    let bearing = Math.atan2(b.x, b.y) * 180 / Math.PI;
    if (bearing < 0) bearing += 360;
    expect(b.dirDeg).toBeCloseTo(bearing);
  });

  it('is level within 1 degree and has no direction below 0.5', () => {
    expect(levelBubble(1, 0).level).toBe(true);
    expect(levelBubble(1.01, 0).level).toBe(false);
    expect(levelBubble(0.49, 0).dirDeg).toBeNull();
    expect(levelBubble(0.5, 0).dirDeg).not.toBeNull();
  });

  it('is invalid for non-finite input', () => {
    expect(levelBubble(NaN, 0).valid).toBe(false);
    expect(levelBubble(0, Infinity).valid).toBe(false);
  });
});

describe('levelStraight', () => {
  it('shows the axis that is not dominant, pitch on a tie', () => {
    // Standing on the X edge (Nick dominates): Roll is left to level.
    expect(levelStraight(10, 60)).toMatchObject({ axis: 'roll', valueDeg: 10 });
    // Standing on the Y edge (Roll dominates): Nick is left to level.
    expect(levelStraight(-70, 20)).toMatchObject({ axis: 'pitch', valueDeg: 20 });
    expect(levelStraight(30, 30).axis).toBe('pitch');
  });

  it('uses the fine scale of the round glass, bubble right/up for a positive angle', () => {
    expect(levelStraight(7.5, 80).x).toBeCloseTo(0.3);
    expect(levelStraight(15, 80).x).toBeCloseTo(0.6);
    expect(levelStraight(-30, 80).x).toBeCloseTo(-0.8);
    expect(levelStraight(80, 45).x).toBeCloseTo(1);
    expect(levelStraight(0, 80).x).toBeCloseTo(0);
  });

  it('is level within 1 degree of the shown axis', () => {
    expect(levelStraight(1, 80).level).toBe(true);
    expect(levelStraight(1.01, 80).level).toBe(false);
  });

  it('is upright when the dominant axis is within 1 degree of 90', () => {
    expect(levelStraight(2, 89)).toMatchObject({ upright: true, level: false });
    expect(levelStraight(-89.5, 0).upright).toBe(true);
    expect(levelStraight(2, 88.9).upright).toBe(false);
  });

  it('is invalid for non-finite input', () => {
    expect(levelStraight(NaN, 0).valid).toBe(false);
  });
});

describe('levelStraightMode', () => {
  it('switches at 45 and back at 43 degrees of the dominant axis', () => {
    expect(levelStraightMode(false, 44.9, 0)).toBe(false);
    expect(levelStraightMode(false, 0, -45)).toBe(true);
    expect(levelStraightMode(true, 44, 10)).toBe(true);   // hysteresis
    expect(levelStraightMode(true, 42.9, 10)).toBe(false);
  });

  it('is not a matter of the combined tilt', () => {
    expect(levelStraightMode(false, 30, 30)).toBe(false); // hypot 42, both axes below 45
  });

  it('keeps the mode while the angles are unreadable', () => {
    expect(levelStraightMode(true, NaN, 0)).toBe(true);
    expect(levelStraightMode(false, 0, NaN)).toBe(false);
  });
});

describe('levelChannels', () => {
  it('needs pitch and roll', () => {
    expect(levelChannels([ch('gyro.pitch')])).toBeNull();
    expect(levelChannels([ch('gyro.roll'), ch('gyro.tilt')])).toBeNull();
  });

  it('splits pitch and roll from the rest, in snapshot order', () => {
    const l = levelChannels([ch('gyro.pitch'), ch('gyro.roll'), ch('gyro.tilt'), ch('gyro.dir')]);
    expect(l?.pitch.id).toBe('gyro.pitch');
    expect(l?.roll.id).toBe('gyro.roll');
    expect(l?.rest.map((s) => s.id)).toEqual(['gyro.tilt', 'gyro.dir']);
  });

  it('is not fooled by a dot in the sensor id', () => {
    expect(levelChannels([ch('a.b.pitch'), ch('a.b.roll')])).not.toBeNull();
  });
});
