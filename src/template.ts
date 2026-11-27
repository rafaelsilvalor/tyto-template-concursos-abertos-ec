/**
 * `concursos-abertos-ec` — the week's open exams as a carousel of 1080×1350 slides.
 *
 * Three kinds of slide, one `::lamina` each:
 *
 * - the cover, `::lamina {capa}`: a title in Black, centred, its last line white on a band;
 * - an area slide, any unmarked `::lamina`: an optional area title, then one or two exams. With
 *   two, each exam is a row — its crest and name on the left, its facts on the right — and a
 *   rule between the rows. With one, crest, name and facts are stacked, larger, in the middle;
 * - the sign-off, `::lamina {contracapa}`: one paragraph whose `**word**` is set white on a box.
 *
 * An exam starts at a `Concurso: name` line; every `Label: value` line under it is one of its
 * facts. Its crest is an `::brasao ./file.png` written before that line, and it is optional: an
 * exam without one draws its name where the crest would sit (the maintainer, 2026-11-05).
 *
 * Every position is the reference art's (the maintainer's PSD), in the slide's pixels: a text
 * is placed by the top of its capitals. The logo and the signature are the brand kit's (Tyto
 * ADR 0063), placeholders without one; every colour is a declared value (Tyto ADR 0153) whose
 * default is the reference's.
 */

import { colorValue, frame, lineBreak, runsOf, solid } from '@tyto/core/template';
import { drawLogo, sealOf, signatureOf } from '@tyto/house-style';
import {
  anchorOf,
  arrowShape,
  at,
  atLeastOne,
  barePicture,
  block,
  capText,
  carouselFooter,
  labelOf,
  labelValueRuns,
  lines,
  plain,
  plainRuns,
  reportOverflow,
  richTextOfPlain,
  rule,
  sealed,
  shape,
  signatureLine,
  slideRichLines,
  stackIn,
  table,
} from '@tyto/template-kit';

import type {
  AssetRef,
  ResolvedSlot,
  RichText,
  TemplateBuild,
  TemplateContext,
  TextRun,
} from '@tyto/core';
import type { NodeDraft, NonEmpty } from '@tyto/core/template';
import type { Area, Block, TableRow, TableStyle } from '@tyto/template-kit';

/* ------------------------------------------------------------------------- the tokens -- */

