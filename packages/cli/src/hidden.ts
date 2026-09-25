import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Hiding a pending image slot for delivery — a delivery-time act, never a
 * content edit (ADR-005's model, reused: see `baselines.ts`).
 *
 * A hidden slot behaves as if the content had never declared it, for the
 * current build only. Nothing on disk under `manuals/<id>/sections/` changes:
 * the authored content still declares the slot, `core` still lists it in the
 * manifest as pending, and support still owes the image. Only the CURRENT
 * build renders as if the slot were never there — and un-hiding is a normal,
 * reversible act, not an undo.
 */

/** One slot's hidden state. */
export interface HiddenEntry {
  /** ISO date the slot was hidden. */
  readonly hiddenAt: string;
  /** Free text — why, or when it is expected. Optional. */
  readonly note?: string;
}

/**
 * There is no `null` half of this shape, for the same reason `BaselineFile`
 * has none: an absent slot key already means "not hidden" — a file of seeded
 * `false`s would assert two spellings of the same fact.
 */
export interface HiddenFile {
  /** Keyed by slot name. Always sorted. */
  readonly hidden: Readonly<Record<string, HiddenEntry>>;
}

/**
 * The path `hidden-images.json` lives at, for one manual. Exported so a
 * caller that needs to `commitFile` this exact path (the `hidden --commit`
 * flag in `main.ts`) names it from here rather than retyping the filename.
 */
export const hiddenPath = (manualDir: string): string => join(manualDir, "hidden-images.json");

/** `null` when the file does not exist — no slot of this manual is hidden. */
export function readHidden(manualDir: string): HiddenFile | null {
  const file = hiddenPath(manualDir);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as HiddenFile;
}

function writeSorted(manualDir: string, hidden: Record<string, HiddenEntry>): HiddenFile {
  const sorted: Record<string, HiddenEntry> = {};
  for (const key of Object.keys(hidden).sort()) {
    sorted[key] = hidden[key] as HiddenEntry;
  }
  const result: HiddenFile = { hidden: sorted };
  writeFileSync(hiddenPath(manualDir), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

/**
 * Hide ONE slot.
 *
 * Leaves every other slot's entry byte-identical — keys are always written
 * sorted, so "hiding A leaves B unchanged" holds regardless of the order
 * slots were hidden in. Mirrors `stampBaseline`'s contract exactly.
 */
export function hideSlot(manualDir: string, slot: string, at: HiddenEntry): HiddenFile {
  const existing = readHidden(manualDir);
  const hidden: Record<string, HiddenEntry> = { ...(existing?.hidden ?? {}), [slot]: at };
  return writeSorted(manualDir, hidden);
}

/**
 * Un-hide ONE slot. A harmless no-op if it was not hidden — the caller is
 * asking for a state, not asserting a transition.
 *
 * LEAVES THE FILESYSTEM UNTOUCHED when `slot` is not currently hidden —
 * including when no `hidden-images.json` exists at all. Writing one anyway
 * would create a pointless tracked file for a manual that has never hidden
 * anything, appearing in `git status` for no reason a diff could explain.
 */
export function showSlot(manualDir: string, slot: string): HiddenFile {
  const existing = readHidden(manualDir);
  if (existing === null || !(slot in existing.hidden)) {
    return existing ?? { hidden: {} };
  }
  const hidden = { ...existing.hidden };
  delete hidden[slot];
  return writeSorted(manualDir, hidden);
}

/** Which of the two things `hidden --commit` just did. */
export type HiddenCommitKind = "hide" | "show";

/**
 * The commit message for a hide or show performed FROM THE WIZARD (the
 * `hidden --commit` flag in `main.ts`) — a small, pure, exported function so
 * it can be run through `checkCommit` (`commit-check.ts`) in a test without
 * spawning the CLI or a git process. See the `commit-messages` skill for the
 * rules this has to satisfy: the manual id in the scope, the `Producto:`
 * trailer, no AI attribution.
 *
 * ENGLISH, per this repository's convention that commit messages are code,
 * not manual content — with one exception: `note`, when given, is quoted
 * verbatim. It is whoever ran the wizard's own words, in whatever language
 * they wrote it in, and translating it would put words in their mouth.
 *
 * `Producto: sin-cambio` always — hiding or showing a slot changes what a
 * document LOOKS like, never what the operator can do with the product.
 */
export function hiddenCommitMessage(
  kind: HiddenCommitKind,
  manualId: string,
  slot: string,
  note?: string,
): string {
  if (kind === "show") {
    return `chore(${manualId}): show ${slot} again\n\nProducto: sin-cambio`;
  }
  const body = note && note.trim() !== "" ? note.trim() : "No note was given for this hide.";
  return `chore(${manualId}): hide ${slot}\n\n${body}\n\nProducto: sin-cambio`;
}

/**
 * Every currently hidden slot, as a plain set — ready to hand to `core`,
 * which stays pure and never reads this file itself (`assemble`,
 * `assignNumbers`, `collectSlots` all take the hidden set as data).
 */
export function hiddenSlotSet(manualDir: string): ReadonlySet<string> {
  const file = readHidden(manualDir);
  return new Set(file ? Object.keys(file.hidden) : []);
}
