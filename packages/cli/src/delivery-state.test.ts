import { describe, expect, it } from "vitest";
import {
  checkTypedVersion,
  classifyDelivery,
  deliveredFor,
  deliveredRows,
  filesBlockingUndeliver,
  newestVersion,
  otherTargetsHoldingRow,
  proofFor,
  rowsForTarget,
  staleReleaseNotesReport,
  versionMismatches,
} from "./delivery-state.ts";

/** The target every row here is delivered to, unless a test says otherwise. */
const MV = "mv";
const SHA = "f".repeat(64);

/**
 * A row, optionally delivered TO `mv` from `commit`.
 *
 * The proof is per target all the way down, so there is no such thing as a row
 * "delivered" without naming who received it.
 */
const row = (version: string, commit?: string) => ({
  version,
  ...(commit === undefined
    ? {}
    : { delivered: { [MV]: { commit, files: { "m-mv.pdf": SHA } } } }),
});

describe("classifyDelivery", () => {
  /**
   * The state of every manual in this repository right now: rows written, none
   * handed over. Nothing to summarise — the row already says what it says.
   */
  it("stamps when the row exists and nothing was delivered under it", () => {
    expect(classifyDelivery([row("1.0.0")], "1.0.0", MV)).toEqual({ kind: "stamp", version: "1.0.0" });
  });

  /** A row already written after a previous delivery still only needs stamping. */
  it("stamps a written row even when an earlier version was delivered", () => {
    expect(classifyDelivery([row("1.0.0", "aaaaaaa"), row("1.1.0")], "1.1.0", MV)).toEqual({
      kind: "stamp",
      version: "1.1.0",
    });
  });

  /** The contingency: a manual reaching its first delivery with no table at all. */
  it("asks for a first summary when no row exists and nothing was ever delivered", () => {
    expect(classifyDelivery([], "1.0.0", MV)).toEqual({ kind: "summarise-first", version: "1.0.0" });
  });

  /** The everyday case once the flow is running. */
  it("asks for a diff summary, anchored on the last delivery's own commit", () => {
    expect(classifyDelivery([row("1.0.0", "8a0ab58")], "1.1.0", MV)).toEqual({
      kind: "summarise-since",
      version: "1.1.0",
      since: "8a0ab58",
    });
  });

  it("anchors on the NEWEST delivery, not the first", () => {
    const rows = [row("1.0.0", "aaaaaaa"), row("1.1.0", "bbbbbbb")];
    expect(classifyDelivery(rows, "1.2.0", MV)).toEqual({
      kind: "summarise-since",
      version: "1.2.0",
      since: "bbbbbbb",
    });
  });

  it("refuses to hand over a version already handed over", () => {
    expect(classifyDelivery([row("1.0.0", "aaaaaaa")], "1.0.0", MV)).toEqual({
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
    expect(classifyDelivery([row("1.0.0"), row("1.1.0")], "1.0.0", MV)).toEqual({
      kind: "not-the-newest",
      version: "1.0.0",
      newest: "1.1.0",
    });
  });

  /** Numerically, so 1.10.0 is above 1.9.0 rather than below it. */
  it("compares versions numerically", () => {
    expect(classifyDelivery([row("1.9.0"), row("1.10.0")], "1.9.0", MV).kind).toBe("not-the-newest");
    expect(classifyDelivery([row("1.9.0"), row("1.10.0")], "1.10.0", MV).kind).toBe("stamp");
  });
});

describe("deliveredRows", () => {
  it("keeps only rows carrying a commit, newest last", () => {
    const rows = [row("1.1.0", "bbbbbbb"), row("2.0.0"), row("1.0.0", "aaaaaaa")];
    expect(deliveredRows(rows, MV).map((r) => r.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("is empty when nothing was ever delivered", () => {
    expect(deliveredRows([row("1.0.0"), row("1.1.0")], MV)).toEqual([]);
  });
});

describe("checkTypedVersion", () => {
  const problem = (typed: string, rows = [row("1.0.0")]) => {
    const judged = checkTypedVersion(typed, rows, MV);
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
    expect(checkTypedVersion("1.0.1", [row("1.0.0")], MV)).toEqual({
      delivery: { kind: "summarise-first", version: "1.0.1" },
    });
  });

  /**
   * THE CASE THIS REPOSITORY IS IN. Every manual has rows written and nothing
   * delivered, so the first delivery of each is a version that already has a
   * row. Rejecting it as "already exists" would have blocked all of them.
   */
  it("accepts a version whose row exists but was never delivered", () => {
    expect(checkTypedVersion("1.0.0", [row("1.0.0")], MV)).toEqual({
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
    expect(checkTypedVersion("1.1.0", [row("1.0.0", "8a0ab58")], MV)).toEqual({
      delivery: { kind: "summarise-since", version: "1.1.0", since: "8a0ab58" },
    });
  });

  it("trims what was typed, so a stray space is not a rejection", () => {
    expect(checkTypedVersion("  1.0.0  ", [row("1.0.0")], MV)).toEqual({
      delivery: { kind: "stamp", version: "1.0.0" },
    });
  });

  /** A first delivery on a manual whose table is empty has nothing to be below. */
  it("accepts any valid version when there are no rows at all", () => {
    expect(checkTypedVersion("2.0.0", [], MV)).toEqual({
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
   * broadlineavida's real shape: 1.0.0 for everyone, 1.1.0 for `mv` and `demo`
   * only. A wizard that ignored the selector would offer `med` a version it was
   * never handed.
   */
  it("narrows to the rows one target actually holds", () => {
    const rows = [conditioned("1.0.0"), conditioned("1.1.0", ["mv", "demo"])];
    expect(rowsForTarget(rows, { tenant: "mv" }).map((r) => r.version)).toEqual(["1.0.0", "1.1.0"]);
    expect(rowsForTarget(rows, { tenant: "med" }).map((r) => r.version)).toEqual(["1.0.0"]);
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

describe("proofFor", () => {
  const SHA = "a".repeat(64);
  const stamped = (delivered: Record<string, unknown>) => ({ version: "1.0.0", delivered });

  it("finds the proof for the target that received it", () => {
    expect(
      proofFor(stamped({ mv: { commit: "9348ddb", files: { "m.pdf": SHA } } }), "mv"),
    ).toEqual({ commit: "9348ddb", files: { "m.pdf": SHA } });
  });

  /**
   * The case the old shape could not express: each target carries its own
   * commit, so one delivered months later is not misattributed to the other's.
   */
  it("gives each target its own commit", () => {
    const row = stamped({
      mv: { commit: "9348ddb", files: { "mv.pdf": SHA } },
      med: { commit: "274e66f", files: { "med.pdf": SHA } },
    });
    expect(proofFor(row, "mv")?.commit).toBe("9348ddb");
    expect(proofFor(row, "med")?.commit).toBe("274e66f");
  });

  /**
   * A row can be handed to `mv` and not to `med`. Reading a commit as proof for
   * every target is how a document gets told it received something it never did.
   */
  it("finds nothing for a target the row does not name", () => {
    expect(
      proofFor(stamped({ mv: { commit: "9348ddb", files: { "m.pdf": SHA } } }), "med"),
    ).toBeUndefined();
  });

  /** "Handed over, nothing handed" is a bookkeeping slip, not history. */
  it("rejects an empty file set", () => {
    expect(proofFor(stamped({ mv: { commit: "9348ddb", files: {} } }), "mv")).toBeUndefined();
  });

  it("rejects an entry with files but no commit", () => {
    expect(proofFor(stamped({ mv: { files: { "m.pdf": SHA } } }), "mv")).toBeUndefined();
  });

  it("finds nothing on a row that was never delivered", () => {
    expect(proofFor({ version: "1.0.0" }, "mv")).toBeUndefined();
  });
});

describe("deliveredFor", () => {
  const SHA = "a".repeat(64);
  const stamped = (version: string, target: string, ...names: string[]) => ({
    version,
    delivered: {
      [target]: { commit: "c", files: Object.fromEntries(names.map((n) => [n, SHA])) },
    },
  });

  it("lists only what this target received, newest last", () => {
    const rows = [stamped("1.1.0", "mv", "b.pdf"), stamped("1.0.0", "mv", "a.pdf")];
    expect(deliveredFor(rows, "mv").map((d) => d.version)).toEqual(["1.0.0", "1.1.0"]);
  });

  it("names the archived files, which is what an undo has to delete", () => {
    const rows = [stamped("1.0.0", "mv", "m.pdf", "m.docx")];
    expect(deliveredFor(rows, "mv")[0]?.files).toEqual(["m.pdf", "m.docx"]);
  });

  it("is empty for a target that received nothing", () => {
    expect(deliveredFor([stamped("1.0.0", "mv", "m.pdf")], "med")).toEqual([]);
  });

  it("ignores rows written but never handed over", () => {
    expect(deliveredFor([{ version: "1.0.0" }], "mv")).toEqual([]);
  });
});

describe("otherTargetsHoldingRow", () => {
  const SHA = "a".repeat(64);
  const stamped = (delivered: Record<string, unknown>) => ({ version: "1.0.0", delivered });

  it("is empty when no other target holds this row", () => {
    const row = stamped({ mv: { commit: "9348ddb", files: { "m.pdf": SHA } } });
    expect(otherTargetsHoldingRow(row, ["mv"])).toEqual([]);
  });

  /** The whole point: a target this run is not undoing keeps its proof. */
  it("names a target that still holds proof, besides the ones excluded", () => {
    const row = stamped({
      mv: { commit: "9348ddb", files: { "mv.pdf": SHA } },
      med: { commit: "274e66f", files: { "med.pdf": SHA } },
    });
    expect(otherTargetsHoldingRow(row, ["mv"])).toEqual(["med"]);
  });

  it("excludes every axis value named, not just one", () => {
    const row = stamped({
      mv: { commit: "9348ddb", files: { "mv.pdf": SHA } },
      med: { commit: "274e66f", files: { "med.pdf": SHA } },
    });
    expect(otherTargetsHoldingRow(row, ["mv", "med"])).toEqual([]);
  });

  /** "Handed over, nothing handed" is not a hold — same rule as `proofFor`. */
  it("does not count an empty entry as still holding it", () => {
    const row = stamped({
      mv: { commit: "9348ddb", files: { "mv.pdf": SHA } },
      med: { commit: "274e66f", files: {} },
    });
    expect(otherTargetsHoldingRow(row, ["mv"])).toEqual([]);
  });

  it("is empty for a row with no proof at all", () => {
    expect(otherTargetsHoldingRow({ version: "1.0.0" }, ["mv"])).toEqual([]);
  });
});

/**
 * GUARD 2 — the pure decision `deliverManual` checks BEFORE rendering
 * anything: does every target's highest change-log row already reach the
 * version being delivered? See `main.ts`'s `deliverManual` for the wiring —
 * this is the predicate `build()` throws on today, run early instead of after
 * `mv` has already rendered.
 */
describe("versionMismatches", () => {
  it("is empty when every target's highest row already matches", () => {
    const targets = [
      { value: "mv", highestRow: "1.2.0" },
      { value: "med", highestRow: "1.2.0" },
    ];
    expect(versionMismatches(targets, "1.2.0")).toEqual([]);
  });

  /** THE FAILURE REPRODUCED TODAY: `mv` reaches 1.2.0, `med` is still at 1.0.0. */
  it("names the target whose highest row falls short", () => {
    const targets = [
      { value: "mv", highestRow: "1.2.0" },
      { value: "med", highestRow: "1.0.0" },
    ];
    expect(versionMismatches(targets, "1.2.0")).toEqual([{ value: "med", highestRow: "1.0.0" }]);
  });

  it("is empty with a single target that matches", () => {
    expect(versionMismatches([{ value: "mv", highestRow: "1.0.0" }], "1.0.0")).toEqual([]);
  });
});

/**
 * GUARD 3 — the pure decision behind `undeliverManual`'s pre-flight check:
 * given what a filesystem probe already found for each file an undelivery
 * would delete, which of them actually block the run?
 *
 * REPRODUCED ON THIS REPOSITORY: `undeliver` was run while the archived
 * release notes `.docx` sat open in Microsoft Word. `unstampFile` had already
 * rewritten the change-log row — in the working tree, uncommitted — by the
 * time `unlinkSync` reached that file and threw `EBUSY`. The run died there,
 * leaving the proof stripped but not committed. This function is what now
 * runs FIRST, against every file the run would touch, so that never happens.
 *
 * The probe itself (does opening a file for read-write throw?) lives beside
 * the filesystem it reads, in `main.ts`'s `isLocked` — this only judges what
 * the probe already found, which is why it takes booleans rather than paths
 * to open.
 */
describe("filesBlockingUndeliver", () => {
  it("is empty when nothing the probe looked at was locked", () => {
    expect(
      filesBlockingUndeliver([
        { path: "deliveries/m/x-mv-v1.0.0.pdf", locked: false },
        { path: "deliveries/m/x-mv-v1.0.0.docx", locked: false },
      ]),
    ).toEqual([]);
  });

  /** An absent file is not a block — the probe already reports it as unlocked. */
  it("names only the locked files, never the ones the probe found merely absent", () => {
    expect(
      filesBlockingUndeliver([
        { path: "deliveries/m/x-mv-v1.0.0.pdf", locked: false },
        { path: "deliveries/m/notas-v1.0.0.docx", locked: true },
      ]),
    ).toEqual(["deliveries/m/notas-v1.0.0.docx"]);
  });

  it("names every locked file when more than one target's files are blocked", () => {
    expect(
      filesBlockingUndeliver([
        { path: "a.pdf", locked: true },
        { path: "a.docx", locked: true },
      ]),
    ).toEqual(["a.pdf", "a.docx"]);
  });
});

/**
 * GUARD 1 — the pure decision behind the stale-release-notes report. Never a
 * refusal: an author may legitimately decide a declared change needs no
 * notes, and a reverted commit still carries its trailer. See `git.ts`'s
 * `productTrailers` / `isAncestorOrSame` for how the CLI answers
 * `notesReflectNewest`; this function only judges what to do once that
 * answer is in hand.
 */
describe("staleReleaseNotesReport", () => {
  const nuevo = { commit: "aaaaaaa", subject: "feat: nuevo módulo" };
  const cambio = { commit: "bbbbbbb", subject: "feat: cambia el flujo" };

  it("reports nothing when no commit in range declares product news", () => {
    expect(
      staleReleaseNotesReport({
        declaredCommits: [],
        notesFileExists: false,
        notesReflectNewest: null,
      }),
    ).toBeNull();
  });

  it("reports the declaring commits when the notes file does not exist at all", () => {
    expect(
      staleReleaseNotesReport({
        declaredCommits: [nuevo],
        notesFileExists: false,
        notesReflectNewest: null,
      }),
    ).toEqual({ offending: [nuevo] });
  });

  it("reports nothing when the notes were touched at or after the newest declaring commit", () => {
    expect(
      staleReleaseNotesReport({
        declaredCommits: [cambio, nuevo],
        notesFileExists: true,
        notesReflectNewest: true,
      }),
    ).toBeNull();
  });

  it("reports every declaring commit when the notes predate the newest one", () => {
    expect(
      staleReleaseNotesReport({
        declaredCommits: [cambio, nuevo],
        notesFileExists: true,
        notesReflectNewest: false,
      }),
    ).toEqual({ offending: [cambio, nuevo] });
  });

  /** Git could not answer (unreadable, missing commit) — degrade to silence, never guess. */
  it("stays silent when the CLI could not tell whether the notes reflect the newest commit", () => {
    expect(
      staleReleaseNotesReport({
        declaredCommits: [nuevo],
        notesFileExists: true,
        notesReflectNewest: null,
      }),
    ).toBeNull();
  });
});
