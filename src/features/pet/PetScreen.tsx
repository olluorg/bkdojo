import { useState } from 'react';
import { PetAvatar } from '../../components/PetAvatar';
import { ProgressBar } from '../../components/ProgressBar';
import {
  canPlay,
  growthProgress,
  petMood,
  petStatus,
  PET_STAGE_LABELS,
} from '../../domain/pet/pet';
import { usePet } from '../../hooks/usePet';
import { useProgress } from '../../state/ProgressContext';
import { hrefFor } from '../../app/router';
import { KiBreathingGame } from './KiBreathingGame';

export function PetScreen() {
  const { dispatch } = useProgress();
  const pet = usePet();
  const mood = petMood(pet);
  const growth = growthProgress(pet);
  const playable = canPlay(pet, new Date());
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <KiBreathingGame
        stage={pet.stage}
        onDone={() => {
          dispatch({ type: 'playPet' });
          setPlaying(false);
        }}
        onCancel={() => setPlaying(false)}
      />
    );
  }

  return (
    <section>
      <h1 className="screen__title">Питомец</h1>

      <div className="pet-hero">
        <PetAvatar stage={pet.stage} mood={mood} size={120} />
        <div className="pet-hero__info">
          <div className="pet-hero__stage">{PET_STAGE_LABELS[pet.stage]}</div>
          <div className="screen__note">{petStatus(pet)}</div>
        </div>
      </div>

      <div className="stat-block">
        <div className="stat-block__head">Сытость</div>
        <ProgressBar value={pet.satiety / 100} />
      </div>
      <div className="stat-block">
        <div className="stat-block__head">Бодрость</div>
        <ProgressBar value={pet.energy / 100} />
      </div>
      <div className="stat-block">
        <div className="stat-block__head">Настроение</div>
        <ProgressBar value={pet.happiness / 100} />
      </div>
      {!growth.atMax && (
        <div className="stat-block">
          <div className="stat-block__head">До следующей стадии</div>
          <ProgressBar value={growth.value} />
        </div>
      )}

      <div className="pet-actions">
        <a className="btn" href={hrefFor('/practice')}>
          Покормить — позаниматься
        </a>
        <button className="btn btn--ghost" disabled={!playable} onClick={() => setPlaying(true)}>
          {playable ? 'Поиграть — дыхание ки' : 'Наигрался, отдыхает'}
        </button>
      </div>

      <p className="screen__note">
        Питомец ест, когда ты решаешь вопросы, и отдыхает в перерывах. Не забрасывай — проголодается и
        загрустит.
      </p>
    </section>
  );
}
