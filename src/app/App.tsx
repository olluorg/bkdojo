import { useEffect, useState } from 'react';
import { AiStatusBanner } from '../components/AiStatusBanner';
import { useAiCapability } from '../hooks/useAiCapability';
import { BookmarksScreen } from '../features/bookmarks/BookmarksScreen';
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
import { PetAvatar } from '../components/PetAvatar';
import { petMood } from '../domain/pet/pet';
import { usePet } from '../hooks/usePet';
import { useStreak } from '../hooks/useStreak';
import { hrefFor, navigate, segments, useHashPath } from './router';

type Route =
  | 'today'
  | 'courses'
  | 'lessons'
  | 'bookmarks'
  | 'glossary'
  | 'level'
  | 'practice'
  | 'interview'
  | 'review'
  | 'stats'
  | 'pet'
  | 'settings';

interface NavItem {
  route: Route;
  label: string;
  icon: string;
}

// Primary destinations: the daily loop. Shown as header tabs on desktop and as
// the bottom tab bar on mobile.
const PRIMARY: NavItem[] = [
  { route: 'today', label: 'Сегодня', icon: '🏠' },
  { route: 'courses', label: 'Курсы', icon: '📚' },
  { route: 'practice', label: 'Практика', icon: '✏️' },
  { route: 'review', label: 'Слабые места', icon: '🔁' },
  { route: 'stats', label: 'Прогресс', icon: '📈' },
];

// Secondary destinations: reachable from "Сегодня" and the "Ещё" menu, not from
// the always-visible bar.
const MORE: NavItem[] = [
  { route: 'bookmarks', label: 'Закладки', icon: '🔖' },
  { route: 'glossary', label: 'Словарь', icon: '📖' },
  { route: 'interview', label: 'Интервью', icon: '🎤' },
  { route: 'level', label: 'Уровень', icon: '🎚️' },
];

// All renderable routes (includes `lessons`, reachable from courses but not a tab).
const RENDERABLE = new Set<Route>([
  'today',
  'courses',
  'lessons',
  'bookmarks',
  'glossary',
  'level',
  'practice',
  'interview',
  'review',
  'stats',
  'pet',
  'settings',
]);

const AI_BANNER_DISMISSED_KEY = 'bkdojo:ai-banner-dismissed';

export function App() {
  const aiStatus = useAiCapability();
  const path = useHashPath();
  const streak = useStreak();
  const pet = usePet();
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(
    () => localStorage.getItem(AI_BANNER_DISMISSED_KEY) === '1',
  );

  function dismissAiBanner() {
    setAiBannerDismissed(true);
    localStorage.setItem(AI_BANNER_DISMISSED_KEY, '1');
  }

  // "Today" is the home screen; it adapts (incl. an onboarding state before placement).
  const fallback: Route = 'today';
  const raw = segments(path)[0] as Route | undefined;
  const route: Route = raw && RENDERABLE.has(raw) ? raw : fallback;

  // Keep the URL in sync when the hash is empty or points at an unknown route.
  useEffect(() => {
    if (!raw || !RENDERABLE.has(raw)) navigate(`/${fallback}`);
  }, [raw, fallback]);

  // Close the "Ещё" menu whenever navigation happens.
  useEffect(() => {
    setMoreOpen(false);
  }, [path]);

  const isActive = (r: Route) => r === route || (r === 'courses' && route === 'lessons');
  const menuActive =
    MORE.some((item) => isActive(item.route)) || route === 'pet' || route === 'settings';

  return (
    <div className="app">
      <header className="app__header">
        <a className="app__brand" href={hrefFor(`/${fallback}`)}>
          <span className="app__brand-mark">b</span>
          bkdojo
        </a>
        <nav className="app__nav" aria-label="Разделы">
          {PRIMARY.map((item) => (
            <a
              key={item.route}
              className={isActive(item.route) ? 'app__tab app__tab--active' : 'app__tab'}
              href={hrefFor(`/${item.route}`)}
              aria-current={isActive(item.route) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="app__aside">
          <div className={moreOpen ? 'app__more app__more--open' : 'app__more'}>
            <button
              type="button"
              className={menuActive ? 'icon-btn icon-btn--active' : 'icon-btn'}
              aria-haspopup="true"
              aria-expanded={moreOpen}
              title="Меню"
              aria-label="Меню"
              onClick={() => setMoreOpen((v) => !v)}
            >
              ☰
            </button>
            {moreOpen && (
              <div className="app__more-menu" role="menu">
                <a
                  className="app__more-item"
                  href={hrefFor('/stats')}
                  role="menuitem"
                  title="Серия и прогресс"
                >
                  <span aria-hidden>🔥</span>
                  Серия: {streak.days} дн.
                </a>
                <a
                  className={route === 'pet' ? 'app__more-item app__more-item--active' : 'app__more-item'}
                  href={hrefFor('/pet')}
                  role="menuitem"
                  aria-current={route === 'pet' ? 'page' : undefined}
                >
                  <PetAvatar stage={pet.stage} mood={petMood(pet)} size={22} />
                  Питомец
                </a>
                {MORE.map((item) => (
                  <a
                    key={item.route}
                    className={isActive(item.route) ? 'app__more-item app__more-item--active' : 'app__more-item'}
                    href={hrefFor(`/${item.route}`)}
                    role="menuitem"
                    aria-current={isActive(item.route) ? 'page' : undefined}
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </a>
                ))}
                <a
                  className={route === 'settings' ? 'app__more-item app__more-item--active' : 'app__more-item'}
                  href={hrefFor('/settings')}
                  role="menuitem"
                  aria-current={route === 'settings' ? 'page' : undefined}
                >
                  <span aria-hidden>⚙</span>
                  Настройки
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {moreOpen && (
        <button
          type="button"
          className="app__more-backdrop"
          aria-hidden
          tabIndex={-1}
          onClick={() => setMoreOpen(false)}
        />
      )}

      {!aiBannerDismissed && <AiStatusBanner status={aiStatus} onDismiss={dismissAiBanner} />}

      <main className="app__main" key={route}>
        {route === 'today' && <TodayScreen />}
        {route === 'courses' && <CoursesScreen />}
        {route === 'lessons' && <LessonsScreen />}
        {route === 'bookmarks' && <BookmarksScreen />}
        {route === 'glossary' && <GlossaryScreen />}
        {route === 'level' && <OnboardingScreen />}
        {route === 'practice' && <PracticeScreen />}
        {route === 'interview' && <InterviewScreen />}
        {route === 'review' && <ReviewScreen />}
        {route === 'stats' && <StatsScreen />}
        {route === 'pet' && <PetScreen />}
        {route === 'settings' && <SettingsScreen />}
      </main>

      <nav className="app__bottombar" aria-label="Основная навигация">
        {PRIMARY.map((item) => (
          <a
            key={item.route}
            className={isActive(item.route) ? 'bottombar__tab bottombar__tab--active' : 'bottombar__tab'}
            href={hrefFor(`/${item.route}`)}
            aria-current={isActive(item.route) ? 'page' : undefined}
          >
            <span className="bottombar__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="bottombar__label">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
