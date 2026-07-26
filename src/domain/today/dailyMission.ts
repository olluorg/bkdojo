import type { ContentIndex } from '../content/contentIndex';
import { getByDomain } from '../content/contentIndex';
import { buildConceptLessonMap } from '../lesson/conceptLessons';
import {
  DEFAULT_GOAL,
  GRADE_TARGET_ABILITY,
  goalLabel,
  type InterviewGoal,
} from '../goal/goal';
import { DOMAIN_LABELS, DOMAINS, type Domain } from '../models/common';
import type { GlossaryTerm } from '../models/glossary';
import type { Lesson } from '../models/lesson';
import type { UserProgress } from '../models/progress';
import { wasActiveOn } from '../progress/activity';
import { isLessonRead } from '../progress/lessonProgress';
import { domainMastery, topicMastery } from '../progress/mastery';
import { rankWeakConcepts } from '../review/weakSpotDetection';
import { buildReviewSession } from '../selection/reviewSelector';
import { clamp01 } from '../util/math';

/**
 * The "Today" / Next Best Action domain layer.
 *
 * Turns the user's progress into a single, explained daily mission: one focus
 * topic, why it was chosen, a concrete plan that points at the existing screens,
 * and the expected effect on interview readiness. Pure — the screen only renders.
 */

/**
 * The interview the trainer is preparing the user for. Read from settings so the
 * goal is the learner's own (grade, company, date) rather than a constant — see
 * `domain/goal/goal`.
 */
export function goalOf(progress: UserProgress): InterviewGoal {
  return progress.settings?.goal ?? DEFAULT_GOAL;
}

/** Readiness toward the goal, per domain and overall (0..1). */
export interface ReadinessSnapshot {
  overall: number;
  byDomain: Record<Domain, number>;
  /** Always 1 — full readiness for the goal. Kept explicit for the UI/gap math. */
  target: number;
}

export type MissionReasonKind = 'weak-spot' | 'gap' | 'due-review' | 'lesson' | 'fresh-start';

export interface MissionReason {
  kind: MissionReasonKind;
  /** Human-readable lines (ru) — always present, so the focus never feels random. */
  lines: string[];
}

/** What the user gains by completing the mission — framed as an interview skill. */
export interface CapabilityUnlock {
  label: string;
  from: string;
  to: string;
}

export type MissionStepKind = 'lesson' | 'practice' | 'review' | 'terms' | 'interview';

export interface MissionStep {
  kind: MissionStepKind;
  title: string;
  detail: string;
  /** Hash-router path of an existing screen, e.g. `/practice` or `/lessons/x`. */
  path: string;
  /** Best-effort "already done today" hint, when we can tell. */
  done?: boolean;
}

export interface DailyMission {
  goalLabel: string;
  readiness: ReadinessSnapshot;
  focusDomain: Domain;
  /** e.g. "Spring Boot: Starters и Autoconfiguration". */
  focusTitle: string;
  focusLesson?: { id: string; title: string };
  reason: MissionReason;
  steps: MissionStep[];
  /** Estimated readiness gain for the focus domain, in percent points [lo, hi]. */
  expectedReadinessGain: [number, number];
  capability?: CapabilityUnlock;
  /** Where the primary CTA leads — the first plan step not yet done today. */
  primaryPath: string;
  /** Label for the primary CTA, matching the next undone step. */
  primaryLabel: string;
}

/** Alias requested by the spec — the mission is the next best action. */
export type NextBestAction = DailyMission;

/**
 * Blends placement ability and practised coverage into a 0..1 readiness, scored
 * against the ability the learner's own target grade demands — so aiming at
 * Senior honestly shows less readiness than aiming at Middle.
 */
export function domainReadiness(progress: UserProgress, index: ContentIndex, domain: Domain): number {
  const ability = progress.skills[domain].ability;
  const abilityProgress = clamp01(ability / GRADE_TARGET_ABILITY[goalOf(progress).grade]);
  const coverage = domainMastery(progress, index, domain);
  return clamp01(0.55 * abilityProgress + 0.45 * coverage);
}

export function readinessSnapshot(progress: UserProgress, index: ContentIndex): ReadinessSnapshot {
  const byDomain = {} as Record<Domain, number>;
  for (const d of DOMAINS) byDomain[d] = domainReadiness(progress, index, d);
  const overall = DOMAINS.reduce((sum, d) => sum + byDomain[d], 0) / DOMAINS.length;
  return { overall, byDomain, target: 1 };
}

export interface MissionInput {
  progress: UserProgress;
  index: ContentIndex;
  lessons: Lesson[];
  terms: GlossaryTerm[];
  now?: Date;
}

