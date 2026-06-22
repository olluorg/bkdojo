import { useState } from 'react';
import { SUBMIT_HINT, onCmdEnter } from './keyboard';

interface Props {
  /** The AI's single clarifying question, or a rubric-based nudge. */
  question: string;
  /**
   * `almost` — a near-miss (partial) answer: encouraging "you're close, think
   * again" tone. `depth` — a brief but correct answer probed for depth.
   */
  variant?: 'depth' | 'almost';
  onSubmit: (text: string) => void;
  onSkip: () => void;
  busy?: boolean;
}

const COPY = {
  almost: {
    meta: 'Почти! Небольшая наводка',
    placeholder: 'Допиши, чего не хватило…',
    submit: 'Проверить',
  },
  depth: {
    meta: 'Уточняющий вопрос · проверим глубину',
    placeholder: 'Коротко добавь — это поможет оценке…',
    submit: 'Ответить',
  },
} as const;

/**
 * Shown before the verdict as a gentle "second chance": instead of jumping to
 * the result, the learner gets one hint to reconsider. Answering can only help
 * the verdict (best of the two is kept); skipping accepts the original.
 */
export function ClarifyCard({ question, variant = 'depth', onSubmit, onSkip, busy }: Props) {
  const [text, setText] = useState('');
  const copy = COPY[variant];
  const canSubmit = !busy && text.trim().length > 0;
  const submit = () => {
    if (canSubmit) onSubmit(text);
  };

  return (
    <div className="card">
      <div className="card__meta">{copy.meta}</div>
      <p className="card__prompt">{question}</p>

      <textarea
        className="textarea"
        rows={4}
        value={text}
        disabled={busy}
        placeholder={copy.placeholder}
        aria-label="Ответ на уточняющий вопрос"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onCmdEnter(submit)}
      />

      <div className="card__actions">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : copy.submit}
        </button>
        <button className="btn btn--ghost" disabled={busy} onClick={onSkip}>
          Пропустить
        </button>
        <span className="card__shortcut">{SUBMIT_HINT}</span>
      </div>
    </div>
  );
}
