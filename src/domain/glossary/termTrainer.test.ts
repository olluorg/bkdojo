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

  test('prioritizes due / unmastered terms over a mastered one', () => {
    let p = createDefaultProgress();
    const masteredId = terms[0]!.id;
    // master it and push its review far into the future
    for (let i = 0; i < 3; i++) p = applyTermResult(p, masteredId, true, now);

    const drill = buildTermDrill(terms, p, { size: 1, now, rng });
    expect(drill[0]?.term.id).not.toBe(masteredId);
  });
});
