import { useState } from 'react';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { OpenQuestion } from '../domain/models/question';

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
      <p className="card__prompt">{question.prompt}</p>

      <textarea
        className="textarea"
        rows={6}
        value={text}
        disabled={busy}
        placeholder="Ответь так, как ответил бы на собеседовании…"
        onChange={(e) => setText(e.target.value)}
      />

      <button className="btn" disabled={busy || text.trim().length === 0} onClick={() => onSubmit(text)}>
        {busy ? 'Проверяю…' : 'Проверить'}
      </button>
    </div>
  );
}
