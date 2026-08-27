import { describe, expect, it } from "vitest";
import {
  checkTypedVersion,
  classifyDelivery,
  deliveredRows,
  newestVersion,
  rowsForTarget,
} from "./delivery-state.ts";

const row = (version: string, commit?: string) => ({
  version,
  ...(commit === undefined ? {} : { delivered: { commit } }),
});

describe("classifyDelivery", () => {
  /**
   * The state of every manual in this repository right now: rows written, none
   * handed over. Nothing to summarise — the row already says what it says.
   */
  it("stamps when the row exists and nothing was delivered under it", () => {
    expect(classifyDelivery([row("1.0.0")], "1.0.0")).toEqual({ kind: "stamp", version: "1.0.0" });
  });

  /** A row already written after a previous delivery still only needs stamping. */
  it("stamps a written row even when an earlier version was delivered", () => {
    expect(classifyDelivery([row("1.0.0", "aaaaaaa"), row("1.1.0")], "1.1.0")).toEqual({
      kind: "stamp",
      version: "1.1.0",
    });
  });

  /** The contingency: a manual reaching its first delivery with no table at all. */
  it("asks for a first summary when no row exists and nothing was ever delivered", () => {
    expect(classifyDelivery([], "1.0.0")).toEqual({ kind: "summarise-first", version: "1.0.0" });
  });

  /** The everyday case once the flow is running. */
  it("asks for a diff summary, anchored on the last delivery's own commit", () => {
    expect(classifyDelivery([row("1.0.0", "8a0ab58")], "1.1.0")).toEqual({
      kind: "summarise-since",
      version: "1.1.0",
      since: "8a0ab58",
    });
  });

  it("anchors on the NEWEST delivery, not the first", () => {
    const rows = [row("1.0.0", "aaaaaaa"), row("1.1.0", "bbbbbbb")];
    expect(classifyDelivery(rows, "1.2.0")).toEqual({
      kind: "summarise-since",
      version: "1.2.0",
      since: "bbbbbbb",
    });
  });

  it("refuses to hand over a version already handed over", () => {
    expect(classifyDelivery([row("1.0.0", "aaaaaaa")], "1.0.0")).toEqual({
      kind: "already-delivered",
      version: "1.0.0",
    });
  });

  /**
   * What is in `output/` was built from current content, so it is not the older
   * version at all. Archiving it under that name would file the wrong document
   * as history — and history is the one thing this flow exists to protect.
   */
  it("refuses a version below the newest row", () => {
    expect(classifyDelivery([row("1.0.0"), row("1.1.0")], "1.0.0")).toEqual({
      kind: "not-the-newest",
      version: "1.0.0",
      newest: "1.1.0",
    });
  });

  /** Numerically, so 1.10.0 is above 1.9.0 rather than below it. */
  it("compares versions numerically", () => {
    expect(classifyDelivery([row("1.9.0"), row("1.10.0")], "1.9.0").kind).toBe("not-the-newest");
    expect(classifyDelivery([row("1.9.0"), row("1.10.0")], "1.10.0").kind).toBe("stamp");
  });
});

