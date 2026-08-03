import { z } from "zod";
import type { BlockDefinition } from "../definition.js";

export const figureProps = z.object({
  /** Image path relative to the manual's assets folder. */
  src: z.string().min(1),
  /** Caption text WITHOUT a number — the number is assigned at build time. */
  caption: z.string().min(1),
  /** Rendered width as a percentage of the text column. */
  widthPercent: z.number().int().min(10).max(100).default(100),
});

export type FigureProps = z.infer<typeof figureProps>;

export const figure: BlockDefinition<FigureProps> = {
  type: "figure",
  version: "0.1.0",
  description:
    "A captioned image. The caption must not contain a figure number: numbers " +
    "are assigned per build target, because a target that skips a section " +
    "shifts every figure number after it.",
  schema: figureProps,
  children: { kind: "none" },
  numbering: { scope: "section", labelKey: "figure" },
};
