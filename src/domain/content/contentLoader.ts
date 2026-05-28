import javaCore from '../../data/questions/java-core.json';
import springBoot from '../../data/questions/spring-boot.json';
import databases from '../../data/questions/databases.json';
import messageBrokers from '../../data/questions/message-brokers.json';
import systemDesign from '../../data/questions/system-design.json';
import type { Domain } from '../models/common';
import type { Question } from '../models/question';
import { validateQuestions, type ValidationIssue } from './questionValidation';

const SOURCES: { domain: Domain; raw: unknown }[] = [
  { domain: 'java-core', raw: javaCore },
  { domain: 'spring-boot', raw: springBoot },
  { domain: 'databases', raw: databases },
  { domain: 'message-brokers', raw: messageBrokers },
  { domain: 'system-design', raw: systemDesign },
];

export interface LoadedContent {
  questions: Question[];
  issues: ValidationIssue[];
}

/** Loads and validates all bundled question JSON. Invalid items are dropped. */
export function loadContent(): LoadedContent {
  const questions: Question[] = [];
  const issues: ValidationIssue[] = [];

  for (const { domain, raw } of SOURCES) {
    const result = validateQuestions(raw, { expectedDomain: domain });
    questions.push(...result.valid);
    issues.push(...result.issues);
  }

  return { questions, issues };
}

/** Convenience accessor that warns (in dev) about any invalid content. */
export function loadAllQuestions(): Question[] {
  const { questions, issues } = loadContent();
  if (issues.length > 0 && import.meta.env?.DEV) {
    console.warn(`[content] ${issues.length} invalid question(s) dropped`, issues);
  }
  return questions;
}
