import { describe, expect, test } from 'bun:test';
import { loadGlossary } from '../content/glossaryLoader';
import { createDefaultProgress } from '../../storage/progressStorage';
import { applyTermResult } from '../progress/termProgress';
import { buildTermDrill } from './termTrainer';

const terms = loadGlossary().terms;
const now = new Date('2026-05-22T00:00:00.000Z');
const rng = () => 0;

describe('buildTermDrill', () => {
  test('returns the requested number of items, each with the correct option present', () => {
    const drill = buildTermDrill(terms, createDefaultProgress(), { size: 8, now, rng });
    expect(drill).toHaveLength(8);
    for (const item of drill) {
      expect(item.options).toHaveLength(4);
      expect(item.options.some((o) => o.id === item.term.id)).toBe(true);
    }
  });

  test('mixes both directions', () => {
    const drill = buildTermDrill(terms, createDefaultProgress(), { size: 4, now, rng });
    const directions = new Set(drill.map((i) => i.direction));
    expect(directions.size).toBe(2);
  });

  test('focusDomain splits the drill ~50/50 between the focus course and the rest', () => {
    const drill = buildTermDrill(terms, createDefaultProgress(), {
      size: 8,
      now,
      rng,
      focusDomain: 'message-brokers',
    });
    const focusCount = drill.filter((i) => i.term.domain === 'message-brokers').length;
    // 8 items → ~4 from the focus course (it has 9 terms, enough to fill its half)
    expect(focusCount).toBe(4);
    expect(drill).toHaveLength(8);
  });

  test('focusDomain backfills from other courses when the focus course is short', () => {
    const fewFocus = terms.filter(
      (t) => t.domain !== 'message-brokers' || t.id === terms.find((x) => x.domain === 'message-brokers')!.id,
    );
    // fewFocus has exactly one message-brokers term; the rest must fill the slots.
    const drill = buildTermDrill(fewFocus, createDefaultProgress(), {
      size: 8,
      now,
      rng,
      focusDomain: 'message-brokers',
    });
    expect(drill).toHaveLength(8);
    expect(drill.filter((i) => i.term.domain === 'message-brokers').length).toBe(1);
  });

  test('prioritizes due / unmastered terms over a mastered one', () => {
    let p = createDefaultProgress();
    const masteredId = terms[0]!.id;
    // master it and push its review far into the future
    for (let i = 0; i < 3; i++) p = applyTermResult(p, masteredId, true, now);

    const drill = buildTermDrill(terms, p, { size: 1, now, rng });
    expect(drill[0]?.term.id).not.toBe(masteredId);
  });
});
