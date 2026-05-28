import { useState } from 'react';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { OpenQuestion } from '../domain/models/question';

interface Props {
  question: OpenQuestion;
  onSubmit: (text: string) => void;
  busy?: boolean;
}

/** Live-coding card: a monospaced editor seeded with the question's starter code. */
export function CodeQuestionCard({ question, onSubmit, busy }: Props) {
  const [code, setCode] = useState(question.starterCode ?? '');

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty} · live coding
        {question.language ? ` · ${question.language}` : ''}
      </div>
      <p className="card__prompt">{question.prompt}</p>

      <textarea
        className="textarea code-editor"
        rows={10}
        spellCheck={false}
        value={code}
        disabled={busy}
        placeholder="// напиши решение здесь"
        onChange={(e) => setCode(e.target.value)}
      />

      <p className="screen__note">
        Запуска кода нет — решение оценит AI по критериям (или ты сам в режиме самопроверки).
      </p>

      <button className="btn" disabled={busy || code.trim().length === 0} onClick={() => onSubmit(code)}>
        {busy ? 'Проверяю…' : 'Проверить'}
      </button>
    </div>
  );
}
