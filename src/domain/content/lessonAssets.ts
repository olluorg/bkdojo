// Lesson infographics live in `src/data/lessons/assets`. Vite hashes each file
// and gives us its final URL (base-path aware), so lesson JSON only stores the
// bare file name and we resolve it here. Both raster (`.png`) and authored
// vector (`.svg`) diagrams are supported.
const MODULES = import.meta.glob<string>('../../data/lessons/assets/*.{png,svg}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const BY_NAME: Record<string, string> = {};
for (const [path, url] of Object.entries(MODULES)) {
  const name = path.split('/').pop();
  if (name) BY_NAME[name] = url;
}

/** Resolves a lesson-asset file name to its bundled URL, or `undefined`. */
export function resolveLessonAsset(src: string): string | undefined {
  return BY_NAME[src];
}
