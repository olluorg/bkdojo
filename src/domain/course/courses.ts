import type { ContentIndex } from '../content/contentIndex';
import { DOMAIN_LABELS, DOMAINS, type Difficulty, type Domain } from '../models/common';
import type { Lesson } from '../models/lesson';
import type { UserProgress } from '../models/progress';
import { lessonProgress, lessonStatus } from '../progress/lessonStatus';
import { domainMastery } from '../progress/mastery';

export interface CourseStep {
  lesson: Lesson;
}

export interface Course {
  domain: Domain;
  title: string;
  steps: CourseStep[];
}

/** Full question completion for the step's progress bar (the defense is separate). */
export const STEP_DONE_THRESHOLD = 0.999;

/** Derives sequential courses from the ordered lessons of each domain. */
export function buildCourses(lessons: Lesson[]): Course[] {
  const byDomain = new Map<Domain, Lesson[]>();
  for (const lesson of [...lessons].sort((a, b) => a.order - b.order)) {
    const bucket = byDomain.get(lesson.domain) ?? [];
    bucket.push(lesson);
    byDomain.set(lesson.domain, bucket);
  }

  const courses: Course[] = [];
  for (const domain of DOMAINS) {
    const domainLessons = byDomain.get(domain);
    if (!domainLessons || domainLessons.length === 0) continue;
    courses.push({
      domain,
      title: DOMAIN_LABELS[domain],
      steps: domainLessons.map((lesson) => ({ lesson })),
    });
  }
  return courses;
}

/**
 * 0..1 — how far the learner has completed this step's lesson (its own
 * questions answered correctly at least once). Drives the per-lesson and course
 * progress bars. Course *level* (junior…architect) uses the deeper
 * `domainMastery` instead, so progressing the course and gaining competency stay
 * separate signals.
 */
export function stepProgress(progress: UserProgress, index: ContentIndex, lesson: Lesson): number {
  return lessonProgress(progress, index, lesson);
}

/** Competency level within a course, growing with how much of it is mastered. */
export type CourseLevel = 'junior' | 'middle' | 'senior' | 'architect';

export const COURSE_LEVELS: readonly CourseLevel[] = ['junior', 'middle', 'senior', 'architect'];

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
  architect: 'Architect',
};

export function courseLevelFromMastery(mastery: number): CourseLevel {
  if (mastery >= 0.75) return 'architect';
  if (mastery >= 0.5) return 'senior';
  if (mastery >= 0.25) return 'middle';
  return 'junior';
}

/** Highest term/content level (1..5) unlocked at a given course level. */
export function maxUnlockedLevel(level: CourseLevel): Difficulty {
  if (level === 'architect') return 5;
  if (level === 'senior') return 4;
  if (level === 'middle') return 3;
  return 2;
}

export function courseLevelOf(
  progress: UserProgress,
  index: ContentIndex,
  domain: Domain,
): CourseLevel {
  return courseLevelFromMastery(domainMastery(progress, index, domain));
}

export function isStepDone(progress: UserProgress, index: ContentIndex, lesson: Lesson): boolean {
  // Answering every question is no longer enough — the topic must be defended.
  return lessonStatus(progress, index, lesson) === 'passed';
}

export function courseProgress(
  progress: UserProgress,
  index: ContentIndex,
  course: Course,
): number {
  if (course.steps.length === 0) return 0;
  const sum = course.steps.reduce((acc, s) => acc + stepProgress(progress, index, s.lesson), 0);
  return sum / course.steps.length;
}

/** The first not-yet-cleared lesson — where "Continue" should jump. */
export function nextStep(
  progress: UserProgress,
  index: ContentIndex,
  course: Course,
): Lesson | undefined {
  const pending = course.steps.find((s) => !isStepDone(progress, index, s.lesson));
  return (pending ?? course.steps[0])?.lesson;
}
