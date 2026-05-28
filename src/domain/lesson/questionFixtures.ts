import type { Domain } from '../models/common';
import type { ChoiceQuestion, OpenQuestion } from '../models/question';

/**
 * Minimal question builders for unit tests of the lesson/corrective modules.
 * Not used in production code — kept tiny and explicit so each test states only
 * the fields it cares about.
 */

const guide = { short: 's', normal: 'n', traps: [] as string[], followUps: [] as string[] };

export function openQ(
  id: string,
  opts: { domain?: Domain; difficulty?: 1 | 2 | 3 | 4 | 5; tags?: string[]; rubricIds?: string[] } = {},
): OpenQuestion {
  return {
    id,
    domain: opts.domain ?? 'java-core',
    difficulty: opts.difficulty ?? 3,
    type: 'open',
    mode: 'definition',
    prompt: `prompt ${id}`,
    tags: opts.tags ?? [],
    answerGuide: { ...guide },
    rubric: (opts.rubricIds ?? ['c1']).map((cid) => ({
      id: cid,
      title: `title ${cid}`,
      description: 'd',
      required: true,
      weight: 1,
    })),
  };
}

export function choiceQ(
  id: string,
  opts: { domain?: Domain; difficulty?: 1 | 2 | 3 | 4 | 5; tags?: string[] } = {},
): ChoiceQuestion {
  return {
    id,
    domain: opts.domain ?? 'java-core',
    difficulty: opts.difficulty ?? 1,
    type: 'single',
    mode: 'definition',
    prompt: `prompt ${id}`,
    tags: opts.tags ?? [],
    answerGuide: { ...guide },
    options: [
      { id: 'a', text: 'a' },
      { id: 'b', text: 'b' },
    ],
    correctOptionIds: ['a'],
  };
}
