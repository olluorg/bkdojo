import { useEffect, useState } from 'react';
import { detectAiAvailability } from '../domain/evaluation/aiCapability';
import type { AiAvailability } from '../domain/models/evaluation';
import { useProgress } from '../state/ProgressContext';

export type AiStatus = AiAvailability | 'checking';

/**
 * Detects Chrome Built-in AI availability once on mount and persists it to
 * progress (so the next visit can show the right UX immediately).
 */
export function useAiCapability(): AiStatus {
  const { dispatch } = useProgress();
  const [status, setStatus] = useState<AiStatus>('checking');

  useEffect(() => {
    let alive = true;
    detectAiAvailability().then((availability) => {
      if (!alive) return;
      setStatus(availability);
      dispatch({ type: 'setAiAvailability', availability });
    });
    return () => {
      alive = false;
    };
  }, [dispatch]);

  return status;
}
