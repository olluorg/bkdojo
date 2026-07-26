import type { OutcomeSource } from './answer';
import type { Domain } from './common';
import type { AppEvent } from './event';
import type { AiAvailability, ConceptResult, Verdict } from './evaluation';
import type { Settings } from './settings';

export interface DomainSkill {
  domain: Domain;
  ability: number; // ~1..5 (fractional)
  answered: number;
  correct: number;
}

export interface AnswerRecord {
  questionId: string;
  domain: Domain;
  tags: string[];
  score: number; // 0..1
  verdict: Verdict;
  conceptCoverage?: ConceptResult[]; // enables concept-level weak spots (open)
  evaluatedBy: OutcomeSource;
  /** The learner's raw text answer (open questions) — persisted for analysis/comments. */
  answer?: string;
  /** The learner's selected option ids (choice questions) — persisted for analysis. */
  selectedOptionIds?: string[];
  /** True when the learner overrode the AI verdict themselves. */
  selfOverride?: boolean;
  answeredAt: string; // ISO
  nextReviewAt?: string; // ISO, for spaced repetition
}

/**
 * A cached AI lesson comment. `fingerprint` captures the answers it was built
 * from; while it matches the current answers the comment is reused instead of
 * spending another LLM request.
 */
export interface CachedLessonComment {
  fingerprint: string;
  text: string;
  source: 'chrome-prompt' | 'server';
  generatedAt: string; // ISO
}

/** Per-term spaced-repetition state for the glossary trainer. */
export interface TermProgress {
  termId: string;
  streak: number; // consecutive correct
  seen: number;
  correct: number;
  lastAnsweredAt?: string; // ISO
  nextReviewAt?: string; // ISO
}

export interface UserProgress {
  version: number;
  skills: Record<Domain, DomainSkill>;
  history: AnswerRecord[];
  placementDone: boolean;
  streakDays: number;
  lastPracticeDate?: string; // ISO date
  lastAiAvailability?: AiAvailability; // UX hint for next visit
  terms?: Record<string, TermProgress>; // optional for backward-compatible load
  lessonsRead?: Record<string, string>; // lessonId → ISO read-at; optional for backward-compatible load
  /** lessonId → ISO defended-at (a passed defense); optional for backward-compatible load. */
  defendedLessons?: Record<string, string>;
  lessonBookmarks?: Record<string, string>; // lessonId → ISO bookmarked-at; optional for backward-compatible load
  questionBookmarks?: Record<string, string>; // questionId → ISO bookmarked-at; optional for backward-compatible load
  lessonComments?: Record<string, CachedLessonComment>; // lessonId → cached AI comment; optional for backward-compatible load
  activity?: Record<string, string>; // activity kind → last-done ISO; distinguishes practice/review/interview
  events?: AppEvent[]; // append-only learning-event log (lessons/terms/sessions); optional for backward-compatible load
  settings?: Settings; // optional for backward-compatible load
}
