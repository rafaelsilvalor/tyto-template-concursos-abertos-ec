import { describe, expect, it } from 'vitest';

import { compileBrief, compileExample } from '../tests/compile.js';

import { AREA_TITLE, CONTENT, COVER, ROW, SIGN_OFF, SINGLE } from './template.js';

import type { AssetResolver } from '@tyto/core';
import type { CompileTemplateOptions } from '@tyto/template-kit/testing';

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
  readonly runs?: readonly {
    readonly kind: string;
    readonly text?: string;
    readonly size?: number;
  }[];
  readonly lineHeight?: number;
  readonly overflow?: string;
}

interface Slide {
  readonly children: readonly Node[];
}

const framesOf = (scene: unknown): Slide[] =>
  (scene as { artworks: { frames: Slide[] }[] }).artworks.map((artwork) => artwork.frames[0]!);

async function slidesOf(file: string): Promise<Slide[]> {
  return framesOf((await compileExample(file)).scene);
}

type Given = Pick<CompileTemplateOptions, 'assets' | 'faces'>;

/** The slides of a brief written here: `body` under the frontmatter, `frontmatter` added to it. */
async function slidesIn(body: string, given: Given = {}, frontmatter = ''): Promise<Slide[]> {
  return framesOf((await compileBrief(body, given, frontmatter)).value.scene);
}

/** How many times a brief's author is told something does not fit. */
async function overflowsIn(body: string): Promise<number> {
  const { diagnostics } = await compileBrief(body);
  return diagnostics.filter((item) => item.code === 'W_TEMPLATE_OVERFLOW').length;
}

/** Every image a brief names, found with the size given; no file is read. */
const filesOf = (w: number, h: number): AssetResolver => ({
  base: '.',
  resolve: (reference) =>
    Promise.resolve({
      id: reference,
      source: 'file',
      path: reference,
      hash: 'file',
      size: { w, h },
    }),
});

/**
 * A face whose every glyph is half an em wide. With a face the context measures a text; without
 * one, as in every other test here, the template counts 0.55 em a glyph.
 */
const HALF_EM: Given = {
  faces: { get: () => ({ advance: (text: string) => [...text].length * 0.5, contentHeight: 1.2 }) },
};

/** The kit's metrics for the face: the capitals stand 0.709 em tall, 0.75 em over the baseline. */
const ASCENT = 0.75;
const CAP_HEIGHT = 0.709;

const sizeOf = (node: Node): number => node.runs?.find((item) => item.kind === 'text')?.size ?? 0;

/** Where a text's first capitals start: under half its leading and the room over a capital. */
const capTop = (node: Node): number => {
  const leading = ((node.lineHeight ?? 1) - 1) / 2;
  return node.transform.y + (leading + ASCENT - CAP_HEIGHT) * sizeOf(node);
};

/**
 * Every node of a slide, each at its place on the slide: a group moves what it holds, so its
 * offset is summed into its children's. Since TYTO-883 a two-exam slide's rows are a table of
 * groups, and a node's own transform is only its place in its cell.
 */
function placed(slide: Slide): Node[] {
  const walk = (nodes: readonly Node[], x: number, y: number): Node[] =>
    nodes.flatMap((node) => {
      const at = { x: x + node.transform.x, y: y + node.transform.y };
      return [{ ...node, transform: at }, ...walk(node.children ?? [], at.x, at.y)];
    });
  return walk(slide.children, 0, 0);
}

