import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { UserProgress } from '../domain/models/progress';
import { loadProgress, saveProgress } from '../storage/progressStorage';
import { progressReducer, type ProgressAction } from './progressReducer';

interface ProgressContextValue {
  progress: UserProgress;
  dispatch: Dispatch<ProgressAction>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, dispatch] = useReducer(progressReducer, undefined, () => loadProgress());

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Override credits fold lazily across calendar days; tick once on mount so
  // the visible balance is fresh whenever the app opens (or browser is reopened
  // after midnight). Inside-session day changes are rare; we don't poll.
  useEffect(() => {
    dispatch({ type: 'tickOverrideCredits' });
  }, []);

  return (
    <ProgressContext.Provider value={{ progress, dispatch }}>{children}</ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within a ProgressProvider');
  return ctx;
}
