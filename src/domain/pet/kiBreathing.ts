/**
 * Pure timing model for the "Ki Breathing" relaxation minigame.
 * The UI drives it with elapsed time; this computes the current breath phase
 * and the ring scale (0 = collapsed, 1 = fully expanded).
 */
export interface BreathConfig {
  inhaleMs: number;
  exhaleMs: number;
  cycles: number;
}

export const DEFAULT_BREATH: BreathConfig = { inhaleMs: 4000, exhaleMs: 4000, cycles: 4 };

export type BreathPhase = 'inhale' | 'exhale' | 'done';

export interface BreathFrame {
  phase: BreathPhase;
  scale: number; // 0..1
  cycle: number; // 0-based
  progress: number; // 0..1 within the current phase
}

export function totalDuration(cfg: BreathConfig = DEFAULT_BREATH): number {
  return (cfg.inhaleMs + cfg.exhaleMs) * cfg.cycles;
}

export function breathAt(elapsedMs: number, cfg: BreathConfig = DEFAULT_BREATH): BreathFrame {
  const cycleMs = cfg.inhaleMs + cfg.exhaleMs;
  if (elapsedMs >= cycleMs * cfg.cycles) {
    return { phase: 'done', scale: 0, cycle: cfg.cycles, progress: 1 };
  }
  const cycle = Math.floor(elapsedMs / cycleMs);
  const within = elapsedMs - cycle * cycleMs;
  if (within < cfg.inhaleMs) {
    const progress = within / cfg.inhaleMs;
    return { phase: 'inhale', scale: progress, cycle, progress };
  }
  const progress = (within - cfg.inhaleMs) / cfg.exhaleMs;
  return { phase: 'exhale', scale: 1 - progress, cycle, progress };
}

/** True when the user's hold matches the phase (hold while inhaling). */
export function inSync(phase: BreathPhase, holding: boolean): boolean {
  if (phase === 'inhale') return holding;
  if (phase === 'exhale') return !holding;
  return false;
}
