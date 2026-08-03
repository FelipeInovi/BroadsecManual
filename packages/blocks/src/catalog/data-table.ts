import { z } from "zod";
import { selectorSchema } from "../conditioning.ts";
import type { BlockDefinition } from "../definition.ts";

export const dataTableRow = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  when: selectorSchema.optional(),
});

export const dataTableProps = z.object({
  labelHeader: z.string().min(1),
  descriptionHeader: z.string().min(1),
  rows: z.array(dataTableRow).min(1),
});

export type DataTableProps = z.infer<typeof dataTableProps>;

export const dataTable: BlockDefinition<DataTableProps> = {
  type: "data-table",
  version: "0.1.0",
  description:
    "A two-column reference table of labels and descriptions, with no icons " +
    "and no item numbers — module capabilities, states, categories. Use " +
    "icon-table instead when the rows describe icon controls the reader must " +
    "recognise on screen, which is what the icon column and the per-row item " +
    "numbers exist for.",
  schema: dataTableProps,
  children: { kind: "none" },
};
