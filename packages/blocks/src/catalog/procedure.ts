import { z } from "zod";
import { selectorSchema } from "../conditioning.ts";
import type { BlockDefinition } from "../definition.ts";
import { imageRefSchema } from "../image.ts";

export const procedureStep = z.object({
  id: z.string().min(1),
  /** Title WITHOUT an ordinal — "Paso 1:" is supplied by the renderer. */
  title: z.string().min(1),
  text: z.string().min(1),
  /**
   * The control this step tells the operator to press. Omit it: the slot is
   * this step's id. Showing the control is the single most useful thing the
   * manual does, so the slot is always declared and renders the pending
   * placeholder until the image arrives.
   */
  image: imageRefSchema.optional(),
  /** Sub-actions inside this step, in order. */
  actions: z.array(z.string().min(1)).optional(),
  when: selectorSchema.optional(),
});

export const procedureProps = z.object({
  /** Sentence introducing the sequence. Optional. */
  lead: z.string().optional(),
  steps: z.array(procedureStep).min(1),
});

export type ProcedureProps = z.infer<typeof procedureProps>;

export const procedure: BlockDefinition<ProcedureProps> = {
  type: "procedure",
  version: "0.2.0",
  description:
    "An ordered sequence the reader performs: dispatch, login, updating a " +
    "report. Steps are numbered by position AFTER conditioning, so a target " +
    "that cannot see a step has the following ones shift up. Never write an " +
    "ordinal into a step title. Use field-list instead when the entries are " +
    "things to know rather than things to do, in no particular order.",
  schema: procedureProps,
  children: { kind: "none" },
  numbering: { scope: "block", labelKey: "step", itemsProp: "steps" },
  images: {
    prop: "image",
    itemsProp: "steps",
    showsProp: "title",
    policy: "always",
    convention: "figure",
  },
};
