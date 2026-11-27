import { compileBrief } from './compile.js';

import type { SuppliedValues } from '@tyto/core';

/**
 * What the role and the highlight tests read of a scene: every node of each slide, groups
 * opened, and each text's runs as `words|weight|#colour`, so a test states a look in one line.
 */

interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface SceneNode {
  readonly name?: string;
  readonly kind: string;
  readonly children?: readonly SceneNode[];
  readonly runs?: readonly {
    readonly kind: string;
    readonly text?: string;
    readonly weight?: number;
    readonly color?: { readonly color?: Rgb };
  }[];
  readonly fill?: { readonly color?: Rgb };
}

const opened = (nodes: readonly SceneNode[]): SceneNode[] =>
  nodes.flatMap((node) => [node, ...opened(node.children ?? [])]);

export const hex = (color: Rgb | undefined): string =>
  color === undefined
    ? 'none'
    : `#${[color.r, color.g, color.b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;

/** Each slide of a brief written in a test, as the list of its nodes. */
export async function slidesOf(
  body: string,
  values?: SuppliedValues,
  frontmatter = '',
): Promise<SceneNode[][]> {
  const { value } = await compileBrief(body, values === undefined ? {} : { values }, frontmatter);
  const scene = value.scene as unknown as {
    artworks: { frames: { children: SceneNode[] }[] }[];
  };
  return scene.artworks.map((artwork) => opened(artwork.frames[0]!.children));
}

export const named = (slide: readonly SceneNode[], name: string): SceneNode[] =>
  slide.filter((node) => node.name === name);

/** A text's runs, a line break as `/`: `words|weight|#colour`. */
export const look = (node: SceneNode | undefined): string[] =>
  (node?.runs ?? []).map((item) =>
    item.kind === 'text'
      ? `${item.text ?? ''}|${String(item.weight)}|${hex(item.color?.color)}`
      : '/',
  );