/** The colours a configuration may change, by declared value name, each the reference's. */
export const COLOR_DEFAULTS = {
  paper: '#ffffff',
  /** Titles, labels, exam names, the rule, the cover's band, the sign-off's box, the logo. */
  ink: '#460292',
  /** A fact's value, the word "Concurso" and the sign-off's paragraph. */
  'body-ink': '#646464',
  /** The cover's last line and the sign-off's boxed word. */
  'on-ink': '#ffffff',
  /** The arrow to the next slide. */
  'arrow-ink': '#7228b1',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;
type Ink = (name: ColorName) => string;

const FACE = { family: 'CircularXX', source: 'system' } as const;
const LIGHT = 300;
const MEDIUM = 500;
const BLACK = 900;

/**
 * CircularXX's capital height, in em. Its vertical metrics are the kit's `DEFAULT_METRICS`
 * (ascent 0.75, descent 0.25, this cap height), from its `OS/2` table and the same in every
 * weight: the kit places a text's capitals by them (measured on concursos-abertos against its
 * reference art).
 */
const CAP_HEIGHT = 0.709;

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const CENTRE_X = SLIDE_WIDTH / 2;
/** A glyph's advance, in em, for when nothing can be measured (a test, CI without the face). */
const ESTIMATED_ADVANCE = 0.55;

/** The words the cover draws when the brief's `::lamina {capa}` is empty. */
export const DEFAULT_COVER = ['Principais concursos abertos com inscrições', 'nesta semana'];
/** The paragraph the sign-off draws when its `::lamina {contracapa}` is empty. */
export const DEFAULT_SIGN_OFF = 'Comente **VAGAS** e receba o link com todas as vagas abertas.';

/** The cover: Black 96 px, 115.2 px from line to line, the block centred on the reference's middle. */
export const COVER = {
  size: 96,
  lineHeight: 115.2 / 96,
  width: 900,
  /** The middle of the block, from the first capitals to the band's foot. */
  centre: 669.5,
  /** The band reaches this far over the capitals of its line and under its baseline. */
  bandOver: 13,
  bandUnder: 18,
  /** The band is the block's widest line, this much narrower on each side. */
  bandInset: 10,
} as const;

/**
 * An area slide's title: Medium 51 px, centred, its first capitals where the reference sets a
 * one-line title (258, its baseline 294.2). A longer title grows downwards, never up towards the
 * logo, and the exams' room starts under its last line (the maintainer, 2026-11-05).
 */
export const AREA_TITLE = { size: 51.06, lineHeight: 1.25, width: 640, capTop: 258 } as const;

/** An exam row, two to a slide: crest and name in a column on the left, facts on the right. */
export const ROW = {
  /**
   * From one row's middle to the next's, the reference's 592 and 998: the rule sits halfway,
   * on the content's middle, and each row half this pitch above or below it.
   */
  pitch: 406,
  rule: { x: 159, w: 764, h: 1 },
  /** The closest the upper row's words come to the rule. */
  ruleClearance: 16,
  /**
   * The crest's box, and the height the crest is drawn at inside it, centred: the reference's
   * crests sit 156 to 159 px tall in a 167 px box.
   */
  crest: { x: 135, w: 203, h: 167, drawn: 158 },
  /** The name's column, centred under the crest. */
  name: { centre: 236.5, width: 230, size: 32, lineHeight: 38 / 32, gap: 31.5 },
  facts: { x: 419, width: 576, size: 32, lineHeight: 55.68 / 32 },
} as const;

/** One exam alone on its slide: everything stacked and centred, larger. */
export const SINGLE = {
  /** The reference's crest is 185 px tall in a 207 px box. */
  crest: { w: 251, h: 207, drawn: 185 },
  name: { width: 260, size: 39.9, lineHeight: 48 / 39.9, gap: 40 },
  /** From the name's last baseline to the facts' first capitals. */
  factsGap: 87,
  facts: { width: 600, size: 35.59, lineHeight: 61.92 / 35.59 },
} as const;

/** The sign-off's paragraph: Light 57.2 px, centred, its boxed word on the brand's colour. */
export const SIGN_OFF = {
  size: 57.2,
  lineHeight: 85.79 / 57.2,
  /**
   * The reference's text box is 802 px; its lines measure up to 801 px in Photoshop and a few
   * more in Tyto, so the paragraph wraps at 840 to break where the reference breaks.
   */
  width: 840,
  centre: 676,
  box: { padX: 17, over: 16, under: 15 },
} as const;

/**
 * The signature: 24 px, letter spacing 0.4 em, centred, its capitals 1271 px down. The
 * reference sets it in CircularXX Thin, a weight Tyto does not resolve (`W_FONT_UNAVAILABLE`,
 * measured 2026-11-05), so it is Light, as the house's other templates set theirs.
 */
const SIGNATURE = { size: 24, capTop: 1271, letterSpacing: 9.6 } as const;
/** The logo, as the reference places the owl: 63 px tall, 85 px from the left. */
const LOGO = { x: 85, y: 67, height: 63 } as const;
/** The arrow: an 8 px shaft and a narrow 15 px head, in the reference's box. */
const ARROW = { x: 798, y: 1269, w: 186, h: 26, shaft: 8, head: 15 } as const;
/** The lowest an exam's content may reach: over the signature. */
const CONTENT_BOTTOM = 1240;

/**
 * Where an area slide's exams sit (the maintainer, 2026-11-05: "without an area the block is
 * centred; gaps and alignments stay consistent when the content changes"). One rule for every
 * area slide: the exams' block — the two rows with the rule between them, or the one exam's
 * stack — is centred on the room left to it.
 *
 * - With a title, the room runs from `titleGap` under the title's last baseline to
 *   `CONTENT_BOTTOM`. Under a one-line title that centre is 794, where the reference draws its
 *   rule; a longer title moves the room's top, and the block, down with it.
 * - Without one, the block is centred on the slide's own middle between the logo's top (67) and
 *   the signature's capitals (1271), 669; the reference centres its lone exam at 669.6.
 *
 * A block taller than its room starts at the room's top, never over the title, and what passes
 * the bottom is reported.
 */
export const CONTENT = {
  titleGap: 54,
  /** The room's top when the slide has no title: the logo's foot and the same gap. */
  topWithoutTitle: 130 + 54,
  /** Measured on the reference's lone exam; the logo-to-signature middle is 669. */
  centreWithoutTitle: 669.6,
} as const;

/**
 * The middle the exams' block is centred on, and the highest its top may be, given the title's
 * last baseline when the slide has a title.
 */
function contentRoom(
  titleBaseline: number | undefined,
  lift: number,
): { centre: number; top: number } {
  if (titleBaseline === undefined)
    return { centre: CONTENT.centreWithoutTitle - lift / 2, top: CONTENT.topWithoutTitle };
  const top = titleBaseline + CONTENT.titleGap;
  return { centre: (top + CONTENT_BOTTOM - lift) / 2, top };
}

/* --------------------------------------------------------------------------- the build -- */

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink: Ink = (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
  // The house's seal, the brief's `selo`, glued to the last slide's foot (TYTO-201): the footer
  // stands on the page the seal leaves, so the signature rises by its band.
  const page = sealed(context.size, sealOf(context));
  const lift = context.size.h - page.size.h;
  const last = context.artwork.index === context.artwork.count - 1;
  const body = context.adjustments['capa']
    ? cover(context, ink)
    : context.adjustments['contracapa']
      ? signOff(context, ink)
      : areaSlide(context, ink, lift);
  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(ink('paper')),
    children: [
      ...body,
      at(
        LOGO.x,
        LOGO.y,
        drawLogo(context.brand, LOGO.height, { primary: ink('ink'), secondary: ink('ink') }),
      ),
      footer(context, { width: page.size.w, height: page.size.h }, ink, last),
      ...page.seal,
    ],
  });
};

