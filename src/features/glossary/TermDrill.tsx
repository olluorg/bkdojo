import { useState } from 'react';
import { buildTermDrill } from '../../domain/glossary/termTrainer';
import type { Domain } from '../../domain/models/common';
import type { GlossaryTerm } from '../../domain/models/glossary';
import { useProgress } from '../../state/ProgressContext';

interface Props {
  terms: GlossaryTerm[];
  title?: string;
  focusDomain?: Domain;
  onExit: () => void;
  onRestart: () => void;
}

export function TermDrill({
  terms,
  title = 'Тренировка терминов',
  focusDomain,
  onExit,
  onRestart,
}: Props) {
  const { progress, dispatch } = useProgress();
  const [drill] = useState(() => buildTermDrill(terms, progress, { size: 10, focusDomain }));
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  if (drill.length === 0) {
    return (
      <section>
        <h1 className="screen__title">{title}</h1>
        <p className="screen__note">Нет доступных терминов для тренировки.</p>
        <button className="btn btn--ghost" onClick={onExit}>
          К словарю
        </button>
      </section>
    );
  }

  if (done) {
    return (
      <section>
        <h1 className="screen__title">Готово</h1>
        <p className="screen__note">
          Верно: {correctCount} из {drill.length}.
        </p>
        <button className="btn" onClick={onRestart}>
          Ещё раз
        </button>
        <button className="btn btn--ghost" onClick={onExit}>
          К словарю
        </button>
      </section>
    );
  }

  const item = drill[step]!;
  const askDefinition = item.direction === 'definition-to-term'; // show definition, pick term
  const prompt = askDefinition ? item.term.definition : item.term.term;
  const revealed = picked !== null;

  function choose(optionId: string) {
    if (revealed) return;
    setPicked(optionId);
    const correct = optionId === item.term.id;
    if (correct) setCorrectCount((c) => c + 1);
    dispatch({ type: 'recordTerm', termId: item.term.id, correct });
  }

  function next() {
    if (step + 1 >= drill.length) setDone(true);
    else {
      setStep((s) => s + 1);
      setPicked(null);
    }
  }

  return (
    <section>
      <button className="link-back" onClick={onExit}>
        ← К словарю
      </button>
      <h1 className="screen__title">{title}</h1>
      <p className="screen__note">
        Вопрос {step + 1} из {drill.length}
      </p>

      <div className="card">
        <div className="card__meta">{askDefinition ? 'Какой это термин?' : 'Что означает термин?'}</div>
        <p className="card__prompt">{prompt}</p>

        <div className="options">
          {item.options.map((opt) => {
            const label = askDefinition ? opt.term : opt.definition;
            let cls = 'option';
            if (revealed) {
              if (opt.id === item.term.id) cls = 'option option--correct';
              else if (opt.id === picked) cls = 'option option--wrong';
            }
            return (
              <button key={opt.id} className={cls} disabled={revealed} onClick={() => choose(opt.id)}>
                {label}
              </button>
            );
          })}
        </div>

        {revealed && (
          <>
            <p className="result__feedback">
              <strong>{item.term.term}</strong> — {item.term.definition}
            </p>
            <button className="btn" onClick={next}>
              {step + 1 >= drill.length ? 'Завершить' : 'Дальше'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
