import { useState } from 'react';
import { COURSE_LEVEL_LABELS, courseLevelOf, maxUnlockedLevel } from '../../domain/course/courses';
import { termsByCourse, unlockedTerms } from '../../domain/glossary/glossaryAccess';
import { DOMAIN_LABELS } from '../../domain/models/common';
import { countMasteredTerms, termMastery } from '../../domain/progress/termProgress';
import { useContentIndex } from '../../hooks/useContentIndex';
import { useGlossary } from '../../hooks/useGlossary';
import { useProgress } from '../../state/ProgressContext';
import { TermDrill } from './TermDrill';

export function GlossaryScreen() {
  const terms = useGlossary();
  const index = useContentIndex();
  const { progress } = useProgress();
  const [mode, setMode] = useState<'browse' | 'drill'>('browse');
  const [drillKey, setDrillKey] = useState(0);

  const unlocked = unlockedTerms(terms, progress, index);

  if (mode === 'drill') {
    return (
      <TermDrill
        key={drillKey}
        terms={unlocked}
        onExit={() => setMode('browse')}
        onRestart={() => setDrillKey((k) => k + 1)}
      />
    );
  }

  const masteredUnlocked = countMasteredTerms(
    progress,
    unlocked.map((t) => t.id),
  );

  return (
    <section>
      <h1 className="screen__title">Словарь</h1>
      <p className="screen__note">
        Термины открываются по мере роста уровня в курсе. Доступно {unlocked.length} из{' '}
        {terms.length}, выучено {masteredUnlocked}.
      </p>

      <button
        className="btn"
        disabled={unlocked.length === 0}
        onClick={() => {
          setDrillKey((k) => k + 1);
          setMode('drill');
        }}
      >
        Тренировать доступные
      </button>

      {[...termsByCourse(terms).entries()].map(([domain, list]) => {
        const level = courseLevelOf(progress, index, domain);
        const maxLvl = maxUnlockedLevel(level);
        return (
          <div key={domain} className="lesson-group">
            <h2 className="lesson-group__h">
              {DOMAIN_LABELS[domain]} · {COURSE_LEVEL_LABELS[level]}
            </h2>
            <ul className="term-list">
              {list.map((t) => {
                const open = t.level <= maxLvl;
                const learned = open && termMastery(progress, t.id) >= 1;
                return (
                  <li key={t.id} className={open ? 'term-row' : 'term-row term-row--locked'}>
                    <div className="term-row__head">
                      <span className="term-row__name">{t.term}</span>
                      <span className="term-row__lvl">ур. {t.level}</span>
                      {learned && <span className="term-row__badge">выучено</span>}
                      {!open && <span className="term-row__lock">🔒</span>}
                    </div>
                    <span className="term-row__def">
                      {open ? t.definition : 'Откроется с ростом уровня в курсе'}
                    </span>
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
