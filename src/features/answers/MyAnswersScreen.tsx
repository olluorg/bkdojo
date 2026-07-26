import { EmptyState } from '../../components/EmptyState';
import { getById } from '../../domain/content/contentIndex';
import { DOMAIN_LABELS, DOMAINS } from '../../domain/models/common';
import { myAnswersByDomain } from '../../domain/progress/myAnswers';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useProgress } from '../../state/ProgressContext';

/**
 * "My answers" — everything the learner has managed to say well, in their own
 * words. This is the pre-interview read: not the reference guide, not a readiness
 * percentage, but evidence of your own successful performance.
 */
export function MyAnswersScreen() {
  const { progress } = useProgress();
  const index = useContentIndex();
  const grouped = myAnswersByDomain(progress);

  const total = [...grouped.values()].reduce((sum, list) => sum + list.length, 0);

  if (total === 0) {
    return (
      <section>
        <h1 className="screen__title">Мои ответы</h1>
        <EmptyState
          icon="🗣️"
          title="Пока пусто"
          description="Здесь копятся твои собственные удачные ответы на открытые вопросы — то, что можно перечитать перед собеседованием. Ответь голосом хотя бы на один."
          actionLabel="К практике"
          actionHref="/practice"
        />
      </section>
    );
  }

  return (
    <section>
      <h1 className="screen__title">Мои ответы</h1>
      <p className="screen__note">
        {total} — твои формулировки, а не эталон. Это то, что ты уже смог сказать; перечитай перед
        собеседованием.
      </p>

      {DOMAINS.map((domain) => {
        const answers = grouped.get(domain);
        if (!answers || answers.length === 0) return null;

        return (
          <div key={domain} className="lesson-group">
            <h2 className="lesson-group__h">
              {DOMAIN_LABELS[domain]} · {answers.length}
            </h2>
            <ul className="my-answers">
              {answers.map((answer) => {
                const question = getById(index, answer.questionId);
                return (
                  <li key={answer.questionId} className="my-answer">
                    <p className="my-answer__q">{question?.prompt ?? answer.questionId}</p>
                    <p className="my-answer__text">{answer.text}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
