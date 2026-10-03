import type { Sensor } from './types';

// Where the bubble of the GY-521 spirit level sits in its glass. Mirrors
// levelBubble() in firmware/src/LevelBubble.h - change both together.
//
// The bubble moves towards the high side. In the unit disc x is right and y is
// up: roll > 0 (the chip's Y side up) puts the bubble right, pitch > 0 (its
// -X side up: pitch is atan2(-ax, ...)) puts it up. dirDeg is the same
// bearing, clockwise from the top, as the GY521TiltSensor "dir" channel:
// atan2(roll, pitch).
//
// Two scales in the round glass: the first LEVEL_INNER_DEG of tilt fill the
// inner LEVEL_INNER_FRAC of the radius (the range that matters for levelling),
// the rest up to LEVEL_OUTER_DEG is squeezed into the outer ring, so the bubble
// keeps moving instead of sticking to the rim. From LEVEL_STRAIGHT_ON_DEG on
// the dominant axis (a device standing on an edge) the card switches to a
// straight level for the other axis, back below LEVEL_STRAIGHT_OFF_DEG.
export const LEVEL_INNER_DEG = 15;        // tilt at the end of the fine scale
export const LEVEL_INNER_FRAC = 0.6;      // ...which is this share of the radius
export const LEVEL_OUTER_DEG = 45;        // tilt at the rim
export const LEVEL_STRAIGHT_ON_DEG = 45;
export const LEVEL_STRAIGHT_OFF_DEG = 43; // hysteresis: no flicker around 45
export const LEVEL_TOLERANCE_DEG = 1;     // "level" within this
export const LEVEL_DIR_MIN_DEG = 0.5;     // below this the direction is noise

export interface LevelBubble {
  valid: boolean;       // roll and pitch are finite
  x: number;
  y: number;
  magnitudeDeg: number; // hypot(roll, pitch)
  dirDeg: number | null; // 0..360, null while undefined
  atRim: boolean;       // tilt beyond LEVEL_OUTER_DEG
  level: boolean;       // within LEVEL_TOLERANCE_DEG
}

// Distance from the centre (0..1) for a tilt, on the two-part scale.
function bubbleRadius(magnitudeDeg: number): number {
  if (magnitudeDeg <= LEVEL_INNER_DEG) return LEVEL_INNER_FRAC * magnitudeDeg / LEVEL_INNER_DEG;
  if (magnitudeDeg >= LEVEL_OUTER_DEG) return 1;
  return LEVEL_INNER_FRAC
    + (1 - LEVEL_INNER_FRAC) * (magnitudeDeg - LEVEL_INNER_DEG) / (LEVEL_OUTER_DEG - LEVEL_INNER_DEG);
}

export function levelBubble(rollDeg: number, pitchDeg: number): LevelBubble {
  const b: LevelBubble = { valid: false, x: 0, y: 0, magnitudeDeg: 0, dirDeg: null, atRim: false, level: false };
  if (!isFinite(rollDeg) || !isFinite(pitchDeg)) return b;
  b.valid = true;
  b.magnitudeDeg = Math.hypot(rollDeg, pitchDeg);
  b.level = b.magnitudeDeg <= LEVEL_TOLERANCE_DEG;
  // Radial: the bubble keeps the direction of the lean whatever the scale.
  b.atRim = b.magnitudeDeg > LEVEL_OUTER_DEG;
  if (b.magnitudeDeg > 0) {
    const k = bubbleRadius(b.magnitudeDeg) / b.magnitudeDeg;
    b.x = rollDeg * k;
    b.y = pitchDeg * k;
  }
  if (b.magnitudeDeg >= LEVEL_DIR_MIN_DEG) {
    const dir = Math.atan2(rollDeg, pitchDeg) * 180 / Math.PI;
    b.dirDeg = dir < 0 ? dir + 360 : dir;
  }
  return b;
}

// The straight level of a device standing on an edge. The dominant axis is the
// one the device stands on; what is left to level is the *other* one, so that
// is the axis shown: Roll on a horizontal tube when Nick dominates, Nick on an
// upright tube (up is positive) when Roll does. The bubble goes right resp. up
// for a positive angle, on the same two-part scale as the round glass
// (x = -1..1 is -45..45 degrees). `level` is within the tolerance of 0;
// `upright` says the dominant axis is within it of 90.
export interface LevelStraight {
  valid: boolean;
  axis: 'pitch' | 'roll'; // the axis shown: the smaller of the two, pitch on a tie
  valueDeg: number;
  x: number;
  level: boolean;
  upright: boolean;
}

export function levelStraight(rollDeg: number, pitchDeg: number): LevelStraight {
  const s: LevelStraight = { valid: false, axis: 'pitch', valueDeg: 0, x: 0, level: false, upright: false };
  if (!isFinite(rollDeg) || !isFinite(pitchDeg)) return s;
  s.valid = true;
  const pitchDominant = Math.abs(pitchDeg) > Math.abs(rollDeg);
  s.axis = pitchDominant ? 'roll' : 'pitch';
  s.valueDeg = pitchDominant ? rollDeg : pitchDeg;
  s.x = Math.sign(s.valueDeg) * bubbleRadius(Math.abs(s.valueDeg));
  s.level = Math.abs(s.valueDeg) <= LEVEL_TOLERANCE_DEG;
  s.upright = Math.max(Math.abs(rollDeg), Math.abs(pitchDeg)) >= 90 - LEVEL_TOLERANCE_DEG;
  return s;
}

// Round or straight, with a hysteresis around the switch. Unreadable angles
// keep the previous mode.
export function levelStraightMode(wasStraight: boolean, rollDeg: number, pitchDeg: number): boolean {
  if (!isFinite(rollDeg) || !isFinite(pitchDeg)) return wasStraight;
  const dominant = Math.max(Math.abs(rollDeg), Math.abs(pitchDeg));
  return wasStraight ? dominant >= LEVEL_STRAIGHT_OFF_DEG : dominant >= LEVEL_STRAIGHT_ON_DEG;
}

// The snapshot rows of a sensor card that make it a spirit level: pitch and
// roll together. `rest` is everything else on the card (tilt, dir, temp, ...).
// null when either is missing - the card then stays a plain channel list.
export interface LevelChannels { pitch: Sensor; roll: Sensor; rest: Sensor[] }

export function channelKey(s: Sensor): string {
  return s.id.slice(s.id.lastIndexOf('.') + 1);
}

export function levelChannels(channels: Sensor[]): LevelChannels | null {
  const pitch = channels.find((s) => channelKey(s) === 'pitch');
  const roll = channels.find((s) => channelKey(s) === 'roll');
  if (!pitch || !roll) return null;
  return { pitch, roll, rest: channels.filter((s) => s !== pitch && s !== roll) };
}
