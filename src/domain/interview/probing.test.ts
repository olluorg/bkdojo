import { describe, expect, test } from 'bun:test';
import type { AnswerOutcome } from '../models/answer';
import type { ConceptResult, EvaluationResult, Verdict } from '../models/evaluation';
import type { EvaluationConcept, OpenQuestion } from '../models/question';
import {
  MAX_PROBES,
  buildProbePrompt,
  combineTranscript,
  nextProbeConcept,
  pickBetterOutcome,
  requestProbe,
} from './probing';

function concept(
  id: string,
  overrides: Partial<EvaluationConcept> = {},
): EvaluationConcept {
  return {
    id,
    title: `Тема ${id}`,
    description: `Описание ${id}`,
    required: true,
    weight: 1,
    ...overrides,
  };
}

function question(rubric: EvaluationConcept[]): OpenQuestion {
  return {
    id: 'q1',
    domain: 'java-core',
    difficulty: 3,
    type: 'open',
    mode: 'definition',
    prompt: 'Как работает HashMap?',
    tags: [],
    answerGuide: { short: '', normal: '', traps: [], followUps: [] },
    rubric,
  };
}

function evaluation(concepts: ConceptResult[], verdict: Verdict = 'partial'): EvaluationResult {
  return {
    source: 'chrome-prompt',
    status: 'ok',
    score: verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0,
    verdict,
    concepts,
    strengths: [],
    gaps: [],
    feedback: '',
  };
}

function outcome(score: number): AnswerOutcome {
  return {
    questionId: 'q1',
    domain: 'java-core',
    difficulty: 3,
    tags: [],
    score,
    verdict: score >= 0.7 ? 'correct' : score > 0 ? 'partial' : 'incorrect',
    evaluatedBy: 'chrome-prompt',
    answeredAt: '2026-01-01T00:00:00Z',
  };
}

describe('nextProbeConcept', () => {
  test('probes a missing concept before a partial one', () => {
    const q = question([concept('a'), concept('b')]);
    const ev = evaluation([
      { conceptId: 'a', coverage: 'partial' },
      { conceptId: 'b', coverage: 'missing' },
    ]);
    expect(nextProbeConcept(q, ev, [], 0)?.id).toBe('b');
  });

  test('prefers the heavier concept at equal coverage', () => {
    const q = question([concept('a', { weight: 1 }), concept('b', { weight: 3 })]);
    const ev = evaluation([
      { conceptId: 'a', coverage: 'missing' },
      { conceptId: 'b', coverage: 'missing' },
    ]);
    expect(nextProbeConcept(q, ev, [], 0)?.id).toBe('b');
  });

  test('prefers a required concept over an optional one of equal weight', () => {
    const q = question([concept('a', { required: false }), concept('b', { required: true })]);
    const ev = evaluation([
      { conceptId: 'a', coverage: 'missing' },
      { conceptId: 'b', coverage: 'missing' },
    ]);
    expect(nextProbeConcept(q, ev, [], 0)?.id).toBe('b');
  });

  test('falls back to rubric order for otherwise equal concepts', () => {
    const q = question([concept('a'), concept('b')]);
    const ev = evaluation([
      { conceptId: 'b', coverage: 'missing' },
      { conceptId: 'a', coverage: 'missing' },
    ]);
    expect(nextProbeConcept(q, ev, [], 0)?.id).toBe('a');
  });

  test('never probes the same concept twice', () => {
    const q = question([concept('a'), concept('b')]);
    const ev = evaluation([
      { conceptId: 'a', coverage: 'missing' },
      { conceptId: 'b', coverage: 'partial' },
    ]);
    expect(nextProbeConcept(q, ev, ['a'], 1)?.id).toBe('b');
    expect(nextProbeConcept(q, ev, ['a', 'b'], 2)).toBeUndefined();
  });

  test('does not nag a fully covered answer', () => {
    const q = question([concept('a')]);
    const ev = evaluation([{ conceptId: 'a', coverage: 'covered' }], 'correct');
    expect(nextProbeConcept(q, ev, [], 0)).toBeUndefined();
  });

  test('does not press a clearly wrong answer — that is the explanation’s job', () => {
    const q = question([concept('a')]);
    const ev = evaluation([{ conceptId: 'a', coverage: 'missing' }], 'incorrect');
    expect(nextProbeConcept(q, ev, [], 0)).toBeUndefined();
  });

  test('still probes a brief but on-track answer', () => {
    const q = question([concept('a')]);
    const ev = evaluation([{ conceptId: 'a', coverage: 'partial' }], 'correct');
    expect(nextProbeConcept(q, ev, [], 0)?.id).toBe('a');
  });

  test('stops at the turn ceiling even with gaps left', () => {
    const q = question([concept('a'), concept('b'), concept('c'), concept('d')]);
    const ev = evaluation([
      { conceptId: 'a', coverage: 'missing' },
      { conceptId: 'b', coverage: 'missing' },
      { conceptId: 'c', coverage: 'missing' },
      { conceptId: 'd', coverage: 'missing' },
    ]);
    expect(nextProbeConcept(q, ev, [], MAX_PROBES)).toBeUndefined();
  });

  test('ignores concept ids the evaluator invented', () => {
    const q = question([concept('a')]);
    const ev = evaluation([{ conceptId: 'ghost', coverage: 'missing' }]);
    expect(nextProbeConcept(q, ev, [], 0)).toBeUndefined();
  });

  test('returns nothing without an evaluation (e.g. a choice question)', () => {
    expect(nextProbeConcept(question([concept('a')]), undefined, [], 0)).toBeUndefined();
  });
});

