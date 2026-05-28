import type { Domain } from './common';

export type PetStage = 'egg' | 'baby' | 'teen' | 'adult';

/**
 * The dojo mascot. Lives off practice frequency: studying feeds it, breaks let
 * it rest, neglect makes it hungry/sad, course progress grows it up.
 * Decay is computed lazily from `updatedAt` (no background timer).
 */
export interface PetState {
  name?: string;
  xp: number;
  stage: PetStage;
  satiety: number; // 0..100
  energy: number; // 0..100
  happiness: number; // 0..100
  recentFoods: Domain[]; // recent fed domains, for variety bonus
  updatedAt: string; // ISO
  lastPlayedAt?: string; // ISO, play cooldown
}
