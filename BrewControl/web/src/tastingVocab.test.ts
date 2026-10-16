import { describe, expect, it } from 'vitest';
import {
  ALCOHOLS, AROMA, AROMA_GROUPS, BALANCES, BITTER_INTENSITIES, BITTER_QUALITIES, BODIES, CARBONATIONS, CLARITIES, COLORS,
  COMPLEXITIES, DRINKABILITIES, FAULTS, FAULT_GROUPS, FAULT_LEVELS, FINISH_LENGTHS, FIRST_IMPRESSIONS, HEAD_AMOUNTS,
  HEAD_STABILITIES, HEAD_TEXTURES, STYLE_FITS, TEXTURES, labelOf, type Choice,
} from './tastingVocab';

const lists: Record<string, Choice[]> = {
  AROMA, FAULTS, COLORS, CLARITIES, HEAD_AMOUNTS, HEAD_TEXTURES, HEAD_STABILITIES, CARBONATIONS, FIRST_IMPRESSIONS, BODIES,
  BALANCES, TEXTURES, BITTER_INTENSITIES, BITTER_QUALITIES, FINISH_LENGTHS, ALCOHOLS, DRINKABILITIES, COMPLEXITIES, STYLE_FITS,
  FAULT_LEVELS,
};

describe('vocabulary', () => {
  it.each(Object.entries(lists))('%s has unique ids and a label for every entry', (_, list) => {
    expect(list.length).toBeGreaterThan(0);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
    for (const c of list) expect(c.label.trim()).not.toBe('');
  });

  it.each(Object.entries(lists))('%s has no empty hint', (_, list) => {
    for (const c of list) if (c.hint !== undefined) expect(c.hint.trim()).not.toBe('');
  });

  it('puts every descriptor in a group that exists, and uses every group', () => {
    const check = (list: { group: string }[], groups: { id: string }[]) => {
      const ids = groups.map((g) => g.id);
      for (const d of list) expect(ids).toContain(d.group);
      for (const g of ids) expect(list.some((d) => d.group === g)).toBe(true);
    };
    check(AROMA, AROMA_GROUPS);
    check(FAULTS, FAULT_GROUPS);
  });

  it('says for every off-flavour what it is like and where it comes from', () => {
    for (const f of FAULTS) {
      expect(f.smell.trim()).not.toBe('');
      expect(f.cause.trim()).not.toBe('');
    }
  });

  it('has one clarity scale that ends in opaque and keeps a place for dark beers', () => {
    const ids = CLARITIES.map((c) => c.id);
    expect(ids).toContain('opaque');
    expect(ids).toContain('unrated');
  });

  it('has a "no head" amount, which the form takes to lock texture and stability', () => {
    expect(HEAD_AMOUNTS.map((c) => c.id)).toContain('none');
    expect(HEAD_STABILITIES.map((c) => c.id)).not.toContain('none');
    expect(HEAD_TEXTURES.map((c) => c.id)).not.toContain('none');
  });

  it('looks a label up by id', () => {
    expect(labelOf(COLORS, 'gold')).toBe('Goldgelb');
    expect(labelOf(COLORS, 'nope')).toBeUndefined();
    expect(labelOf(COLORS, undefined)).toBeUndefined();
  });
});
