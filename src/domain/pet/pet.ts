import type { Domain } from '../models/common';
import type { Verdict } from '../models/evaluation';
import type { PetStage, PetState } from '../models/pet';
import { clamp, clamp01 } from '../util/math';

const SATIETY_DECAY_PER_HOUR = 5;
const ENERGY_REGEN_PER_HOUR = 12;
const ENERGY_COST_PER_FEED = 4;
const OVERLOAD_ENERGY = 20; // below this, cramming yields less
const RECENT_FOODS = 3;
const PLAY_COOLDOWN_MS = 30 * 60 * 1000;

const STAGE_MIN_XP: Record<PetStage, number> = { egg: 0, baby: 30, teen: 150, adult: 500 };
const STAGE_ORDER: PetStage[] = ['egg', 'baby', 'teen', 'adult'];

export type PetMood = 'happy' | 'content' | 'sad' | 'hungry' | 'tired';

export interface FeedEvent {
  domain?: Domain; // absent for glossary terms (no flavor variety)
  verdict: Verdict;
  difficulty: number;
}

export function petStageFromXp(xp: number): PetStage {
  if (xp >= STAGE_MIN_XP.adult) return 'adult';
  if (xp >= STAGE_MIN_XP.teen) return 'teen';
  if (xp >= STAGE_MIN_XP.baby) return 'baby';
  return 'egg';
}

export function createDefaultPet(now: Date = new Date()): PetState {
  return {
    xp: 0,
    stage: 'egg',
    satiety: 60,
    energy: 80,
    happiness: 70,
    recentFoods: [],
    updatedAt: now.toISOString(),
  };
}

function hoursSince(iso: string, now: Date): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (now.getTime() - then) / 3_600_000);
}

/** Applies time-based decay (satiety down, energy/rest up, happiness drifts). */
export function decayPet(pet: PetState, now: Date = new Date()): PetState {
  const hours = hoursSince(pet.updatedAt, now);
  if (hours <= 0) return pet;

  const satiety = clamp(pet.satiety - SATIETY_DECAY_PER_HOUR * hours, 0, 100);
  const energy = clamp(pet.energy + ENERGY_REGEN_PER_HOUR * hours, 0, 100);
  const target = (satiety + energy) / 2;
  const pull = clamp01(hours * 0.2);
  const happiness = clamp(pet.happiness + (target - pet.happiness) * pull, 0, 100);

  return { ...pet, satiety, energy, happiness, updatedAt: now.toISOString() };
}

/** Feeds the pet from one answered question (called for every recorded outcome). */
export function feedPet(pet: PetState, event: FeedEvent, now: Date = new Date()): PetState {
  const d = decayPet(pet, now);
  const overloaded = d.energy < OVERLOAD_ENERGY;
  const dampen = overloaded ? 0.5 : 1;

  const baseSatiety = event.verdict === 'correct' ? 10 : event.verdict === 'partial' ? 6 : 3;
  const baseXp =
    event.verdict === 'correct' ? 8 + event.difficulty * 2 : event.verdict === 'partial' ? 4 : 1;

  let happinessGain: number;
  let recentFoods = d.recentFoods;
  if (event.domain) {
    const fresh = !d.recentFoods.includes(event.domain);
    happinessGain = fresh ? 6 : 2;
    recentFoods = [event.domain, ...d.recentFoods.filter((x) => x !== event.domain)].slice(
      0,
      RECENT_FOODS,
    );
  } else {
    happinessGain = 2;
  }
  if (overloaded) happinessGain -= 4; // cramming stresses the pet

  const xp = Math.round(d.xp + baseXp * dampen);

  return {
    ...d,
    satiety: clamp(d.satiety + baseSatiety * dampen, 0, 100),
    energy: clamp(d.energy - ENERGY_COST_PER_FEED, 0, 100),
    happiness: clamp(d.happiness + happinessGain, 0, 100),
    xp,
    stage: petStageFromXp(xp),
    recentFoods,
  };
}

export function canPlay(pet: PetState, now: Date = new Date()): boolean {
  if (!pet.lastPlayedAt) return true;
  const then = Date.parse(pet.lastPlayedAt);
  if (Number.isNaN(then)) return true;
  return now.getTime() - then >= PLAY_COOLDOWN_MS;
}

/** A relaxing interaction: cheers the pet up and refreshes energy. */
export function playPet(pet: PetState, now: Date = new Date()): PetState {
  const d = decayPet(pet, now);
  return {
    ...d,
    happiness: clamp(d.happiness + 12, 0, 100),
    energy: clamp(d.energy + 8, 0, 100),
    lastPlayedAt: now.toISOString(),
  };
}

export function petMood(pet: PetState): PetMood {
  if (pet.satiety < 25) return 'hungry';
  if (pet.energy < 25) return 'tired';
  if (pet.happiness >= 70) return 'happy';
  if (pet.happiness >= 40) return 'content';
  return 'sad';
}

const MOOD_STATUS: Record<PetMood, string> = {
  happy: 'доволен и полон сил',
  content: 'в порядке',
  sad: 'скучает — позанимайся с ним',
  hungry: 'проголодался — пора учиться',
  tired: 'устал — сделай перерыв',
};

export function petStatus(pet: PetState): string {
  return MOOD_STATUS[petMood(pet)];
}

export const PET_STAGE_LABELS: Record<PetStage, string> = {
  egg: 'Яйцо',
  baby: 'Малыш',
  teen: 'Подросток',
  adult: 'Взрослый',
};

export interface GrowthProgress {
  value: number; // 0..1 toward next stage
  atMax: boolean;
}

/** Progress of the current stage toward the next (for a growth bar). */
export function growthProgress(pet: PetState): GrowthProgress {
  const i = STAGE_ORDER.indexOf(pet.stage);
  const next = STAGE_ORDER[i + 1];
  if (!next) return { value: 1, atMax: true };
  const from = STAGE_MIN_XP[pet.stage];
  const to = STAGE_MIN_XP[next];
  return { value: clamp01((pet.xp - from) / (to - from)), atMax: false };
}
