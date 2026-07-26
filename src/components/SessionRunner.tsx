import { useEffect, useRef, useState } from 'react';
import { applySelfOverride } from '../domain/evaluation/applySelfOverride';
import {
  evaluateAnswer,
  skipAnswer,
  submitManualAssessment,
} from '../domain/evaluation/evaluationService';
import { isQuestionBookmarked } from '../domain/progress/questionBookmarks';
import { applyHintPenalty, hintsFor } from '../domain/hints/hints';
import {
  MAX_PROBES,
  combineTranscript,
  nextProbeConcept,
  pickBetterOutcome,
  requestProbe,
  type InterviewTurn,
} from '../domain/interview/probing';
import type { AnswerOutcome, ChoiceSubmission } from '../domain/models/answer';
import type { SessionKind } from '../domain/models/event';
import type { EvaluationResult, SelfAssessment } from '../domain/models/evaluation';
import { isChoiceQuestion, isOpenQuestion } from '../domain/models/question';
import type { Session, SessionItem } from '../domain/models/session';
import { clearStepFromHash, hrefFor, routeBase, stepFromHash, writeStepToHash } from '../app/router';
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../state/activeSessionStore';
import { useProgress } from '../state/ProgressContext';
import { Celebration } from './Celebration';
import { ChoiceQuestionCard } from './ChoiceQuestionCard';
import { CodeQuestionCard } from './CodeQuestionCard';
import { InterviewProbeCard } from './InterviewProbeCard';
import { EvaluationResultView } from './EvaluationResultView';
import { ManualAssessmentCard } from './ManualAssessmentCard';
import { OpenQuestionCard } from './OpenQuestionCard';
import { ProgressBar } from './ProgressBar';
import { QuestionChatPanel } from './QuestionChatPanel';

type Phase =
  | { kind: 'answering' }
  | {
      /** The interviewer dialogue: follow-ups asked so far plus the pending one. */
      kind: 'interview';
      originalAnswer: string;
      /** Best outcome seen so far — the floor the dialogue can only improve on. */
      baseOutcome: AnswerOutcome;
      turns: InterviewTurn[];
      probedConceptIds: string[];
      pending: string;
    }
  | { kind: 'manual'; answer: string; evaluation: EvaluationResult }
  | { kind: 'result'; outcome: AnswerOutcome };

interface Props {
  title: string;
  session: Session;
  /** Learning rate bucket for the ability update. */
  mode: 'placement' | 'daily';
  emptyMessage: string;
  onRestart: () => void;
  restartLabel?: string;
  /** Fired once when the last question is recorded, with the main pass's outcomes. */
  onComplete?: (outcomes: AnswerOutcome[]) => void;
  /**
   * Interview conditions: no hints and no "я не знаю". Used by topic defenses,
   * where the whole point is that closing a topic costs something.
   */
  strict?: boolean;
  /**
   * When set, a `session_started` event is logged once on a fresh start (skipped
   * on resume after a refresh). Lesson tests pass nothing — they aren't one of
   * the tracked daily-loop session kinds.
   */
  activityKind?: SessionKind;
  /**
   * Optional primary action on the completion screen, e.g. "next lesson". When
   * present it becomes the primary button and the restart action is demoted to a
   * secondary (ghost) button.
   */
  nextAction?: { label: string; path: string };
  /**
   * When provided, the main pass is followed by a "work on mistakes" round built
   * from its outcomes (directives 1 & 2: re-ask wrong answers, probe missing
   * parts). Returning an empty list means there is nothing to revisit.
   */
  buildCorrectiveRound?: (outcomes: AnswerOutcome[]) => Promise<SessionItem[]>;
}

function clampStep(step: number, session: Session): number {
  if (session.items.length === 0) return 0;
  return Math.min(Math.max(step, 0), session.items.length - 1);
}

/**
 * Runs a Session through the answer → [clarify] → [manual] → result loop,
 * recording each outcome into progress. Shared by daily practice, review and
 * lessons.
 *
 * The main session and current question are persisted (per-tab) and the step is
 * mirrored into the hash (`…/q<n>`), so refreshing the page resumes the same
 * session at the same question. The optional corrective round (lessons) runs
 * after the main pass and is transient — not resumed across reloads.
 */
