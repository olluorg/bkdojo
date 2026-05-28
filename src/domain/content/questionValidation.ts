import {
  isDifficulty,
  isDomain,
  QUESTION_MODES,
  type Domain,
  type QuestionMode,
} from '../models/common';
import type {
  AnswerGuide,
  ChoiceOption,
  EvaluationConcept,
  Question,
} from '../models/question';

export interface ValidationIssue {
  index: number;
  questionId?: string;
  message: string;
}

export interface ValidationResult {
  valid: Question[];
  issues: ValidationIssue[];
}

interface ValidateOptions {
  expectedDomain?: Domain;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function validateAnswerGuide(raw: unknown, errors: string[]): AnswerGuide | undefined {
  if (!isRecord(raw)) {
    errors.push('answerGuide must be an object');
    return undefined;
  }
  if (!isNonEmptyString(raw.short)) errors.push('answerGuide.short must be a non-empty string');
  if (!isNonEmptyString(raw.normal)) errors.push('answerGuide.normal must be a non-empty string');
  if (!isStringArray(raw.traps)) errors.push('answerGuide.traps must be a string[]');
  if (!isStringArray(raw.followUps)) errors.push('answerGuide.followUps must be a string[]');
  if (errors.length > 0) return undefined;
  return raw as unknown as AnswerGuide;
}

function validateOptions(raw: unknown, errors: string[]): ChoiceOption[] | undefined {
  if (!Array.isArray(raw) || raw.length < 2) {
    errors.push('options must be an array of at least 2 items');
    return undefined;
  }
  const ids = new Set<string>();
  for (const opt of raw) {
    if (!isRecord(opt) || !isNonEmptyString(opt.id) || !isNonEmptyString(opt.text)) {
      errors.push('each option must have non-empty id and text');
      return undefined;
    }
    if (ids.has(opt.id)) {
      errors.push(`duplicate option id "${opt.id}"`);
      return undefined;
    }
    ids.add(opt.id);
  }
  return raw as unknown as ChoiceOption[];
}

function validateRubric(raw: unknown, errors: string[]): EvaluationConcept[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push('rubric must be a non-empty array');
    return undefined;
  }
  const ids = new Set<string>();
  for (const c of raw) {
    if (!isRecord(c)) {
      errors.push('each rubric concept must be an object');
      return undefined;
    }
    if (!isNonEmptyString(c.id)) errors.push('rubric concept id must be a non-empty string');
    if (!isNonEmptyString(c.title)) errors.push('rubric concept title must be a non-empty string');
    if (!isNonEmptyString(c.description)) {
      errors.push('rubric concept description must be a non-empty string');
    }
    if (typeof c.required !== 'boolean') errors.push('rubric concept required must be boolean');
    if (typeof c.weight !== 'number' || c.weight <= 0) {
      errors.push('rubric concept weight must be a positive number');
    }
    if (c.minLevel !== undefined && !isDifficulty(c.minLevel)) {
      errors.push('rubric concept minLevel must be 1..5 when present');
    }
    if (c.keywords !== undefined && !isStringArray(c.keywords)) {
      errors.push('rubric concept keywords must be a string[] when present');
    }
    if (isNonEmptyString(c.id)) {
      if (ids.has(c.id)) errors.push(`duplicate rubric concept id "${c.id}"`);
      ids.add(c.id);
    }
  }
  if (errors.length > 0) return undefined;
  return raw as unknown as EvaluationConcept[];
}

function validateQuestion(
  raw: unknown,
  opts: ValidateOptions,
): { question?: Question; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { errors: ['question must be an object'] };
  }

  if (!isNonEmptyString(raw.id)) errors.push('id must be a non-empty string');
  if (!isDomain(raw.domain)) {
    errors.push('domain is invalid');
  } else if (opts.expectedDomain && raw.domain !== opts.expectedDomain) {
    errors.push(`domain "${raw.domain}" does not match file domain "${opts.expectedDomain}"`);
  }
  if (!isDifficulty(raw.difficulty)) errors.push('difficulty must be 1..5');
  if (!QUESTION_MODES.includes(raw.mode as QuestionMode)) errors.push('mode is invalid');
  if (!isNonEmptyString(raw.prompt)) errors.push('prompt must be a non-empty string');
  if (!isStringArray(raw.tags)) errors.push('tags must be a string[]');

  validateAnswerGuide(raw.answerGuide, errors);

  const type = raw.type;
  if (type === 'single' || type === 'multiple') {
    const options = validateOptions(raw.options, errors);
    const correct = raw.correctOptionIds;
    if (!isStringArray(correct) || correct.length === 0) {
      errors.push('correctOptionIds must be a non-empty string[]');
    } else if (options) {
      const optionIds = new Set(options.map((o) => o.id));
      if (!correct.every((id) => optionIds.has(id))) {
        errors.push('correctOptionIds must reference existing options');
      }
      if (type === 'single' && correct.length !== 1) {
        errors.push('single-choice question must have exactly one correct option');
      }
    }
  } else if (type === 'open') {
    validateRubric(raw.rubric, errors);
    if (raw.language !== undefined && !isNonEmptyString(raw.language)) {
      errors.push('language must be a non-empty string when present');
    }
    if (raw.starterCode !== undefined && typeof raw.starterCode !== 'string') {
      errors.push('starterCode must be a string when present');
    }
  } else {
    errors.push('type must be one of single | multiple | open');
  }

  if (errors.length > 0) return { errors };
  return { question: raw as unknown as Question, errors };
}

/** Validates a raw JSON payload into Question[], collecting per-item issues. */
export function validateQuestions(raw: unknown, opts: ValidateOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const valid: Question[] = [];

  if (!Array.isArray(raw)) {
    return { valid, issues: [{ index: -1, message: 'content root must be an array' }] };
  }

  const seenIds = new Set<string>();

  raw.forEach((item, index) => {
    const { question, errors } = validateQuestion(item, opts);
    const id = isRecord(item) && typeof item.id === 'string' ? item.id : undefined;

    if (id) {
      if (seenIds.has(id)) errors.push(`duplicate question id "${id}"`);
      seenIds.add(id);
    }

    if (question && errors.length === 0) {
      valid.push(question);
    } else {
      for (const message of errors) issues.push({ index, questionId: id, message });
    }
  });

  return { valid, issues };
}
