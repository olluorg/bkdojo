import { useMemo, useState } from 'react';
import type { ChoiceSubmission } from '../domain/models/answer';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { ChoiceQuestion } from '../domain/models/question';
import { orderedOptions } from '../domain/util/shuffle';

interface Props {
  question: ChoiceQuestion;
  onSubmit: (submission: ChoiceSubmission) => void;
}

export function ChoiceQuestionCard({ question, onSubmit }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const multiple = question.type === 'multiple';
  // Stable per-question shuffle so the correct answer isn't always first.
  const options = useMemo(() => orderedOptions(question.id, question.options), [question.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (!multiple) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty}
        {multiple ? ' · можно выбрать несколько' : ''}
      </div>
      <p className="card__prompt">{question.prompt}</p>

      <div className="options">
        {options.map((option) => (
          <button
            key={option.id}
            className={selected.includes(option.id) ? 'option option--selected' : 'option'}
            onClick={() => toggle(option.id)}
          >
            {option.text}
          </button>
        ))}
      </div>

      <button
        className="btn"
        disabled={selected.length === 0}
        onClick={() =>
          onSubmit({ questionId: question.id, type: question.type, selectedOptionIds: selected })
        }
      >
        Ответить
      </button>
    </div>
  );
}
