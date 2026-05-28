export type Domain =
  | 'java-core'
  | 'spring-boot'
  | 'databases'
  | 'message-brokers'
  | 'system-design';

export const DOMAINS: readonly Domain[] = [
  'java-core',
  'spring-boot',
  'databases',
  'message-brokers',
  'system-design',
] as const;

export const DOMAIN_LABELS: Record<Domain, string> = {
  'java-core': 'Java Core',
  'spring-boot': 'Spring Boot',
  databases: 'Databases',
  'message-brokers': 'Message Brokers',
  'system-design': 'System Design',
};

export function isDomain(value: unknown): value is Domain {
  return typeof value === 'string' && (DOMAINS as readonly string[]).includes(value);
}

/** Numeric difficulty 1..5. Mapped to junior/middle/senior labels only in the UI. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4, 5] as const;

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export type QuestionType = 'single' | 'multiple' | 'open';

export const QUESTION_TYPES: readonly QuestionType[] = ['single', 'multiple', 'open'] as const;

export type QuestionMode =
  | 'definition'
  | 'comparison'
  | 'scenario'
  | 'code_review'
  | 'live_coding'
  | 'sql'
  | 'architecture'
  | 'interview_answer';

export const QUESTION_MODES: readonly QuestionMode[] = [
  'definition',
  'comparison',
  'scenario',
  'code_review',
  'live_coding',
  'sql',
  'architecture',
  'interview_answer',
] as const;
