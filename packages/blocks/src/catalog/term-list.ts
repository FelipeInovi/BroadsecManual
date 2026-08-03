import { z } from "zod";
import { selectorSchema } from "../conditioning.ts";
import type { BlockDefinition } from "../definition.ts";

export const termListEntry = z.object({
  id: z.string().min(1),
  term: z.string().min(1),
  definition: z.string().min(1),
  /** Illustration for this one entry. Optional — most entries need none. */
  image: z.string().optional(),
  when: selectorSchema.optional(),
});

export const termListProps = z.object({
  entries: z.array(termListEntry).min(1),
});

export type TermListProps = z.infer<typeof termListProps>;

export const termList: BlockDefinition<TermListProps> = {
  type: "term-list",
  version: "0.2.0",
  description:
    "A tight run of term-and-definition pairs, one line each, no images — the " +
    "options of a single control, a short glossary. Use field-list instead " +
    "when an entry needs a full paragraph or a screenshot; use data-table " +
    "when the entries are numerous enough that a reader will scan rather " +
    "than read them.",
  schema: termListProps,
  children: { kind: "none" },
};
