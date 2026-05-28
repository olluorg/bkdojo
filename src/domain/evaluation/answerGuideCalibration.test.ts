import { describe, expect, test } from 'bun:test';
import { loadContent } from '../content/contentLoader';
import { isOpenQuestion, type OpenQuestion } from '../models/question';

interface Gap {
  id: string;
  prompt: string;
  missing: string[];
}

function findGaps(question: OpenQuestion): Gap | null {
  const answer = `${question.answerGuide?.short ?? ''} ${question.answerGuide?.normal ?? ''}`.toLowerCase();
  const missing: string[] = [];
  for (const concept of question.rubric) {
    if (!concept.required) continue;
    const keywords = concept.keywords ?? [];
    if (keywords.length === 0) {
      // Without keywords we cannot deterministically verify coverage; that's a
      // separate content problem caught by the rubric-keywords assertion below.
      continue;
    }
    const hit = keywords.some((k) => answer.includes(k.toLowerCase()));
    if (!hit) missing.push(concept.id);
  }
  if (missing.length === 0) return null;
  return { id: question.id, prompt: question.prompt, missing };
}

describe('answerGuide ↔ rubric calibration', () => {
  const { questions } = loadContent();
  const openQuestions = questions.filter(isOpenQuestion);

  test('every required rubric concept has keywords (deterministic coverage check is possible)', () => {
    const offenders: { id: string; conceptIds: string[] }[] = [];
    for (const q of openQuestions) {
      const conceptIds = q.rubric
        .filter((c) => c.required && (c.keywords ?? []).length === 0)
        .map((c) => c.id);
      if (conceptIds.length > 0) offenders.push({ id: q.id, conceptIds });
    }
    if (offenders.length > 0) {
      const lines = offenders.map((o) => `  ${o.id}: ${o.conceptIds.join(', ')}`).join('\n');
      throw new Error(
        `Open questions with required rubric concepts that lack keywords:\n${lines}\n` +
          `Add keywords to each required concept so calibration can verify it.`,
      );
    }
  });

  test("each open question's answerGuide covers every required rubric concept", () => {
    // Each required rubric concept must be hit by at least one keyword inside the
    // question's own answerGuide (short + normal). Otherwise a learner who repeats
    // the reference answer cannot pass — the topic becomes unpassable.
    const gaps: Gap[] = [];
    for (const q of openQuestions) {
      const gap = findGaps(q);
      if (gap) gaps.push(gap);
    }

    if (gaps.length > 0) {
      const lines = gaps
        .map((g) => `  ${g.id} ("${g.prompt.slice(0, 60)}") → missing concepts: ${g.missing.join(', ')}`)
        .join('\n');
      throw new Error(
        `answerGuide does not cover all required rubric concepts for ${gaps.length} question(s):\n${lines}\n` +
          `Fix either the answerGuide.normal/short to mention each required concept, or rewrite the rubric.`,
      );
    }

    expect(gaps).toEqual([]);
  });
});
