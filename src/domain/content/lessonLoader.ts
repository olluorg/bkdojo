import javaCore from '../../data/lessons/java-core.json';
import springBoot from '../../data/lessons/spring-boot.json';
import databases from '../../data/lessons/databases.json';
import messageBrokers from '../../data/lessons/message-brokers.json';
import systemDesign from '../../data/lessons/system-design.json';
import { type Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import { validateLessons, type LessonValidationIssue } from './lessonValidation';

const SOURCES: { domain: Domain; raw: unknown }[] = [
  { domain: 'java-core', raw: javaCore },
  { domain: 'spring-boot', raw: springBoot },
  { domain: 'databases', raw: databases },
  { domain: 'message-brokers', raw: messageBrokers },
  { domain: 'system-design', raw: systemDesign },
];

export interface LoadedLessons {
  lessons: Lesson[];
  issues: LessonValidationIssue[];
}

export function loadLessons(): LoadedLessons {
  const lessons: Lesson[] = [];
  const issues: LessonValidationIssue[] = [];
  for (const { domain, raw } of SOURCES) {
    const result = validateLessons(raw, { expectedDomain: domain });
    lessons.push(...result.valid);
    issues.push(...result.issues);
  }
  return { lessons, issues };
}

export function loadAllLessons(): Lesson[] {
  const { lessons, issues } = loadLessons();
  if (issues.length > 0 && import.meta.env?.DEV) {
    console.warn(`[lessons] ${issues.length} invalid lesson(s) dropped`, issues);
  }
  return [...lessons].sort((a, b) => a.order - b.order);
}
