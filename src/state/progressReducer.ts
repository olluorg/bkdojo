import type { AnswerOutcome } from '../domain/models/answer';
import type { AppEventInput } from '../domain/models/event';
import type { AiAvailability } from '../domain/models/evaluation';
import type { InterviewGoal } from '../domain/goal/goal';
import type { CachedLessonComment, UserProgress } from '../domain/models/progress';
import { DEFAULT_SETTINGS, type EvalMethod } from '../domain/models/settings';
import { recordActivity, type ActivityKind } from '../domain/progress/activity';
import { appendEvent } from '../domain/progress/eventLog';
import { isLessonDefended, markLessonDefended } from '../domain/progress/lessonDefense';
import { isLessonRead, setLessonRead } from '../domain/progress/lessonProgress';
import { setLessonBookmark } from '../domain/progress/lessonBookmarks';
import { setQuestionBookmark } from '../domain/progress/questionBookmarks';
import { applyOutcome } from '../domain/progress/applyOutcome';
import { touchStreak } from '../domain/progress/streak';
import { applyTermResult } from '../domain/progress/termProgress';
import { createDefaultProgress, mergeProgress } from '../storage/progressStorage';

export type ProgressAction =
  | { type: 'record'; outcome: AnswerOutcome; mode?: 'placement' | 'daily' }
  | { type: 'recordTerm'; termId: string; correct: boolean }
  | { type: 'setLessonRead'; lessonId: string; read: boolean }
  | { type: 'markLessonDefended'; lessonId: string }
  | { type: 'setLessonBookmark'; lessonId: string; bookmarked: boolean }
  | { type: 'setQuestionBookmark'; questionId: string; bookmarked: boolean }
  | { type: 'saveLessonComment'; lessonId: string; comment: CachedLessonComment }
  | { type: 'recordActivity'; kind: ActivityKind }
  | { type: 'logEvent'; event: AppEventInput }
  | { type: 'completePlacement' }
  | { type: 'setAiAvailability'; availability: AiAvailability }
  | { type: 'setEvalMethod'; method: EvalMethod }
  | { type: 'setGoal'; goal: InterviewGoal }
  | { type: 'selfOverride' }
  | { type: 'replace'; progress: UserProgress }
  | { type: 'merge'; progress: UserProgress }
  | { type: 'reset' };

export function progressReducer(state: UserProgress, action: ProgressAction): UserProgress {
  switch (action.type) {
    case 'record':
      return applyOutcome(state, action.outcome, { mode: action.mode });
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
      };
    }
    case 'setLessonRead': {
      const wasRead = isLessonRead(state, action.lessonId);
      const next = setLessonRead(state, action.lessonId, action.read);
      // Completing a lesson (unread → read) is logged as a milestone. Toggling
      // read off, or re-marking an already-read lesson, isn't.
      if (action.read && !wasRead) {
        return appendEvent(next, { type: 'lesson_completed', refId: action.lessonId });
      }
      return next;
    }
    case 'markLessonDefended': {
      if (isLessonDefended(state, action.lessonId)) return state;
      return appendEvent(markLessonDefended(state, action.lessonId), {
        type: 'lesson_completed',
        refId: action.lessonId,
      });
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
    case 'setGoal':
      return {
        ...state,
        settings: { ...(state.settings ?? DEFAULT_SETTINGS), goal: action.goal },
      };
    // Disagreeing with the evaluator is unrationed: a budget on saying "I was
    // actually right" only signalled that the app knew its grades weren't
    // trusted. It stays logged, so a learner who overrides constantly is still
    // visible in the event log.
    case 'selfOverride':
      return appendEvent(state, { type: 'override_used' });
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