/**
 * Picks the day's focus, in priority order:
 *  1. a repeatedly-missed concept (weak spot) → its lesson's domain;
 *  2. otherwise the domain with the biggest gap to the goal;
 *  then attaches a reason, a concrete plan, and the expected effect.
 * Before placement it returns a meaningful onboarding mission instead of an empty screen.
 */
export function buildDailyMission(input: MissionInput): DailyMission {
  const { progress, index, lessons, terms, now = new Date() } = input;
  const readiness = readinessSnapshot(progress, index);

  if (!progress.placementDone) return freshStartMission(progress, readiness, lessons);

  const conceptLessons = buildConceptLessonMap(index, lessons);
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  let focusDomain: Domain | undefined;
  let focusLesson: Lesson | undefined;
  let reasonKind: MissionReasonKind = 'gap';
  let capability: CapabilityUnlock | undefined;

  // 1) Weak spot: a concept the user keeps failing to cover in open answers.
  const weak = rankWeakConcepts(progress, 2).find((c) => c.missRate >= 0.5);
  if (weak) {
    const lesson = lessonById.get(conceptLessons.get(weak.conceptId) ?? '');
    if (lesson) {
      focusDomain = lesson.domain;
      focusLesson = lesson;
    }
    const conceptTitle = index.conceptTitles.get(weak.conceptId) ?? 'эту тему';
    reasonKind = 'weak-spot';
    capability = {
      label: `Могу уверенно объяснить: ${conceptTitle}`,
      from: 'слабое место',
      to: 'на закреплении',
    };
  }

  // 2) Otherwise: the domain furthest from the goal.
  if (!focusDomain) focusDomain = lowestReadinessDomain(readiness, index);

  if (!focusLesson) focusLesson = weakestLessonInDomain(progress, index, lessons, focusDomain);
  if (!capability && focusLesson) {
    capability = {
      label: `Могу внятно объяснить тему «${focusLesson.title}»`,
      from: 'базово',
      to: 'уверенно',
    };
  }

  const dueInFocus = buildReviewSession(index, progress, { now, size: 100 }).items.filter(
    (i) => i.question.domain === focusDomain,
  ).length;

  const focusTitle = focusLesson
    ? `${DOMAIN_LABELS[focusDomain]}: ${focusLesson.title}`
    : DOMAIN_LABELS[focusDomain];

  // The CTA tracks the plan: it leads to the first step not yet done today, so
  // it advances (lesson → practice → review → terms → interview) instead of
  // re-opening the same lesson every time. When everything is done, offer extra
  // practice rather than a dead end.
  const steps = buildSteps(progress, focusDomain, focusLesson, terms, now);
  const nextStep = steps.find((s) => !s.done);

  return {
    goalLabel: goalLabel(goalOf(progress)),
    readiness,
    focusDomain,
    focusTitle,
    focusLesson: focusLesson ? { id: focusLesson.id, title: focusLesson.title } : undefined,
    reason: buildReason(reasonKind, focusDomain, readiness, dueInFocus),
    steps,
    expectedReadinessGain: expectedGain(readiness.byDomain[focusDomain]),
    capability,
    primaryPath: nextStep?.path ?? '/practice',
    primaryLabel: nextStep?.title ?? 'Позаниматься ещё',
  };
}

function lowestReadinessDomain(readiness: ReadinessSnapshot, index: ContentIndex): Domain {
  let best: Domain = 'java-core';
  let bestVal = Number.POSITIVE_INFINITY;
  for (const d of DOMAINS) {
    if (getByDomain(index, d).length === 0) continue;
    if (readiness.byDomain[d] < bestVal) {
      bestVal = readiness.byDomain[d];
      best = d;
    }
  }
  return best;
}

function weakestLessonInDomain(
  progress: UserProgress,
  index: ContentIndex,
  lessons: Lesson[],
  domain: Domain,
): Lesson | undefined {
  const inDomain = lessons.filter((l) => l.domain === domain).sort((a, b) => a.order - b.order);
  let best: Lesson | undefined;
  let bestVal = Number.POSITIVE_INFINITY;
  for (const lesson of inDomain) {
    const mastery = topicMastery(progress, index, domain, lesson.relatedTags ?? []);
    if (mastery < bestVal) {
      bestVal = mastery;
      best = lesson;
    }
  }
  return best;
}

function buildReason(
  kind: MissionReasonKind,
  domain: Domain,
  readiness: ReadinessSnapshot,
  dueInFocus: number,
): MissionReason {
  const lines: string[] = [];
  const pct = Math.round(readiness.byDomain[domain] * 100);

  if (kind === 'weak-spot') {
    lines.push('Эта тема просела в практике и mock-интервью — открытые ответы её не раскрывают.');
  } else {
    lines.push(`${DOMAIN_LABELS[domain]} — самый большой разрыв до цели (готовность ${pct}%).`);
  }
  lines.push('Она важна для перехода на Middle-уровень.');
  if (dueInFocus > 0) lines.push(`На повторение в этой теме накопилось: ${dueInFocus}.`);

  return { kind, lines };
}

