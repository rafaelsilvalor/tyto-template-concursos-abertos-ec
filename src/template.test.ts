import { describe, expect, it } from 'vitest';

import { compileExample } from '../tests/compile.js';

import { AREA_TITLE, CONTENT, ROW } from './template.js';

/**
 * The composition's rules, read on the `Scene` the example briefs compile to: what each kind of
 * slide holds, that an exam draws without its crest, and that nothing leaves the slide.
 */

interface Node {
  readonly name?: string;
  readonly kind: string;
  readonly transform: { readonly x: number; readonly y: number };
  readonly box?: { readonly w: number };
  readonly size?: { readonly w: number; readonly h: number };
  readonly children?: readonly Node[];
  readonly runs?: readonly { readonly kind: string; readonly text?: string }[];
}

interface Slide {
  readonly children: readonly Node[];
}

async function slidesOf(file: string): Promise<Slide[]> {
  const compiled = await compileExample(file);
  const scene = compiled.scene as unknown as { artworks: { frames: Slide[] }[] };
  return scene.artworks.map((artwork) => artwork.frames[0]!);
}

const named = (slide: Slide, name: string): Node[] =>
  slide.children.filter((node) => node.name === name);

const words = (node: Node): string =>
  (node.runs ?? []).map((item) => (item.kind === 'text' ? (item.text ?? '') : '\n')).join('');

describe('the example with crests', () => {
  it('draws a cover, a two-exam slide, a one-exam slide and the sign-off', async () => {
    const [cover, two, one, signOff] = await slidesOf('semana.brief');

    expect(named(cover!, 'capa-faixa')).toHaveLength(1);
    expect(words(named(cover!, 'capa-faixa-texto')[0]!)).toBe('em Novembro');
    expect(named(two!, 'area').map(words)).toEqual(['Área Policial']);
    expect(named(two!, 'brasao')).toHaveLength(2);
    expect(named(two!, 'divisoria')).toHaveLength(1);
    expect(named(one!, 'area')).toHaveLength(0);
    expect(named(one!, 'brasao')).toHaveLength(1);
    expect(named(one!, 'divisoria')).toHaveLength(0);
    expect(named(signOff!, 'contracapa-caixa')).toHaveLength(1);
    expect(named(signOff!, 'contracapa-destaque').map(words)).toEqual(['PALAVRA']);
  });

  it('puts each crest in its row, over the name of the exam written under it', async () => {
    const [, two] = await slidesOf('semana.brief');
    const crests = named(two!, 'brasao');
    const names = named(two!, 'concurso');

    expect(names.map(words)).toEqual(['Concurso\nPC QX', 'Concurso\nPC Vale Alto']);
    for (const [index, crest] of crests.entries()) {
      expect(crest.transform.x).toBe(ROW.crest.x);
      expect(crest.transform.y).toBeLessThan(names[index]!.transform.y);
      expect(crest.transform.y + crest.size!.h).toBeLessThan(names[index]!.transform.y + 60);
    }
  });

  it('draws the arrow on every slide but the last', async () => {
    const slides = await slidesOf('semana.brief');

    expect(slides.map((slide) => named(slide, 'seta').length)).toEqual([1, 1, 1, 0]);
  });
});

describe('the example without crests', () => {
  it('draws no crest, and each name where the crest would sit, centred on its row', async () => {
    const [, two, one] = await slidesOf('sem-brasao.brief');

    expect(named(two!, 'brasao')).toHaveLength(0);
    expect(named(one!, 'brasao')).toHaveLength(0);
    const [top, bottom] = named(two!, 'concurso');
    const [rule] = named(two!, 'divisoria');
    // Without a crest the name column is the name alone, centred on its row's middle.
    expect(top!.transform.y).toBeGreaterThan(rule!.transform.y - ROW.pitch / 2 - 100);
    expect(top!.transform.y).toBeLessThan(rule!.transform.y - ROW.pitch / 2);
    expect(bottom!.transform.y).toBeGreaterThan(rule!.transform.y + ROW.pitch / 2 - 100);
    expect(bottom!.transform.y).toBeLessThan(rule!.transform.y + ROW.pitch / 2);
  });

  it('draws the default cover and sign-off when both are empty', async () => {
    const slides = await slidesOf('sem-brasao.brief');

    expect(words(named(slides[0]!, 'capa-faixa-texto')[0]!)).toBe('nesta semana');
    expect(named(slides[3]!, 'contracapa-destaque').map(words)).toEqual(['VAGAS']);
  });
});

describe('where the exams sit', () => {
  it('puts the rule on the room under a one-line title: 794, where the reference draws it', async () => {
    const [, two] = await slidesOf('semana.brief');

    expect(named(two!, 'area')).toHaveLength(1);
    expect(named(two!, 'divisoria')[0]!.transform.y).toBe(794);
  });

  it('centres two exams on the slide when it has no area title', async () => {
    const [two] = await slidesOf('sem-area.brief');

    expect(named(two!, 'area')).toHaveLength(0);
    expect(named(two!, 'divisoria')[0]!.transform.y).toBe(Math.round(CONTENT.centreWithoutTitle));
  });

  it('keeps one exam under a title clear of the title by the same gap or more', async () => {
    const [, one] = await slidesOf('sem-area.brief');
    const [crest] = named(one!, 'brasao');

    expect(named(one!, 'area')).toHaveLength(1);
    // The crest's box starts at the room's top or lower; its drawn picture inside the box lower still.
    expect(crest!.transform.y).toBeGreaterThanOrEqual(
      AREA_TITLE.capTop + AREA_TITLE.size * 0.709 + CONTENT.titleGap,
    );
  });
});

describe('a long area title', () => {
  it('starts where a one-line title starts and takes the exams down with its extra lines', async () => {
    const [, short] = await slidesOf('sem-brasao.brief');
    const [, , long] = await slidesOf('sem-area.brief');
    const [shortTitle] = named(short!, 'area');
    const [longTitle] = named(long!, 'area');

    expect(longTitle!.transform.y).toBe(shortTitle!.transform.y);
    // The rule moves down by half the title's extra height: the room's top moves by all of it.
    const below =
      named(long!, 'divisoria')[0]!.transform.y - named(short!, 'divisoria')[0]!.transform.y;
    expect(below).toBeGreaterThan(0);
  });
});

describe('every slide', () => {
  it('keeps every text and shape inside the slide', async () => {
    for (const file of ['semana.brief', 'sem-brasao.brief', 'sem-area.brief']) {
      for (const slide of await slidesOf(file)) {
        for (const node of slide.children) {
          const width = node.box?.w ?? node.size?.w ?? 0;
          expect(node.transform.x, node.name).toBeGreaterThanOrEqual(0);
          expect(node.transform.x + width, node.name).toBeLessThanOrEqual(1080);
          expect(node.transform.y, node.name).toBeGreaterThanOrEqual(0);
          expect(node.transform.y, node.name).toBeLessThan(1350);
        }
      }
    }
  });
});
