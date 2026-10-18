import { describe, expect, it } from 'vitest';
import { findStyles, fromBjcp, resolveStyle, type BeerStyle, type StyleSource } from './styleSource';

const style = (id: string, name: string, category: string, guide: BeerStyle['guide'] = 'bjcp-2021'): BeerStyle =>
  ({ id, guide, name, category });

const all = [
  style('7B', 'Altbier', 'Amber Bitter European Beer'),
  style('11A', 'Ordinary Bitter', 'British Bitter'),
  style('5B', 'Kölsch', 'Pale Bitter European Beer'),
  style('21A', 'American IPA', 'IPA'),
  style('18B', 'American Pale Ale', 'Pale American Ale'),
];

describe('findStyles', () => {
  it('returns the first styles for an empty query', () => {
    expect(findStyles(all, '', 2).map((s) => s.id)).toEqual(['7B', '11A']);
  });

  it('matches the number case-insensitively', () => {
    expect(findStyles(all, '21a').map((s) => s.id)).toEqual(['21A']);
  });

  it('matches the name', () => {
    expect(findStyles(all, 'alt').map((s) => s.id)).toContain('7B');
  });

  it('matches the category', () => {
    expect(findStyles(all, 'british').map((s) => s.id)).toEqual(['11A']);
  });

  it('ranks prefix matches before substring matches', () => {
    const list = [style('a', 'Extra Bitter', 'X'), style('b', 'Bitter', 'X')];
    expect(findStyles(list, 'bitter').map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('returns nothing for an unknown query', () => {
    expect(findStyles(all, 'zzzz')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(findStyles(all, 'a', 2)).toHaveLength(2);
  });

  it('does not match the generated id of an own style', () => {
    expect(findStyles([style('mgx4k2', 'Hausbier', 'Haus', 'own')], 'mgx')).toEqual([]);
  });
});

describe('fromBjcp', () => {
  it('converts SG to °P and SRM to EBC and keeps ABV and IBU', () => {
    const s = fromBjcp({
      id: '5B', name: 'Kölsch', category: 'Pale Bitter European Beer', categoryId: '5',
      og: [1.044, 1.050], fg: [1.007, 1.011], ibu: [18, 30], srm: [3.5, 5], abv: [4.4, 5.2],
    });
    expect(s).toMatchObject({ id: '5B', guide: 'bjcp-2021', name: 'Kölsch', category: 'Pale Bitter European Beer' });
    expect(s.og![0]).toBeCloseTo(10.96, 2);
    expect(s.og![1]).toBeCloseTo(12.39, 2);
    expect(s.fg![0]).toBeCloseTo(1.80, 2);
    expect(s.ebc).toEqual([3.5 * 1.97, 5 * 1.97]);
    expect(s.ibu).toEqual([18, 30]);
    expect(s.abv).toEqual([4.4, 5.2]);
    expect(s).not.toHaveProperty('srm');
  });
});

describe('resolveStyle', () => {
  const bjcp: StyleSource = { guide: 'bjcp-2021', label: 'BJCP 2021', styles: [style('7B', 'Altbier', 'X')] };
  const own: StyleSource = { guide: 'own', label: 'Eigene', styles: [style('7B', 'Haus-Alt', 'X', 'own')] };

  it('reads an unset guide as BJCP', () => {
    expect(resolveStyle([bjcp, own], { styleId: '7B' })?.style.name).toBe('Altbier');
  });

  it('finds an own style', () => {
    expect(resolveStyle([bjcp, own], { styleId: '7B', styleGuide: 'own' })?.style.name).toBe('Haus-Alt');
  });

  it('gives nothing without the source, the style or a link', () => {
    expect(resolveStyle([own], { styleId: '7B' })).toBeUndefined();
    expect(resolveStyle([bjcp, own], { styleId: '9Z' })).toBeUndefined();
    expect(resolveStyle([bjcp, own], {})).toBeUndefined();
    expect(resolveStyle(null, { styleId: '7B' })).toBeUndefined();
  });
});
