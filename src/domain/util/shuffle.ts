import type { ChoiceOption } from '../models/question';

/** Fisher–Yates shuffle into a new array. `rng` defaults to Math.random. */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** Small deterministic PRNG (mulberry32) for seeded, reproducible shuffles. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string hash (FNV-1a) → unsigned 32-bit int, for deriving a seed. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Display order of a choice question's options: a stable shuffle seeded by the
 * question id. The correct answer is no longer always first, yet the order is
 * identical on every render and between the answering card and the result view —
 * so the learner never sees the options jump around.
 */
export function orderedOptions(
  questionId: string,
  options: readonly ChoiceOption[],
): ChoiceOption[] {
  return shuffle(options, seededRng(hashString(questionId)));
}
