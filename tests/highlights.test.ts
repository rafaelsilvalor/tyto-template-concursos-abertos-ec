import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS } from '../src/template.js';

import { hex, look, named, slidesOf } from './scene.js';

import type { SuppliedValues } from '@tyto/core';

/**
 * The highlights of `concursos-abertos-ec`, read through the kit (the maintainer, 2026-11-27):
 *
 * - a fact's value, in both layouts: `**…**` is Black in `destaque`; a label, a line with no
 *   label and a `{cor:…}` mark change nothing;
 * - the area's title: `**…**` is Black in `destaque`, and `{cor:destaque|destaque-2|destaque-3}`
 *   paints its colour at the title's own weight;
 * - an exam's name and the cover take no highlight;
 * - the sign-off's `**word**` stays its boxed word, white on a box in `ink` whatever `destaque`
 *   is, and a `{cor:…}` mark changes nothing there.
 *
 * A look is `words|weight|#colour`.
 */

const INK = COLOR_DEFAULTS.ink;
const BODY = COLOR_DEFAULTS['body-ink'];
const RED = '#e30613';
const GREEN = '#00a651';

const set = (values: Record<string, string>): SuppliedValues =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }]));

const lone = (fact: string, title = ''): string =>
  `::lamina\n${title === '' ? '' : `  ${title}\n`}  Concurso: Guarda QX\n  ${fact}`;
const rows = (fact: string): string =>
  `::lamina\n  Concurso: Guarda QX\n  ${fact}\n  Concurso: Guarda Sul\n  Banca: Quintex`;

const factsOf = async (body: string, values?: SuppliedValues): Promise<string[]> => {
  const [slide] = await slidesOf(body, values);
  return look(named(slide!, 'fatos')[0]);
};
const titleOf = async (title: string, values?: SuppliedValues): Promise<string[]> => {
  const [slide] = await slidesOf(lone('Vagas: 85', title), values);
  return look(named(slide!, 'area')[0]);
};

describe("a fact's value", () => {
  it.each([
    ['alone on its slide', lone],
    ['in a row of two', rows],
  ])(
    'draws `**…**` Black in `destaque`, the label and the rest as they were, %s',
    async (_, in_) => {
      expect(await factsOf(in_('Vagas: **300** imediatas'))).toEqual([
        `Vagas: |500|${INK}`,
        `300|900|${COLOR_DEFAULTS.destaque}`,
        ` imediatas|300|${BODY}`,
      ]);
    },
  );

  it('takes the colour a configuration gives `destaque`, and no other value', async () => {
    const marked = lone('Vagas: **300** imediatas');

    expect(await factsOf(marked, set({ destaque: RED }))).toEqual([
      `Vagas: |500|${INK}`,
      `300|900|${RED}`,
      ` imediatas|300|${BODY}`,
    ]);
    expect(await factsOf(marked, set({ 'destaque-2': RED, 'destaque-3': RED }))).toEqual(
      await factsOf(marked),
    );
  });

  it('takes `destaque` from the frontmatter of the brief', async () => {
    const [slide] = await slidesOf(lone('Vagas: **300**'), undefined, `destaque: '${RED}'\n`);

    expect(look(named(slide!, 'fatos')[0])).toEqual([`Vagas: |500|${INK}`, `300|900|${RED}`]);
  });

  it('leaves a label, a line with no label and a colour mark as they are', async () => {
    const values = set({ destaque: RED, 'destaque-2': GREEN });

    expect(await factsOf(lone('**Vagas**: 300'), values)).toEqual(
      await factsOf(lone('Vagas: 300')),
    );
    expect(await factsOf(lone('Somente **nível** superior'), values)).toEqual(
      await factsOf(lone('Somente nível superior')),
    );
    expect(await factsOf(lone('Vagas: {cor:destaque-2}300{/} imediatas'), values)).toEqual(
      await factsOf(lone('Vagas: 300 imediatas')),
    );
  });

  it('keeps every fact on its own line, marked or not', async () => {
    expect(
      await factsOf(lone('Vagas: **300**\n  Banca: Quintex\n  Salário: R$ **5.000,00**')),
    ).toEqual([
      `Vagas: |500|${INK}`,
      `300|900|${INK}`,
      '/',
      `Banca: |500|${INK}`,
      `Quintex|300|${BODY}`,
      '/',
      `Salário: |500|${INK}`,
      `R$ |300|${BODY}`,
      `5.000,00|900|${INK}`,
    ]);
  });
});

