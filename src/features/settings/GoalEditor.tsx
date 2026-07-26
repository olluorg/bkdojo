import { GRADES, GRADE_LABELS, goalLabel, type TargetGrade } from '../../domain/goal/goal';
import { goalOf } from '../../domain/today/dailyMission';
import { useProgress } from '../../state/ProgressContext';

/**
 * Editor for the learner's actual goal: grade, optional company, optional date.
 *
 * Shared by Settings and the post-placement screen, because the moment right
 * after a level is measured is exactly when naming a destination makes sense.
 */
export function GoalEditor() {
  const { progress, dispatch } = useProgress();
  const goal = goalOf(progress);

  const setGrade = (grade: TargetGrade) => dispatch({ type: 'setGoal', goal: { ...goal, grade } });

  return (
    <div className="stat-block">
      <div className="stat-block__head">Цель</div>

      <div className="depth-switch">
        {GRADES.map((grade) => (
          <button
            key={grade}
            className={grade === goal.grade ? 'depth-btn depth-btn--active' : 'depth-btn'}
            onClick={() => setGrade(grade)}
          >
            {GRADE_LABELS[grade]}
          </button>
        ))}
      </div>

      <div className="goal-fields">
        <label className="goal-field">
          <span className="goal-field__label">Компания (необязательно)</span>
          <input
            className="text-input"
            type="text"
            value={goal.company ?? ''}
            placeholder="Например, Яндекс"
            onChange={(e) => dispatch({ type: 'setGoal', goal: { ...goal, company: e.target.value } })}
          />
        </label>

        <label className="goal-field">
          <span className="goal-field__label">Дата собеседования (необязательно)</span>
          <input
            className="text-input"
            type="date"
            value={goal.interviewDate ?? ''}
            onChange={(e) =>
              dispatch({ type: 'setGoal', goal: { ...goal, interviewDate: e.target.value } })
            }
          />
        </label>
      </div>

      <p className="screen__note">
        Готовность считается относительно грейда: {goalLabel(goal)}. Дата включает обратный отсчёт на
        «Сегодня». Хранится только в этом браузере.
      </p>
    </div>
  );
}
