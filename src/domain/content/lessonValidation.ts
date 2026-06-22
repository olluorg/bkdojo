import { isDomain, type Domain } from '../models/common';
import type { Lesson, LessonSection } from '../models/lesson';

export interface LessonValidationIssue {
  index: number;
  lessonId?: string;
  message: string;
}

export interface LessonValidationResult {
  valid: Lesson[];
  issues: LessonValidationIssue[];
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

const INTERACTIVE_KINDS = new Set(['param-demo', 'stepper']);

/**
 * Validates the *shape* of `section.interactive` only. Whether `id` maps to a real
 * widget is the renderer's concern (the registry lives in the components layer, so
 * importing it here would cross domain→UI boundaries); an unknown id degrades
 * gracefully at render time.
 */
function validateInteractive(raw: unknown, errors: string[]): void {
  if (!isRecord(raw)) {
    errors.push('section.interactive must be an object when present');
    return;
  }
  if (typeof raw.kind !== 'string' || !INTERACTIVE_KINDS.has(raw.kind)) {
    errors.push('section.interactive.kind must be one of: param-demo, stepper');
  }
  if (!isNonEmptyString(raw.id)) errors.push('section.interactive.id must be a non-empty string');
  if (raw.title !== undefined && typeof raw.title !== 'string') {
    errors.push('section.interactive.title must be a string when present');
  }
  if (raw.caption !== undefined && typeof raw.caption !== 'string') {
    errors.push('section.interactive.caption must be a string when present');
  }
}

function validateSections(raw: unknown, errors: string[]): LessonSection[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.push('sections must be a non-empty array');
    return undefined;
  }
  for (const section of raw) {
    if (!isRecord(section)) {
      errors.push('each section must be an object');
      return undefined;
    }
    if (!isNonEmptyString(section.heading)) errors.push('section.heading must be a non-empty string');
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0 || !isStringArray(section.paragraphs)) {
      errors.push('section.paragraphs must be a non-empty string[]');
    }
    if (section.code !== undefined && typeof section.code !== 'string') {
      errors.push('section.code must be a string when present');
    }
    if (section.interactive !== undefined) validateInteractive(section.interactive, errors);
  }
  return errors.length === 0 ? (raw as unknown as LessonSection[]) : undefined;
}

function validateLesson(
  raw: unknown,
  expectedDomain: Domain | undefined,
): { lesson?: Lesson; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(raw)) return { errors: ['lesson must be an object'] };

  if (!isNonEmptyString(raw.id)) errors.push('id must be a non-empty string');
  if (!isDomain(raw.domain)) {
    errors.push('domain is invalid');
  } else if (expectedDomain && raw.domain !== expectedDomain) {
    errors.push(`domain "${raw.domain}" does not match file domain "${expectedDomain}"`);
  }
  if (!isNonEmptyString(raw.topic)) errors.push('topic must be a non-empty string');
  if (!isNonEmptyString(raw.title)) errors.push('title must be a non-empty string');
  if (!isNonEmptyString(raw.summary)) errors.push('summary must be a non-empty string');
  if (typeof raw.order !== 'number') errors.push('order must be a number');
  if (raw.relatedTags !== undefined && !isStringArray(raw.relatedTags)) {
    errors.push('relatedTags must be a string[] when present');
  }
  if (raw.questionIds !== undefined && !isStringArray(raw.questionIds)) {
    errors.push('questionIds must be a string[] when present');
  }
  if (raw.related !== undefined && !isStringArray(raw.related)) {
    errors.push('related must be a string[] when present');
  }
  validateSections(raw.sections, errors);

  if (errors.length > 0) return { errors };
  return { lesson: raw as unknown as Lesson, errors };
}

export function validateLessons(
  raw: unknown,
  opts: { expectedDomain?: Domain } = {},
): LessonValidationResult {
  const issues: LessonValidationIssue[] = [];
  const valid: Lesson[] = [];

  if (!Array.isArray(raw)) {
    return { valid, issues: [{ index: -1, message: 'lesson root must be an array' }] };
  }

  const seenIds = new Set<string>();
  raw.forEach((item, index) => {
    const { lesson, errors } = validateLesson(item, opts.expectedDomain);
    const id = isRecord(item) && typeof item.id === 'string' ? item.id : undefined;
    if (id) {
      if (seenIds.has(id)) errors.push(`duplicate lesson id "${id}"`);
      seenIds.add(id);
    }
    if (lesson && errors.length === 0) valid.push(lesson);
    else for (const message of errors) issues.push({ index, lessonId: id, message });
  });

  return { valid, issues };
}
