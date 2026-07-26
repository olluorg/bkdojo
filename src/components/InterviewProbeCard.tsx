import { useState } from 'react';
import type { InterviewTurn } from '../domain/interview/probing';
import { AnswerComposer } from './AnswerComposer';

interface Props {
  /** The follow-up being asked right now. */
  question: string;
  /** Follow-ups already answered in this dialogue. */
  turns: readonly InterviewTurn[];
  /** How many follow-ups this dialogue can still contain, including this one. */
  remaining: number;
  onSubmit: (text: string) => void;
  onSkip: () => void;
  busy?: boolean;
}

/**
 * One turn of the interviewer dialogue.
 *
 * The transcript above the prompt is the point: the learner sees the conversation
 * they are having, not a sequence of graded items. Skipping is always available
 * and always safe — the verdict can only improve from here — so being pressed
 * stays a chance to say more rather than a trap.
 */
export function InterviewProbeCard({
  question,
  turns,
  remaining,
  onSubmit,
  onSkip,
  busy,
}: Props) {
  const [text, setText] = useState('');

  return (
    <div className="card probe">
      <div className="card__meta">
        Интервьюер копает глубже{remaining > 0 ? ` · ещё до ${remaining}` : ''}
      </div>

      {turns.length > 0 && (
        <ol className="probe__transcript">
          {turns.map((turn, i) => (
            <li key={i} className="probe__turn">
              <p className="probe__turn-q">{turn.question}</p>
              <p className="probe__turn-a">{turn.answer}</p>
            </li>
          ))}
        </ol>
      )}

      <p className="card__prompt probe__prompt">{question}</p>

      <AnswerComposer
        value={text}
        onChange={setText}
        onSubmit={() => onSubmit(text)}
        busy={busy}
        rows={4}
        placeholder="Скажи вслух или напиши — коротко и по делу…"
        ariaLabel="Ответ интервьюеру"
        submitLabel="Ответить"
        secondary={
          <button className="btn btn--ghost" disabled={busy} onClick={onSkip}>
            Достаточно
          </button>
        }
      />
    </div>
  );
}
