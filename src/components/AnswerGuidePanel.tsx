import type { AnswerGuide } from '../domain/models/question';

/** Shows the "how to answer in an interview" guide after an answer is submitted. */
export function AnswerGuidePanel({ guide }: { guide: AnswerGuide }) {
  return (
    <div className="guide">
      <h3 className="guide__h">Как ответить на собеседовании</h3>
      <p>
        <strong>Кратко:</strong> {guide.short}
      </p>
      <p>
        <strong>Развёрнуто:</strong> {guide.normal}
      </p>

      {guide.traps.length > 0 && (
        <>
          <h4 className="guide__sub">Частые ошибки</h4>
          <ul>
            {guide.traps.map((trap, i) => (
              <li key={i}>{trap}</li>
            ))}
          </ul>
        </>
      )}

      {guide.followUps.length > 0 && (
        <>
          <h4 className="guide__sub">Возможные доп. вопросы</h4>
          <ul>
            {guide.followUps.map((followUp, i) => (
              <li key={i}>{followUp}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
