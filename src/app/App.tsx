import { useEffect } from 'react';
import { AiStatusBanner } from '../components/AiStatusBanner';
import { useAiCapability } from '../hooks/useAiCapability';
import { CoursesScreen } from '../features/courses/CoursesScreen';
import { GlossaryScreen } from '../features/glossary/GlossaryScreen';
import { InterviewScreen } from '../features/interview/InterviewScreen';
import { LessonsScreen } from '../features/lessons/LessonsScreen';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { PetScreen } from '../features/pet/PetScreen';
import { PracticeScreen } from '../features/practice/PracticeScreen';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { StatsScreen } from '../features/stats/StatsScreen';
import { TodayScreen } from '../features/today/TodayScreen';
import { PetWidget } from '../components/PetWidget';
import { StreakWidget } from '../components/StreakWidget';
import { hrefFor, navigate, segments, useHashPath } from './router';

type Route =
  | 'today'
  | 'courses'
  | 'lessons'
  | 'glossary'
  | 'level'
  | 'practice'
  | 'interview'
  | 'review'
  | 'stats'
  | 'pet'
  | 'settings';

// Tabs shown in the header.
const NAV: { route: Route; label: string }[] = [
  { route: 'today', label: 'Сегодня' },
  { route: 'courses', label: 'Курсы' },
  { route: 'glossary', label: 'Словарь' },
  { route: 'level', label: 'Уровень' },
  { route: 'practice', label: 'Практика' },
  { route: 'interview', label: 'Интервью' },
  { route: 'review', label: 'Слабые места' },
  { route: 'stats', label: 'Прогресс' },
];

// All renderable routes (includes `lessons`, reachable from courses but not a tab).
const RENDERABLE = new Set<Route>([
  'today',
  'courses',
  'lessons',
  'glossary',
  'level',
  'practice',
  'interview',
  'review',
  'stats',
  'pet',
  'settings',
]);

export function App() {
  const aiStatus = useAiCapability();
  const path = useHashPath();

  // "Today" is the home screen; it adapts (incl. an onboarding state before placement).
  const fallback: Route = 'today';
  const raw = segments(path)[0] as Route | undefined;
  const route: Route = raw && RENDERABLE.has(raw) ? raw : fallback;

  // Keep the URL in sync when the hash is empty or points at an unknown route.
  useEffect(() => {
    if (!raw || !RENDERABLE.has(raw)) navigate(`/${fallback}`);
  }, [raw, fallback]);

  return (
    <div className="app">
      <header className="app__header">
        <a className="app__brand" href={hrefFor(`/${fallback}`)}>
          <span className="app__brand-mark">b</span>
          bkdojo
        </a>
        <nav className="app__nav">
          {NAV.map((item) => {
            const active =
              item.route === route || (item.route === 'courses' && route === 'lessons');
            return (
              <a
                key={item.route}
                className={active ? 'app__tab app__tab--active' : 'app__tab'}
                href={hrefFor(`/${item.route}`)}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="app__aside">
          <StreakWidget />
          <PetWidget />
          <a
            className={route === 'settings' ? 'icon-btn icon-btn--active' : 'icon-btn'}
            href={hrefFor('/settings')}
            title="Настройки"
            aria-label="Настройки"
          >
            ⚙
          </a>
        </div>
      </header>

      <AiStatusBanner status={aiStatus} />

      <main className="app__main" key={route}>
        {route === 'today' && <TodayScreen />}
        {route === 'courses' && <CoursesScreen />}
        {route === 'lessons' && <LessonsScreen />}
        {route === 'glossary' && <GlossaryScreen />}
        {route === 'level' && <OnboardingScreen />}
        {route === 'practice' && <PracticeScreen />}
        {route === 'interview' && <InterviewScreen />}
        {route === 'review' && <ReviewScreen />}
        {route === 'stats' && <StatsScreen />}
        {route === 'pet' && <PetScreen />}
        {route === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
