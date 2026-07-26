import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyError,
  createRecognizer,
  speechSupported,
  type DictationError,
} from '../domain/speech/dictation';
import type { SpeechRecognizer } from '../types/speech';

export type DictationState = 'idle' | 'listening';

export interface SpeechInput {
  supported: boolean;
  state: DictationState;
  /** Text heard but not yet finalized — shown as a live tail, never stored. */
  interim: string;
  /** Milliseconds since the current recording started (0 while idle). */
  elapsedMs: number;
  error?: DictationError;
  start: () => void;
  stop: () => void;
}

/**
 * Dictation for open answers.
 *
 * Finalized phrases are streamed out through `onFinal` and only the interim tail
 * is kept as state, so the *card* remains the single source of truth for the
 * answer text and the learner can edit what was heard before submitting.
 *
 * Recognition ends itself after a long pause even with `continuous` set, so
 * `onend` restarts it as long as the learner is still recording — thinking in
 * silence for ten seconds must not end the answer.
 */
export function useSpeechInput(onFinal: (chunk: string) => void): SpeechInput {
  const [supported] = useState(speechSupported);
  const [state, setState] = useState<DictationState>('idle');
  const [interim, setInterim] = useState('');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<DictationError | undefined>(undefined);

  const recognizerRef = useRef<SpeechRecognizer | undefined>(undefined);
  /** True while the learner intends to be recording (drives the auto-restart). */
  const recordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const stop = useCallback(() => {
    recordingRef.current = false;
    recognizerRef.current?.stop();
    recognizerRef.current = undefined;
    setState('idle');
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!supported || recordingRef.current) return;
    const recognizer = createRecognizer();
    if (!recognizer) return;

    recognizer.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const alternative = result[0];
        if (!alternative) continue;
        if (result.isFinal) onFinalRef.current(alternative.transcript);
        else pending += alternative.transcript;
      }
      setInterim(pending);
    };

    recognizer.onerror = (event) => {
      const kind = classifyError(event.error);
      if (!kind) return; // transient — `onend` restarts us
      recordingRef.current = false;
      recognizerRef.current = undefined;
      setError(kind);
      setState('idle');
      setInterim('');
    };

    recognizer.onend = () => {
      setInterim('');
      if (!recordingRef.current) {
        setState('idle');
        return;
      }
      // Stopped on silence while the learner is still answering — resume.
      try {
        recognizer.start();
      } catch {
        recordingRef.current = false;
        recognizerRef.current = undefined;
        setState('idle');
      }
    };

    recognizerRef.current = recognizer;
    recordingRef.current = true;
    startedAtRef.current = Date.now();
    setError(undefined);
    setElapsedMs(0);
    setState('listening');

    try {
      recognizer.start();
    } catch {
      recordingRef.current = false;
      recognizerRef.current = undefined;
      setState('idle');
      setError('failed');
    }
  }, [supported]);

  // Recording timer. 250ms keeps `m:ss` from visibly lagging without churn.
  useEffect(() => {
    if (state !== 'listening') return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);

  // Leaving the question mid-recording must release the microphone.
  useEffect(
    () => () => {
      recordingRef.current = false;
      recognizerRef.current?.abort();
      recognizerRef.current = undefined;
    },
    [],
  );

  return { supported, state, interim, elapsedMs, error, start, stop };
}
