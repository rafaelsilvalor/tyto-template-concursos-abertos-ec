import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS } from '../src/template.js';

import { compileExample, manifest } from './compile.js';

import type { SuppliedValues } from '@tyto/core';

/**
 * What a configuration may change in `concursos-abertos-ec` (Tyto ADR 0153): each declared
 * default pinned to the constant the code falls back to, so a template nobody configures draws
 * the same bytes, and a value set here found in the HTML.
 */

const FALLBACKS: Record<string, unknown> = { ...COLOR_DEFAULTS };

const html = async (values?: SuppliedValues): Promise<string> =>
  (await compileExample('semana.brief', values)).frames.map((slide) => slide.html).join('\n');

describe('declared values', () => {
  const declared = manifest.values ?? {};

  it('declares each default equal to the one the code falls back to, and no other', () => {
    const defaults = Object.fromEntries(
      Object.entries(declared).map(([name, value]) => [name, value.default]),
    );
    expect(defaults).toEqual(FALLBACKS);
  });

  it('draws the same HTML with every default supplied as with no values at all', async () => {
    const supplied = Object.fromEntries(
      Object.entries(FALLBACKS).map(([name, value]) => [name, { value }]),
    ) as SuppliedValues;
    expect(await html(supplied)).toBe(await html());
  });

  it('paints the brand colour a configured colour, found in the HTML', async () => {
    const painted = await html({ ink: { value: '#123456' } });

    expect(painted).toContain('#123456');
    expect(await html()).not.toContain('#123456');
  });
});
