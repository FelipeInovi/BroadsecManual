import { z } from "zod";
import type { BlockDefinition } from "../definition.js";
import { selectorSchema } from "../conditioning.ts";

export const iconTableRow = z.object({
  /** Stable id. Referenceable, and the anchor for the row's icon asset. */
  id: z.string().min(1),
  /** Icon asset, relative to the manual's assets folder. Optional. */
  icon: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  /** Conditioning for this ROW. Omitted means every target sees it. */
  when: selectorSchema.optional(),
});

export const iconTableProps = z.object({
  /** Middle column header — the source manual's own label. */
  labelHeader: z.string().min(1),
  descriptionHeader: z.string().min(1),
  rows: z.array(iconTableRow).min(1),
});

export type IconTableProps = z.infer<typeof iconTableProps>;

export const iconTable: BlockDefinition<IconTableProps> = {
  type: "icon-table",
  version: "0.1.0",
  description:
    "A table describing icon-based UI controls, one row per control. Rows are " +
    "DATA and each carries its own conditioning, so a target that lacks a " +
    "control simply does not get its row and the table renumbers itself. Use " +
    "this — never a hand-written table — whenever rows can vary by target.",
  schema: iconTableProps,
  children: { kind: "none" },
  numbering: { scope: "subsection", labelKey: "row" },
};
