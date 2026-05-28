import { K_DAILY, K_PLACEMENT, updateAbility } from '../ability/abilityUpdate';
import type { AnswerOutcome } from '../models/answer';
import type { AnswerRecord, UserProgress } from '../models/progress';
import { consecutiveCorrect, scheduleReview } from '../review/spacedRepetition';
import { touchStreak } from './streak';

export interface ApplyOutcomeOptions {
  mode?: 'placement' | 'daily';
  now?: Date;
}

/**
 * Pure reducer step: folds one AnswerOutcome into UserProgress — updates the
 * domain ability (Elo), counters, appends a history record with its next review
 * date, and advances the daily streak. Returns a new object (no mutation).
 */
export function applyOutcome(
  progress: UserProgress,
  outcome: AnswerOutcome,
  options: ApplyOutcomeOptions = {},
): UserProgress {
  const now = options.now ?? new Date();
  const k = options.mode === 'placement' ? K_PLACEMENT : K_DAILY;

  const skill = progress.skills[outcome.domain];
  const ability = updateAbility({
    ability: skill.ability,
    difficulty: outcome.difficulty,
    score: outcome.score,
    k,
  });

  const priorCorrect = consecutiveCorrect(progress.history, outcome.questionId);
  const schedule = scheduleReview({
    priorConsecutiveCorrect: priorCorrect,
    verdict: outcome.verdict,
    now,
  });

  const record: AnswerRecord = {
    questionId: outcome.questionId,
    domain: outcome.domain,
    tags: outcome.tags,
    score: outcome.score,
    verdict: outcome.verdict,
    conceptCoverage: outcome.evaluation?.concepts,
    evaluatedBy: outcome.evaluatedBy,
    answer: outcome.answer,
    selectedOptionIds: outcome.selectedOptionIds,
    selfOverride: outcome.selfOverride,
    answeredAt: outcome.answeredAt,
    nextReviewAt: schedule.nextReviewAt,
  };

  const streak = touchStreak(progress, now);

  return {
    ...progress,
    skills: {
      ...progress.skills,
      [outcome.domain]: {
        ...skill,
        ability,
        answered: skill.answered + 1,
        correct: skill.correct + (outcome.verdict === 'correct' ? 1 : 0),
      },
    },
    history: [...progress.history, record],
    streakDays: streak.streakDays,
    lastPracticeDate: streak.lastPracticeDate,
  };
}
