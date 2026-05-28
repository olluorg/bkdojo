import { useEffect, useRef, useState } from 'react';
import { applySelfOverride } from '../domain/evaluation/applySelfOverride';
import {
  evaluateAnswer,
  skipAnswer,
  submitManualAssessment,
} from '../domain/evaluation/evaluationService';
import { visibleBalance } from '../domain/progress/overrideCredits';
import {
  combineAnswers,
  pickBetterOutcome,
  requestClarifyingQuestion,
  shouldClarify,
} from '../domain/lesson/clarify';
import type { AnswerOutcome, ChoiceSubmission } from '../domain/models/answer';
import type { EvaluationResult, SelfAssessment } from '../domain/models/evaluation';
import { isChoiceQuestion, isOpenQuestion } from '../domain/models/question';
import type { Session, SessionItem } from '../domain/models/session';
import { clearStepFromHash, routeBase, stepFromHash, writeStepToHash } from '../app/router';
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../state/activeSessionStore';
import { useProgress } from '../state/ProgressContext';
import { ChoiceQuestionCard } from './ChoiceQuestionCard';
import { ClarifyCard } from './ClarifyCard';
import { CodeQuestionCard } from './CodeQuestionCard';
import { EvaluationResultView } from './EvaluationResultView';
import { ManualAssessmentCard } from './ManualAssessmentCard';
import { OpenQuestionCard } from './OpenQuestionCard';
import { QuestionChatPanel } from './QuestionChatPanel';

type Phase =
  | { kind: 'answering' }
  | { kind: 'clarify'; originalAnswer: string; baseOutcome: AnswerOutcome; clarifyQuestion: string }
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
  /** Fired once when the last question is recorded (the session is completed). */
  onComplete?: () => void;
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
        <button className="btn btn--ghost" onClick={handleRestart}>
          {restartLabel ?? 'Обновить'}
        </button>
      </section>
    );
  }

  if (done) {
    return (
      <section>
        <h1 className="screen__title">Сессия завершена</h1>
        <p className="screen__note">
          Отвечено вопросов: {activeSession.items.length}. Серия: {progress.streakDays} дн.
        </p>
        <button className="btn" onClick={handleRestart}>
          {restartLabel ?? 'Новая сессия'}
        </button>
      </section>
    );
  }

  const items = round === 'main' ? activeSession.items : corrective;
  const item = items[step];
  if (!item) return null;
  const question = item.question;

  function finish() {
    setDone(true);
    endSession();
    onComplete?.();
  }

  async function handleChoice(submission: ChoiceSubmission) {
    setBusy(true);
    try {
      const result = await evaluateAnswer(question, submission, { resolver: { method } });
      if (result.kind === 'outcome') setPhase({ kind: 'result', outcome: result.outcome });
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
      const ev = outcome.evaluation;
      // Directive 3: a brief but on-track verbal answer earns one clarifying
      // question to probe depth instead of an immediate verdict. Code tasks are
      // excluded — a worded follow-up doesn't fit a coding exercise.
      if (isOpenQuestion(question) && !question.language && ev && shouldClarify(text, ev)) {
        const clarifyQuestion = await requestClarifyingQuestion(question, ev, { method });
        if (clarifyQuestion) {
          setPhase({ kind: 'clarify', originalAnswer: text, baseOutcome: outcome, clarifyQuestion });
          return;
        }
      }
      setPhase({ kind: 'result', outcome });
    } finally {
      setBusy(false);
    }
  }

  async function handleClarify(text: string) {
    if (phase.kind !== 'clarify') return;
    setBusy(true);
    try {
      const combined = combineAnswers(phase.originalAnswer, text);
      const result = await evaluateAnswer(
        question,
        { questionId: question.id, type: 'open', text: combined },
        { resolver: { method } },
      );
      const outcome =
        result.kind === 'outcome'
          ? pickBetterOutcome(phase.baseOutcome, result.outcome)
          : phase.baseOutcome;
      setPhase({ kind: 'result', outcome });
    } finally {
      setBusy(false);
    }
  }

  function handleSkipClarify() {
    if (phase.kind !== 'clarify') return;
    setPhase({ kind: 'result', outcome: phase.baseOutcome });
  }

  async function handleManual(selfAssessment: SelfAssessment) {
    if (phase.kind !== 'manual' || !isOpenQuestion(question)) return;
    setBusy(true);
    try {
      const outcome = await submitManualAssessment(question, phase.answer, selfAssessment);
      setPhase({ kind: 'result', outcome });
    } finally {
      setBusy(false);
    }
  }

  function handleDontKnow() {
    // "I don't know": count as incorrect and jump straight to the explanation.
    setPhase({ kind: 'result', outcome: skipAnswer(question) });
  }

  async function handleNext() {
    if (phase.kind !== 'result') return;
    dispatch({ type: 'record', outcome: phase.outcome, mode });
    if (round === 'main') outcomes.current.push(phase.outcome);

    if (step + 1 < items.length) {
      const nextStep = step + 1;
      setStep(nextStep);
      setPhase({ kind: 'answering' });
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
      <p className="screen__note">
        Вопрос {step + 1} из {items.length}
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

      {phase.kind === 'answering' && (
        <button className="btn btn--ghost" onClick={handleDontKnow} disabled={busy}>
          Я не знаю
        </button>
      )}

      {phase.kind === 'clarify' && (
        <ClarifyCard
          question={phase.clarifyQuestion}
          onSubmit={handleClarify}
          onSkip={handleSkipClarify}
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
            selfOverrideCredits={visibleBalance(progress.overrideCredits)}
            onSelfOverride={() => {
              dispatch({ type: 'useOverrideCredit' });
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
