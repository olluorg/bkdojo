import { levelLabel, LEVEL_LABELS } from '../../domain/ability/level';
import { DOMAIN_LABELS, DOMAINS } from '../../domain/models/common';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor } from '../../app/router';
import { GoalEditor } from '../settings/GoalEditor';
import { PlacementFlow } from './PlacementFlow';

export function OnboardingScreen() {
  const index = useContentIndex();
  const { progress, dispatch } = useProgress();

  if (!progress.placementDone) {
    return (
      <section>
        <h1 className="screen__title">Определение уровня</h1>
        <p className="screen__note">
          Несколько вопросов с вариантами — чтобы подобрать сложность. Работает без AI.
        </p>
        <PlacementFlow index={index} />
      </section>
    );
  }

  return (
    <section>
      <h1 className="screen__title">Уровень определён</h1>
      <ul className="ability-list">
        {DOMAINS.map((domain) => {
          const skill = progress.skills[domain];
          return (
            <li key={domain} className="ability-list__row">
              <span>{DOMAIN_LABELS[domain]}</span>
              <span className="ability-list__level">
                {LEVEL_LABELS[levelLabel(skill.ability)]} · {skill.ability.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
      {/* Right after the level is measured is the moment a destination makes
          sense: now the gap between "here" and "there" is a real number. */}
      <GoalEditor />

      <p className="screen__note">Готово — можно начинать ежедневную практику.</p>
      <a className="btn" href={hrefFor('/practice')}>
        Перейти к практике
      </a>
      <button className="btn btn--ghost" onClick={() => dispatch({ type: 'reset' })}>
        Сбросить прогресс
      </button>
    </section>
  );
}
