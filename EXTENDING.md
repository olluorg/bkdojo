# Extending bkdojo

## Architecture invariant

The UI and the ability/review layers depend **only** on `EvaluationResult` and
`AnswerOutcome` (`src/domain/models/`). They never touch a specific evaluator or
the Chrome Prompt API directly. The only code that touches `window`/`LanguageModel`
is `domain/evaluation/aiCapability.ts` and `domain/evaluation/ChromePromptEvaluator.ts`.

This is what makes the open-answer evaluator swappable.

## Adding a server-side AI evaluator (out of MVP scope)

No UI or domain changes are required — you add one class and register it.

### 1. Implement the evaluator

`src/domain/evaluation/ServerAiEvaluator.ts`:

```ts
import type { AiAvailability, AnswerEvaluator, EvaluationInput, EvaluationResult } from '../models/evaluation';
import { buildEvaluationPrompt } from './evaluationPrompt';
import { parseEvaluation } from './parseEvaluation';

export class ServerAiEvaluator implements AnswerEvaluator {
  readonly id = 'server' as const; // already part of EvaluatorId

  constructor(private readonly endpoint: string) {}

  async availability(): Promise<AiAvailability> {
    // ping your backend / read a config flag
    return 'available';
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const { system, user } = buildEvaluationPrompt(input);
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ system, user }),
    });
    const raw = await res.text();        // backend returns the model's JSON
    return parseEvaluation(raw, input.question); // same normalization as Chrome
  }
}
```

Reusing `buildEvaluationPrompt` + `parseEvaluation` keeps scoring identical to the
on-device path (score is computed from rubric weights, not trusted from the model).

### 2. Register it in the chain

In `src/domain/evaluation/evaluatorResolver.ts`, add it to the chain at the
position your product wants:

- **cloud-first:** `new ServerAiEvaluator(url)` before `ChromePromptEvaluator`
- **on-device-first, cloud fallback:** after `ChromePromptEvaluator`

The chain is tried in order; the first available evaluator that yields a result
wins, and `ManualFallbackEvaluator` stays last as the always-available backstop.

## Adding questions

Append objects to `src/data/questions/<domain>.json`. The shape is validated at
load time by `domain/content/questionValidation.ts`:

- `type: 'single'` → exactly one `correctOptionIds`
- `type: 'multiple'` → one or more
- `type: 'open'` → non-empty `rubric` (the AI grades each concept)
- every question needs an `answerGuide`

Invalid questions are dropped (and warned about in dev), so the app never crashes
on bad content. `bun test` asserts the bundled content has zero validation issues.