/**
 * The footer over `page`, the slide less the seal's band: the brand's signature and, on every
 * slide but the last, the arrow to the next one. The kit stands both on the page's foot.
 */
function footer(context: TemplateContext, page: Area, ink: Ink, last: boolean): NodeDraft {
  const line = signatureLine(
    signatureOf(context.brand),
    { width: SLIDE_WIDTH, height: Infinity },
    { font: FACE, weight: LIGHT, color: ink('ink') },
    { size: SIGNATURE.size, letterSpacing: SIGNATURE.letterSpacing },
    { name: 'assinatura', text: { overflow: 'grow' } },
  );
  const arrow = arrowShape(
    { w: ARROW.w, h: ARROW.h },
    solid(ink('arrow-ink')),
    { shaft: ARROW.shaft, headRatio: ARROW.head / ARROW.h },
    { name: 'seta' },
  );
  return at(
    0,
    0,
    carouselFooter(
      page,
      { signature: line, ...(last ? {} : { trailing: arrow }) },
      {
        signatureFromFoot: SLIDE_HEIGHT - SIGNATURE.capTop,
        trailingFromFoot: SLIDE_HEIGHT - (ARROW.y + ARROW.h),
        trailingInset: SLIDE_WIDTH - (ARROW.x + ARROW.w),
      },
      { name: 'rodape' },
    ),
  );
}

/* -------------------------------------------------------------------------- the cover -- */

/**
 * The cover: every line but the last is the title, wrapped in Black and centred; the last is
 * set white on a band as wide as the block's widest line.
 */
function cover(context: TemplateContext, ink: Ink): NodeDraft[] {
  const written = slideRichLines(context).map((line) => plain(line).trim());
  const [titleLines, bandLine] = splitCover(written.length === 0 ? DEFAULT_COVER : written);
  const set = {
    size: COVER.size,
    lineHeight: COVER.lineHeight,
    width: COVER.width,
    align: 'center',
  } as const;
  const style = { font: FACE, size: COVER.size, weight: BLACK };
  const left = CENTRE_X - COVER.width / 2;
  const title = capitals(
    'capa-titulo',
    plainRuns(titleLines.join('\n'), { ...style, color: ink('ink') }),
    set,
  );
  const measuredTitle = laidOut(context, title, titleLines, COVER.size, COVER.width);
  const titleCount = titleLines.length === 0 ? 0 : measuredTitle.lines;
  const pitch = COVER.size * COVER.lineHeight;
  const capHeight = COVER.size * CAP_HEIGHT;
  const bandHeight = bandLine === undefined ? 0 : COVER.bandOver + capHeight + COVER.bandUnder;
  // The block runs from the first capitals to the band's foot (or the last baseline).
  const blockHeight =
    titleCount * pitch + (bandLine === undefined ? capHeight - pitch : capHeight + COVER.bandUnder);
  const top = COVER.centre - blockHeight / 2;
  const nodes: NodeDraft[] = [];
  if (titleCount > 0) nodes.push(capitalsAt(left, top, title));
  if (bandLine !== undefined) {
    const capTop = top + titleCount * pitch;
    const band = capitals(
      'capa-faixa-texto',
      plainRuns(bandLine, { ...style, color: ink('on-ink') }),
      set,
    );
    const bandWidth = laidOut(context, band, [bandLine], COVER.size, COVER.width).width;
    const width = Math.max(measuredTitle.width, bandWidth) - 2 * COVER.bandInset;
    nodes.push(
      at(
        CENTRE_X - width / 2,
        capTop - COVER.bandOver,
        shape({ w: width, h: bandHeight }, solid(ink('ink')), {}, { name: 'capa-faixa' }),
      ),
      capitalsAt(left, capTop, band),
    );
  }
  return nodes;
}

