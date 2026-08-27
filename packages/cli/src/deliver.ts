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

const indentOf = (line: string): number => (line.match(/^\s*/)?.[0] ?? "").length;

/**
 * Take one target's proof back off a row.
 *
 * THE INVERSE OF `stampProof`, and text surgery for the same reason: a YAML
 * round-trip would reformat every section it touches and lose the comments that
 * carry this repository's reasoning.
 *
 * PER TARGET, because the proof is per target. Removing the whole `delivered:`
 * block to undo one document would erase the record of the OTHER one — which
 * still went out, and whose bytes are still in the archive. The block itself is
 * removed only when the last target leaves it: an empty `delivered:` would say
 * "handed over, nothing handed", and `deliveryProofFor` already treats that as
 * a lie worth guarding against.
 *
 * Returns null when there is nothing to undo — no such row, no proof, or no
 * entry for that target. Null is not a failure to report as an error; it is the
 * caller's signal that this document was never delivered at that version.
 */
export function unstampProof(
  yaml: string,
  version: string,
  axisValue: string,
): { readonly yaml: string; readonly files: readonly string[] } | null {
  const lines = yaml.split("\n");
  const at = lines.findIndex((l) =>
    new RegExp(`^\\s*version:\\s*${version.replace(/\./g, "\\.")}\\s*$`).test(l),
  );
  if (at === -1) return null;
  const rowIndent = indentOf(lines[at] ?? "");

  // Bounded to THIS row. Scanning to the end of the file would find the next
  // row's proof and quietly undo a delivery nobody asked about.
  let delivered = -1;
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") continue;
    if (indentOf(line) < rowIndent) break;
    if (indentOf(line) === rowIndent && /^\s*-\s/.test(line)) break;
    if (indentOf(line) === rowIndent && /^\s*delivered:\s*$/.test(line)) {
      delivered = i;
      break;
    }
  }
  if (delivered === -1) return null;

  // Everything indented deeper than `delivered:` belongs to it.
  let afterBlock = delivered + 1;
  while (afterBlock < lines.length) {
    const line = lines[afterBlock] ?? "";
    if (line.trim() !== "" && indentOf(line) <= rowIndent) break;
    afterBlock += 1;
  }

  const body = lines.slice(delivered + 1, afterBlock);
  const filesAt = body.findIndex((l) => /^\s*files:\s*$/.test(l));
  if (filesAt === -1) return null;
  const filesIndent = indentOf(body[filesAt] ?? "");

  const targetAt = body.findIndex(
    (l, i) =>
      i > filesAt &&
      indentOf(l) === filesIndent + 2 &&
      l.trim() === `${axisValue}:`,
  );
  if (targetAt === -1) return null;

  let afterTarget = targetAt + 1;
  const named: string[] = [];
  while (afterTarget < body.length) {
    const line = body[afterTarget] ?? "";
    if (line.trim() !== "" && indentOf(line) <= filesIndent + 2) break;
    const file = /^\s*([^\s:]+):\s*[0-9a-f]{64}\s*$/.exec(line);
    if (file?.[1] !== undefined) named.push(file[1]);
    afterTarget += 1;
  }

  // Was that the only target? Then the block goes, not just the entry.
  const remaining = body.filter(
    (l, i) =>
      i > filesAt &&
      (i < targetAt || i >= afterTarget) &&
      l.trim() !== "" &&
      indentOf(l) === filesIndent + 2,
  );

  const kept =
    remaining.length === 0
      ? [...lines.slice(0, delivered), ...lines.slice(afterBlock)]
      : [
          ...lines.slice(0, delivered + 1),
          ...body.slice(0, targetAt),
          ...body.slice(afterTarget),
          ...lines.slice(afterBlock),
        ];

  return { yaml: kept.join("\n"), files: named };
}

/** Take the proof off on disk. Null when there was nothing to take off. */
export function unstampFile(
  sectionFile: string,
  version: string,
  axisValue: string,
): readonly string[] | null {
  const undone = unstampProof(readFileSync(sectionFile, "utf8"), version, axisValue);
  if (undone === null) return null;
  writeFileSync(sectionFile, undone.yaml, "utf8");
  return undone.files;
}
