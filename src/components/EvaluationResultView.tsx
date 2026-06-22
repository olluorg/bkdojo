import type { AnswerOutcome } from '../domain/models/answer';
import { DOMAIN_LABELS } from '../domain/models/common';
import type { ConceptCoverage, Verdict } from '../domain/models/evaluation';
import {
  isChoiceQuestion,
  isFillBlankQuestion,
  isOpenQuestion,
  templateSegments,
  type Question,
} from '../domain/models/question';
import { normalizeBlank } from '../domain/scoring/fillBlankScorer';
import { orderedOptions } from '../domain/util/shuffle';
import { AnswerGuidePanel } from './AnswerGuidePanel';

const VERDICT_LABELS: Record<Verdict, string> = {
  correct: 'Зачёт',
  partial: 'Частично',
  incorrect: 'Не зачёт',
};

const COVERAGE_LABELS: Record<ConceptCoverage, string> = {
  covered: 'раскрыто',
  partial: 'частично',
  missing: 'не раскрыто',
};

interface CoverageGap {
  title: string;
  coverage: ConceptCoverage;
  comment?: string;
}

interface Props {
  question: Question;
  outcome: AnswerOutcome;
  /** Remaining self-override credits; when > 0 and verdict ≠ correct, a button is shown. */
  selfOverrideCredits?: number;
  /** Fired when the learner spends a credit to mark their answer correct. */
  onSelfOverride?: () => void;
}

export function EvaluationResultView({
  question,
  outcome,
  selfOverrideCredits,
  onSelfOverride,
}: Props) {
  const evaluation = outcome.evaluation;
  const gaps: CoverageGap[] = [];
  if (evaluation && isOpenQuestion(question)) {
    for (const rc of question.rubric) {
      const cr = evaluation.concepts.find((c) => c.conceptId === rc.id);
      const coverage = cr?.coverage ?? 'missing';
      if (coverage !== 'covered') gaps.push({ title: rc.title, coverage, comment: cr?.comment });
    }
  }
  const canSelfOverride =
    !!onSelfOverride &&
    isOpenQuestion(question) &&
    outcome.verdict !== 'correct' &&
    !outcome.selfOverride &&
    outcome.evaluatedBy !== 'skipped' &&
    (selfOverrideCredits ?? 0) > 0;

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
        {VERDICT_LABELS[outcome.verdict]}
      </span>

      {outcome.evaluatedBy === 'skipped' && (
        <p className="result__feedback">Вопрос пропущен — вот как на него ответить.</p>
      )}

      {outcome.assisted && (
        <p className="result__feedback">Засчитан лучший результат — с учётом наводки.</p>
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

      {isFillBlankQuestion(question) && (
        <p className="fill-blank fill-blank--result">
          {templateSegments(question.template).map((seg, i) => {
            if (seg.kind === 'text') return <span key={i}>{seg.text}</span>;
            const blank = question.blanks.find((b) => b.id === seg.id);
            const given = outcome.blankAnswers?.[seg.id]?.trim() ?? '';
            const ok =
              given.length > 0 &&
              !!blank?.accept.some((a) => normalizeBlank(a) === normalizeBlank(given));
            const canonical = blank?.accept[0] ?? '';
            return (
              <span
                key={i}
                className={ok ? 'fill-blank__slot fill-blank__slot--ok' : 'fill-blank__slot fill-blank__slot--bad'}
              >
                <span className="fill-blank__given">{given || '∅'}</span>
                {!ok && <span className="fill-blank__correct"> → {canonical}</span>}
              </span>
            );
          })}
        </p>
      )}

      {evaluation && isOpenQuestion(question) && (
        <>
          <div className="result-diagnosis">
            <h3 className="result-diagnosis__title">
              {gaps.length > 0 ? 'Что исправить' : 'Ключевые части раскрыты'}
            </h3>
            {gaps.length > 0 ? (
              <ul className="result-diagnosis__list">
                {gaps.slice(0, 3).map((gap) => (
                  <li key={gap.title}>
                    <strong>{gap.title}</strong>
                    <span> — {COVERAGE_LABELS[gap.coverage]}</span>
                    {gap.comment && <span className="result-diagnosis__comment"> · {gap.comment}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="result__feedback">{evaluation.feedback || 'Ответ покрывает ожидаемые части.'}</p>
            )}
          </div>
          <details className="result-details">
            <summary>Подробная оценка по критериям</summary>
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
          </details>
        </>
      )}

      <details className="result-details" open={outcome.verdict !== 'correct'}>
        <summary>Как ответить на собеседовании</summary>
        <AnswerGuidePanel guide={question.answerGuide} />
      </details>

      {outcome.selfOverride && (
        <p className="result__feedback">Ответ зачтён по самооценке.</p>
      )}

      {canSelfOverride && (
        <div className="result__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onSelfOverride}
            title="Зачесть ответ самостоятельно. Тратится один кредит самооценки."
          >
            Я считаю, что ответил верно ({selfOverrideCredits} осталось)
          </button>
        </div>
      )}
    </div>
  );
}
