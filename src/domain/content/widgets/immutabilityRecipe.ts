// Pure model behind the "Собери immutable-класс" sandbox. The recipe for a truly
// immutable class is framed as three "locks" an attacker must get past; each
// recipe step is one guard. Turn a guard off and a concrete attack opens up —
// the widget shows which. The class under construction is the classic `Period`
// with a *mutable* `List<Event>` field, so both the input copy and the output
// copy are independently required (storing a mutable defensive copy means the
// getter must still not hand out the live reference).

/** One ingredient of the immutable-class recipe. */
export type Guard =
  | 'finalFields'
  | 'privateFields'
  | 'noSetters'
  | 'finalClass'
  | 'copyIn'
  | 'copyOut';

/** The three "locks" the recipe closes, in defensive order. */
export type Lock = 'assign' | 'access' | 'reference';

export interface GuardDef {
  id: Guard;
  /** Which lock this guard belongs to. */
  lock: Lock;
  /** The recipe step, phrased as the action you take. */
  label: string;
  /** Short Java-ish attack that becomes possible when the guard is OFF. */
  attack: string;
  /** Why that attack breaks immutability. */
  leak: string;
}

export const LOCK_TITLE: Record<Lock, string> = {
  assign: 'Замок 1 — присваивание',
  access: 'Замок 2 — доступ',
  reference: 'Замок 3 — ссылки',
};

export const LOCK_HINT: Record<Lock, string> = {
  assign: 'Запрети менять сами поля.',
  access: 'Запрети дотянуться до полей снаружи.',
  reference: 'Запрети пролезть через общую ссылку на изменяемый объект.',
};

/**
 * The full recipe, in recipe order. Each guard maps to exactly one distinct
 * attack so the learner sees a one-to-one «забыл шаг → вот дыра».
 */
export const GUARDS: GuardDef[] = [
  {
    id: 'finalFields',
    lock: 'assign',
    label: 'Поля final',
    attack: 'p.events = new ArrayList<>(); // переприсвоили поле',
    leak: 'Без final ссылку в поле можно заменить целиком — и теряется гарантия безопасной публикации (final field freeze).',
  },
  {
    id: 'privateFields',
    lock: 'access',
    label: 'Поля private',
    attack: 'p.events.add(evt); // поле видно напрямую',
    leak: 'Публичное/пакетное поле читают и меняют в обход геттера — инкапсуляции нет.',
  },
  {
    id: 'noSetters',
    lock: 'access',
    label: 'Никаких сеттеров и мутаторов',
    attack: 'p.setEvents(other); // сеттер меняет состояние',
    leak: 'Любой мутатор напрямую меняет наблюдаемое состояние после создания.',
  },
  {
    id: 'finalClass',
    lock: 'access',
    label: 'Запрет наследования (final-класс или приватный конструктор + фабрика)',
    attack: 'class Evil extends Period { int v; void set(int x){ v=x; } }',
    leak: 'Подкласс добавляет изменяемое состояние/мутатор, а его экземпляр передают всюду, где ждут Period.',
  },
  {
    id: 'copyIn',
    lock: 'reference',
    label: 'Защитная копия на входе (в конструкторе)',
    attack: 'List<Event> src = ...; Period p = new Period(src); src.add(evt);',
    leak: 'Конструктор сохранил чужую ссылку — у вызывающего остаётся рычаг к внутренностям объекта.',
  },
  {
    id: 'copyOut',
    lock: 'reference',
    label: 'Защитная копия на выходе (в геттере)',
    attack: 'p.events().add(evt); // геттер вернул живую ссылку',
    leak: 'Геттер отдал внутренний изменяемый список — его меняют снаружи прямо у вас «под капотом».',
  },
];

/** A single open attack: which guard is missing and what it lets you do. */
export interface Hole {
  guard: Guard;
  label: string;
  attack: string;
  leak: string;
}

export interface ImmutabilityVerdict {
  /** True only when every guard in the recipe is enabled. */
  immutable: boolean;
  /** Open attacks, in recipe order, for the guards that are off. */
  holes: Hole[];
}

/**
 * Given the set of recipe steps the user has applied, reports whether the class
 * is truly immutable and, if not, every concrete attack still open.
 */
export function evalImmutability(enabled: Iterable<Guard>): ImmutabilityVerdict {
  const on = new Set(enabled);
  const holes: Hole[] = GUARDS.filter((g) => !on.has(g.id)).map((g) => ({
    guard: g.id,
    label: g.label,
    attack: g.attack,
    leak: g.leak,
  }));
  return { immutable: holes.length === 0, holes };
}
