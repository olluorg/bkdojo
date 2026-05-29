import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { UserProgress } from '../domain/models/progress';
import {
  INCOMING_EVENT,
  loadProgressFromDb,
  persistProgress,
} from '../storage/progressDb';
import { progressReducer, type ProgressAction } from './progressReducer';

interface ProgressContextValue {
  progress: UserProgress;
  dispatch: Dispatch<ProgressAction>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({
  children,
  initialProgress,
}: {
  children: ReactNode;
  /** Loaded from IndexedDB by the async bootstrap in `main.tsx`. */
  initialProgress: UserProgress;
}) {
  const [progress, dispatch] = useReducer(progressReducer, initialProgress);

  // Snapshot of what is already persisted, so each save writes only the diff and
  // an incoming-sync reload does not echo back into the outbox.
  const lastPersisted = useRef<UserProgress>(initialProgress);

  useEffect(() => {
    if (progress === lastPersisted.current) return;
    const prev = lastPersisted.current;
    lastPersisted.current = progress;
    void persistProgress(prev, progress).catch((err) =>
      console.warn('[progress] persist failed:', err),
    );
  }, [progress]);

  // When sync delivers changes from another device, the SDK has already written
  // them into IndexedDB; reload and replace in-memory state without re-persisting.
  useEffect(() => {
    function onIncoming() {
      void loadProgressFromDb()
        .then((next) => {
          lastPersisted.current = next; // echo guard: next save sees no diff
          dispatch({ type: 'replace', progress: next });
        })
        .catch((err) => console.warn('[progress] incoming reload failed:', err));
    }
    window.addEventListener(INCOMING_EVENT, onIncoming);
    return () => window.removeEventListener(INCOMING_EVENT, onIncoming);
  }, []);

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
