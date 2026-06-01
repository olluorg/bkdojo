import { useState } from 'react';
import { SUBMIT_HINT, onCmdEnter } from './keyboard';

interface Props {
  /** The AI's single clarifying question. */
  question: string;
  onSubmit: (text: string) => void;
  onSkip: () => void;
  busy?: boolean;
}

/**
 * Shown after a brief-but-on-track open answer (directive 3): the AI asks one
 * clarifying question to probe depth. Answering can only help the verdict;
 * skipping accepts the original one — a short answer is fine.
 */
export function ClarifyCard({ question, onSubmit, onSkip, busy }: Props) {
  const [text, setText] = useState('');
  const canSubmit = !busy && text.trim().length > 0;
  const submit = () => {
    if (canSubmit) onSubmit(text);
  };

  return (
    <div className="card">
      <div className="card__meta">Уточняющий вопрос · проверим глубину</div>
      <p className="card__prompt">{question}</p>

      <textarea
        className="textarea"
        rows={4}
        value={text}
        disabled={busy}
        placeholder="Коротко добавь — это поможет оценке…"
        aria-label="Ответ на уточняющий вопрос"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onCmdEnter(submit)}
      />

      <div className="card__actions">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : 'Ответить'}
        </button>
        <button className="btn btn--ghost" disabled={busy} onClick={onSkip}>
          Пропустить
        </button>
        <span className="card__shortcut">{SUBMIT_HINT}</span>
      </div>
    </div>
  );
}