/** The cover's written lines as the title's and the band's: the last line is the band's. */
function splitCover(written: readonly string[]): [string[], string | undefined] {
  if (written.length < 2) return [[...written], undefined];
  return [written.slice(0, -1), written[written.length - 1]];
}

/* ----------------------------------------------------------------------- the sign-off -- */

/** One word of the sign-off, and whether it is the boxed one. */
interface Word {
  readonly words: string;
  readonly boxed: boolean;
}

/**
 * The sign-off's paragraph, broken into lines here rather than by the exporter: the boxed
 * word's box is drawn behind it, so this template must know where that word lands.
 *
 * Pending the boxed run (Tyto ADR 0231): a run that carries its own box lets core break these
 * lines, and this loop, `wordsOf` and the advances go with it. That swap moves pixels, so it is
 * its own decision and not part of the recomposition (TYTO-893).
 */
function signOff(context: TemplateContext, ink: Ink): NodeDraft[] {
  const written = slideRichLines(context);
  const words = wordsOf(written.length === 0 ? [richTextOfPlain(DEFAULT_SIGN_OFF)] : written);
  const piece = (name: string, text: string, weight: number, color: string): Block =>
    capitals(name, plainRuns(text, { font: FACE, size: SIGN_OFF.size, weight, color }), {
      size: SIGN_OFF.size,
    });
  // A word's advance at a weight: measured when the context can, estimated otherwise.
  const advance = (text: string, weight: number): number => {
    const measure = (sample: string): number | undefined =>
      measured(context, piece('medida', sample, weight, '#000000'))?.width;
    const width = measure(text === ' ' ? 'a a' : text);
    if (width === undefined) return [...text].length * SIGN_OFF.size * ESTIMATED_ADVANCE;
    if (text !== ' ') return width;
    // A space's advance: "a a" less two "a".
    const single = measure('aa');
    return single === undefined ? SIGN_OFF.size * 0.25 : width - single;
  };
  const space = advance(' ', LIGHT);
  const widthOf = (word: Word): number =>
    word.boxed ? advance(word.words, BLACK) + 2 * SIGN_OFF.box.padX : advance(word.words, LIGHT);
  // Greedy lines within the paragraph's width, the boxed word one unit.
  const rows: Word[][] = [];
  let row: Word[] = [];
  let rowWidth = 0;
  for (const word of words) {
    const width = widthOf(word);
    const added = row.length === 0 ? width : rowWidth + space + width;
    if (row.length > 0 && added > SIGN_OFF.width) {
      rows.push(row);
      row = [word];
      rowWidth = width;
    } else {
      row.push(word);
      rowWidth = added;
    }
  }
  if (row.length > 0) rows.push(row);
  const pitch = SIGN_OFF.size * SIGN_OFF.lineHeight;
  const capHeight = SIGN_OFF.size * CAP_HEIGHT;
  const blockHeight = (rows.length - 1) * pitch + capHeight;
  const top = SIGN_OFF.centre - blockHeight / 2;
  const nodes: NodeDraft[] = [];
  for (const [index, line] of rows.entries()) {
    const capTop = top + index * pitch;
    const widths = line.map(widthOf);
    const total = widths.reduce((sum, width) => sum + width, 0) + space * (line.length - 1);
    let x = CENTRE_X - total / 2;
    // A run of plain words is one text; a boxed word is a box and its own text.
    let pending: string[] = [];
    let pendingX = x;
    const flush = (): void => {
      if (pending.length === 0) return;
      nodes.push(
        capitalsAt(
          pendingX,
          capTop,
          piece('contracapa-texto', pending.join(' '), LIGHT, ink('body-ink')),
        ),
      );
      pending = [];
    };
    for (const [position, word] of line.entries()) {
      const width = widths[position] ?? 0;
      if (word.boxed) {
        flush();
        nodes.push(
          at(
            x,
            capTop - SIGN_OFF.box.over,
            shape(
              { w: width, h: SIGN_OFF.box.over + capHeight + SIGN_OFF.box.under },
              solid(ink('ink')),
              {},
              { name: 'contracapa-caixa' },
            ),
          ),
          capitalsAt(
            x + SIGN_OFF.box.padX,
            capTop,
            piece('contracapa-destaque', word.words, BLACK, ink('on-ink')),
          ),
        );
      } else {
        if (pending.length === 0) pendingX = x;
        pending.push(word.words);
      }
      x += width + space;
    }
    flush();
  }
  return nodes;
}

