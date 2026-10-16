import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCustom, addTasting, customLabel, customTerms, daysSinceBottling, emptyTasting, fitsLimit, getTasting, isCustom, MAX_CUSTOM_LENGTH, pickOne, pickRating, removeTasting, saveTasting, setFaultLevel, textOrUndefined,
  toggleFault, toggleId, updateTasting, type BrewTasting,
} from './brewTasting';

const doc = (...at: number[]): BrewTasting => ({
  id: 'b1', tastings: at.map((t) => emptyTasting(t, `t${t}`)),
});

describe('tasting list', () => {
  it('keeps the tastings in time order whatever order they are added in', () => {
    const d = addTasting(addTasting(doc(10, 30), emptyTasting(20, 'x')), emptyTasting(5, 'y'));
    expect(d.tastings.map((t) => t.at)).toEqual([5, 10, 20, 30]);
  });

  it('does not change the document it is given', () => {
    const d = doc(1, 2);
    addTasting(d, emptyTasting(3));
    removeTasting(d, 't1');
    expect(d.tastings).toHaveLength(2);
  });

  it('removes one tasting by its id', () => {
    expect(removeTasting(doc(1, 2, 3), 't2').tastings.map((t) => t.at)).toEqual([1, 3]);
  });

  it('replaces a tasting and re-sorts it when its time moved', () => {
    const moved = { ...emptyTasting(99, 't1'), taster: 'Nils' };
    const d = updateTasting(doc(1, 2, 3), moved);
    expect(d.tastings.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
    expect(d.tastings[2].taster).toBe('Nils');
  });

  it('gives an empty tasting without any choice made', () => {
    const t = emptyTasting(1, 'a');
    expect(t.aroma.descriptors).toEqual([]);
    expect(t.main.textures).toEqual([]);
    expect(t.finish.aftertaste).toEqual([]);
    expect(t.faults).toEqual([]);
    expect(t.finish.drinkability).toBeUndefined();
    expect(t.overall.enjoyment).toBeUndefined();
  });

  it('makes a different id for each new tasting', () => {
    expect(emptyTasting(1).id).not.toBe(emptyTasting(1).id);
  });
});

describe('own aroma words', () => {
  it('adds a typed word, trimmed, marked as an own word', () => {
    const ids = addCustom(['citrus'], '  Pfirsich ');
    expect(ids).toEqual(['citrus', '~Pfirsich']);
    expect(isCustom(ids[1])).toBe(true);
    expect(isCustom('citrus')).toBe(false);
    expect(customLabel(ids[1])).toBe('Pfirsich');
  });

  it('ignores empty text and a word already there in any case', () => {
    const ids = ['~Pfirsich'];
    expect(addCustom(ids, '   ')).toBe(ids);
    expect(addCustom(ids, 'pfirsich')).toBe(ids);
  });

  it('cuts a word to the length limit', () => {
    expect(customLabel(addCustom([], 'x'.repeat(100))[0])).toHaveLength(MAX_CUSTOM_LENGTH);
  });

  it('lists the own words of all tastings once, smell and aftertaste alike', () => {
    const a = { ...emptyTasting(1, 'a'), aroma: { descriptors: ['citrus', '~Pfirsich'] } };
    const b = { ...emptyTasting(2, 'b'), aroma: { descriptors: ['~pfirsich'] }, finish: { aftertaste: ['~Honig'] } };
    expect(customTerms([a, b])).toEqual(['~Pfirsich', '~Honig']);
    expect(customTerms([])).toEqual([]);
  });
});

describe('picking', () => {
  it('adds an id and takes it out when it is picked again', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('picks one choice and clears it when the same is picked again', () => {
    expect(pickOne(undefined, 'gold')).toBe('gold');
    expect(pickOne('gold', 'amber')).toBe('amber');
    expect(pickOne('gold', 'gold')).toBeUndefined();
  });

  it('picks a star rating and clears it when the same star is picked again', () => {
    expect(pickRating(undefined, 4)).toBe(4);
    expect(pickRating(4, 2)).toBe(2);
    expect(pickRating(4, 4)).toBeUndefined();
  });

  it('marks an off-flavour as slight, changes its level and takes it out again', () => {
    const marked = toggleFault([], 'diacetyl');
    expect(marked).toEqual([{ id: 'diacetyl', level: 'slight' }]);
    const strong = setFaultLevel(marked, 'diacetyl', 'strong');
    expect(strong).toEqual([{ id: 'diacetyl', level: 'strong' }]);
    expect(marked[0].level).toBe('slight');
    expect(toggleFault(strong, 'diacetyl')).toEqual([]);
  });

  it('leaves the other off-flavours alone when one changes', () => {
    const two = toggleFault(toggleFault([], 'dms'), 'sulfur');
    expect(setFaultLevel(two, 'sulfur', 'clear')).toEqual([{ id: 'dms', level: 'slight' }, { id: 'sulfur', level: 'clear' }]);
  });

  it('takes a blank text for no text', () => {
    expect(textOrUndefined('')).toBeUndefined();
    expect(textOrUndefined('  ')).toBeUndefined();
    expect(textOrUndefined('mild')).toBe('mild');
  });
});

describe('daysSinceBottling', () => {
  const day = 86_400_000;
  it('counts whole days from the bottling', () => {
    expect(daysSinceBottling(10 * day + 5, 3 * day)).toBe(7);
    expect(daysSinceBottling(3 * day + day - 1, 3 * day)).toBe(0);
  });

  it('has no age before the bottling or without one', () => {
    expect(daysSinceBottling(2 * day, 3 * day)).toBeUndefined();
    expect(daysSinceBottling(2 * day, undefined)).toBeUndefined();
  });
});

describe('size limit', () => {
  it('fits a dozen well filled tastings, but not a hundred', () => {
    const full = (i: number) => {
      const t = emptyTasting(1760000000000 + i, `id${i}xxxxxxxxxxx`);
      const ids = ['stone-fruit', 'dried-fruit', 'chocolate', 'resin', 'burnt-sugar'];
      const note = 'Ein ganzer Satz zu dieser Phase, mit Umlauten und einigen Worten mehr.';
      return {
        ...t,
        appearance: { color: 'brown', clarity: 'opalescent', headAmount: 'medium', headTexture: 'fine', headStability: 'lasting', notes: note },
        aroma: { descriptors: ids, notes: note },
        attack: { carbonation: 'lively', impression: 'sweet-malty', notes: note },
        main: { body: 'heavy', balance: 'malty', textures: ['creamy', 'warming', 'smooth'], notes: note },
        finish: {
          bitterIntensity: 'firm', bitterQuality: 'crisp', aftertaste: ids, length: 'long', alcohol: 'warming',
          drinkability: 'pleasant', notes: note,
        },
        faults: ids.slice(0, 2).map((id) => ({ id, level: 'clear' as const })),
        overall: { complexity: 'complex', styleFit: 'perfect', enjoyment: 5, notes: note },
      };
    };
    expect(fitsLimit({ id: 'b1', tastings: Array.from({ length: 12 }, (_, i) => full(i)) })).toBe(true);
    expect(fitsLimit({ id: 'b1', tastings: Array.from({ length: 100 }, (_, i) => full(i)) })).toBe(false);
  });

  it('counts the bytes of umlauts in a note, not their characters', () => {
    const notes = 'ä'.repeat(7600);
    expect(fitsLimit({ id: 'b1', tastings: [{ ...emptyTasting(1, 'a'), overall: { notes } }] })).toBe(false);
    expect(fitsLimit({ id: 'b1', tastings: [{ ...emptyTasting(1, 'a'), overall: { notes: 'a'.repeat(7600) } }] })).toBe(true);
  });
});

describe('store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives an empty document for a brew without a file', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    expect(await getTasting('b1')).toEqual({ id: 'b1', tastings: [] });
  });

  it('copes with a file that has no list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'b1' }))));
    expect(await getTasting('b1')).toEqual({ id: 'b1', tastings: [] });
  });

  it('puts the document to the brew\'s tasting url', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', f);
    const d = doc(1);
    await saveTasting(d);
    expect(f).toHaveBeenCalledWith('/api/brews/b1/tasting', expect.objectContaining({ method: 'PUT', body: JSON.stringify(d) }));
  });

  it('refuses an invalid id and a document that is too large before it asks the device', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(saveTasting({ id: '../x', tastings: [] })).rejects.toThrow('ungültige ID');
    await expect(saveTasting({ id: 'b1', tastings: [{ ...emptyTasting(1, 'a'), overall: { notes: 'ä'.repeat(8000) } }] })).rejects.toThrow('Zu viele');
    expect(f).not.toHaveBeenCalled();
  });
});
