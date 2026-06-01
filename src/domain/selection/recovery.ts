import type { Domain } from '../models/common';
import type { AnswerRecord } from '../models/progress';
import { DESIRABLE_OFFSET } from './adaptiveSelector';

/** How many of the most recent in-domain answers the recovery check looks at. */
export const RECOVERY_WINDOW = 4;
/** Below this many recent answers we don't have enough signal — stay at default. */
export const RECOVERY_MIN_SAMPLES = 2;

/** Recent mean score thresholds that trigger easing off. */
export const STRUGGLING_MEAN = 0.34; // mostly wrong → drop a full level below desirable
export const SHAKY_MEAN = 0.5; // mixed → aim at-level instead of above

/**
 * Adaptive "desirable difficulty" offset for a domain.
 *
 * Normally we aim slightly above the learner's ability ({@link DESIRABLE_OFFSET})
 * to keep a productive challenge. But when the recent answers in this domain show
 * the learner is struggling, we back off — to at-level (offset 0) or below
 * (offset −1) — so they can rebuild confidence instead of being ground down by
 * questions above their head. Once recent scores recover, the offset climbs back
 * to the default on its own. Pure and deterministic — easy to test.
 */
export function recoveryOffset(history: AnswerRecord[], domain: Domain): number {
  const recent = history.filter((r) => r.domain === domain).slice(-RECOVERY_WINDOW);
  if (recent.length < RECOVERY_MIN_SAMPLES) return DESIRABLE_OFFSET;

  const mean = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
  if (mean < STRUGGLING_MEAN) return -1;
  if (mean < SHAKY_MEAN) return 0;
  return DESIRABLE_OFFSET;
}