/** The sign-off's words as written: a `**…**` span is one boxed unit. */
function wordsOf(written: readonly RichText[]): Word[] {
  const words: Word[] = [];
  for (const line of written) {
    const runs = runsOf(
      line,
      { font: FACE, size: 1, weight: LIGHT, color: '#000000' },
      {
        bold: BLACK,
      },
    );
    for (const item of runs) {
      if (item.kind !== 'text') continue;
      const boxed = item.weight === BLACK;
      if (boxed) {
        const value = item.text.trim();
        if (value !== '') words.push({ words: value, boxed: true });
      } else {
        for (const part of item.text.split(/\s+/)) {
          if (part !== '') words.push({ words: part, boxed: false });
        }
      }
    }
  }
  return words;
}

/* ---------------------------------------------------------------------- the area slide -- */

/** One exam as written: its name, its crest when the brief gave one, and its facts. */
export interface Exam {
  readonly name: string;
  readonly crest: AssetRef | undefined;
  readonly facts: readonly RichText[];
}

/** An area slide as written: its title, when it has one, and its exams in order. */
export interface AreaSlide {
  readonly title: string | undefined;
  readonly exams: readonly Exam[];
}

/** The label that starts an exam: `Concurso: name`. */
const EXAM_LABEL = 'concurso';

/**
 * The slide's body read as an area title and exams (Tyto ADR 0160 gives the order): a first
 * line with no label is the title; `Concurso: name` starts an exam; every other line is a fact
 * of the exam above it; an `::brasao` is the crest of the next exam, or of the last one when no
 * exam follows it and that one has none.
 */
export function readAreaSlide(context: TemplateContext): AreaSlide {
  const slide = context.slots['lamina'];
  let title: string | undefined;
  const exams: { name: string; crest: AssetRef | undefined; facts: RichText[] }[] = [];
  let pendingCrest: AssetRef | undefined;
  const addLines = (written: RichText): void => {
    for (const line of lines(written)) {
      const words = plain(line).trim();
      if (words === '') continue;
      const { label, text: rest } = labelOf(line);
      const labelWords = label === undefined ? undefined : plain(label).replace(/:\s*$/, '').trim();
      if (labelWords !== undefined && labelWords.toLowerCase() === EXAM_LABEL) {
        exams.push({ name: plain(rest).trim(), crest: pendingCrest, facts: [] });
        pendingCrest = undefined;
      } else if (label === undefined && exams.length === 0 && title === undefined) {
        title = words;
      } else {
        const current = exams[exams.length - 1];
        if (current === undefined) {
          exams.push({ name: '', crest: pendingCrest, facts: [line] });
          pendingCrest = undefined;
        } else {
          current.facts.push(line);
        }
      }
    }
  };
  const addCrest = (crestSlot: ResolvedSlot | undefined): void => {
    if (crestSlot?.value.kind === 'image') pendingCrest = crestSlot.value.asset;
  };
  if (slide?.blocks === undefined) {
    if (slide?.value.kind === 'rich-text') addLines(slide.value.text);
    addCrest(context.slots['brasao']);
  } else {
    for (const block of slide.blocks) {
      if (block.kind === 'text') addLines(block.text);
      else if (block.slot.name === 'brasao') addCrest(block.slot);
    }
  }
  if (pendingCrest !== undefined) {
    const lastExam = exams[exams.length - 1];
    if (lastExam !== undefined && lastExam.crest === undefined) lastExam.crest = pendingCrest;
  }
  return { title, exams };
}

/** An area slide: its title, then one exam stacked or two in rows. */
function areaSlide(context: TemplateContext, ink: Ink, lift: number): NodeDraft[] {
  const slide = readAreaSlide(context);
  const nodes: NodeDraft[] = [];
  const title = slide.title === undefined ? undefined : areaTitle(context, slide.title, ink);
  if (title !== undefined) nodes.push(title.node);
  const room = contentRoom(title?.baseline, lift);
  const [first, second, ...rest] = slide.exams;
  if (first === undefined) return nodes;
  if (second === undefined) {
    nodes.push(...singleExam(context, first, room, ink, lift));
    return nodes;
  }
  // The rule on the room's middle, unless that would lift the upper row over the room's top.
  const middle = Math.round(Math.max(room.centre, room.top + ROW.pitch / 2));
  nodes.push(examRows(context, [first, second], middle, CONTENT_BOTTOM - lift, ink));
  // A slide holds two exams: a third and later are not drawn, and the author is told.
  if (rest.length > 0) {
    context.report({
      code: 'W_TEMPLATE_OVERFLOW',
      overflow: rest.length * ROW.pitch,
    });
  }
  return nodes;
}

