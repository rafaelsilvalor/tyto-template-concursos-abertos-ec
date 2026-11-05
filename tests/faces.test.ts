import { describe, expect, it } from 'vitest';

import { compileExample, manifest } from './compile.js';

/**
 * The faces the manifest declares are the ones the composition draws (Tyto ADR 0048).
 *
 * In a plugin's process `context.measure` answers only from the faces the manifest lists, and
 * a face left out measures as nothing. So every (family, weight) the examples draw must be
 * declared, and a declared face nothing draws is a stale line.
 */

/** Every `family weight` a scene's text runs draw, found wherever a run carries a font. */
function facesIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) facesIn(item, found);
  } else if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    const font = record['font'] as { family?: unknown } | undefined;
    if (typeof font?.family === 'string' && typeof record['weight'] === 'number') {
      found.add(`${font.family} ${String(record['weight'])}`);
    }
    for (const value of Object.values(record)) facesIn(value, found);
  }
  return found;
}

describe('the declared faces', () => {
  it('are exactly the faces the examples draw', async () => {
    const drawn = new Set<string>();
    for (const file of ['semana.brief', 'sem-brasao.brief']) {
      facesIn((await compileExample(file)).scene, drawn);
    }
    const declared = (manifest.faces ?? []).map((face) => `${face.family} ${String(face.weight)}`);

    expect(drawn.size).toBeGreaterThan(0);
    expect([...drawn].sort()).toEqual([...declared].sort());
  });
});
