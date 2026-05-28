import { useState } from 'react';

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
        onChange={(e) => setText(e.target.value)}
      />

      <div className="card__actions">
        <button
          className="btn"
          disabled={busy || text.trim().length === 0}
          onClick={() => onSubmit(text)}
        >
          {busy ? 'Проверяю…' : 'Ответить'}
        </button>
        <button className="btn btn--ghost" disabled={busy} onClick={onSkip}>
          Пропустить
        </button>
      </div>
    </div>
  );
}
