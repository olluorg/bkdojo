import type { SpeechRecognizer, SpeechRecognizerStatic } from '../../types/speech';

/**
 * Spoken answers for open questions.
 *
 * The product reason for dictation: an interview answer is *produced out loud*,
 * not recognized among four options and not typed at leisure. Speaking is also
 * far cheaper than typing a paragraph, which is what makes a daily session
 * survivable.
 *
 * The pacing band below is part of the training, not decoration — a good
 * interview answer is long enough to have structure and short enough not to
 * ramble, so the timer teaches that length alongside the content.
 */

export const TARGET_MIN_SECONDS = 30;
export const TARGET_MAX_SECONDS = 90;

export type Pacing = 'warmup' | 'good' | 'over';

export function pacingFor(seconds: number): Pacing {
  if (seconds < TARGET_MIN_SECONDS) return 'warmup';
  if (seconds <= TARGET_MAX_SECONDS) return 'good';
  return 'over';
}

/** `m:ss` for the recording timer. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Appends one finalized recognition chunk to the answer so far. Recognition
 * emits bare phrases without punctuation, so chunks are joined with a single
 * space and inner whitespace is collapsed — deliberately dumb, because the
 * learner edits the transcript before submitting anyway.
 */
export function appendChunk(existing: string, chunk: string): string {
  const next = chunk.trim().replace(/\s+/g, ' ');
  if (!next) return existing;
  const base = existing.trim();
  return base ? `${base} ${next}` : next;
}

/** The (usually vendor-prefixed) constructor, if this browser has one. */
function recognizerCtor(): SpeechRecognizerStatic | undefined {
  if (typeof window === 'undefined') return undefined;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognizerStatic;
    webkitSpeechRecognition?: SpeechRecognizerStatic;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

export function speechSupported(): boolean {
  return recognizerCtor() !== undefined;
}

export const DICTATION_LANG = 'ru-RU';

/** Creates a recognizer configured for one long, continuous spoken answer. */
export function createRecognizer(lang: string = DICTATION_LANG): SpeechRecognizer | undefined {
  const Ctor = recognizerCtor();
  if (!Ctor) return undefined;
  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.maxAlternatives = 1;
  return recognizer;
}

/** Errors worth surfacing. Everything else is transient and simply restarted. */
export type DictationError = 'denied' | 'no-device' | 'failed';

/**
 * Maps a `SpeechRecognitionErrorEvent.error` code to what the learner should be
 * told. `undefined` means "transient" — a silence timeout or our own stop — and
 * must not interrupt the session with an error.
 */
export function classifyError(code: string): DictationError | undefined {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
  if (code === 'audio-capture') return 'no-device';
  if (code === 'no-speech' || code === 'aborted') return undefined;
  return 'failed';
}

export const DICTATION_ERROR_TEXT: Record<DictationError, string> = {
  denied: 'Доступ к микрофону запрещён — разреши его в настройках сайта или ответь текстом.',
  'no-device': 'Микрофон не найден — подключи его или ответь текстом.',
  failed: 'Распознавание не сработало — попробуй ещё раз или ответь текстом.',
};
