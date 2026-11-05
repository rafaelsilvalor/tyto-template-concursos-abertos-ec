import { describe, expect, it } from 'vitest';

import { compileExample } from './compile.js';

/**
 * The example briefs against the HTML the template produced last time it was reviewed: one
 * snapshot per slide.
 */

describe.each([
  ['semana', 4],
  ['sem-brasao', 4],
  ['sem-area', 4],
])('the example %s', (name, slides) => {
  it(`compiles to ${String(slides)} grid slides, the HTML the template drew last time`, async () => {
    const compiled = await compileExample(`${name}.brief`);

    expect(compiled.frames).toHaveLength(slides);
    for (const [index, slide] of compiled.frames.entries()) {
      await expect(slide.html).toMatchFileSnapshot(
        `./__snapshots__/${name}-${String(index + 1)}.html`,
      );
    }
  });
});
