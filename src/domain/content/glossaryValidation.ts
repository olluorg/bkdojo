import { isDifficulty, isDomain } from '../models/common';
import type { GlossaryTerm } from '../models/glossary';

export interface GlossaryIssue {
  index: number;
  termId?: string;
  message: string;
}

export interface GlossaryValidationResult {
  valid: GlossaryTerm[];
  issues: GlossaryIssue[];
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

export function validateGlossary(raw: unknown): GlossaryValidationResult {
  const issues: GlossaryIssue[] = [];
  const valid: GlossaryTerm[] = [];

  if (!Array.isArray(raw)) {
    return { valid, issues: [{ index: -1, message: 'glossary root must be an array' }] };
  }

  const seenIds = new Set<string>();
  raw.forEach((item, index) => {
    const errors: string[] = [];
    const id = isRecord(item) && typeof item.id === 'string' ? item.id : undefined;

    if (!isRecord(item)) {
      issues.push({ index, message: 'term must be an object' });
      return;
    }
    if (!isNonEmptyString(item.id)) errors.push('id must be a non-empty string');
    if (!isNonEmptyString(item.term)) errors.push('term must be a non-empty string');
    if (!isNonEmptyString(item.definition)) errors.push('definition must be a non-empty string');
    if (!isDomain(item.domain)) errors.push('domain (course) is invalid');
    if (!isDifficulty(item.level)) errors.push('level must be 1..5');
    if (item.aliases !== undefined && !isStringArray(item.aliases)) {
      errors.push('aliases must be a string[] when present');
    }
    if (id) {
      if (seenIds.has(id)) errors.push(`duplicate term id "${id}"`);
      seenIds.add(id);
    }

    if (errors.length === 0) valid.push(item as unknown as GlossaryTerm);
    else for (const message of errors) issues.push({ index, termId: id, message });
  });

  return { valid, issues };
}