describe("deliveredRows", () => {
  it("keeps only rows carrying a commit, newest last", () => {
    const rows = [row("1.1.0", "bbbbbbb"), row("2.0.0"), row("1.0.0", "aaaaaaa")];
    expect(deliveredRows(rows).map((r) => r.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("is empty when nothing was ever delivered", () => {
    expect(deliveredRows([row("1.0.0"), row("1.1.0")])).toEqual([]);
  });
});

describe("checkTypedVersion", () => {
  const problem = (typed: string, rows = [row("1.0.0")]) => {
    const judged = checkTypedVersion(typed, rows);
    if (!("problem" in judged)) throw new Error(`expected ${typed} to be rejected`);
    return judged.problem;
  };

  it("asks for something when nothing was typed", () => {
    expect(problem("")).toContain("hace falta una versión");
    expect(problem("   ")).toContain("hace falta una versión");
  });

  it("rejects anything that is not three numbers and two dots", () => {
    for (const bad of ["1.0.1a", "v1.0.1", "1.0", "1.0.1.2", "uno.cero.uno", "1,0,1", "latest"]) {
      expect(problem(bad)).toContain("sólo números y puntos");
    }
  });

  /**
   * `1.0.01` and `1.0.1` compare equal but are different strings, so they would
   * file as two rows for one version and the proof would attach to whichever was
   * typed. Rejected by shape rather than normalised: silently rewriting what the
   * owner typed is the wrong kind of helpful.
   */
  it("rejects leading zeros instead of quietly normalising them", () => {
    expect(problem("1.0.01", [row("1.0.0")])).toContain("sin ceros al principio");
    expect(problem("01.0.0", [])).toContain("sin ceros al principio");
  });

  it("accepts a legitimate zero part", () => {
    expect(checkTypedVersion("1.0.1", [row("1.0.0")])).toEqual({
      delivery: { kind: "summarise-first", version: "1.0.1" },
    });
  });

  /**
   * THE CASE THIS REPOSITORY IS IN. Every manual has rows written and nothing
   * delivered, so the first delivery of each is a version that already has a
   * row. Rejecting it as "already exists" would have blocked all of them.
   */
  it("accepts a version whose row exists but was never delivered", () => {
    expect(checkTypedVersion("1.0.0", [row("1.0.0")])).toEqual({
      delivery: { kind: "stamp", version: "1.0.0" },
    });
  });

  it("rejects a version already handed over", () => {
    expect(problem("1.0.0", [row("1.0.0", "aaaaaaa")])).toContain("ya fue entregada");
  });

  it("rejects a version below the highest row", () => {
    const why = problem("0.9.0", [row("1.0.0")]);
    expect(why).toContain("por debajo de 1.0.0");
  });

  it("rejects an older row that exists, for the same reason", () => {
    expect(problem("1.0.0", [row("1.0.0"), row("1.1.0")])).toContain("por debajo de 1.1.0");
  });

  it("carries the previous delivery's commit through, for the diff", () => {
    expect(checkTypedVersion("1.1.0", [row("1.0.0", "8a0ab58")])).toEqual({
      delivery: { kind: "summarise-since", version: "1.1.0", since: "8a0ab58" },
    });
  });

  it("trims what was typed, so a stray space is not a rejection", () => {
    expect(checkTypedVersion("  1.0.0  ", [row("1.0.0")])).toEqual({
      delivery: { kind: "stamp", version: "1.0.0" },
    });
  });

  /** A first delivery on a manual whose table is empty has nothing to be below. */
  it("accepts any valid version when there are no rows at all", () => {
    expect(checkTypedVersion("2.0.0", [])).toEqual({
      delivery: { kind: "summarise-first", version: "2.0.0" },
    });
  });
});

describe("rowsForTarget", () => {
  const conditioned = (version: string, tenants?: readonly string[]) => ({
    version,
    ...(tenants === undefined ? {} : { when: { tenant: [...tenants] } }),
  });

  /**
   * broadlineavida's real shape: 1.4.7 for everyone, 1.5.0 for `mv` and `demo`
   * only. A wizard that ignored the selector would offer `med` a version it was
   * never handed.
   */
  it("narrows to the rows one target actually holds", () => {
    const rows = [conditioned("1.4.7"), conditioned("1.5.0", ["mv", "demo"])];
    expect(rowsForTarget(rows, { tenant: "mv" }).map((r) => r.version)).toEqual(["1.4.7", "1.5.0"]);
    expect(rowsForTarget(rows, { tenant: "med" }).map((r) => r.version)).toEqual(["1.4.7"]);
  });

  it("gives an unconditioned row to every target", () => {
    expect(rowsForTarget([conditioned("1.0.0")], { tenant: "cualquiera" })).toHaveLength(1);
  });
});

describe("newestVersion", () => {
  it("is null for an empty table", () => {
    expect(newestVersion([])).toBeNull();
  });

  /** String order puts 1.9.0 above 1.10.0. Numeric order does not. */
  it("compares parts numerically", () => {
    expect(newestVersion([row("1.9.0"), row("1.10.0")])).toBe("1.10.0");
  });
});
