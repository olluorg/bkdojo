import { useEffect, useMemo, useState } from 'react';
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

  function submit() {
    if (selected.length === 0) return;
    onSubmit({ questionId: question.id, type: question.type, selectedOptionIds: selected });
  }

  // Keyboard: 1–9 pick an option, Enter submits. Lets a fast learner run a
  // choice session without the mouse. Ignored while focus is in a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key >= '1' && e.key <= '9') {
        const idx = Number(e.key) - 1;
        if (idx < options.length) {
          e.preventDefault();
          toggle(options[idx]!.id);
        }
      } else if (e.key === 'Enter' && tag !== 'BUTTON') {
        // Let a focused button (e.g. an option, "Я не знаю") handle its own Enter.
        e.preventDefault();
        submit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selected]);

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty}
        {multiple ? ' · можно выбрать несколько' : ''}
      </div>
      <p className="card__prompt">{question.prompt}</p>

      <div className="options" role="group" aria-label="Варианты ответа">
        {options.map((option, i) => (
          <button
            key={option.id}
            className={selected.includes(option.id) ? 'option option--selected' : 'option'}
            aria-pressed={selected.includes(option.id)}
            onClick={() => toggle(option.id)}
          >
            <span className="option__key" aria-hidden>
              {i + 1}
            </span>
            <span>{option.text}</span>
          </button>
        ))}
      </div>

      <div className="card__submit">
        <button className="btn" disabled={selected.length === 0} onClick={submit}>
          Ответить
        </button>
        <span className="card__shortcut">1–9 — выбрать · Enter — ответить</span>
      </div>
    </div>
  );
}
