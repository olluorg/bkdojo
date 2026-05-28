import type { AnswerEvaluator } from '../models/evaluation';
import type { EvalMethod } from '../models/settings';
import { ChromePromptEvaluator } from './ChromePromptEvaluator';
import { ManualFallbackEvaluator } from './ManualFallbackEvaluator';
import { RuleBasedFallbackEvaluator } from './RuleBasedFallbackEvaluator';
import { ServerAiEvaluator, serverEndpoint } from './ServerAiEvaluator';

export interface ResolverConfig {
  /** Explicit evaluator chain — overrides the default (used in tests). */
  evaluators?: AnswerEvaluator[];
  /** User preference for the evaluation method. Defaults to 'auto'. */
  method?: EvalMethod;
  /** Include the keyword fallback before manual. Off by default (tests/emergency). */
  enableRuleBased?: boolean;
}

/**
 * Builds the ordered evaluator chain from the user's preference. Every chain
 * ends with `ManualFallbackEvaluator` as the always-available backstop, so a
 * chosen-but-unavailable evaluator (e.g. Chrome AI on Firefox) still degrades to
 * self-assessment instead of failing.
 *
 * - auto:   Chrome AI → Server (if configured) → [rule-based] → manual
 * - chrome: Chrome AI → manual
 * - server: Server → manual
 * - manual: manual
 */
export function resolveEvaluators(config: ResolverConfig = {}): AnswerEvaluator[] {
  if (config.evaluators) return config.evaluators;

  const method: EvalMethod = config.method ?? 'auto';
  const manual = new ManualFallbackEvaluator();

  if (method === 'manual') return [manual];
  if (method === 'chrome') return [new ChromePromptEvaluator(), manual];
  if (method === 'server') return [new ServerAiEvaluator(), manual];

  // auto (on-device first)
  const chain: AnswerEvaluator[] = [new ChromePromptEvaluator()];
  if (serverEndpoint()) chain.push(new ServerAiEvaluator());
  if (config.enableRuleBased) chain.push(new RuleBasedFallbackEvaluator());
  chain.push(manual);
  return chain;
}
