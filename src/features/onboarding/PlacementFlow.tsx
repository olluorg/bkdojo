import { useState } from 'react';
import { ChoiceQuestionCard } from '../../components/ChoiceQuestionCard';
import type { ContentIndex } from '../../domain/content/contentIndex';
import { evaluateAnswer } from '../../domain/evaluation/evaluationService';
import type { AnswerSubmission } from '../../domain/models/answer';
import { isChoiceQuestion } from '../../domain/models/question';
import { buildPlacementSession } from '../../domain/selection/placementSelector';
import { useProgress } from '../../state/ProgressContext';

/**
 * Placement stepper. Choice-only so it works before any AI model is downloaded;
 * each answer is recorded with the placement learning rate to converge fast.
 */
export function PlacementFlow({ index }: { index: ContentIndex }) {
  const { dispatch } = useProgress();
  const [session] = useState(() =>
    buildPlacementSession(index, { choiceOnly: true, perDomain: 2 }),
  );
  const [step, setStep] = useState(0);

  const item = session.items[step];
  if (!item) return null;
  const question = item.question;

  async function handleSubmit(submission: AnswerSubmission) {
    const result = await evaluateAnswer(question, submission);
    if (result.kind === 'outcome') {
      dispatch({ type: 'record', outcome: result.outcome, mode: 'placement' });
    }
    if (step + 1 >= session.items.length) {
      dispatch({ type: 'completePlacement' });
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div>
      <p className="screen__note">
        Вопрос {step + 1} из {session.items.length}
      </p>
      {isChoiceQuestion(question) ? (
        <ChoiceQuestionCard key={question.id} question={question} onSubmit={handleSubmit} />
      ) : (
        <p className="screen__note">Открытые вопросы появятся в практике.</p>
      )}
    </div>
  );
}
