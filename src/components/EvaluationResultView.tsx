import type { AnswerOutcome } from '../domain/models/answer';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { ConceptCoverage, Verdict } from '../domain/models/evaluation';
import { isChoiceQuestion, isOpenQuestion, type Question } from '../domain/models/question';
import { orderedOptions } from '../domain/util/shuffle';
import { AnswerGuidePanel } from './AnswerGuidePanel';

/** Choice questions really are a quiz — grade language fits them. */
const VERDICT_LABELS: Record<Verdict, string> = {
  correct: 'Зачёт',
  partial: 'Частично',
  incorrect: 'Не зачёт',
};

/**
 * Open answers close a dialogue, not an exam, so they get the summary a real
 * interviewer would give. Saying what would have happened in the room is also the
 * only feedback that converts into confidence — a grade never does.
 */
const INTERVIEW_VERDICT_LABELS: Record<Verdict, string> = {
  correct: 'На интервью такой ответ проходит',
  partial: 'На интервью тебя бы дожимали',
  incorrect: 'На интервью такой ответ не прошёл бы',
};

const COVERAGE_LABELS: Record<ConceptCoverage, string> = {
  covered: 'раскрыто',
  partial: 'частично',
  missing: 'не раскрыто',
};

interface Props {
  question: Question;
  outcome: AnswerOutcome;
  /** Fired when the learner marks their own answer correct. */
  onSelfOverride?: () => void;
}

export function EvaluationResultView({ question, outcome, onSelfOverride }: Props) {
  const evaluation = outcome.evaluation;
  const canSelfOverride =
    !!onSelfOverride &&
    isOpenQuestion(question) &&
    outcome.verdict !== 'correct' &&
    !outcome.selfOverride &&
    outcome.evaluatedBy !== 'skipped';

  return (
    <div className="card">
      {/* Keep the question visible so the explanation can be read in context. */}
      <div className="card__meta">
        {DOMAIN_LABELS[question.domain]} · сложность {question.difficulty}
      </div>
      <p className="card__prompt">{question.prompt}</p>

      <span
        className={`verdict verdict--${outcome.verdict}`}
        role="status"
        aria-live="polite"
      >
        {isOpenQuestion(question) && outcome.evaluatedBy !== 'skipped'
          ? INTERVIEW_VERDICT_LABELS[outcome.verdict]
          : VERDICT_LABELS[outcome.verdict]}
      </span>

      {outcome.evaluatedBy === 'skipped' && (
        <p className="result__feedback">Вопрос пропущен — вот как на него ответить.</p>
      )}

      {evaluation?.status === 'error' && (
        <div className="banner banner--warn">
          Не удалось получить AI-оценку{evaluation.error ? `: ${evaluation.error}` : ''}.
        </div>
      )}

      {isChoiceQuestion(question) && (
        <ul className="result-options">
          {orderedOptions(question.id, question.options).map((option) => {
            const correct = question.correctOptionIds.includes(option.id);
            return (
              <li
                key={option.id}
                className={correct ? 'result-option result-option--correct' : 'result-option'}
              >
                <span className="result-option__mark">{correct ? '✓' : ''}</span>
                <span>{option.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {evaluation && isOpenQuestion(question) && (
        <>
          {evaluation.feedback && <p className="result__feedback">{evaluation.feedback}</p>}
          <ul className="concepts">
            {question.rubric.map((rc) => {
              const cr = evaluation.concepts.find((c) => c.conceptId === rc.id);
              const coverage = cr?.coverage ?? 'missing';
              return (
                <li key={rc.id} className={`concept concept--${coverage}`}>
                  <span className="concept__title">{rc.title}</span>
                  <span className="concept__cov">{COVERAGE_LABELS[coverage]}</span>
                  {cr?.comment && <span className="concept__comment">{cr.comment}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <AnswerGuidePanel guide={question.answerGuide} />

      {outcome.selfOverride && (
        <p className="result__feedback">Ответ зачтён по самооценке.</p>
      )}

      {canSelfOverride && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onSelfOverride}
          title="Зачесть ответ самостоятельно"
        >
          Я считаю, что ответил верно
        </button>
      )}
    </div>
  );
}