describe("the area's title", () => {
  it('draws `**…**` Black in `destaque`', async () => {
    expect(await titleOf('Área **Policial**')).toEqual([`Área |500|${INK}`, `Policial|900|${INK}`]);
    expect(await titleOf('Área **Policial**', set({ destaque: RED }))).toEqual([
      `Área |500|${INK}`,
      `Policial|900|${RED}`,
    ]);
  });

  it.each(['destaque', 'destaque-2', 'destaque-3'])(
    'paints a `{cor:%s}` span its colour at the title’s own weight',
    async (name) => {
      const others = Object.fromEntries(
        ['destaque', 'destaque-2', 'destaque-3'].map((each) => [each, GREEN]),
      );

      expect(
        await titleOf(`Área {cor:${name}}Policial{/}`, set({ ...others, [name]: RED })),
      ).toEqual([`Área |500|${INK}`, `Policial|500|${RED}`]);
    },
  );

  it('leaves the words of a colour it does not declare as they are', async () => {
    expect(await titleOf('Área {cor:azul}Policial{/}', set({ destaque: RED }))).toEqual(
      await titleOf('Área Policial'),
    );
  });

  it('draws the same title with no mark as it always did: one run in `ink`', async () => {
    expect(await titleOf('Área Policial', set({ destaque: RED }))).toEqual([
      `Área Policial|500|${INK}`,
    ]);
  });
});

describe('what takes no highlight', () => {
  const values = set({ destaque: RED, 'destaque-2': GREEN });

  it("an exam's name", async () => {
    const [marked] = await slidesOf(
      '::lamina\n  Concurso: **Guarda** {cor:destaque-2}QX{/}\n  Vagas: 85',
      values,
    );
    const [bare] = await slidesOf('::lamina\n  Concurso: Guarda QX\n  Vagas: 85');

    expect(look(named(marked!, 'concurso')[0])).toEqual(look(named(bare!, 'concurso')[0]));
  });

  it('the cover', async () => {
    const [marked] = await slidesOf(
      '::lamina {capa}\n  **Concursos** {cor:destaque-2}abertos{/}\n  **nesta** semana',
      values,
    );
    const [bare] = await slidesOf('::lamina {capa}\n  Concursos abertos\n  nesta semana');

    for (const name of ['capa-titulo', 'capa-faixa-texto']) {
      expect(look(named(marked!, name)[0])).toEqual(look(named(bare!, name)[0]));
    }
  });

  it('the sign-off: its `**word**` stays boxed, white on a box in `ink`, whatever `destaque` is', async () => {
    const paragraph =
      '::lamina {contracapa}\n  Comente **PALAVRA** e {cor:destaque-2}receba{/} o link';
    const [marked] = await slidesOf(paragraph, values);
    const [bare] = await slidesOf('::lamina {contracapa}\n  Comente **PALAVRA** e receba o link');
    const [inked] = await slidesOf(paragraph, set({ ink: GREEN }));

    expect(look(named(marked!, 'contracapa-destaque')[0])).toEqual([
      `PALAVRA|900|${COLOR_DEFAULTS['on-ink']}`,
    ]);
    expect(hex(named(marked!, 'contracapa-caixa')[0]!.fill?.color)).toBe(INK);
    expect(named(marked!, 'contracapa-texto').map(look)).toEqual(
      named(bare!, 'contracapa-texto').map(look),
    );
    // The box is the brand's, like the cover's band: it follows `ink`, never `destaque`.
    expect(hex(named(inked!, 'contracapa-caixa')[0]!.fill?.color)).toBe(GREEN);
  });
});
