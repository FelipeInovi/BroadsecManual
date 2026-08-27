import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { BuildTarget, Selector } from "@broadsec-manual/blocks";
import { matches } from "@broadsec-manual/core";

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
  /** The row's own conditioning. Absent means every target holds it. */
  readonly when?: Selector | undefined;
  readonly delivered?: { readonly commit?: unknown } | undefined;
}

/**
 * The rows ONE TARGET's table actually holds.
 *
 * Delegates to the engine's own `matches` rather than reading `when` here. A
 * second selector implementation is precisely how content leaks across
 * tenants: the first version of that check used `includes` on a scalar and
 * turned exact matching into substring matching. There is one answer to "does
 * this target see this", and it lives in `@broadsec-manual/core`.
 */
export function rowsForTarget(
  rows: readonly ChangeLogRowLike[],
  target: BuildTarget,
): readonly ChangeLogRowLike[] {
  return rows.filter((row) => matches(row.when, target));
}

/**
 * Judge a version typed by hand, against the history of ONE target.
 *
 * The version is TYPED rather than picked, because picking is only possible
 * among things that already exist and a new delivery is by definition a number
 * nothing has yet. What a menu did give was validity for free, so every way of
 * being wrong has to be answered here — and answered as a re-ask, never as an
 * exit: a flow that drops the operator back to a shell over a typo makes them
 * start the whole conversation again.
 *
 * ACCEPTS A VERSION THAT ALREADY HAS A ROW, deliberately. A row written and not
 * yet delivered is the `stamp` case, and it is the SIMPLEST delivery there is —
 * nothing to summarise, because the description is already written. Rejecting
 * it as "already exists" would have blocked the first delivery of every manual
 * in this repository, all of which sit in exactly that state.
 */
/** A version that can still be delivered, and the work that delivering it takes. */
export type PromotableCase = Extract<
  DeliveryCase,
  { readonly kind: "stamp" | "summarise-first" | "summarise-since" }
>;

export function checkTypedVersion(
  typed: string,
  rows: readonly ChangeLogRowLike[],
): { readonly delivery: PromotableCase } | { readonly problem: string } {
  const version = typed.trim();
  if (version === "") return { problem: "hace falta una versión" };
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    return { problem: "no es una versión válida: sólo números y puntos, como 1.0.1" };
  }
  // `1.0.01` and `1.0.1` compare equal but are two different strings, so they
  // would file as two rows for one version and the proof would attach to
  // whichever was typed. Rejected by shape rather than normalised, because
  // silently rewriting what the owner typed is the wrong kind of helpful.
  if (version.split(".").some((part) => part.length > 1 && part.startsWith("0"))) {
    return {
      problem: `${version} y ${version
        .split(".")
        .map((p) => String(Number(p)))
        .join(".")} serían la misma versión escrita de dos formas; escribila sin ceros al principio`,
    };
  }

  const state = classifyDelivery(rows, version);
  if (state.kind === "already-delivered") {
    return {
      problem:
        `${version} ya fue entregada. Una entrega es un hecho: publicar cambios ` +
        `necesita una versión nueva, no reescribir ésta`,
    };
  }
  if (state.kind === "not-the-newest") {
    return {
      problem:
        `${version} está por debajo de ${state.newest}, la fila más alta de la tabla. ` +
        `Una entrega sólo puede ser la última fila`,
    };
  }
  // The CASE travels with the accepted version, so the caller never classifies
  // the same version twice. Two classifications of one fact are two chances to
  // disagree, and the second one would be the branch that decides whether an
  // agent runs at all.
  return { delivery: state };
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

/**
 * The highest version among rows, or null when the table is empty.
 *
 * Compared NUMERICALLY per part: string order puts 1.9.0 above 1.10.0, and a
 * cover printing 1.9.0 while the bottom of the table reads 1.10.0 is the exact
 * incoherence the version-derivation rule exists to prevent.
 */
export function newestVersion(rows: readonly ChangeLogRowLike[]): string | null {
  return rows.reduce<string | null>(
    (best, r) => (best === null || compare(r.version, best) > 0 ? r.version : best),
    null,
  );
}

export function classifyDelivery(
  rows: readonly ChangeLogRowLike[],
  version: string,
): DeliveryCase {
  const newest = newestVersion(rows);
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
            // Carried through, not dropped: these rows come back UNCONDITIONED
            // and `rowsForTarget` is what narrows them. Without the selector
            // there is nothing to narrow by, and broadlineavida — whose 1.5.0
            // row belongs to `mv` and `demo` only — would report the same
            // history for every target.
            when: r["when"] as ChangeLogRowLike["when"],
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
