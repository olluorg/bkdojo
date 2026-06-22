import type { AnswerOutcome } from '../domain/models/answer';
import type { AppEventInput } from '../domain/models/event';
import type { AiAvailability } from '../domain/models/evaluation';
import type { CachedLessonComment, UserProgress } from '../domain/models/progress';
import { DEFAULT_SETTINGS, type EvalMethod } from '../domain/models/settings';
import { createDefaultPet, feedPet, playPet, type FeedEvent } from '../domain/pet/pet';
import { recordActivity, type ActivityKind } from '../domain/progress/activity';
import { appendEvent } from '../domain/progress/eventLog';
import { isLessonRead, setLessonRead } from '../domain/progress/lessonProgress';
import { setLessonBookmark } from '../domain/progress/lessonBookmarks';
import { setQuestionBookmark } from '../domain/progress/questionBookmarks';
import { applyOutcome } from '../domain/progress/applyOutcome';
import { earnFromLesson, touchCredits, useCredit } from '../domain/progress/overrideCredits';
import { touchStreak } from '../domain/progress/streak';
import { applyTermResult } from '../domain/progress/termProgress';
import { createDefaultProgress, mergeProgress } from '../storage/progressStorage';

export type ProgressAction =
  | { type: 'record'; outcome: AnswerOutcome; mode?: 'placement' | 'daily' }
  | { type: 'recordTerm'; termId: string; correct: boolean }
  | { type: 'setLessonRead'; lessonId: string; read: boolean }
  | { type: 'setLessonBookmark'; lessonId: string; bookmarked: boolean }
  | { type: 'setQuestionBookmark'; questionId: string; bookmarked: boolean }
  | { type: 'saveLessonComment'; lessonId: string; comment: CachedLessonComment }
  | { type: 'recordActivity'; kind: ActivityKind }
  | { type: 'logEvent'; event: AppEventInput }
  | { type: 'completePlacement' }
  | { type: 'setAiAvailability'; availability: AiAvailability }
  | { type: 'setEvalMethod'; method: EvalMethod }
  | { type: 'playPet' }
  | { type: 'tickOverrideCredits' }
  | { type: 'useOverrideCredit' }
  | { type: 'replace'; progress: UserProgress }
  | { type: 'merge'; progress: UserProgress }
  | { type: 'reset' };

function fed(state: UserProgress, event: FeedEvent): PetCarrier {
  const now = new Date();
  return { pet: feedPet(state.pet ?? createDefaultPet(now), event, now) };
}
interface PetCarrier {
  pet: UserProgress['pet'];
}

export function progressReducer(state: UserProgress, action: ProgressAction): UserProgress {
  switch (action.type) {
    case 'record': {
      const next = applyOutcome(state, action.outcome, { mode: action.mode });
      return {
        ...next,
        ...fed(next, {
          domain: action.outcome.domain,
          verdict: action.outcome.verdict,
          difficulty: action.outcome.difficulty,
        }),
      };
    }
    case 'recordTerm': {
      const next = applyTermResult(state, action.termId, action.correct);
      const streak = touchStreak(next, new Date()); // glossary practice also counts
      const logged = appendEvent(next, {
        type: 'term_drilled',
        refId: action.termId,
        correct: action.correct,
      });
      return {
        ...logged,
        streakDays: streak.streakDays,
        lastPracticeDate: streak.lastPracticeDate,
        ...fed(next, { verdict: action.correct ? 'correct' : 'incorrect', difficulty: 1 }),
      };
    }
    case 'setLessonRead': {
      const wasRead = isLessonRead(state, action.lessonId);
      let next = setLessonRead(state, action.lessonId, action.read);
      // Completing a lesson (unread → read) may earn one override credit per
      // day and is logged as a milestone. Toggling read off, or re-marking an
      // already-read lesson, doesn't.
      if (action.read && !wasRead) {
        const earned = earnFromLesson(next.overrideCredits, new Date());
        next = appendEvent(
          { ...next, overrideCredits: earned.state },
          { type: 'lesson_completed', refId: action.lessonId },
        );
      }
      return next;
    }
    case 'setLessonBookmark':
      return setLessonBookmark(state, action.lessonId, action.bookmarked);
    case 'setQuestionBookmark':
      return setQuestionBookmark(state, action.questionId, action.bookmarked);
    case 'saveLessonComment':
      return {
        ...state,
        lessonComments: { ...(state.lessonComments ?? {}), [action.lessonId]: action.comment },
      };
    case 'recordActivity':
      return appendEvent(recordActivity(state, action.kind), {
        type: 'session_completed',
        refId: action.kind,
      });
    case 'logEvent':
      return appendEvent(state, action.event);
    case 'completePlacement':
      return state.placementDone
        ? state
        : appendEvent({ ...state, placementDone: true }, { type: 'placement_completed' });
    case 'setAiAvailability':
      return state.lastAiAvailability === action.availability
        ? state
        : { ...state, lastAiAvailability: action.availability };
    case 'setEvalMethod':
      return {
        ...state,
        settings: { ...(state.settings ?? DEFAULT_SETTINGS), evalMethod: action.method },
      };
    case 'playPet': {
      const now = new Date();
      return { ...state, pet: playPet(state.pet ?? createDefaultPet(now), now) };
    }
    case 'tickOverrideCredits': {
      const next = touchCredits(state.overrideCredits, new Date());
      if (next === state.overrideCredits) return state;
      return { ...state, overrideCredits: next };
    }
    case 'useOverrideCredit': {
      const { state: nextCredits, used } = useCredit(state.overrideCredits, new Date());
      const next = { ...state, overrideCredits: nextCredits };
      return used ? appendEvent(next, { type: 'override_used' }) : next;
    }
    case 'replace':
      return action.progress;
    case 'merge':
      return mergeProgress(state, action.progress);
    case 'reset':
      return createDefaultProgress();
    default:
      return state;
  }
}
