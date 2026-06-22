import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { FillBlankSubmission } from '../domain/models/answer';
import { DOMAIN_LABELS } from '../domain/models/common';
import { templateSegments, type FillBlankQuestion } from '../domain/models/question';
import { SUBMIT_HINT } from './keyboard';

interface Props {
  question: FillBlankQuestion;
  onSubmit: (submission: FillBlankSubmission) => void;
  busy?: boolean;
  reasonText?: string;
}

export function FillBlankQuestionCard({ question, onSubmit, busy, reasonText }: Props) {
  const segments = useMemo(() => templateSegments(question.template), [question.template]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // The gap a word-bank chip should fill: the last focused one, else the first empty.
  const focused = useRef<string | null>(null);

  const canSubmit =
    !busy && question.blanks.every((b) => (answers[b.id] ?? '').trim().length > 0);

  function setBlank(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function submit() {
    if (canSubmit) onSubmit({ questionId: question.id, type: 'fill-blank', answers });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
      e.preventDefault();
      submit();
    }
  }

  function pickFromBank(word: string) {
    const target =
      focused.current && question.blanks.some((b) => b.id === focused.current)
        ? focused.current
        : question.blanks.find((b) => !(answers[b.id] ?? '').trim())?.id;
    if (target) setBlank(target, word);
  }

  const blankInput = (id: string) => {
    const blank = question.blanks.find((b) => b.id === id);
    const value = answers[id] ?? '';
    const size = Math.max(value.length + 1, blank?.placeholder?.length ?? 6);
    return (
      <input
        key={id}
        type="text"
        className="fill-blank__input"
        value={value}
        size={size}
        disabled={busy}
        placeholder={blank?.placeholder ?? '…'}
        aria-label={`Пропуск ${id}`}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onFocus={() => {
          focused.current = id;
        }}
        onChange={(e) => setBlank(id, e.target.value)}
        onKeyDown={onKeyDown}
      />
    );
  };

  const body = segments.map((seg, i) =>
    seg.kind === 'text' ? <span key={i}>{seg.text}</span> : blankInput(seg.id),
  );

  return (
    <div className="card">
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty} · заполни пропуски
      </div>
      {reasonText && <p className="card__reason">{reasonText}</p>}
      <p className="card__prompt">{question.prompt}</p>

      {question.code ? (
        <pre className="fill-blank fill-blank--code">
          <code>{body}</code>
        </pre>
      ) : (
        <p className="fill-blank fill-blank--text">{body}</p>
      )}

      {question.wordBank && question.wordBank.length > 0 && (
        <div className="fill-blank__bank" role="group" aria-label="Банк слов">
          {question.wordBank.map((word) => (
            <button
              key={word}
              type="button"
              className="fill-blank__chip"
              disabled={busy}
              onClick={() => pickFromBank(word)}
            >
              {word}
            </button>
          ))}
        </div>
      )}

      <div className="card__submit">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : 'Проверить'}
        </button>
        <span className="card__shortcut">Enter — ответить · {SUBMIT_HINT}</span>
      </div>
    </div>
  );
}
