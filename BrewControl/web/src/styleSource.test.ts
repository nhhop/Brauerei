import { describe, expect, it } from 'vitest';
import { findStyles, type BjcpStyle } from './styleSource';

const span: [number, number] = [0, 1];
const style = (id: string, name: string, category: string): BjcpStyle =>
  ({ id, name, category, categoryId: id.replace(/\D/g, ''), og: span, fg: span, ibu: span, srm: span, abv: span });

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
});