describe('combineTranscript', () => {
  test('keeps the opening answer alone when nothing was probed', () => {
    expect(combineTranscript('  основа  ', [])).toBe('основа');
  });

  test('appends each follow-up with its answer', () => {
    const text = combineTranscript('основа', [
      { question: 'А почему?', answer: 'потому что' },
      { question: 'А если коллизия?', answer: 'список или дерево' },
    ]);
    expect(text).toBe(
      'основа\n\nВопрос интервьюера: А почему?\nОтвет: потому что\n\n' +
        'Вопрос интервьюера: А если коллизия?\nОтвет: список или дерево',
    );
  });

  test('drops skipped follow-ups', () => {
    expect(combineTranscript('основа', [{ question: 'А почему?', answer: '   ' }])).toBe('основа');
  });
});

describe('pickBetterOutcome', () => {
  test('keeps the higher score so probing never punishes', () => {
    expect(pickBetterOutcome(outcome(0.8), outcome(0.3)).score).toBe(0.8);
  });

  test('prefers the fresh outcome on a tie', () => {
    const base = outcome(0.5);
    const probed = outcome(0.5);
    expect(pickBetterOutcome(base, probed)).toBe(probed);
  });
});

describe('buildProbePrompt', () => {
  test('names the uncovered concept and forbids repeats', () => {
    const q = question([concept('a')]);
    const input = buildProbePrompt(q, concept('a'), [{ question: 'А почему?', answer: 'x' }]);
    expect(input.user).toContain('Как работает HashMap?');
    expect(input.user).toContain('Тема a');
    expect(input.user).toContain('не повторяйся');
    expect(input.user).toContain('— А почему?');
    expect(input.system).toContain('РОВНО ОДИН');
  });
});

describe('requestProbe', () => {
  test('returns the generated question', async () => {
    const q = question([concept('a')]);
    const probe = await requestProbe(q, concept('a'), [], {
      method: 'auto',
      run: async () => ({ source: 'chrome-prompt', text: '  А что при resize?  ' }),
    });
    expect(probe).toBe('А что при resize?');
  });

  test('degrades to undefined when no AI channel answers', async () => {
    const q = question([concept('a')]);
    const probe = await requestProbe(q, concept('a'), [], {
      method: 'auto',
      run: async () => {
        throw new Error('unavailable');
      },
    });
    expect(probe).toBeUndefined();
  });

  test('treats an empty generation as no probe', async () => {
    const q = question([concept('a')]);
    const probe = await requestProbe(q, concept('a'), [], {
      method: 'auto',
      run: async () => ({ source: 'server', text: '   ' }),
    });
    expect(probe).toBeUndefined();
  });
});
