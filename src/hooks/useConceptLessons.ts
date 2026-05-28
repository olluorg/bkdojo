import { useMemo } from 'react';
import { buildConceptLessonMap } from '../domain/lesson/conceptLessons';
import { useContentIndex } from './useContentIndex';
import { useLessons } from './useLessons';

export interface ConceptLesson {
  id: string;
  title: string;
}

/** conceptId → the lesson that teaches it (id + title), for "weak spot" links. */
export function useConceptLessons(): Map<string, ConceptLesson> {
  const index = useContentIndex();
  const { all, byId } = useLessons();

  return useMemo(() => {
    const idMap = buildConceptLessonMap(index, all);
    const out = new Map<string, ConceptLesson>();
    for (const [conceptId, lessonId] of idMap) {
      const lesson = byId.get(lessonId);
      if (lesson) out.set(conceptId, { id: lesson.id, title: lesson.title });
    }
    return out;
  }, [index, all, byId]);
}