/** The area's title, centred, wrapped, growing down from the reference's capitals; and its last baseline. */
function areaTitle(
  context: TemplateContext,
  words: string,
  ink: Ink,
): { node: NodeDraft; baseline: number } {
  const set = capitals(
    'area',
    plainRuns(words, { font: FACE, size: AREA_TITLE.size, weight: MEDIUM, color: ink('ink') }),
    {
      size: AREA_TITLE.size,
      lineHeight: AREA_TITLE.lineHeight,
      width: AREA_TITLE.width,
      align: 'center',
    },
  );
  const count = laidOut(context, set, [words], AREA_TITLE.size, AREA_TITLE.width).lines;
  const pitch = AREA_TITLE.size * AREA_TITLE.lineHeight;
  const baseline = AREA_TITLE.capTop + AREA_TITLE.size * CAP_HEIGHT + (count - 1) * pitch;
  return {
    node: capitalsAt(CENTRE_X - AREA_TITLE.width / 2, AREA_TITLE.capTop, set),
    baseline,
  };
}

/** An exam's name: "Concurso" in Light, then its name in Medium, centred in a column. */
function nameText(
  name: string,
  set: { readonly size: number; readonly lineHeight: number; readonly width: number },
  ink: Ink,
): Block {
  const base = { font: FACE, size: set.size, weight: LIGHT, color: ink('body-ink') };
  const [first, ...others] = plainRuns('Concurso', base);
  const named =
    name === ''
      ? []
      : [lineBreak(), ...plainRuns(name, { ...base, weight: MEDIUM, color: ink('ink') })];
  return capitals('concurso', [first, ...others, ...named], { ...set, align: 'center' });
}

/** An exam's facts, one per line: the label Medium in the brand's colour, the value Light. */
function factRuns(facts: readonly RichText[], size: number, ink: Ink): TextRun[] {
  const body = { font: FACE, size, weight: LIGHT, color: ink('body-ink') };
  return labelValueRuns(facts.map(plain), {
    label: { ...body, weight: MEDIUM, color: ink('ink') },
    value: body,
  });
}

/** The name column's left edge: the table's, the crest centred above the name inside it. */
const NAME_LEFT = ROW.name.centre - ROW.name.width / 2;

/**
 * Two exams in rows by the kit's `table` (TYTO-883): the crest and name column and the facts,
 * each centred on its row's middle, and between the rows a band of no height holding the rule.
 *
 * Each row's middle is fixed, half the pitch either side of the rule, whatever the rows hold;
 * the table stacks rows, so its gap is what puts both middles there. A cell is placed by the top
 * of its capitals: it declares the height from its first capitals to its last baseline and
 * draws its words a cap offset above its top, so the table's middle is the capitals' middle.
 * Nothing shrinks: a row taller than its room runs into the rule or the signature, and the
 * author is told by how much, the upper row against the rule and the lower one against `bottom`.
 */
function examRows(
  context: TemplateContext,
  exams: readonly [Exam, Exam],
  middle: number,
  bottom: number,
  ink: Ink,
): NodeDraft {
  const [upper, lower] = exams.map((exam) => examCells(context, exam, ink)) as [
    ExamCells,
    ExamCells,
  ];
  const gap = (ROW.pitch - (upper.height + lower.height) / 2) / 2;
  const top = middle - ROW.pitch / 2 - upper.height / 2;
  const ruleBand = top + upper.height + gap;
  const layout: TableStyle = {
    columns: [
      { name: 'exam-name', width: ROW.name.width, valign: 'middle' },
      { name: 'exam-facts', width: ROW.facts.width, valign: 'middle' },
    ],
    kinds: { exam: { name: 'exam' }, rule: { name: 'rule' } },
    columnGap: ROW.facts.x - (NAME_LEFT + ROW.name.width),
    rowGap: gap,
    minRowHeight: 0,
    names: { table: 'exams', row: 'exam' },
  };
  const divider = rule(
    ROW.rule.w,
    solid(ink('ink')),
    { thickness: ROW.rule.h },
    { name: 'divisoria' },
  );
  const rows: TableRow[] = [
    upper.row,
    {
      kind: 'rule',
      span: true,
      cells: [
        {
          draw: (width) => block(width, 0, at(ROW.rule.x - NAME_LEFT, middle - ruleBand, divider)),
        },
      ],
    },
    lower.row,
  ];
  const drawn = table(layout, rows, ROW.facts.x + ROW.facts.width - NAME_LEFT);
  reportOverflow(context.report, top + upper.height, middle - ROW.ruleClearance);
  reportOverflow(context.report, top + drawn.height, bottom);
  return at(NAME_LEFT, top, drawn);
}

