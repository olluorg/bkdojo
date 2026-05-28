import type { AiAvailability } from '../models/evaluation';

/**
 * Detects whether the Chrome Built-in AI / Prompt API is usable.
 *
 * This is the ONLY place (besides ChromePromptEvaluator) that touches the
 * global `LanguageModel`. Everything else reads the resulting AiAvailability.
 * Full evaluation wiring lands in M3 — this is the M0 detection stub.
 */
export async function detectAiAvailability(): Promise<AiAvailability> {
  try {
    const lm = globalThis.LanguageModel;
    if (!lm || typeof lm.availability !== 'function') return 'unavailable';
    return await lm.availability();
  } catch {
    return 'unavailable';
  }
}

/** True when open answers can be AI-evaluated right now (model ready). */
export function isAiReady(availability: AiAvailability): boolean {
  return availability === 'available';
}
