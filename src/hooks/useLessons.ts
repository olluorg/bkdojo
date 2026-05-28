import { useMemo } from 'react';
import { loadAllLessons } from '../domain/content/lessonLoader';
import type { Domain } from '../domain/models/common';
import type { Lesson } from '../domain/models/lesson';

export interface LessonsData {
  all: Lesson[];
  byDomain: Map<Domain, Lesson[]>;
  byId: Map<string, Lesson>;
}

/** Loads lessons once and groups them by domain (preserving order). */
export function useLessons(): LessonsData {
  return useMemo(() => {
    const all = loadAllLessons();
    const byDomain = new Map<Domain, Lesson[]>();
    const byId = new Map<string, Lesson>();
    for (const lesson of all) {
      const bucket = byDomain.get(lesson.domain) ?? [];
      bucket.push(lesson);
      byDomain.set(lesson.domain, bucket);
      byId.set(lesson.id, lesson);
    }
    return { all, byDomain, byId };
  }, []);
}
