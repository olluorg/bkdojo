/**
 * Prints title/summary/tags/section headings for the lessons named on argv, so
 * new questions can be written against what the lesson actually teaches.
 * Run: bun scripts/lesson-brief.ts java-core jc-lesson-sets jc-lesson-treemap
 */
const domain = process.argv[2] ?? 'java-core';
const wanted = new Set(process.argv.slice(3));
const lessons = (await import(`../src/data/lessons/${domain}.json`)).default as any[];

for (const l of lessons) {
  if (wanted.size && !wanted.has(l.id)) continue;
  console.log(`\n### ${l.id} — ${l.title}`);
  console.log(`summary: ${l.summary}`);
  console.log(`tags: ${(l.relatedTags ?? []).join(', ')}`);
  console.log(`questionIds: ${(l.questionIds ?? []).join(', ')}`);
  console.log(`sections: ${l.sections.map((s: any) => s.heading).join(' | ')}`);
}
