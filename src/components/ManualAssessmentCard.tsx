import { useState } from 'react';
import type { SelfAssessment } from '../domain/models/evaluation';
import type { OpenQuestion } from '../domain/models/question';
import { AnswerGuidePanel } from './AnswerGuidePanel';

interface Props {
  question: OpenQuestion;
  onSubmit: (selfAssessment: SelfAssessment) => void;
  busy?: boolean;
  /** Why we're in manual mode: user chose it, or AI was unavailable/failed. */
  reason?: 'chosen' | 'fallback';
}

const REASON_TEXT: Record<'chosen' | 'fallback', string> = {
  chosen: 'Самопроверка (выбрана в настройках) — отметь раскрытые пункты по эталону.',
  fallback: 'AI-оценка недоступна — оцени сам по эталону.',
};

/** Phase 2 of the manual fallback: the user self-marks which concepts they covered. */
export function ManualAssessmentCard({ question, onSubmit, busy, reason = 'fallback' }: Props) {
  const [covered, setCovered] = useState<string[]>([]);

  function toggle(id: string) {
    setCovered((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    const selfScore = question.rubric.length === 0 ? 0 : covered.length / question.rubric.length;
    onSubmit({ coveredConceptIds: covered, selfScore });
  }

  return (
    <div className="card">
      <div className="card__meta">{REASON_TEXT[reason]}</div>
      <AnswerGuidePanel guide={question.answerGuide} />

      <h4 className="guide__sub">Что из этого ты раскрыл(а) в ответе?</h4>
      <div className="options">
        {question.rubric.map((rc) => (
          <button
            key={rc.id}
            className={covered.includes(rc.id) ? 'option option--selected' : 'option'}
            onClick={() => toggle(rc.id)}
          >
            {rc.title}
          </button>
        ))}
      </div>

      <button className="btn" disabled={busy} onClick={submit}>
        Засчитать самооценку
      </button>
    </div>
  );
}
