import { z } from "zod";
import type { BlockDefinition } from "../definition.js";

export const noteProps = z.object({
  text: z.string().min(1),
});

export type NoteProps = z.infer<typeof noteProps>;

export const note: BlockDefinition<NoteProps> = {
  type: "note",
  version: "0.1.0",
  description:
    "A short aside the reader should not miss — a precondition, a caveat, a " +
    "consequence. Use sparingly: a page of notes is a page with no emphasis " +
    "at all.",
  schema: noteProps,
  children: { kind: "none" },
};
