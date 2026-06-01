import { useEffect, useState } from 'react';
import { ChoiceQuestionCard } from '../../components/ChoiceQuestionCard';
import { CodeQuestionCard } from '../../components/CodeQuestionCard';
import { EvaluationResultView } from '../../components/EvaluationResultView';
import { ManualAssessmentCard } from '../../components/ManualAssessmentCard';
import { OpenQuestionCard } from '../../components/OpenQuestionCard';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { evaluateAnswer, submitManualAssessment } from '../../domain/evaluation/evaluationService';
import { buildMockInterview, summarizeInterview } from '../../domain/interview/mockInterview';
import type { AnswerOutcome, ChoiceSubmission } from '../../domain/models/answer';
import type { Domain } from '../../domain/models/common';
import { isChoiceQuestion, isOpenQuestion, type Question } from '../../domain/models/question';
import type { SelfAssessment } from '../../domain/models/evaluation';
import { RANK_LABELS } from '../../domain/progress/mastery';
import { useProgress } from '../../state/ProgressContext';

interface Props {
  index: ContentIndex;
  domain: Domain;
  title: string;
  onExit: () => void;
  onRestart: () => void;
}

interface Result {
  question: Question;
  outcome: AnswerOutcome;
}

export function MockInterviewRunner({ index, domain, title, onExit, onRestart }: Props) {
  const { progress, dispatch } = useProgress();
  const method = progress.settings?.evalMethod ?? 'auto';
  const [session] = useState(() => buildMockInterview(index, domain, { size: 8 }));
  const [step, setStep] = useState(0);
  const [manualAnswer, setManualAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [finished, setFinished] = useState(false);

  // A mock interview isn't resumed across refreshes, so each mount with real
  // questions is a fresh session start.
  useEffect(() => {
    if (session.items.length > 0) {
      dispatch({ type: 'logEvent', event: { type: 'session_started', refId: 'interview', domain } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (session.items.length === 0) {
    return (
      <section>
        <h1 className="screen__title">{title}</h1>
        <p className="screen__note">Недостаточно вопросов для интервью по этой теме.</p>
        <button className="btn btn--ghost" onClick={onExit}>
          Назад
        </button>
      </section>
    );
  }

  if (finished) {
    const summary = summarizeInterview(results.map((r) => r.outcome));
    return (
      <section>
        <h1 className="screen__title">Итоги интервью</h1>
        <div className="rank">
          <span className={`rank__badge rank__badge--${summary.level}`}>
            {RANK_LABELS[summary.level]}
          </span>
          <div className="rank__meta">
            Верно {summary.correct} из {summary.total} · средний балл {Math.round(summary.avgScore * 100)}%
          </div>
        </div>
        {results.map((r, i) => (
          <EvaluationResultView key={`${r.question.id}-${i}`} question={r.question} outcome={r.outcome} />
        ))}
        <button className="btn" onClick={onRestart}>
          Новое интервью
        </button>
        <button className="btn btn--ghost" onClick={onExit}>
          Выйти
        </button>
      </section>
    );
  }

  const item = session.items[step];
  if (!item) return null;
  const question = item.question;

  function record(outcome: AnswerOutcome) {
    dispatch({ type: 'record', outcome, mode: 'daily' });
    setResults((prev) => [...prev, { question, outcome }]);
    setManualAnswer(null);
    if (step + 1 >= session.items.length) {
      setFinished(true);
      dispatch({ type: 'recordActivity', kind: 'interview' });
    } else {
      setStep((s) => s + 1);
    }
  }

  async function handleChoice(submission: ChoiceSubmission) {
    setBusy(true);
    try {
      const result = await evaluateAnswer(question, submission, { resolver: { method } });
      if (result.kind === 'outcome') record(result.outcome);
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
      if (result.kind === 'outcome') record(result.outcome);
      else setManualAnswer(text);
    } finally {
      setBusy(false);
    }
  }

  async function handleManual(selfAssessment: SelfAssessment) {
    if (manualAnswer === null || !isOpenQuestion(question)) return;
    setBusy(true);
    try {
      record(await submitManualAssessment(question, manualAnswer, selfAssessment));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="screen__title">{title}</h1>
      <p className="screen__note">
        Вопрос {step + 1} из {session.items.length} · разбор будет в конце
      </p>

      {manualAnswer !== null && isOpenQuestion(question) ? (
        <ManualAssessmentCard
          question={question}
          onSubmit={handleManual}
          busy={busy}
          reason={method === 'manual' ? 'chosen' : 'fallback'}
        />
      ) : isChoiceQuestion(question) ? (
        <ChoiceQuestionCard key={question.id} question={question} onSubmit={handleChoice} />
      ) : isOpenQuestion(question) && question.language ? (
        <CodeQuestionCard key={question.id} question={question} onSubmit={handleOpen} busy={busy} />
      ) : (
        <OpenQuestionCard key={question.id} question={question} onSubmit={handleOpen} busy={busy} />
      )}
    </section>
  );
}
