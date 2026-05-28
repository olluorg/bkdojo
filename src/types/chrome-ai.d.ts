/**
 * Minimal ambient types for the Chrome Built-in AI / Prompt API.
 *
 * NOTE: this API is still evolving (origin trial / flagged). These declarations
 * cover only what the evaluation layer needs and are intentionally loose.
 * They are isolated here so the rest of the code never touches `window.ai`
 * directly — only `domain/evaluation/aiCapability` and `ChromePromptEvaluator`.
 */

export type LanguageModelAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable';

export interface LanguageModelCreateMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: { loaded: number; total?: number }) => void,
  ): void;
}

export interface LanguageModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LanguageModelCreateOptions {
  temperature?: number;
  topK?: number;
  initialPrompts?: LanguageModelMessage[];
  monitor?: (monitor: LanguageModelCreateMonitor) => void;
  signal?: AbortSignal;
}

export interface LanguageModelPromptOptions {
  /** JSON schema constraining structured output. */
  responseConstraint?: unknown;
  signal?: AbortSignal;
}

export interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  destroy(): void;
}

export interface LanguageModelStatic {
  availability(): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

declare global {
  // Newer surface: global `LanguageModel`.
  var LanguageModel: LanguageModelStatic | undefined;
}
