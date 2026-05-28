import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { loadContent } from '../content/contentLoader';
import { DOMAINS } from '../models/common';
import { buildPlacementSession } from './placementSelector';

const index = buildContentIndex(loadContent().questions);

describe('buildPlacementSession', () => {
  test('covers every domain and marks items as placement', () => {
    const session = buildPlacementSession(index, { perDomain: 2 });
    expect(session.kind).toBe('placement');
    expect(session.items.every((i) => i.reason === 'placement')).toBe(true);

    const domains = new Set(session.items.map((i) => i.question.domain));
    for (const domain of DOMAINS) expect(domains.has(domain)).toBe(true);
  });

  test('choiceOnly mode yields only choice questions (AI-independent)', () => {
    const session = buildPlacementSession(index, { perDomain: 2, choiceOnly: true });
    expect(session.items.length).toBeGreaterThan(0);
    expect(session.items.every((i) => i.question.type !== 'open')).toBe(true);
  });
});