const named = (slide: Slide, name: string): Node[] =>
  placed(slide).filter((node) => node.name === name);

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
        for (const node of placed(slide)) {
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

describe('the seal', () => {
  const exam = '::lamina\n  Concurso: Guarda QX\n  Vagas: 85';
  const sealed = (body: string): Promise<Slide[]> =>
    slidesIn(body, { assets: filesOf(1080, 140) }, 'selo: ./selo.png\n');
  const top = (slide: Slide, name: string): number => named(slide, name)[0]!.transform.y;

  it('is drawn on the last slide, the signature on the page it leaves, the exam centred there', async () => {
    const [open] = await slidesIn(exam);
    const [closed] = await sealed(exam);
    const [seal] = named(closed!, 'seal');

    expect(named(open!, 'seal')).toHaveLength(0);
    expect(seal).toBeDefined();
    const band = seal!.size!.h;
    expect(band).toBeGreaterThan(0);
    expect(seal!.transform.y).toBe(1350 - band);
    expect(top(open!, 'assinatura') - top(closed!, 'assinatura')).toBeCloseTo(band, 6);
    // The exam's room loses the band at its foot, so its middle rises by half of it.
    expect(top(open!, 'concurso') - top(closed!, 'concurso')).toBeCloseTo(band / 2, 6);
    expect(top(open!, 'fatos') - top(closed!, 'fatos')).toBeCloseTo(band / 2, 6);
  });

  it('leaves every slide but the last where it stands without a seal', async () => {
    const carousel = `::lamina {capa}\n\n${exam}\n\n::lamina {contracapa}`;
    const open = await slidesIn(carousel);
    const closed = await sealed(carousel);

    expect(closed.map((slide) => named(slide, 'seal').length)).toEqual([0, 0, 1]);
    for (const index of [0, 1]) {
      expect(top(closed[index]!, 'assinatura')).toBe(top(open[index]!, 'assinatura'));
      expect(top(closed[index]!, 'seta')).toBe(top(open[index]!, 'seta'));
    }
    expect(top(closed[1]!, 'concurso')).toBe(top(open[1]!, 'concurso'));
  });
});

describe('a crest', () => {
  const brief = [
    '::lamina',
    '::brasao ./a.png',
    '  Concurso: Guarda QX',
    '  Vagas: 85',
    '::brasao ./b.png',
    '  Concurso: Guarda Vale Alto',
    '  Vagas: 40',
    '',
    '::lamina',
    '::brasao ./a.png',
    '  Concurso: Guarda QX',
    '  Vagas: 85',
  ].join('\n');

  it.each([
    ['nine times as wide as it is tall', 900, 100],
    ['nine times as tall as it is wide', 100, 900],
  ])('is held to the shape the reference draws when its file is %s', async (_shape, w, h) => {
    const [two, one] = await slidesIn(brief, { assets: filesOf(w, h) });

    expect(named(two!, 'brasao').map((crest) => crest.size)).toEqual([
      { w: ROW.crest.w, h: ROW.crest.drawn },
      { w: ROW.crest.w, h: ROW.crest.drawn },
    ]);
    const [crest] = named(one!, 'brasao');
    const [name] = named(one!, 'concurso');
    expect(crest!.size).toEqual({ w: SINGLE.crest.w, h: SINGLE.crest.drawn });
    expect(crest!.transform.x + SINGLE.crest.w / 2).toBe(1080 / 2);
    // Centred in its box, the name's capitals the gap under the box's foot.
    expect(capTop(name!) - (crest!.transform.y + SINGLE.crest.drawn / 2)).toBeCloseTo(
      SINGLE.crest.h / 2 + SINGLE.name.gap,
      6,
    );
  });
});

describe('what a face measures', () => {
  it("centres a lone exam's facts by their widest line as measured, never rounded", async () => {
    // "Vagas: 85" is 9 glyphs, half an em each at the facts' 35.59 px.
    const [one] = await slidesIn('::lamina\n  Concurso: Guarda QX\n  Vagas: 85', HALF_EM);
    const [facts] = named(one!, 'fatos');
    const widest = 9 * 0.5 * SINGLE.facts.size;

    expect(Number.isInteger(widest)).toBe(false);
    expect(facts!.transform.x).toBeCloseTo(1080 / 2 - widest / 2, 6);
  });

  it("centres a lone exam's facts by their column when a line is wider than it", async () => {
    // One word of 60 glyphs cannot break, and is wider than the column's 600 px.
    const wide = `::lamina\n  Concurso: Guarda QX\n  Vagas: ${'9'.repeat(60)}`;
    const [one] = await slidesIn(wide, HALF_EM);

    expect(named(one!, 'fatos')[0]!.transform.x).toBe(1080 / 2 - SINGLE.facts.width / 2);
  });

  it("makes the cover's band as wide as the wider of the title and its own line", async () => {
    // "Vagas" is 5 glyphs and "nesta semana" 12, half an em each at the cover's 96 px.
    const [cover] = await slidesIn('::lamina {capa}\n  Vagas\n  nesta semana', HALF_EM);
    const [band] = named(cover!, 'capa-faixa');

    expect(band!.size!.w).toBeCloseTo(12 * 0.5 * COVER.size - 2 * COVER.bandInset, 6);
    expect(band!.transform.x + band!.size!.w / 2).toBeCloseTo(1080 / 2, 6);
  });
});

describe('what the estimate counts', () => {
  // Without a face a line of the area title's 640 px holds 22 glyphs of 0.55 em at 51.06 px.
  const rows = '  Concurso: Guarda QX\n  Vagas: 85\n  Concurso: Guarda Vale Alto\n  Vagas: 40';
  const ruleUnder = async (title: string): Promise<number> => {
    const [two] = await slidesIn(`::lamina\n  ${title}\n${rows}`);
    return named(two!, 'divisoria')[0]!.transform.y;
  };

  it('keeps a title of 22 glyphs on one line and wraps one of 23', async () => {
    const pitch = AREA_TITLE.size * AREA_TITLE.lineHeight;

    expect([...'Área Policial e Fiscal']).toHaveLength(22);
    expect(await ruleUnder('Área Policial e Fiscal')).toBe(794);
    // A second line takes the room's top down by its pitch, and the rule by half of that.
    expect(await ruleUnder('Área Policial e Fiscais')).toBe(Math.round(794.10075 + pitch / 2));
  });
});

describe('what a slide holds', () => {
  const exam = (name: string, facts = 1): string =>
    [`  Concurso: ${name}`, ...Array.from({ length: facts }, () => '  Vagas: 85')].join('\n');

  it('draws two exams and tells the author of a third', async () => {
    const two = `::lamina\n${exam('Guarda QX')}\n${exam('Guarda Vale Alto')}`;
    const three = `${two}\n${exam('Guarda Sul')}`;
    const [slide] = await slidesIn(three);

    expect(named(slide!, 'concurso').map(words)).toEqual([
      'Concurso\nGuarda QX',
      'Concurso\nGuarda Vale Alto',
    ]);
    expect(await overflowsIn(three)).toBe(1);
    expect(await overflowsIn(two)).toBe(0);
  });

  it("draws an exam with no fact in its row, its name on the row's middle, and says nothing", async () => {
    // Two short names: each is two lines, "Concurso" and the name, by the estimate too.
    const brief = `::lamina\n${exam('Guarda QX', 0)}\n${exam('Guarda Sul')}`;
    const [slide] = await slidesIn(brief);
    const [upper, lower] = named(slide!, 'concurso');
    const [rule] = named(slide!, 'divisoria');
    const height = ROW.name.size * ROW.name.lineHeight + ROW.name.size * CAP_HEIGHT;

    expect(named(slide!, 'fatos').map(words)).toEqual(['Vagas: 85']);
    expect(capTop(upper!) + height / 2).toBeCloseTo(rule!.transform.y - ROW.pitch / 2, 6);
    expect(capTop(lower!) + height / 2).toBeCloseTo(rule!.transform.y + ROW.pitch / 2, 6);
    expect(await overflowsIn(brief)).toBe(0);
  });

  it('centres a lone exam with no fact by its name alone', async () => {
    const [slide] = await slidesIn(`::lamina\n${exam('Guarda QX', 0)}`);
    const [name] = named(slide!, 'concurso');
    const height = SINGLE.name.size * SINGLE.name.lineHeight + SINGLE.name.size * CAP_HEIGHT;

    expect(named(slide!, 'fatos')).toHaveLength(0);
    expect(capTop(name!) + height / 2).toBeCloseTo(CONTENT.centreWithoutTitle, 6);
  });
});

describe("the sign-off's boxed word", () => {
  const capitalsHeight = SIGN_OFF.size * CAP_HEIGHT;
  const signOff = async (
    paragraph: string,
    given: Given = {},
  ): Promise<{ box: Node; word: Node; plain: Node[]; order: (string | undefined)[] }> => {
    const [slide] = await slidesIn(`::lamina {contracapa}\n  ${paragraph}`, given);
    return {
      box: named(slide!, 'contracapa-caixa')[0]!,
      word: named(slide!, 'contracapa-destaque')[0]!,
      plain: named(slide!, 'contracapa-texto'),
      order: placed(slide!).map((node) => node.name),
    };
  };

  it.each([
    ['on a paragraph of one line', 'Comente **PALAVRA** hoje', 0],
    [
      'on the last of three lines',
      'Receba o link do blog com todas as vagas abertas: comente **PALAVRA**',
      2,
    ],
  ])(
    'is centred in its box, 16 px over its capitals and 15 px under its baseline, %s',
    async (_where, paragraph, line) => {
      const { box, word, plain } = await signOff(paragraph);
      const first = Math.min(...plain.map((node) => node.transform.y));
      const over = capTop(word) - box.transform.y;
      const under = box.transform.y + box.size!.h - (capTop(word) + capitalsHeight);

      expect((word.transform.y - first) / (SIGN_OFF.size * SIGN_OFF.lineHeight)).toBeCloseTo(
        line,
        6,
      );
      expect(over).toBeCloseTo(SIGN_OFF.box.over, 6);
      expect(under).toBeCloseTo(SIGN_OFF.box.under, 6);
      expect(Math.abs(over - under)).toBeLessThanOrEqual(1);
    },
  );

  it('has the same 17 px each side of its measured advance, a measured space from its neighbours', async () => {
    const { box, word, plain } = await signOff('Comente **PALAVRA** hoje', HALF_EM);
    const glyph = SIGN_OFF.size * 0.5;
    // "Comente", the box, "hoje" and two spaces: 20 glyphs and the box's two paddings.
    const left = 1080 / 2 - (20 * glyph + 2 * SIGN_OFF.box.padX) / 2;

    expect(box.size!.w).toBeCloseTo(7 * glyph + 2 * SIGN_OFF.box.padX, 6);
    expect(word.transform.x - box.transform.x).toBeCloseTo(SIGN_OFF.box.padX, 6);
    expect(plain.map(words)).toEqual(['Comente', 'hoje']);
    expect(plain[0]!.transform.x).toBeCloseTo(left, 6);
    expect(box.transform.x).toBeCloseTo(left + 8 * glyph, 6);
    expect(plain[1]!.transform.x).toBeCloseTo(box.transform.x + box.size!.w + glyph, 6);
  });

  // An accent stands over the capitals, and at a line height of 1 the line box starts only
  // 0.041 em over them: what keeps the accent is that the text is never cut at that box, and
  // that the box behind it, drawn first, reaches past the whole line. How tall an accent is
  // belongs to the face, and is looked at on a render, not here.
  it.each(['INSCRIÇÕES', 'ÂNGULO'])(
    'keeps the accents of %s: the word grows past its line box, over a box that holds the line',
    async (accented) => {
      const { box, word, order } = await signOff(`Comente **${accented}** hoje`);

      expect(words(word)).toBe(accented);
      expect(word.lineHeight).toBe(1);
      expect(word.overflow).toBe('grow');
      expect(order.indexOf('contracapa-caixa')).toBeLessThan(order.indexOf('contracapa-destaque'));
      expect(box.transform.y).toBeLessThan(word.transform.y);
      expect(box.transform.y + box.size!.h).toBeGreaterThan(word.transform.y + SIGN_OFF.size);
    },
  );
});
