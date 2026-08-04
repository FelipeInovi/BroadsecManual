import { z } from "zod";
import type { BlockDefinition } from "../definition.ts";
import { imageRefSchema } from "../image.ts";

export const proseProps = z.object({
  /** Paragraph text. `**bold**` is the only inline markup. */
  text: z.string().min(1),
  /**
   * Illustration for this paragraph. Opt-in, and NOT a figure: it carries no
   * caption and takes no number. Use `figure` when the image must be
   * referenceable. `true` uses this node's id as the slot.
   */
  image: imageRefSchema.optional(),
});

export type ProseProps = z.infer<typeof proseProps>;

export const prose: BlockDefinition<ProseProps> = {
  type: "prose",
  version: "0.3.0",
  description:
    "A body paragraph, optionally illustrated. Use for explanatory text " +
    "between structured blocks. Do not use it to fake a list, a table or a " +
    "callout — those have their own block types and only they condition and " +
    "renumber correctly. Use `figure` instead when the image needs a caption " +
    "and a number so the text can refer back to it.",
  schema: proseProps,
  children: { kind: "none" },
  images: { prop: "image", showsProp: "text", policy: "optional" },
};
