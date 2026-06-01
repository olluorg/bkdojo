import { useState } from 'react';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { OpenQuestion } from '../domain/models/question';
import { SUBMIT_HINT, onCmdEnter } from './keyboard';

interface Props {
  question: OpenQuestion;
  onSubmit: (text: string) => void;
  busy?: boolean;
}

/** Live-coding card: a monospaced editor seeded with the question's starter code. */
export function CodeQuestionCard({ question, onSubmit, busy }: Props) {
  const [code, setCode] = useState(question.starterCode ?? '');
  const canSubmit = !busy && code.trim().length > 0;
  const submit = () => {
    if (canSubmit) onSubmit(code);
  };

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
        aria-label="Твоё решение"
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={onCmdEnter(submit)}
      />

      <p className="screen__note">
        Запуска кода нет — решение оценит AI по критериям (или ты сам в режиме самопроверки).
      </p>

      <div className="card__submit">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : 'Проверить'}
        </button>
        <span className="card__shortcut">{SUBMIT_HINT}</span>
      </div>
    </div>
  );
}
