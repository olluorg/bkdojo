// Pure decision model behind the "Какой замок выбрать?" widget. Mirrors the
// escalation ladder of the lesson: start at synchronized and climb only as far as
// your requirements force you — ReentrantLock for the extras synchronized lacks,
// ReentrantReadWriteLock for read-heavy sharing, StampedLock for optimistic reads.
// Each step costs something, so the recommendation always carries its caveats.

export type LockChoice =
  | 'synchronized'
  | 'ReentrantLock'
  | 'ReentrantReadWriteLock'
  | 'StampedLock';

/** A capability the user says they need; selecting it may force a richer lock. */
export type Need =
  | 'tryTimeout'
  | 'interruptible'
  | 'fair'
  | 'conditions'
  | 'concurrentReads'
  | 'optimisticRead';

export interface NeedDef {
  id: Need;
  /** Which question group the need belongs to. */
  group: 'exclusive' | 'read';
  /** Checkbox label. */
  label: string;
}

export const NEEDS: NeedDef[] = [
  { id: 'tryTimeout', group: 'exclusive', label: 'Взять без блокировки / по таймауту (tryLock)' },
  { id: 'interruptible', group: 'exclusive', label: 'Прерываемое ожидание (lockInterruptibly)' },
  { id: 'fair', group: 'exclusive', label: 'Честная очередь FIFO (fairness)' },
  { id: 'conditions', group: 'exclusive', label: 'Несколько условий ожидания (Condition)' },
  { id: 'concurrentReads', group: 'read', label: 'Много читателей сразу (чтений ≫ записей)' },
  { id: 'optimisticRead', group: 'read', label: 'Предельная скорость чтения, запись очень редка' },
];

export const GROUP_TITLE: Record<NeedDef['group'], string> = {
  exclusive: 'Взаимное исключение (один в секции)',
  read: 'Параллельное чтение',
};

/** Short feature word per exclusive need, used to explain a ReentrantLock pick. */
const FEATURE_WORD: Partial<Record<Need, string>> = {
  tryTimeout: 'tryLock/таймаут',
  interruptible: 'прерываемость',
  fair: 'честность',
  conditions: 'несколько Condition',
};

export interface LockRecommendation {
  choice: LockChoice;
  /** Why this lock is the right rung of the ladder. */
  reason: string;
  /** The price you pay / things to remember for this lock. */
  caveats: string[];
}

/**
 * Recommends the simplest lock that still covers every selected need, plus the
 * caveats that come with it. Precedence: optimistic read → read-heavy sharing →
 * extras over synchronized → plain synchronized.
 */
export function chooseLock(needs: Iterable<Need>): LockRecommendation {
  const s = new Set(needs);

  if (s.has('optimisticRead')) {
    const caveats = ['Не реентерабелен — не бери этот lock повторно во вложенном вызове.'];
    if (s.has('conditions')) {
      caveats.push('Condition не поддерживается — если они нужны, бери ReentrantReadWriteLock.');
    }
    return {
      choice: 'StampedLock',
      reason:
        'Оптимистичное чтение (tryOptimisticRead + validate) делает чтения почти бесплатными, когда записи очень редки.',
      caveats,
    };
  }

  if (s.has('concurrentReads')) {
    const caveats = ['При частой записи выигрыша нет — накладные расходы выше обычного замка.'];
    if (s.has('conditions')) caveats.push('Condition доступен только у writeLock().');
    caveats.push('Снимай read/write lock в finally — автоосвобождения нет.');
    return {
      choice: 'ReentrantReadWriteLock',
      reason: 'Много читателей одновременно ИЛИ один писатель — выигрыш на read-heavy данных.',
      caveats,
    };
  }

  const extras = NEEDS.filter((n) => n.group === 'exclusive' && s.has(n.id));
  if (extras.length > 0) {
    const list = extras.map((n) => FEATURE_WORD[n.id]).join(', ');
    return {
      choice: 'ReentrantLock',
      reason: `Нужны возможности сверх synchronized: ${list}.`,
      caveats: ['Снимай lock в finally — сам он не освобождается.'],
    };
  }

  return {
    choice: 'synchronized',
    reason:
      'Простое взаимное исключение без доп. требований — synchronized короче и освобождается автоматически.',
    caveats: [],
  };
}
