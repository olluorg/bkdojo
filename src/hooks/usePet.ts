import type { PetState } from '../domain/models/pet';
import { createDefaultPet, decayPet } from '../domain/pet/pet';
import { useProgress } from '../state/ProgressContext';

/** Live, time-decayed pet state for display (persistence happens on events). */
export function usePet(): PetState {
  const { progress } = useProgress();
  return decayPet(progress.pet ?? createDefaultPet(), new Date());
}
