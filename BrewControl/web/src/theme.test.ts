import { describe, it, expect } from 'vitest';
import { hueChroma, gradientCss, DEFAULT_GRADIENT } from './theme';

describe('hueChroma', () => {
  it('matches the OKLCH reference values for pure red', () => {
    const { h, c } = hueChroma('#ff0000');
    expect(h).toBeCloseTo(29.2, 0);
    expect(c).toBeCloseTo(0.2577, 3);
  });

  it('gives grays (almost) no chroma', () => {
    expect(hueChroma('#808080').c).toBeLessThan(0.001);
  });
});

describe('DEFAULT_GRADIENT', () => {
  it('carries only the settings fields (it is posted to the device as is)', () => {
    expect(Object.keys(DEFAULT_GRADIENT).sort()).toEqual(['angle', 'enabled', 'from', 'intensity', 'to', 'via']);
  });
});

describe('gradientCss', () => {
  it('emits three stops at 0/50/100 % in the given direction', () => {
    const css = gradientCss({ ...DEFAULT_GRADIENT, angle: 90 });
    expect(css.startsWith('linear-gradient(90deg, ')).toBe(true);
    expect(css.match(/oklch\(from var\(--bg\) l /g)).toHaveLength(3);
    expect(css).toMatch(/ 0%, .* 50%, .* 100%\)$/);
  });

  it('scales chroma with the intensity and drops it to zero at 0', () => {
    const at = (intensity: number) => gradientCss({ ...DEFAULT_GRADIENT, intensity });
    expect(at(0)).not.toMatch(/ l 0\.0[1-9]/);
    expect(at(0).match(/ l 0\.0000 /g)).toHaveLength(3);
    const c15 = Number(at(15).match(/ l (\d\.\d+) /)![1]);
    const c30 = Number(at(30).match(/ l (\d\.\d+) /)![1]);
    expect(c30).toBeCloseTo(c15 * 2, 3);
  });
});
