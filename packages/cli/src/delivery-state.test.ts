import { describe, expect, it } from "vitest";
import { classifyDelivery, deliveredRows } from "./delivery-state.ts";

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
