import { DEFAULT_GOAL, type InterviewGoal } from '../goal/goal';

/** How open answers get evaluated (user preference). */
export type EvalMethod = 'auto' | 'chrome' | 'server' | 'manual';

export interface Settings {
  evalMethod: EvalMethod;
  /** What the learner is actually preparing for. */
  goal: InterviewGoal;
}

export const DEFAULT_SETTINGS: Settings = { evalMethod: 'auto', goal: DEFAULT_GOAL };

export const EVAL_METHOD_LABELS: Record<EvalMethod, string> = {
  auto: 'Авто (по доступности)',
  server: 'Сервер (LLM)',
  chrome: 'Chrome AI',
  manual: 'Самопроверка',
};

export const EVAL_METHOD_HINTS: Record<EvalMethod, string> = {
  auto: 'Сначала Chrome AI, затем сервер (если настроен), иначе самопроверка.',
  server: 'Оценивает облачная LLM через прокси micro-platform (нужен свой провайдер и ключ).',
  chrome: 'Встроенная модель браузера (Chrome Built-in AI), на устройстве.',
  manual: 'Ты сам отмечаешь раскрытые пункты по эталону.',
};
