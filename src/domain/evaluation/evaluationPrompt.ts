import type { EvaluationInput } from '../models/evaluation';

export interface PromptParts {
  system: string;
  user: string;
}

const SYSTEM = [
  'Ты — доброжелательный, но справедливый интервьюер по backend-разработке (Java/Kotlin).',
  'Тебе дают вопрос, критерии оценки (rubric) и ответ кандидата.',
  'Для КАЖДОГО критерия определи покрытие: "covered" (суть критерия раскрыта), "partial" (затронут, но неполно/неточно) или "missing" (не затронут).',
  'ВАЖНО: оценивай только саму суть критерия, а не сходство с каким-либо эталоном. Эталона у тебя нет — есть только description критерия. Если кандидат своими словами передал суть, это "covered", даже если формулировка отличается, термины упрощены или используются синонимы.',
  'Не требуй конкретных слов или терминов из description: смысловой парафраз = "covered". Не снижай оценку за лаконичность, за бытовой стиль речи и за отсутствие "красивых" формулировок. Не требуй того, о чём description не спрашивает.',
  'Ставь "partial" только если есть конкретная неточность или явный пробел внутри самого критерия. Ставь "missing" только если критерий по сути вообще не затронут.',
  'Опирайся только на содержание ответа, не додумывай за кандидата.',
  'Пример (для калибровки). Критерий: "Work stealing — свободные worker-потоки забирают задачи из очередей занятых worker-ов". Ответ: "если у воркера закончились задачи, он берёт работу у соседа". Это "covered" — суть передана своими словами без термина "work stealing".',
  'Дай краткий конструктивный feedback на русском языке — как улучшить ответ на собеседовании.',
  'Ответь ТОЛЬКО валидным JSON без markdown, без тройных кавычек и без любого текста вне JSON.',
].join(' ');

/** Builds the system + user prompt for evaluating one open answer. */
export function buildEvaluationPrompt(input: EvaluationInput): PromptParts {
  const { question, answer } = input;
  const targetLevel = input.targetLevel ?? question.difficulty;

  const rubricLines = question.rubric
    .map((c) => {
      const req = c.required ? 'обязательный' : 'дополнительный';
      return `- [${c.id}] ${c.title} (${req}): ${c.description}`;
    })
    .join('\n');

  const codeNote = question.language
    ? `Это задача на код (язык: ${question.language}). Оцени корректность, обработку краевых случаев и стиль решения.`
    : undefined;

  const conceptIds = question.rubric.map((c) => c.id).join(', ');

  const user = [
    `Вопрос: ${question.prompt}`,
    `Целевой уровень сложности (1–5): ${targetLevel}`,
    ...(codeNote ? ['', codeNote] : []),
    '',
    'Критерии оценки (rubric):',
    rubricLines,
    '',
    question.language ? 'Решение кандидата:' : 'Ответ кандидата:',
    '"""',
    answer.trim() || '(пустой ответ)',
    '"""',
    '',
    'Верни ответ СТРОГО в таком JSON (без markdown, без текста вокруг):',
    '{',
    '  "concepts": [',
    '    { "conceptId": "<id критерия>", "coverage": "covered|partial|missing", "comment": "<кратко или null>" }',
    '  ],',
    '  "feedback": "<краткий совет на русском>"',
    '}',
    `conceptId — строго один из: ${conceptIds}. Включи по объекту на каждый критерий rubric.`,
  ].join('\n');

  return { system: SYSTEM, user };
}
