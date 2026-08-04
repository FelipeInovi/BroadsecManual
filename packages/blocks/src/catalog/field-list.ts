import { z } from "zod";
import { selectorSchema } from "../conditioning.ts";
import type { BlockDefinition } from "../definition.ts";
import { imageRefSchema } from "../image.ts";

export const fieldListItem = z.object({
  id: z.string().min(1),
  /** Name of the element as the product shows it. */
  label: z.string().min(1),
  text: z.string().min(1),
  /**
   * Screenshot of this one element. Omit it: the slot is then this item's id,
   * and it renders the pending placeholder until the image is delivered — so a
   * module can be written long before its captures exist.
   */
  image: imageRefSchema.optional(),
  when: selectorSchema.optional(),
});

export const fieldListProps = z.object({
  items: z.array(fieldListItem).min(1),
});

export type FieldListProps = z.infer<typeof fieldListProps>;

export const fieldList: BlockDefinition<FieldListProps> = {
  type: "field-list",
  version: "0.2.0",
  description:
    "A run of named UI elements, each with its own explanation and its own " +
    "screenshot — filter fields, dashboard widgets, panel controls. Use this " +
    "instead of alternating detail-header / prose / figure: only this block " +
    "conditions each element as a unit, and its screenshots illustrate the " +
    "element rather than becoming numbered figures. Prefer term-list when the " +
    "entries are short definitions with no screenshots.",
  schema: fieldListProps,
  children: { kind: "none" },
  images: { prop: "image", itemsProp: "items", showsProp: "label", policy: "always" },
};
