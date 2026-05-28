import type { Difficulty, Domain } from '../models/common';
import { isOpenQuestion, type Question } from '../models/question';

export interface ContentIndex {
  all: Question[];
  byId: Map<string, Question>;
  byDomain: Map<Domain, Question[]>;
  byDomainDifficulty: Map<string, Question[]>;
  /** conceptId → concept title, across all open-question rubrics. */
  conceptTitles: Map<string, string>;
}

function key(domain: Domain, difficulty: Difficulty): string {
  return `${domain}:${difficulty}`;
}

export function buildContentIndex(questions: Question[]): ContentIndex {
  const byId = new Map<string, Question>();
  const byDomain = new Map<Domain, Question[]>();
  const byDomainDifficulty = new Map<string, Question[]>();
  const conceptTitles = new Map<string, string>();

  for (const q of questions) {
    byId.set(q.id, q);

    const domainBucket = byDomain.get(q.domain) ?? [];
    domainBucket.push(q);
    byDomain.set(q.domain, domainBucket);

    const ddKey = key(q.domain, q.difficulty);
    const ddBucket = byDomainDifficulty.get(ddKey) ?? [];
    ddBucket.push(q);
    byDomainDifficulty.set(ddKey, ddBucket);

    if (isOpenQuestion(q)) {
      for (const concept of q.rubric) conceptTitles.set(concept.id, concept.title);
    }
  }

  return { all: questions, byId, byDomain, byDomainDifficulty, conceptTitles };
}

/**
 * Adds one question to an existing index in place, keeping every bucket
 * consistent. Used to fold AI-generated follow-up questions into the runtime
 * "bank" (see generatedQuestions / resolveCorrective). A no-op if the id is
 * already present, so re-merging persisted questions is safe.
 */
export function addToIndex(index: ContentIndex, q: Question): void {
  if (index.byId.has(q.id)) return;

  index.all.push(q);
  index.byId.set(q.id, q);

  const domainBucket = index.byDomain.get(q.domain) ?? [];
  domainBucket.push(q);
  index.byDomain.set(q.domain, domainBucket);

  const ddKey = key(q.domain, q.difficulty);
  const ddBucket = index.byDomainDifficulty.get(ddKey) ?? [];
  ddBucket.push(q);
  index.byDomainDifficulty.set(ddKey, ddBucket);

  if (isOpenQuestion(q)) {
    for (const concept of q.rubric) index.conceptTitles.set(concept.id, concept.title);
  }
}

export function getById(index: ContentIndex, id: string): Question | undefined {
  return index.byId.get(id);
}

export function getByDomain(index: ContentIndex, domain: Domain): Question[] {
  return index.byDomain.get(domain) ?? [];
}

export function getByDomainDifficulty(
  index: ContentIndex,
  domain: Domain,
  difficulty: Difficulty,
): Question[] {
  return index.byDomainDifficulty.get(key(domain, difficulty)) ?? [];
}
