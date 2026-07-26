/**
 * Minimal ambient types for the Web Speech API (speech recognition).
 *
 * NOTE: lib.dom already declares the event and result types
 * (`SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`, …) but neither the
 * recognizer interface itself nor the global constructor, which is still
 * vendor-prefixed almost everywhere. Only what dictation needs is declared here,
 * and it is isolated so the rest of the code never touches
 * `window.webkitSpeechRecognition` directly — only `domain/speech/dictation`.
 */

export interface SpeechRecognizer extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export interface SpeechRecognizerStatic {
  new (): SpeechRecognizer;
}
