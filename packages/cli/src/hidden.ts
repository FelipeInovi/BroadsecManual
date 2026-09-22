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

const hiddenPath = (manualDir: string): string => join(manualDir, "hidden-images.json");

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

/**
 * Every currently hidden slot, as a plain set — ready to hand to `core`,
 * which stays pure and never reads this file itself (`assemble`,
 * `assignNumbers`, `collectSlots` all take the hidden set as data).
 */
export function hiddenSlotSet(manualDir: string): ReadonlySet<string> {
  const file = readHidden(manualDir);
  return new Set(file ? Object.keys(file.hidden) : []);
}
