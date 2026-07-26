import type { ReactNode } from 'react';
import {
  DICTATION_ERROR_TEXT,
  TARGET_MAX_SECONDS,
  TARGET_MIN_SECONDS,
  appendChunk,
  formatDuration,
  pacingFor,
  type Pacing,
} from '../domain/speech/dictation';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { SUBMIT_HINT, onCmdEnter } from './keyboard';

/** Coaching for the answer length, shown live while recording. */
const PACING_HINT: Record<Pacing, string> = {
  warmup: 'Начни с главного — одним предложением.',
  good: 'Хороший темп. Держи структуру: что → почему → пример.',
  over: 'Уже длинно — на собеседовании пора закругляться.',
};

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  rows?: number;
  placeholder?: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  submitLabel?: string;
  /** Rendered after the submit button (e.g. a "skip" action). */
  secondary?: ReactNode;
}

/**
 * The shared answer input: dictation plus a textarea, used everywhere the learner
 * says something in their own words — the opening answer and every interviewer
 * follow-up.
 *
 * Speech is the primary path (an interview answer is spoken, not typed) but the
 * recognized text lands in an ordinary editable textarea, so a misheard word
 * never costs the answer and browsers without the API simply see a textarea.
 */
export function AnswerComposer({
  value,
  onChange,
  onSubmit,
  busy,
  rows = 6,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  submitLabel = 'Проверить',
  secondary,
}: Props) {
  // Recreated every render, so the hook's ref always holds the latest `value`.
  const speech = useSpeechInput((chunk) => onChange(appendChunk(value, chunk)));

  const listening = speech.state === 'listening';
  const canSubmit = !busy && value.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    speech.stop();
    onSubmit();
  };

  const pacing = pacingFor(Math.floor(speech.elapsedMs / 1000));

  return (
    <>
      {speech.supported && (
        <div className="dictation">
          <div className="dictation__controls">
            <button
              type="button"
              className={listening ? 'btn btn--rec btn--rec-on' : 'btn btn--rec'}
              onClick={listening ? speech.stop : speech.start}
              disabled={busy}
              aria-pressed={listening}
            >
              <span className="dictation__dot" aria-hidden />
              {listening ? 'Стоп' : 'Ответить голосом'}
            </button>

            {listening && (
              <span className={`dictation__timer dictation__timer--${pacing}`}>
                {formatDuration(speech.elapsedMs)}
              </span>
            )}
          </div>

          <p className="dictation__hint">
            {listening
              ? PACING_HINT[pacing]
              : `Проговори ответ вслух, как на собеседовании — ${TARGET_MIN_SECONDS}–${TARGET_MAX_SECONDS} секунд. Текст можно поправить перед отправкой.`}
          </p>

          {speech.interim && <p className="dictation__interim">{speech.interim}</p>}
          {speech.error && <p className="dictation__error">{DICTATION_ERROR_TEXT[speech.error]}</p>}

          <p className="sr-only" role="status" aria-live="polite">
            {listening ? 'Идёт запись ответа' : ''}
          </p>
        </div>
      )}

      <textarea
        className="textarea"
        rows={rows}
        value={value}
        disabled={busy}
        placeholder={
          placeholder ??
          (speech.supported
            ? 'Скажи вслух или напиши — так, как ответил бы на собеседовании…'
            : 'Ответь так, как ответил бы на собеседовании…')
        }
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onCmdEnter(submit)}
      />

      <div className="card__submit">
        <button className="btn" disabled={!canSubmit} onClick={submit}>
          {busy ? 'Проверяю…' : submitLabel}
        </button>
        {secondary}
        <span className="card__shortcut">{SUBMIT_HINT}</span>
      </div>
    </>
  );
}
