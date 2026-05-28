import { DOMAINS, type Domain } from '../models/common';
import type { UserProgress } from '../models/progress';

export interface DomainWeakness {
  domain: Domain;
  ability: number;
  accuracy: number;
  answered: number;
}

/** Ranks domains weakest-first by ability, then accuracy. */
export function rankWeakDomains(progress: UserProgress): DomainWeakness[] {
  return DOMAINS.map((domain) => {
    const skill = progress.skills[domain];
    return {
      domain,
      ability: skill.ability,
      accuracy: skill.answered === 0 ? 0 : skill.correct / skill.answered,
      answered: skill.answered,
    };
  }).sort((a, b) => a.ability - b.ability || a.accuracy - b.accuracy);
}

export interface ConceptWeakness {
  conceptId: string;
  attempts: number;
  /** (missing + 0.5 * partial) / attempts — higher means weaker. */
  missRate: number;
}

/**
 * Aggregates per-concept coverage from open-answer history to find the concepts
 * the user repeatedly fails to cover.
 */
export function rankWeakConcepts(progress: UserProgress, minAttempts = 1): ConceptWeakness[] {
  const agg = new Map<string, { attempts: number; penalty: number }>();

  for (const record of progress.history) {
    if (!record.conceptCoverage) continue;
    for (const concept of record.conceptCoverage) {
      const current = agg.get(concept.conceptId) ?? { attempts: 0, penalty: 0 };
      current.attempts += 1;
      if (concept.coverage === 'missing') current.penalty += 1;
      else if (concept.coverage === 'partial') current.penalty += 0.5;
      agg.set(concept.conceptId, current);
    }
  }

  const result: ConceptWeakness[] = [];
  for (const [conceptId, value] of agg) {
    if (value.attempts < minAttempts) continue;
    result.push({ conceptId, attempts: value.attempts, missRate: value.penalty / value.attempts });
  }
  return result.sort((a, b) => b.missRate - a.missRate);
}
