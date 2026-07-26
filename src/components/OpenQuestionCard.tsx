import { useState } from 'react';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { OpenQuestion } from '../domain/models/question';
import { AnswerComposer } from './AnswerComposer';

interface Props {
  question: OpenQuestion;
  onSubmit: (text: string) => void;
  busy?: boolean;
}

export function OpenQuestionCard({ question, onSubmit, busy }: Props) {
  const [text, setText] = useState('');

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty} · открытый ответ
      </div>
      <p className="card__prompt" id={`prompt-${question.id}`}>
        {question.prompt}
      </p>

      <AnswerComposer
        value={text}
        onChange={setText}
        onSubmit={() => onSubmit(text)}
        busy={busy}
        ariaLabel="Твой ответ"
        ariaDescribedBy={`prompt-${question.id}`}
      />
    </div>
  );
}