function buildSteps(
  progress: UserProgress,
  domain: Domain,
  lesson: Lesson | undefined,
  terms: GlossaryTerm[],
  now: Date,
): MissionStep[] {
  // Steps are a daily checklist: each ticks off when its activity happens today,
  // independent of which focus the mission currently shows (so completed work
  // still counts even if the focus shifts after some practice).
  const lessonDone =
    readAnyLessonOn(progress, now) || (lesson ? isLessonRead(progress, lesson.id) : false);
  const domainTerms = terms.filter((t) => t.domain === domain).length;

  return [
    {
      kind: 'lesson',
      title: lesson ? 'Прочитать или повторить урок' : 'Изучить тему курса',
      detail: lesson ? lesson.title : DOMAIN_LABELS[domain],
      path: lesson ? `/lessons/${lesson.id}` : `/courses/${domain}`,
      done: lessonDone,
    },
    {
      kind: 'practice',
      title: 'Пройти практику',
      detail: 'Адаптивные вопросы по слабым темам',
      path: '/practice',
      done: wasActiveOn(progress, 'practice', now),
    },
    {
      kind: 'review',
      title: 'Отработать слабое место',
      detail: 'Повторить то, что недавно не получилось',
      path: '/review',
      done: wasActiveOn(progress, 'review', now),
    },
    {
      kind: 'terms',
      title: 'Повторить 3 термина',
      detail: domainTerms > 0 ? `Короткий дрилл по словарю (${DOMAIN_LABELS[domain]})` : 'Короткий дрилл по словарю',
      path: '/glossary',
      done: countTermsAnsweredOn(progress, now) > 0,
    },
    {
      kind: 'interview',
      title: 'При готовности — mini interview',
      detail: `Мок-интервью: ${DOMAIN_LABELS[domain]}`,
      path: '/interview',
      done: wasActiveOn(progress, 'interview', now),
    },
  ];
}

function expectedGain(readinessVal: number): [number, number] {
  const headroom = 1 - readinessVal;
  const lo = Math.min(5, Math.max(2, Math.round(headroom * 6)));
  return [lo, lo + 2];
}

function freshStartMission(
  progress: UserProgress,
  readiness: ReadinessSnapshot,
  lessons: Lesson[],
): DailyMission {
  const focusDomain: Domain = 'java-core';
  const lesson = lessons
    .filter((l) => l.domain === focusDomain)
    .sort((a, b) => a.order - b.order)[0];

  const steps: MissionStep[] = [
    {
      kind: 'lesson',
      title: 'Пройти диагностику уровня',
      detail: '5 минут с вариантами ответа — подберём сложность под тебя. Работает без AI.',
      path: '/level',
    },
    {
      kind: 'lesson',
      title: 'Прочитать первый урок',
      detail: lesson ? lesson.title : DOMAIN_LABELS[focusDomain],
      path: lesson ? `/lessons/${lesson.id}` : `/courses/${focusDomain}`,
    },
    {
      kind: 'practice',
      title: 'Пройти первую практику',
      detail: 'Несколько вопросов — чтобы появились данные для фокуса дня',
      path: '/practice',
    },
  ];

  return {
    goalLabel: goalLabel(goalOf(progress)),
    readiness,
    focusDomain,
    focusTitle: 'Начни с диагностики уровня',
    reason: {
      kind: 'fresh-start',
      lines: [
        'Пока не знаю твой уровень — пройди короткую диагностику.',
        'После неё фокус дня подстроится под твои слабые темы.',
      ],
    },
    steps,
    expectedReadinessGain: expectedGain(readiness.overall),
    primaryPath: '/level',
    primaryLabel: 'Пройти диагностику',
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function readAnyLessonOn(progress: UserProgress, day: Date): boolean {
  const read = progress.lessonsRead ?? {};
  for (const at of Object.values(read)) {
    const when = new Date(at);
    if (!Number.isNaN(when.getTime()) && isSameDay(when, day)) return true;
  }
  return false;
}

function countTermsAnsweredOn(progress: UserProgress, day: Date): number {
  const terms = progress.terms ?? {};
  let count = 0;
  for (const term of Object.values(terms)) {
    if (!term.lastAnsweredAt) continue;
    const at = new Date(term.lastAnsweredAt);
    if (!Number.isNaN(at.getTime()) && isSameDay(at, day)) count++;
  }
  return count;
}