interface ExamCells {
  readonly row: TableRow;
  /** The taller of the two cells, from its first capitals to its last baseline. */
  readonly height: number;
}

/** One exam's row: the crest and name column, and the facts. */
function examCells(context: TemplateContext, exam: Exam, ink: Ink): ExamCells {
  const name = ROW.name;
  const nameSet = nameText(
    exam.name,
    { size: name.size, lineHeight: name.lineHeight, width: name.width },
    ink,
  );
  const nameLines = laidOut(context, nameSet, ['Concurso', exam.name], name.size, name.width).lines;
  const nameHeight = (nameLines - 1) * name.size * name.lineHeight + name.size * CAP_HEIGHT;
  const crestHeight = exam.crest === undefined ? 0 : ROW.crest.h + name.gap;
  const columnHeight = crestHeight + nameHeight;

  const facts = ROW.facts;
  const runs = atLeastOne(factRuns(exam.facts, facts.size, ink));
  const factsSet =
    runs === undefined
      ? undefined
      : capitals('fatos', runs, {
          size: facts.size,
          lineHeight: facts.lineHeight,
          width: facts.width,
        });
  // An exam with no facts draws none, and one line's height still counts, as it always did.
  const factLines =
    factsSet === undefined
      ? 1
      : laidOut(context, factsSet, exam.facts.map(plain), facts.size, facts.width).lines;
  const factsHeight = (factLines - 1) * facts.size * facts.lineHeight + facts.size * CAP_HEIGHT;

  // The crest's box over the name, the name `gap` under it; with no crest, the name alone.
  const column = stackIn({ width: name.width, height: Infinity }, [
    ...(exam.crest === undefined
      ? []
      : [
          block(
            name.width,
            ROW.crest.h,
            at(ROW.crest.x - NAME_LEFT, 0, crest(exam.crest, ROW.crest)),
          ),
        ]),
    { item: fromCapitals(nameSet, name.width, nameHeight), gapAbove: name.gap },
  ]);
  return {
    row: {
      kind: 'exam',
      cells: [
        { draw: (width) => block(width, columnHeight, column.draft) },
        {
          draw: (width) =>
            factsSet === undefined
              ? block(width, factsHeight, stackIn({ width, height: Infinity }, []).draft)
              : fromCapitals(factsSet, width, factsHeight),
        },
      ],
    },
    height: Math.max(columnHeight, factsHeight),
  };
}

/** One exam alone: crest, name and facts stacked and centred on the room the slide leaves. */
function singleExam(
  context: TemplateContext,
  exam: Exam,
  room: { readonly centre: number; readonly top: number },
  ink: Ink,
  lift: number,
): NodeDraft[] {
  const name = SINGLE.name;
  const nameSet = nameText(
    exam.name,
    { size: name.size, lineHeight: name.lineHeight, width: name.width },
    ink,
  );
  const nameLines = laidOut(context, nameSet, ['Concurso', exam.name], name.size, name.width).lines;
  const nameHeight = (nameLines - 1) * name.size * name.lineHeight + name.size * CAP_HEIGHT;

  const facts = SINGLE.facts;
  const runs = atLeastOne(factRuns(exam.facts, facts.size, ink));
  const factsSet =
    runs === undefined
      ? undefined
      : capitals('fatos', runs, {
          size: facts.size,
          lineHeight: facts.lineHeight,
          width: facts.width,
        });
  const laid =
    factsSet === undefined
      ? undefined
      : laidOut(context, factsSet, exam.facts.map(plain), facts.size, facts.width);
  const factsHeight =
    laid === undefined
      ? 0
      : (laid.lines - 1) * facts.size * facts.lineHeight + facts.size * CAP_HEIGHT;

  const crestHeight = exam.crest === undefined ? 0 : SINGLE.crest.h + name.gap;
  const factsGap = factsSet === undefined ? 0 : SINGLE.factsGap;
  const total = crestHeight + nameHeight + factsGap + factsHeight;
  const top = Math.max(room.top, room.centre - total / 2);

  const nodes: NodeDraft[] = [];
  if (exam.crest !== undefined) {
    nodes.push(at(CENTRE_X - SINGLE.crest.w / 2, top, crest(exam.crest, SINGLE.crest)));
  }
  const nameTop = top + crestHeight;
  nodes.push(capitalsAt(CENTRE_X - name.width / 2, nameTop, nameSet));
  if (factsSet !== undefined && laid !== undefined) {
    // The facts are a left-aligned block, the block centred on the slide by its widest line as
    // measured: the kit's `huggedText` rounds that width up, which would move the block.
    const width = Math.min(facts.width, laid.width);
    const factsTop = nameTop + nameHeight + factsGap;
    nodes.push(capitalsAt(CENTRE_X - width / 2, factsTop, factsSet));
    reportOverflow(context.report, factsTop + factsHeight, CONTENT_BOTTOM - lift);
  }
  return nodes;
}

