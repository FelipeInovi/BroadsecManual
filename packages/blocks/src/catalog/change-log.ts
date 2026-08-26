import { z } from "zod";
import { selectorSchema } from "../conditioning.ts";
import type { BlockDefinition } from "../definition.ts";

/**
 * One delivered version of the manual.
 *
 * `version` is the version DELIVERED TO THE CLIENT, which is not the same
 * number as `manual.contentVersion` in `manual.config.yaml`. That one moves
 * with internal work — a corrected figure, a reworded paragraph. This one moves
 * only when something reaches the client, and only when the owner says so.
 * Keeping them apart is the whole reason this block exists.
 *
 * `date` is ISO `YYYY-MM-DD` in the source and is FORMATTED on the way out, so
 * that a typo is a validation error rather than a wrong date printed with
 * confidence. See `formatChangeLogDate`.
 *
 * `when` is what lets one row belong to some targets and not others. A version
 * delivered to one tenant and not another is the normal case, not the
 * exception: the manuals are conditioned, so their delivery histories diverge.
 */
export const changeLogRow = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO YYYY-MM-DD"),
  description: z.string().min(1),
  when: selectorSchema.optional(),
});

export const changeLogProps = z.object({
  versionHeader: z.string().min(1),
  dateHeader: z.string().min(1),
  descriptionHeader: z.string().min(1),
  rows: z.array(changeLogRow).min(1),
});

export type ChangeLogProps = z.infer<typeof changeLogProps>;

/**
 * ISO `YYYY-MM-DD` -> `DD/MM/YYYY`, which is what a Spanish-language manual
 * prints.
 *
 * Lives here rather than in each renderer because two copies of a date format
 * are two copies that drift, and the block is the one thing both renderers
 * already import. Deliberately NOT `Intl.DateTimeFormat`: that reads the host's
 * timezone, and a date with no time in it can come back a day early west of
 * UTC — a delivery date is a fact, not an instant.
 */
export function formatChangeLogDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export const changeLog: BlockDefinition<ChangeLogProps> = {
  type: "change-log",
  version: "0.1.0",
  description:
    "The manual's own delivery history: one row per version handed to the " +
    "client, with the date and a short statement of what that delivery " +
    "changed. Belongs in the final module of a manual and nowhere else. Not " +
    "data-table, whose two columns quote the PRODUCT and feed the label " +
    "citation check — every word in a change log is the manual's own, and a " +
    "version number is not a UI label. Rows condition individually, because " +
    "a version delivered to one target and not another is normal.",
  schema: changeLogProps,
  children: { kind: "none" },
  // No `numbering`: the version column IS the row's identity, and a second
  // ordinal beside it would be a number the reader has to ignore.
  //
  // No `images`: this is the one block in the catalogue about the manual rather
  // than about a screen, so there is nothing to photograph. The overview-figure
  // rule in `module-completeness` does not reach the module built from it.
  //
  // No `labels`: nothing here is quoted from the product. Declaring one would
  // send the label checker looking for `1.4.7` in the source and report the
  // manual's own delivery history as drifted.
};
