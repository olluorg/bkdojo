import { describe, expect, test } from 'bun:test';
import { buildContentIndex } from '../content/contentIndex';
import { selectFollowupFromBank } from './followupSelector';
import { choiceQ, openQ } from './questionFixtures';

describe('selectFollowupFromBank', () => {
  test('prefers an open question whose rubric contains the missing concept', () => {
    const source = openQ('src', { tags: ['oop'], rubricIds: ['gap'] });
    const byConcept = openQ('concept-match', { tags: [], rubricIds: ['gap'] });
    const byTagOnly = choiceQ('tag-match', { tags: ['oop'] });
    const index = buildContentIndex([source, byConcept, byTagOnly]);

    const picked = selectFollowupFromBank(index, source, 'gap');
    expect(picked?.id).toBe('concept-match');
  });

  test('falls back to a tag-sharing question, preferring choice then easier', () => {
    const source = openQ('src', { tags: ['oop'], rubricIds: ['c-src'] });
    const openSameTag = openQ('open-tag', { tags: ['oop'], difficulty: 2, rubricIds: ['other'] });
    const choiceSameTagHard = choiceQ('choice-hard', { tags: ['oop'], difficulty: 4 });
    const choiceSameTagEasy = choiceQ('choice-easy', { tags: ['oop'], difficulty: 1 });
    const index = buildContentIndex([source, openSameTag, choiceSameTagHard, choiceSameTagEasy]);

    const picked = selectFollowupFromBank(index, source, 'gap-not-in-bank');
    expect(picked?.id).toBe('choice-easy');
  });

  test('never returns the source question', () => {
    const source = openQ('src', { tags: ['oop'], rubricIds: ['gap'] });
    const index = buildContentIndex([source]);
    expect(selectFollowupFromBank(index, source, 'gap')).toBeUndefined();
  });

  test('honours excludeIds', () => {
    const source = openQ('src', { tags: ['oop'], rubricIds: ['c-src'] });
    const candidate = openQ('cand', { tags: [], rubricIds: ['gap'] });
    const index = buildContentIndex([source, candidate]);
    expect(selectFollowupFromBank(index, source, 'gap', new Set(['cand']))).toBeUndefined();
  });

  test('stays within the source domain', () => {
    const source = openQ('src', { domain: 'java-core', tags: ['oop'], rubricIds: ['c-src'] });
    const otherDomain = openQ('other', { domain: 'spring-boot', tags: ['oop'], rubricIds: ['gap'] });
    const index = buildContentIndex([source, otherDomain]);
    expect(selectFollowupFromBank(index, source, 'gap')).toBeUndefined();
  });
});
