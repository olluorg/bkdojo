import { useState } from 'react';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { OpenQuestion } from '../domain/models/question';
import { SUBMIT_HINT, onCmdEnter } from './keyboard';

interface Props {
  question: OpenQuestion;
  onSubmit: (text: string) => void;
  busy?: boolean;
  reasonText?: string;
}

export function OpenQuestionCard({ question, onSubmit, busy, reasonText }: Props) {
  const [text, setText] = useState('');
  const canSubmit = !busy && text.trim().length > 0;
  const submit = () => {
    if (canSubmit) onSubmit(text);
  };

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty} · открытый ответ
      </div>
      {reasonText && <p className="card__reason">{reasonText}</p>}
      <p className="card__prompt" id={`prompt-${question.id}`}>
        {question.prompt}
      </p>

      <textarea
        className="textarea"
        rows={6}
        value={text}
        disabled={busy}
        placeholder="Ответь так, как ответил бы на собеседовании…"
        aria-label="Твой ответ"
        aria-describedby={`prompt-${question.id}`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onCmdEnter(submit)}
      />

      <div className="card__submit">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : 'Проверить'}
        </button>
        <span className="card__shortcut">{SUBMIT_HINT}</span>
      </div>
    </div>
  );
}
