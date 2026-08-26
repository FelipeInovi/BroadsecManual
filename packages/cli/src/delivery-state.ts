import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * What promoting a version to an official delivery actually requires.
 *
 * The flow was first described as three cases: no official manual with a
 * matching row, no official manual without one, and an official manual already
 * existing. They collapse into TWO QUESTIONS, and the collapse is worth keeping
 * because three named cases invite a fourth that nobody notices is missing:
 *
 *   1. Does a row already declare this version?
 *      No  -> somebody has to write it, and writing it is judgement.
 *      Yes -> there is nothing to write. Stamp it and stop.
 *
 *   2. Only when a row must be written: has anything been delivered before?
 *      No  -> the summary describes what the manual COVERS. There is no diff
 *             to take, because there is no previous delivery to diff against.
 *      Yes -> the summary describes what CHANGED, read from that delivery's
 *             own commit forward.
 *
 * The second question never decides whether an agent runs — only what it is
 * asked. That is why this is one skill with two modes rather than two skills:
 * everything hard about the task (what a client cares about, how to word it,
 * how long) is shared, and duplicated rules drift apart.
 */

/** One change-log row, as it comes off the loaded document. */
export interface ChangeLogRowLike {
  readonly version: string;
  readonly delivered?: { readonly commit?: unknown } | undefined;
}

export type DeliveryCase =
  /** The row exists and nothing was delivered under it. Deterministic. */
  | { readonly kind: "stamp"; readonly version: string }
  /** No row. Nothing delivered before, so describe what the manual covers. */
  | { readonly kind: "summarise-first"; readonly version: string }
  /** No row, and a previous delivery to diff against. */
  | { readonly kind: "summarise-since"; readonly version: string; readonly since: string }
  /** Already handed over. A delivery is a fact; publishing changes needs a new version. */
  | { readonly kind: "already-delivered"; readonly version: string }
  /**
   * Asked for a version below the newest row.
   *
   * The artefacts in `output/` are built from the current content, so they are
   * not that older version at all — archiving them under its name would file
   * the wrong document as history.
   */
  | { readonly kind: "not-the-newest"; readonly version: string; readonly newest: string };

const compare = (a: string, b: string): number => {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

/** The rows already handed over, newest last. */
export function deliveredRows(
  rows: readonly ChangeLogRowLike[],
): readonly { version: string; commit: string }[] {
  return rows
    .filter((r) => typeof r.delivered?.commit === "string")
    .map((r) => ({ version: r.version, commit: r.delivered?.commit as string }))
    .sort((a, b) => compare(a.version, b.version));
}

export function classifyDelivery(
  rows: readonly ChangeLogRowLike[],
  version: string,
): DeliveryCase {
  const newest = rows.reduce<string | null>(
    (best, r) => (best === null || compare(r.version, best) > 0 ? r.version : best),
    null,
  );
  if (newest !== null && compare(version, newest) < 0) {
    return { kind: "not-the-newest", version, newest };
  }

  const row = rows.find((r) => r.version === version);
  if (row !== undefined && typeof row.delivered?.commit === "string") {
    return { kind: "already-delivered", version };
  }
  if (row !== undefined) return { kind: "stamp", version };

  const previous = deliveredRows(rows).at(-1);
  return previous === undefined
    ? { kind: "summarise-first", version }
    : { kind: "summarise-since", version, since: previous.commit };
}

/**
 * The section file holding a manual's change log.
 *
 * Found by reading the files, never by naming one. The change log must sort
 * last (`assertChangeLog`), and hardcoding `08-` would break on the first
 * manual with a different number of modules — broadlineavida is already at
 * `13-`.
 */
export function changeLogSectionFile(manualDir: string): string | null {
  const dir = join(manualDir, "sections");
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yaml")).sort()) {
    if (/^\s*type:\s*change-log\s*$/m.test(readFileSync(join(dir, f), "utf8"))) {
      return join(dir, f);
    }
  }
  return null;
}

/**
 * A manual's change-log rows, read straight off its section file.
 *
 * Parses ONE file rather than assembling the manual, so the wizard can ask what
 * state a delivery is in without pulling in the whole build. Rows come back
 * unconditioned — every row, whatever target it belongs to — which is what the
 * classification wants: whether a version was delivered anywhere is the
 * question a wizard is asking before it knows which targets are involved.
 */
export function readChangeLogRows(manualDir: string): readonly ChangeLogRowLike[] {
  const file = changeLogSectionFile(manualDir);
  if (file === null) return [];
  let doc: unknown;
  try {
    doc = parseYaml(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const rows: ChangeLogRowLike[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o["type"] === "change-log") {
      const props = o["props"] as Record<string, unknown> | undefined;
      for (const r of (props?.["rows"] as Record<string, unknown>[] | undefined) ?? []) {
        if (typeof r["version"] === "string") {
          rows.push({
            version: r["version"],
            delivered: r["delivered"] as ChangeLogRowLike["delivered"],
          });
        }
      }
    }
    for (const value of Object.values(o)) walk(value);
  };
  walk(doc);
  return rows;
}