export function SessionRunner({
  title,
  session,
  mode,
  emptyMessage,
  onRestart,
  restartLabel,
  onComplete,
  buildCorrectiveRound,
  nextAction,
  activityKind,
  strict = false,
}: Props) {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';

  // Resume key + restored state are read once, at mount, before the URL changes.
  const storeKey = useRef(routeBase()).current;
  const restored = useRef(loadActiveSession(storeKey)).current;

  const [activeSession] = useState<Session>(() => restored?.session ?? session);
  const [step, setStep] = useState<number>(() =>
    clampStep(restored ? restored.step : stepFromHash() ?? 0, restored?.session ?? session),
  );
  const [phase, setPhase] = useState<Phase>({ kind: 'answering' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Hints used on the *current* question (reset on advance). Drives the mild
  // score cap so help never feels like a hard failure but still keeps ability
  // honest. See domain/hints.
  const [hintsUsed, setHintsUsed] = useState(0);

  // Corrective ("work on mistakes") round, appended after the main pass.
  const [round, setRound] = useState<'main' | 'corrective'>('main');
  const [corrective, setCorrective] = useState<SessionItem[]>([]);
  const [preparing, setPreparing] = useState(false);
  const outcomes = useRef<AnswerOutcome[]>([]);

  // Persist the (possibly freshly built) session and sync the hash on mount.
  useEffect(() => {
    if (activeSession.items.length === 0) return;
    saveActiveSession(storeKey, activeSession, step);
    writeStepToHash(step);
    // Log the start of a fresh session once. `restored` means we resumed after a
    // refresh — don't double-count that as a new session.
    if (activityKind && !restored) {
      dispatch({ type: 'logEvent', event: { type: 'session_started', refId: activityKind } });
    }
    // Mount-only: subsequent updates are handled in handleNext.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function endSession() {
    clearActiveSession(storeKey);
    clearStepFromHash();
  }

  function handleRestart() {
    endSession();
    onRestart();
  }

  if (activeSession.items.length === 0) {
    return (
      <section>
        <h1 className="screen__title">{title}</h1>
        <p className="screen__note">{emptyMessage}</p>
        <div className="session-done__actions">
          {nextAction && (
            <a className="btn" href={hrefFor(nextAction.path)}>
              {nextAction.label}
            </a>
          )}
          <button className="btn btn--ghost" onClick={handleRestart}>
            {restartLabel ?? 'Обновить'}
          </button>
        </div>
      </section>
    );
  }

  if (done) {
    // Breakdown of the main pass — corrective re-asks aren't counted twice.
    const results = outcomes.current;
    const total = results.length || activeSession.items.length;
    const correct = results.filter((o) => o.verdict === 'correct').length;
    const partial = results.filter((o) => o.verdict === 'partial').length;
    const wrong = results.filter((o) => o.verdict === 'incorrect').length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const praise =
      accuracy >= 80
        ? { emoji: '🎉', title: 'Отлично!' }
        : accuracy >= 50
          ? { emoji: '💪', title: 'Хорошо, держим темп' }
          : { emoji: '🧱', title: 'Есть над чем поработать' };

    return (
      <section className="session-done">
        <Celebration />
        <div className="session-done__hero">
          <span className="session-done__emoji" aria-hidden>
            {praise.emoji}
          </span>
          <h1 className="screen__title">{praise.title}</h1>
          <p className="screen__note">Сессия завершена — отвечено вопросов: {total}.</p>
        </div>

        <div className="stat-block">
          <div className="stat-block__head">
            <span>Точность</span>
            <span className="ability-list__level">{accuracy}%</span>
          </div>
          <ProgressBar value={total ? correct / total : 0} />
        </div>

        <ul className="session-done__breakdown">
          <li className="session-done__item session-done__item--correct">
            <span className="session-done__count">{correct}</span>
            <span className="session-done__label">зачёт</span>
          </li>
          <li className="session-done__item session-done__item--partial">
            <span className="session-done__count">{partial}</span>
            <span className="session-done__label">частично</span>
          </li>
          <li className="session-done__item session-done__item--incorrect">
            <span className="session-done__count">{wrong}</span>
            <span className="session-done__label">не зачёт</span>
          </li>
        </ul>

        <p className="session-done__streak">
          <span aria-hidden>🔥</span> Серия: <strong>{progress.streakDays}</strong> дн.
        </p>

        <div className="session-done__actions">
          {nextAction && (
            <a className="btn" href={hrefFor(nextAction.path)}>
              {nextAction.label}
            </a>
          )}
          <button className={nextAction ? 'btn btn--ghost' : 'btn'} onClick={handleRestart}>
            {restartLabel ?? 'Новая сессия'}
          </button>
          {wrong + partial > 0 && (
            <a className="btn btn--ghost" href={hrefFor('/review')}>
              Повторить слабые места
            </a>
          )}
          <a className="btn btn--ghost" href={hrefFor('/today')}>
            На главную
          </a>
        </div>
      </section>
    );
  }

  const items = round === 'main' ? activeSession.items : corrective;
  const item = items[step];
  if (!item) return null;
  const question = item.question;
  const bookmarked = isQuestionBookmarked(progress, question.id);

  function finish() {
    setDone(true);
    endSession();
    onComplete?.(outcomes.current);
  }

  // All evaluated answers reach the result screen through here so the mild hint
  // penalty (score cap, verdict untouched) is applied in exactly one place.
  function showResult(outcome: AnswerOutcome) {
    setPhase({ kind: 'result', outcome: applyHintPenalty(outcome, hintsUsed) });
  }

  const hints = strict ? [] : hintsFor(question);
  const revealed = hints.slice(0, hintsUsed);

  async function handleChoice(submission: ChoiceSubmission) {
    setBusy(true);
    try {
      const result = await evaluateAnswer(question, submission, { resolver: { method } });
      if (result.kind === 'outcome') showResult(result.outcome);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(text: string) {
    setBusy(true);
    try {
      const result = await evaluateAnswer(
        question,
        { questionId: question.id, type: 'open', text },
        { resolver: { method } },
      );
      if (result.kind !== 'outcome') {
        setPhase({ kind: 'manual', answer: text, evaluation: result.evaluation });
        return;
      }
      const outcome = result.outcome;
      // An open answer opens a dialogue instead of settling a verdict: the
      // interviewer presses on whatever the rubric says is still uncovered. Code
      // tasks are excluded — a worded follow-up doesn't fit a coding exercise.
      if (isOpenQuestion(question) && !question.language) {
        const concept = nextProbeConcept(question, outcome.evaluation, [], 0);
        if (concept) {
          const probe = await requestProbe(question, concept, [], { method });
          if (probe) {
            setPhase({
              kind: 'interview',
              originalAnswer: text,
              baseOutcome: outcome,
              turns: [],
              probedConceptIds: [concept.id],
              pending: probe,
            });
            return;
          }
        }
      }
      showResult(outcome);
    } finally {
      setBusy(false);
    }
  }

  /**
   * One turn of the dialogue: fold the answer into the transcript, re-evaluate
   * the whole thing, then either press on the next gap or settle. The verdict
   * only ever moves up (`pickBetterOutcome`), so answering is always safe.
   */
  async function handleProbeAnswer(text: string) {
    if (phase.kind !== 'interview' || !isOpenQuestion(question)) return;
    setBusy(true);
    try {
      const turns = [...phase.turns, { question: phase.pending, answer: text }];
      const result = await evaluateAnswer(
        question,
        { questionId: question.id, type: 'open', text: combineTranscript(phase.originalAnswer, turns) },
        { resolver: { method } },
      );
      const outcome =
        result.kind === 'outcome'
          ? pickBetterOutcome(phase.baseOutcome, result.outcome)
          : phase.baseOutcome;

      const concept = nextProbeConcept(
        question,
        result.kind === 'outcome' ? result.outcome.evaluation : undefined,
        phase.probedConceptIds,
        turns.length,
      );
      if (concept) {
        const probe = await requestProbe(question, concept, turns, { method });
        if (probe) {
          setPhase({
            ...phase,
            baseOutcome: outcome,
            turns,
            probedConceptIds: [...phase.probedConceptIds, concept.id],
            pending: probe,
          });
          return;
        }
      }
      showResult(outcome);
    } finally {
      setBusy(false);
    }
  }

  function handleEndProbing() {
    if (phase.kind !== 'interview') return;
    showResult(phase.baseOutcome);
  }

  async function handleManual(selfAssessment: SelfAssessment) {
    if (phase.kind !== 'manual' || !isOpenQuestion(question)) return;
    setBusy(true);
    try {
      const outcome = await submitManualAssessment(question, phase.answer, selfAssessment);
      showResult(outcome);
    } finally {
      setBusy(false);
    }
  }

  function handleDontKnow() {
    // "I don't know": count as incorrect and jump straight to the explanation.
    showResult(skipAnswer(question));
  }

  function handleHint() {
    setHintsUsed((n) => Math.min(n + 1, hints.length));
  }

  async function handleNext() {
    if (phase.kind !== 'result') return;
    dispatch({ type: 'record', outcome: phase.outcome, mode });
    if (round === 'main') outcomes.current.push(phase.outcome);

    if (step + 1 < items.length) {
      const nextStep = step + 1;
      setStep(nextStep);
      setPhase({ kind: 'answering' });
      setHintsUsed(0);
      if (round === 'main') {
        saveActiveSession(storeKey, activeSession, nextStep);
        writeStepToHash(nextStep);
      }
      return;
    }

    // End of the main pass: build and enter the corrective round if asked to.
    if (round === 'main' && buildCorrectiveRound) {
      endSession();
      setPreparing(true);
      try {
        const correctiveItems = await buildCorrectiveRound(outcomes.current);
        if (correctiveItems.length > 0) {
          setCorrective(correctiveItems);
          setRound('corrective');
          setStep(0);
          setPhase({ kind: 'answering' });
          setHintsUsed(0);
          return;
        }
      } finally {
        setPreparing(false);
      }
    }
    finish();
  }

  if (preparing) {
    return (
      <section>
        <h1 className="screen__title">{title}</h1>
        <p className="screen__note">Готовлю работу над ошибками…</p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="screen__title">{title}</h1>
      {round === 'corrective' && (
        <div className="banner banner--info">
          Работа над ошибками: вернёмся к тому, что не получилось.
        </div>
      )}
      <div className="session__progress">
        <div className="session__progress-head">
          <p className="screen__note session__progress-label">
            Вопрос {step + 1} из {items.length}
          </p>
          <button
            type="button"
            className={
              bookmarked
                ? 'bookmark-toggle bookmark-toggle--on'
                : 'bookmark-toggle'
            }
            onClick={() =>
              dispatch({
                type: 'setQuestionBookmark',
                questionId: question.id,
                bookmarked: !bookmarked,
              })
            }
            aria-pressed={bookmarked}
            title={bookmarked ? 'Убрать вопрос из закладок' : 'В закладки — повторить позже'}
          >
            {bookmarked ? '★ В закладках' : '☆ В закладки'}
          </button>
        </div>
        <ProgressBar value={(step + (phase.kind === 'result' ? 1 : 0)) / items.length} />
      </div>

      {/* Politely announce the evaluation wait for screen readers. */}
      <p className="sr-only" role="status" aria-live="polite">
        {busy ? 'Проверяю ответ…' : ''}
      </p>

      {phase.kind === 'answering' && isChoiceQuestion(question) && (
        <ChoiceQuestionCard key={question.id} question={question} onSubmit={handleChoice} />
      )}
      {phase.kind === 'answering' &&
        isOpenQuestion(question) &&
        (question.language ? (
          <CodeQuestionCard key={question.id} question={question} onSubmit={handleOpen} busy={busy} />
        ) : (
          <OpenQuestionCard key={question.id} question={question} onSubmit={handleOpen} busy={busy} />
        ))}

      {phase.kind === 'answering' && hints.length > 0 && (
        <div className="session__hints">
          {revealed.length > 0 && (
            <ul className="session__hint-list">
              {revealed.map((hint, i) => (
                <li key={i} className="session__hint">
                  {hint}
                </li>
              ))}
            </ul>
          )}
          {hintsUsed < hints.length && (
            <button className="btn btn--ghost btn--hint" onClick={handleHint} disabled={busy}>
              {hintsUsed === 0 ? 'Подсказка' : `Ещё подсказка (${hints.length - hintsUsed})`}
            </button>
          )}
        </div>
      )}

      {phase.kind === 'answering' && !strict && (
        <button className="btn btn--ghost" onClick={handleDontKnow} disabled={busy}>
          Я не знаю
        </button>
      )}

      {phase.kind === 'interview' && (
        <InterviewProbeCard
          question={phase.pending}
          turns={phase.turns}
          remaining={MAX_PROBES - phase.turns.length}
          onSubmit={handleProbeAnswer}
          onSkip={handleEndProbing}
          busy={busy}
        />
      )}

      {phase.kind === 'manual' && isOpenQuestion(question) && (
        <ManualAssessmentCard
          question={question}
          onSubmit={handleManual}
          busy={busy}
          reason={method === 'manual' ? 'chosen' : 'fallback'}
        />
      )}

      {phase.kind === 'result' && (
        <>
          <EvaluationResultView
            question={question}
            outcome={phase.outcome}
            onSelfOverride={() => {
              dispatch({ type: 'selfOverride' });
              setPhase({ kind: 'result', outcome: applySelfOverride(phase.outcome) });
            }}
          />
          {phase.outcome.verdict !== 'correct' && (
            <QuestionChatPanel key={question.id} question={question} outcome={phase.outcome} />
          )}
          <button className="btn" onClick={handleNext} disabled={busy}>
            {step + 1 >= items.length && !(round === 'main' && buildCorrectiveRound)
              ? 'Завершить'
              : 'Дальше'}
          </button>
        </>
      )}
    </section>
  );
}
