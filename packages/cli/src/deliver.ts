import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * Promoting a build to an official delivery.
 *
 * Everything here is DETERMINISTIC and that is the point of the split: copying
 * files, hashing bytes, stamping a row. Not one decision in it. The judgement —
 * what to tell the client changed — belongs to an agent reading the commit
 * range, and the two meet at the row this leaves behind.
 *
 * Nothing in this module writes prose.
 */

/** SHA-256 of a file's bytes, lower-case hex. */
export function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** One target's artefacts, as the delivery found them. */
export interface DeliverableFile {
  /** Axis value this file belongs to, e.g. `mv`. */
  readonly axisValue: string;
  readonly path: string;
  readonly sha: string;
}

export interface DeliveryPlan {
  readonly version: string;
  readonly files: readonly DeliverableFile[];
  readonly commit: string;
}

/**
 * Why a delivery cannot go ahead.
 *
 * Returned rather than thrown so the caller — a wizard mid-conversation, or a
 * command — decides how to say it. A refusal here is always about the delivery
 * being WRONG, never about it being inconvenient.
 */
export type DeliveryRefusal =
  | { readonly kind: "dirty-tree" }
  | { readonly kind: "no-commit" }
  | { readonly kind: "missing-files"; readonly axisValues: readonly string[] }
  | { readonly kind: "already-delivered"; readonly axisValues: readonly string[] }
  | { readonly kind: "not-the-newest"; readonly newest: string };

/**
 * The files an official delivery of `version` would consist of.
 *
 * DRAFTS ARE EXCLUDED BY CONSTRUCTION, not by filtering: the expected name is
 * built from the same template the build used, so a `-BORRADOR` or a
 * `-NO-ENTREGADO` file simply is not the name being looked for. A draft carries
 * internal slot paths and must never reach a client.
 */
export function planDelivery(
  outDir: string,
  version: string,
  expectedNames: ReadonlyMap<string, readonly string[]>,
): { plan: readonly DeliverableFile[]; missing: readonly string[] } {
  const plan: DeliverableFile[] = [];
  const missing: string[] = [];
  for (const [axisValue, names] of expectedNames) {
    let found = false;
    for (const name of names) {
      const path = join(outDir, name);
      if (!existsSync(path)) continue;
      plan.push({ axisValue, path, sha: hashFile(path) });
      found = true;
    }
    if (!found) missing.push(axisValue);
  }
  return { plan, missing };
}

/**
 * Copy the planned files into the archive.
 *
 * REFUSES TO OVERWRITE. A file already sitting in `deliveries/` is one a client
 * received; replacing it would destroy the only copy of the thing the proof in
 * the repository refers to. If a name is already there, the delivery is either
 * a mistake or a repeat, and both want a human rather than a silent overwrite.
 */
export function archive(
  deliveriesDir: string,
  manualId: string,
  files: readonly DeliverableFile[],
): { readonly copied: readonly string[]; readonly refused: readonly string[] } {
  const dest = join(deliveriesDir, manualId);
  mkdirSync(dest, { recursive: true });
  const copied: string[] = [];
  const refused: string[] = [];
  for (const file of files) {
    const target = join(dest, basename(file.path));
    if (existsSync(target)) {
      refused.push(basename(file.path));
      continue;
    }
    copyFileSync(file.path, target);
    copied.push(basename(file.path));
  }
  return { copied, refused };
}

/**
 * Write the proof onto the row that already declares this version.
 *
 * EDITS THE YAML AS TEXT, deliberately. Round-tripping the file through a YAML
 * parser would reformat every section it touches — losing the comments that
 * carry this repository's reasoning, which are the most valuable thing in those
 * files. The insertion is anchored on the row's own `version:` line and its
 * indentation is taken from it.
 *
 * Returns `null` when no row declares that version: that is the caller's signal
 * that this is not a stamp but a new row, which is an agent's job to write.
 */
export function stampProof(
  yaml: string,
  version: string,
  proof: { readonly commit: string; readonly files: readonly DeliverableFile[] },
): string | null {
  const lines = yaml.split("\n");
  const at = lines.findIndex((l) => new RegExp(`^\\s*version:\\s*${version.replace(/\./g, "\\.")}\\s*$`).test(l));
  if (at === -1) return null;

  const indent = (lines[at] ?? "").match(/^\s*/)?.[0] ?? "          ";
  // Grouped by target, then by filename. A target receives a SET — the PDF and
  // the Word file — and the first version of this wrote one line per FILE under
  // the target's own key. The two collided, YAML kept the last, and the PDF's
  // hash vanished without a word. Grouping is what makes the collision
  // impossible rather than merely unlikely.
  const byTarget = new Map<string, DeliverableFile[]>();
  for (const f of proof.files) {
    const bucket = byTarget.get(f.axisValue);
    if (bucket) bucket.push(f);
    else byTarget.set(f.axisValue, [f]);
  }

  const block = [
    `${indent}delivered:`,
    `${indent}  commit: ${proof.commit}`,
    `${indent}  files:`,
    ...[...byTarget.entries()].flatMap(([axisValue, files]) => [
      `${indent}    ${axisValue}:`,
      ...files.map((f) => `${indent}      ${basename(f.path)}: ${f.sha}`),
    ]),
  ];

  // After the row's `date:` when there is one, so the human-facing fields stay
  // together at the top of the row and the machinery sits below them.
  let insertAt = at + 1;
  while (insertAt < lines.length && /^\s*date:\s/.test(lines[insertAt] ?? "")) insertAt += 1;

  return [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)].join("\n");
}

/** Write the stamped YAML back, or throw if the row vanished between reads. */
export function stampFile(
  sectionFile: string,
  version: string,
  proof: { readonly commit: string; readonly files: readonly DeliverableFile[] },
): boolean {
  const stamped = stampProof(readFileSync(sectionFile, "utf8"), version, proof);
  if (stamped === null) return false;
  writeFileSync(sectionFile, stamped, "utf8");
  return true;
}
