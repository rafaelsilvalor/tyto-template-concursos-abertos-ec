import { describe, expect, it } from 'vitest';

import { named, slidesOf } from './scene.js';

/**
 * A slide's role, read through the kit's `roleOf`: `{capa}` is the cover, `{contracapa}` the
 * sign-off, a slide with neither an area slide, and a slide that writes both is the cover.
 * Each role is told by what only it draws: the cover's band, the sign-off's box, an exam's name.
 */

const EXAM = '  Concurso: Guarda QX\n  Vagas: 85';

/** Which of the three bodies a slide drew. */
const drawn = (slide: Parameters<typeof named>[0]): string[] =>
  ['capa-faixa', 'contracapa-caixa', 'concurso'].filter((name) => named(slide, name).length > 0);

describe("a slide's role", () => {
  it('is the cover under `{capa}`', async () => {
    const [slide] = await slidesOf('::lamina {capa}');

    expect(drawn(slide!)).toEqual(['capa-faixa']);
  });

  it('is the sign-off under `{contracapa}`', async () => {
    const [slide] = await slidesOf('::lamina {contracapa}');

    expect(drawn(slide!)).toEqual(['contracapa-caixa']);
  });

  it('is an area slide with neither flag', async () => {
    const [slide] = await slidesOf(`::lamina\n${EXAM}`);

    expect(drawn(slide!)).toEqual(['concurso']);
  });

  it.each(['{capa, contracapa}', '{contracapa, capa}'])(
    'is the cover when the slide writes both flags, %s',
    async (flags) => {
      const [slide] = await slidesOf(`::lamina ${flags}`);

      expect(drawn(slide!)).toEqual(['capa-faixa']);
    },
  );

  it('is read slide by slide: a cover, an area slide and a sign-off in one brief', async () => {
    const slides = await slidesOf(`::lamina {capa}\n\n::lamina\n${EXAM}\n\n::lamina {contracapa}`);

    expect(slides.map(drawn)).toEqual([['capa-faixa'], ['concurso'], ['contracapa-caixa']]);
  });
});
