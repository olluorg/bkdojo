// Pure model behind the "GC generations" stepper. Reproduces the young-generation
// mechanics at a teachable scale: allocation into Eden, a copying minor GC that
// moves only the survivors into the empty survivor space, ageing, tenuring past a
// threshold, and premature promotion when the survivor space cannot hold everyone.
// Each emitted step carries a full heap snapshot so the renderer is a pure function
// of the step.

export const EDEN_CAPACITY = 8;
export const SURVIVOR_CAPACITY = 3;
export const TENURING_THRESHOLD = 3;

export interface HeapObject {
  id: string;
  /** How many minor GCs this object lives through before becoming garbage. */
  survives: number;
  /** Minor GCs already survived. */
  age: number;
}

export type GcAction = 'init' | 'alloc' | 'minor';

export interface GcStep {
  action: GcAction;
  eden: HeapObject[];
  /** The survivor space currently holding aged objects (the "from" space). */
  survivor: HeapObject[];
  old: HeapObject[];
  /** Which survivor space is active — flips on every collection, like real copying GC. */
  survivorLabel: 'S0' | 'S1';
  /** Objects collected by this step, for the "freed" figure. */
  collected: number;
  /** Ids promoted to the old generation by this step. */
  promoted: string[];
  /** True when promotion happened because the survivor space overflowed. */
  premature: boolean;
  note: string;
}

/**
 * Allocation batches, given as the number of minor GCs each object will survive.
 * Chosen to demonstrate the three things the lesson talks about, in order: an
 * ordinary cheap collection where almost everything dies, a survivor overflow that
 * forces premature promotion, and an object reaching the tenuring threshold.
 */
export const DEFAULT_BATCHES: number[][] = [
  [0, 0, 0, 0, 0, 1, 3, 5],
  [0, 0, 0, 0, 0, 0, 2, 4],
  [0, 0, 0, 0, 0, 0, 0, 6],
];

const BATCH_LETTERS = 'abcdefgh';

function clone(objects: HeapObject[]): HeapObject[] {
  return objects.map((o) => ({ ...o }));
}

function snapshot(
  step: Omit<GcStep, 'eden' | 'survivor' | 'old'>,
  eden: HeapObject[],
  survivor: HeapObject[],
  old: HeapObject[],
): GcStep {
  return { ...step, eden: clone(eden), survivor: clone(survivor), old: clone(old) };
}

/**
 * Simulates allocation and minor collections over `batches`, returning one step per
 * meaningful event: the initial empty heap, each Eden fill, and each minor GC.
 */
export function simulateGenerations(batches: number[][] = DEFAULT_BATCHES): GcStep[] {
  let eden: HeapObject[] = [];
  let survivor: HeapObject[] = [];
  const old: HeapObject[] = [];
  let survivorLabel: 'S0' | 'S1' = 'S0';

  const steps: GcStep[] = [];
  const base = { collected: 0, promoted: [] as string[], premature: false, survivorLabel };

  steps.push(
    snapshot(
      {
        ...base,
        action: 'init',
        note: `Пустая куча. Eden на ${EDEN_CAPACITY} объектов, Survivor на ${SURVIVOR_CAPACITY}, порог продвижения — возраст ${TENURING_THRESHOLD}.`,
      },
      eden,
      survivor,
      old,
    ),
  );

  batches.forEach((batch, batchIndex) => {
    const letter = BATCH_LETTERS[batchIndex] ?? 'x';
    eden = batch.map((survivesCount, i) => ({
      id: `${letter}${i + 1}`,
      survives: survivesCount,
      age: 0,
    }));

    steps.push(
      snapshot(
        {
          ...base,
          survivorLabel,
          action: 'alloc',
          note: `Eden заполнен: ${eden.length} новых объектов выделены простым сдвигом указателя. Место кончилось — пора собирать.`,
        },
        eden,
        survivor,
        old,
      ),
    );

    // Minor GC: everything reachable is copied out, Eden is then freed wholesale.
    const candidates = [...survivor, ...eden].filter((o) => o.age < o.survives);
    const collected = survivor.length + eden.length - candidates.length;
    for (const o of candidates) o.age++;

    // Oldest first: real collectors promote by age, and it decides who overflows.
    candidates.sort((a, b) => b.age - a.age);

    const tenured = candidates.filter((o) => o.age >= TENURING_THRESHOLD);
    const staying = candidates.filter((o) => o.age < TENURING_THRESHOLD);
    const fits = staying.slice(0, SURVIVOR_CAPACITY);
    const overflow = staying.slice(SURVIVOR_CAPACITY);

    old.push(...tenured, ...overflow);
    survivor = fits;
    eden = [];
    survivorLabel = survivorLabel === 'S0' ? 'S1' : 'S0';

    const promoted = [...tenured, ...overflow].map((o) => o.id);
    const notes = [
      `Minor GC: живых ${candidates.length}, собрано ${collected} — копируем только выживших в ${survivorLabel}, Eden освобождается целиком.`,
    ];
    if (tenured.length > 0) {
      notes.push(
        `Возраст ${TENURING_THRESHOLD} достигнут: ${tenured.map((o) => o.id).join(', ')} — в старое поколение.`,
      );
    }
    if (overflow.length > 0) {
      notes.push(
        `Survivor вмещает ${SURVIVOR_CAPACITY}, а выживших больше: ${overflow
          .map((o) => o.id)
          .join(', ')} уезжают в old досрочно — преждевременное продвижение.`,
      );
    }

    steps.push(
      snapshot(
        {
          ...base,
          survivorLabel,
          action: 'minor',
          collected,
          promoted,
          premature: overflow.length > 0,
          note: notes.join(' '),
        },
        eden,
        survivor,
        old,
      ),
    );
  });

  return steps;
}
