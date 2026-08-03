/**
 * How a block type is declared.
 *
 * The catalogue of concrete block types is defined in `./catalog/`, one file
 * per type, and is populated once the design team delivers the fixed visual
 * structures. This file describes the shape those declarations take.
 */

import type { ZodType, ZodTypeDef } from "zod";
import type { BlockType } from "./ast.ts";

/**
 * A block's props schema.
 *
 * The input type is left open because a schema may transform — `.default()`,
 * `.coerce`, `.transform()` — so what an author writes is not always what the
 * renderer receives. Only the OUTPUT type is pinned.
 */
export type PropsSchema<TProps> = ZodType<TProps, ZodTypeDef, unknown>;

/** What a block may contain. */
export type ChildPolicy =
  /** Leaf block — content lives entirely in `props`. */
  | { readonly kind: "none" }
  /** A single run of inline content. */
  | { readonly kind: "inline" }
  /** Other blocks, restricted to the listed types. */
  | { readonly kind: "blocks"; readonly allowed: readonly BlockType[] };

/** Where a block's counter resets, for block types that are numbered. */
export type NumberingScope = "document" | "section" | "subsection";

export interface NumberingPolicy {
  readonly scope: NumberingScope;
  /** Caption prefix, e.g. `"Figura"`. Rendered per the manual's language. */
  readonly labelKey: string;
}

export interface BlockDefinition<TProps = unknown> {
  readonly type: BlockType;
  /** SemVer. Manuals pin a catalogue version; a breaking change bumps major. */
  readonly version: string;
  /**
   * What this block is for and when to use it, addressed to whoever — human or
   * agent — is choosing between block types. This is the text that keeps
   * authors from improvising layout.
   */
  readonly description: string;
  readonly schema: PropsSchema<TProps>;
  readonly children: ChildPolicy;
  /** Present only if instances of this block are numbered. */
  readonly numbering?: NumberingPolicy;
}

/** The full set of block types available to a manual. */
export type BlockCatalog = ReadonlyMap<BlockType, BlockDefinition>;
