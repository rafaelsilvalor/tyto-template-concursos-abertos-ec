import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';

import { build } from '../src/template.js';

import type { AssetRef, AssetResolver, SuppliedValues } from '@tyto/core';
import type { CompiledTemplate } from '@tyto/template-kit/testing';

/**
 * The example briefs, compiled the way Tyto compiles them (Tyto ADR 0152), shared by the tests.
 *
 * Nothing is measured and every face is a placeholder, so the HTML moves when the composition
 * does and not when a machine has another font. No brand kit: the logo and the signature are
 * the house's and stay out of this public repository. A crest the brief names is found in the
 * examples folder and handed to the template as a reference with its size and a hash of its
 * name, so the snapshots do not hold image bytes.
 */

export const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const EXAMPLES = '../templates/concursos-abertos-ec/examples/';

const parsed = parseManifest(
  read('../templates/concursos-abertos-ec/manifest.yaml'),
  'manifest.yaml',
);
if (!parsed.ok) throw new Error(parsed.error.map((item) => item.message).join('\n'));
export const manifest = parsed.value;
export const template = defineTemplate(manifest, build);
export const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

/** A PNG's size, read from its header. */
function pngSize(bytes: Buffer): { w: number; h: number } {
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

const assets: AssetResolver = {
  base: EXAMPLES,
  resolve(reference: string): Promise<AssetRef | undefined> {
    const name = reference.replace(/^\.\//, '');
    let bytes: Buffer;
    try {
      bytes = readFileSync(new URL(EXAMPLES + name, import.meta.url));
    } catch {
      return Promise.resolve(undefined);
    }
    const hash = Buffer.from(name).toString('hex').padEnd(64, '0').slice(0, 64);
    return Promise.resolve({
      id: `asset-${name}`,
      source: 'file',
      path: name,
      hash,
      size: pngSize(bytes),
    });
  },
};

/** One example brief, compiled; it throws on an error so a test reads only the result. */
export async function compileExample(
  file: string,
  values?: SuppliedValues,
): Promise<CompiledTemplate> {
  const result = await compileTemplate({
    brief: read(EXAMPLES + file),
    template,
    formats,
    assets,
    asset: (ref) => `data:image/png;asset,${ref.id}`,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value;
}
