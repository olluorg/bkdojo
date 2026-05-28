import { hrefFor } from '../app/router';
import { petMood } from '../domain/pet/pet';
import { usePet } from '../hooks/usePet';
import { PetAvatar } from './PetAvatar';

/** Always-visible header companion; links to the full pet screen. */
export function PetWidget() {
  const pet = usePet();
  return (
    <a className="pet-widget" href={hrefFor('/pet')} title="Питомец" aria-label="Питомец">
      <PetAvatar stage={pet.stage} mood={petMood(pet)} size={34} />
    </a>
  );
}
