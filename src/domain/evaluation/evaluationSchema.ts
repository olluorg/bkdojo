/**
 * JSON schema passed to the Prompt API as `responseConstraint` to force
 * structured output, plus the raw shape we expect back.
 *
 * The model only classifies coverage and writes qualitative feedback — the
 * numeric score is computed deterministically from the rubric weights in
 * `parseEvaluation`, never trusted from the model.
 */
export interface RawConceptEvaluation {
  conceptId: string;
  coverage: 'covered' | 'partial' | 'missing';
  comment?: string;
}

export interface RawEvaluation {
  concepts: RawConceptEvaluation[];
  strengths?: string[];
  gaps?: string[];
  feedback: string;
  suggestedLevel?: number;
}

/**
 * NOTE on strict structured outputs (OpenAI / OpenRouter): when `strict: true`,
 * EVERY property must be listed in `required`. Optional fields are expressed as
 * nullable (`type: [..., 'null']`). `parseEvaluation` tolerates null/absent.
 */
export function buildEvaluationSchema(conceptIds: string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['concepts', 'strengths', 'gaps', 'feedback', 'suggestedLevel'],
    properties: {
      concepts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['conceptId', 'coverage', 'comment'],
          properties: {
            conceptId: { type: 'string', enum: conceptIds },
            coverage: { type: 'string', enum: ['covered', 'partial', 'missing'] },
            comment: { type: ['string', 'null'] },
          },
        },
      },
      strengths: { type: 'array', items: { type: 'string' } },
      gaps: { type: 'array', items: { type: 'string' } },
      feedback: { type: 'string' },
      suggestedLevel: { type: ['integer', 'null'] },
    },
  };
}
