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

/**
 * Where a block's counter resets, for block types that are numbered.
 *
 * - `document` — one counter for the whole manual, never reset. Bare ordinal.
 * - `section` — resets at each top-level section, keeps counting through every
 *   subsection nested under it. Ordinal is `<top-level number>.<n>`.
 * - `subsection` — resets at every section, at any depth. Ordinal is
 *   `<full section path>.<n>`.
 * - `block` — resets at every instance of the block. Bare ordinal. For items
 *   that only make sense relative to their own container, such as the steps of
 *   one procedure.
 */
export type NumberingScope = "document" | "section" | "subsection" | "block";

export interface NumberingPolicy {
  readonly scope: NumberingScope;
  /** Caption prefix, e.g. `"Figura"`. Rendered per the manual's language. */
  readonly labelKey: string;
  /**
   * Name of the prop holding the items to number, when the block is a
   * container rather than a single numbered thing.
   *
   * Declared, never inferred. Guessing from a prop happening to be called
   * `rows` silently mis-numbers the first block that owns an unrelated array
   * by that name.
   */
  readonly itemsProp?: string;
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
