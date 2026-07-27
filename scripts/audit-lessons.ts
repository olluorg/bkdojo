/**
 * Ad-hoc content audit: prints per-lesson structure stats for one domain so gaps
 * (missing tests, thin sections, no cross-links) are visible at a glance.
 * Run: bun scripts/audit-lessons.ts java-core
 */
const domain = process.argv[2] ?? 'java-core';
const lessons = (await import(`../src/data/lessons/${domain}.json`)).default as any[];
const questions = (await import(`../src/data/questions/${domain}.json`)).default as any[];

const qById = new Map(questions.map((q: any) => [q.id, q]));
const usedQ = new Set<string>();

let rows: string[] = [];
for (const l of lessons) {
  const words = l.sections.flatMap((s: any) => s.paragraphs).join(' ').split(/\s+/).length;
  const qIds: string[] = l.questionIds ?? [];
  qIds.forEach((id) => usedQ.add(id));
  const missing = qIds.filter((id) => !qById.has(id));
  const open = qIds.filter((id) => qById.get(id)?.type === 'open').length;
  const hasCode = l.sections.some((s: any) => s.code);
  const hasImage = l.sections.some((s: any) => s.image);
  const hasWidget = l.sections.some((s: any) => s.interactive);
  const hasInterview = l.sections.some((s: any) => /собеседовании/i.test(s.heading));
  rows.push(
    [
      l.id.padEnd(34),
      `sec=${l.sections.length}`.padEnd(7),
      `w=${words}`.padEnd(8),
      `q=${qIds.length}`.padEnd(6),
      `open=${open}`.padEnd(7),
      `rel=${(l.related ?? []).length}`.padEnd(6),
      hasCode ? 'code' : '    ',
      hasImage ? 'img' : '   ',
      hasWidget ? 'wid' : '   ',
      hasInterview ? 'interview' : '         ',
      missing.length ? `MISSING:${missing.join(',')}` : '',
    ].join(' '),
  );
}
console.log(rows.join('\n'));

const orphan = questions.filter((q: any) => !usedQ.has(q.id));
console.log(`\nlessons=${lessons.length} questions=${questions.length} orphanQuestions=${orphan.length}`);
console.log('orphans:', orphan.map((q: any) => q.id).join(','));
