import { hrefFor } from '../app/router';
import type { ConceptLesson } from '../hooks/useConceptLessons';
import type { UserProgress } from '../domain/models/progress';
import { rankWeakConceptStatuses } from '../domain/review/weakSpotLifecycle';

interface Props {
  progress: UserProgress;
  conceptTitles: Map<string, string>;
  conceptLessons?: Map<string, ConceptLesson>;
  limit?: number;
}

/** Shows the concepts the user most often fails to cover, linked to the lesson that teaches them. */
export function WeakConceptsPanel({ progress, conceptTitles, conceptLessons, limit = 5 }: Props) {
  const weak = rankWeakConceptStatuses(progress).slice(0, limit);

  if (weak.length === 0) return null;

  return (
    <div className="weak">
      <h4 className="guide__sub">Слабые концепты</h4>
      <ul className="ability-list">
        {weak.map((concept) => {
          const lesson = conceptLessons?.get(concept.conceptId);
          return (
            <li key={concept.conceptId} className="weak-row">
              <div className="weak-row__head">
                <span>{conceptTitles.get(concept.conceptId) ?? concept.conceptId}</span>
                <span className={`weak-row__state weak-row__state--${concept.state}`}>
                  {concept.label}
                </span>
              </div>
              <div className="weak-row__meta">
                {Math.round(concept.missRate * 100)}% пропусков · {concept.attempts} попыт.
              </div>
              {lesson && (
                <a className="weak-row__lesson" href={hrefFor(`/lessons/${lesson.id}`)}>
                  Подтянуть: {lesson.title} →
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
