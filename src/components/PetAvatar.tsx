import type { PetStage } from '../domain/models/pet';
import type { PetMood } from '../domain/pet/pet';

const MOOD_COLOR: Record<PetMood, string> = {
  happy: '#3fb950',
  content: '#3b82f6',
  sad: '#8b949e',
  hungry: '#d29922',
  tired: '#6e7681',
};

const INK = '#0e1116';

function mouthPath(mood: PetMood, cx: number, y: number): string {
  switch (mood) {
    case 'happy':
      return `M${cx - 9},${y - 2} Q${cx},${y + 7} ${cx + 9},${y - 2}`;
    case 'content':
      return `M${cx - 7},${y} Q${cx},${y + 4} ${cx + 7},${y}`;
    case 'sad':
      return `M${cx - 8},${y + 3} Q${cx},${y - 5} ${cx + 8},${y + 3}`;
    case 'hungry':
      return `M${cx - 3},${y} a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0`;
    case 'tired':
      return `M${cx - 7},${y} H${cx + 7}`;
  }
}

function Sprout({ cx, top, big }: { cx: number; top: number; big: boolean }) {
  return (
    <g>
      <line x1={cx} y1={top} x2={cx} y2={top - 8} stroke="#3fb950" strokeWidth={2} />
      <circle cx={cx} cy={top - 10} r={big ? 4 : 3} fill="#3fb950" />
    </g>
  );
}

export function PetAvatar({
  stage,
  mood,
  size = 96,
}: {
  stage: PetStage;
  mood: PetMood;
  size?: number;
}) {
  const color = MOOD_COLOR[mood];

  if (stage === 'egg') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="питомец-яйцо">
        <ellipse cx={50} cy={56} rx={26} ry={32} fill={color} />
        <path
          d="M38,54 L46,50 L42,58 L52,54 L48,62"
          stroke={INK}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const cx = 50;
  const cy = 54;
  const r = stage === 'adult' ? 34 : stage === 'teen' ? 28 : 22;
  const eyeY = cy - r * 0.25;
  const eyeDx = r * 0.45;
  const mouthY = cy + r * 0.3;
  const closed = mood === 'tired';

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="питомец">
      {stage !== 'baby' && <Sprout cx={cx} top={cy - r} big={stage === 'adult'} />}
      <circle cx={cx} cy={cy} r={r} fill={color} />
      {closed ? (
        <>
          <line x1={cx - eyeDx - 4} y1={eyeY} x2={cx - eyeDx + 4} y2={eyeY} stroke={INK} strokeWidth={2} strokeLinecap="round" />
          <line x1={cx + eyeDx - 4} y1={eyeY} x2={cx + eyeDx + 4} y2={eyeY} stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx - eyeDx} cy={eyeY} r={3.2} fill={INK} />
          <circle cx={cx + eyeDx} cy={eyeY} r={3.2} fill={INK} />
        </>
      )}
      <path d={mouthPath(mood, cx, mouthY)} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
    </svg>
  );
}