/**
 * A crest in its box: contained at the height the reference draws crests, whatever its own
 * proportions, and centred in the box. The kit's picture is held to that one shape.
 */
function crest(
  asset: AssetRef,
  box: { readonly w: number; readonly h: number; readonly drawn: number },
): Block {
  const held = box.w / box.drawn;
  const picture = barePicture(
    asset,
    { width: box.w, height: box.drawn },
    { fit: 'contain', widest: held, tallest: held },
    { name: 'brasao' },
  );
  return block(box.w, box.h, at(0, (box.h - box.drawn) / 2, picture));
}

/* -------------------------------------------------------------------------- the shared -- */

/** How a text is set: its size, and what the kit's capital-placed text takes besides. */
interface Setting {
  readonly size: number;
  readonly lineHeight?: number;
  readonly width?: number;
  readonly align?: 'left' | 'center';
  readonly letterSpacing?: number;
}

/** Runs as the kit's block, its anchor at the top of its capitals. */
function capitals(name: string, runs: NonEmpty<TextRun>, set: Setting): Block {
  return capText(
    runs,
    { width: set.width ?? Infinity, height: Infinity },
    {
      size: set.size,
      lineHeight: set.lineHeight ?? 1,
      letterSpacing: set.letterSpacing ?? 0,
      align: set.align ?? 'left',
    },
    // Never cut at the box: at a line height of 1 an accented capital on the first line
    // (the Á of MONGAGUÁ) rises above the line's box, and a clipped box drops the accent.
    { name, text: { overflow: 'grow' } },
  );
}

/** A text placed with its first capitals at `capTop`, in the slide's pixels. */
function capitalsAt(x: number, capTop: number, set: Block): NodeDraft {
  return at(x, capTop - anchorOf(set).capTop, set);
}

/** A text as a block that starts at its first capitals: its line box hangs a cap offset above. */
function fromCapitals(set: Block, width: number, height: number): Block {
  return block(width, height, capitalsAt(0, 0, set));
}

/** What the context measures of a text: its lines and its widest line, unrounded. */
function measured(
  context: TemplateContext,
  set: Block,
): { lines: number; width: number } | undefined {
  return set.draft.kind === 'text' ? context.measure(set.draft) : undefined;
}

/**
 * How many lines a text wraps to and its widest line: measured when the context can, estimated
 * otherwise.
 */
function laidOut(
  context: TemplateContext,
  set: Block,
  written: readonly string[],
  size: number,
  width: number,
): { lines: number; width: number } {
  const found = measured(context, set);
  if (found !== undefined) return { lines: Math.max(1, found.lines), width: found.width };
  return estimated(written, size, width);
}

/**
 * The lines and the widest line of a text nothing can measure (a test, CI without the face):
 * from the characters a line of `width` holds, each written line counted apart. It goes when
 * the kit estimates by width itself (TYTO-905).
 */
function estimated(
  written: readonly string[],
  size: number,
  width: number,
): { lines: number; width: number } {
  const perLine = Math.max(1, Math.floor(width / (size * ESTIMATED_ADVANCE)));
  let count = 0;
  let widest = 0;
  for (const line of written) {
    const characters = [...line].length;
    count += Math.max(1, Math.ceil(characters / perLine));
    widest = Math.max(widest, Math.min(width, characters * size * ESTIMATED_ADVANCE));
  }
  return { lines: Math.max(1, count), width: widest };
}
