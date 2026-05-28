import type { LanguageModelStatic } from '../../types/chrome-ai';
import type {
  AiAvailability,
  AnswerEvaluator,
  EvaluationInput,
  EvaluationResult,
} from '../models/evaluation';
import { buildEvaluationPrompt } from './evaluationPrompt';
import { buildEvaluationSchema } from './evaluationSchema';
import { parseEvaluation } from './parseEvaluation';

export class ChromeEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChromeEvaluatorError';
  }
}

export interface ChromePromptDeps {
  /** Resolves the Prompt API entry point. Injectable for testing. */
  getModel: () => LanguageModelStatic | undefined;
  /** Abort the prompt after this many ms; on timeout the resolver falls back. */
  timeoutMs: number;
}

const defaultDeps: ChromePromptDeps = {
  getModel: () => globalThis.LanguageModel,
  timeoutMs: 20_000,
};

/**
 * Primary open-answer evaluator backed by the Chrome Built-in AI / Prompt API.
 * Produces a normalized EvaluationResult; throws on unavailability / timeout /
 * unparseable output so the resolver can fall back to manual.
 */
export class ChromePromptEvaluator implements AnswerEvaluator {
  readonly id = 'chrome-prompt' as const;

  constructor(private readonly deps: ChromePromptDeps = defaultDeps) {}

  async availability(): Promise<AiAvailability> {
    const model = this.deps.getModel();
    if (!model) return 'unavailable';
    try {
      return await model.availability();
    } catch {
      return 'unavailable';
    }
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const model = this.deps.getModel();
    if (!model) throw new ChromeEvaluatorError('Prompt API is unavailable');

    const { system, user } = buildEvaluationPrompt(input);
    const schema = buildEvaluationSchema(input.question.rubric.map((c) => c.id));

    const session = await model.create({
      initialPrompts: [{ role: 'system', content: system }],
      temperature: 0.2,
      topK: 3,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.deps.timeoutMs);
    try {
      const raw = await session.prompt(user, {
        responseConstraint: schema,
        signal: controller.signal,
      });
      return parseEvaluation(raw, input.question);
    } finally {
      clearTimeout(timer);
      session.destroy();
    }
  }
}
