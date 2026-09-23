import { describe, expect, it } from "vitest";
import {
  checkCommit,
  headerScopes,
  isExemptMessage,
  manualsFromPaths,
  productoTrailerValue,
  stripGitCleanup,
} from "./commit-check.ts";

describe("manualsFromPaths", () => {
  it("finds the manual id in a nested path", () => {
    expect(manualsFromPaths(["manuals/broadlineavida/sections/07-x.yaml"])).toEqual([
      "broadlineavida",
    ]);
  });

  it("finds more than one manual, sorted and deduplicated", () => {
    expect(
      manualsFromPaths([
        "manuals/bridge-manual/sections/01-x.yaml",
        "manuals/broadlineavida/sections/07-x.yaml",
        "manuals/broadlineavida/manual.config.yaml",
      ]),
    ).toEqual(["bridge-manual", "broadlineavida"].sort());
  });

  it("ignores a file directly under manuals/, which belongs to no manual", () => {
    expect(manualsFromPaths(["manuals/AGENTS.md"])).toEqual([]);
  });

  it("ignores paths outside manuals/ entirely", () => {
    expect(manualsFromPaths(["packages/cli/src/main.ts", "AGENTS.md"])).toEqual([]);
  });

  it("normalises backslashes, in case a caller assembled paths that way", () => {
    expect(manualsFromPaths(["manuals\\broadlineavida\\sections\\07-x.yaml"])).toEqual([
      "broadlineavida",
    ]);
  });

  it("is empty for no staged paths at all", () => {
    expect(manualsFromPaths([])).toEqual([]);
  });
});

describe("isExemptMessage", () => {
  it("exempts a merge commit", () => {
    expect(isExemptMessage("Merge branch 'feature-x' into main")).toBe(true);
  });

  it("exempts a fixup! commit", () => {
    expect(isExemptMessage("fixup! feat(broadlineavida): algo")).toBe(true);
  });

  it("exempts a squash! commit", () => {
    expect(isExemptMessage("squash! feat(broadlineavida): algo")).toBe(true);
  });

  it("does NOT exempt git revert's default message — see commit-messages", () => {
    expect(isExemptMessage('Revert "feat(broadlineavida): algo"')).toBe(false);
  });

  it("does not exempt an ordinary commit", () => {
    expect(isExemptMessage("feat(broadlineavida): algo")).toBe(false);
  });
});

describe("headerScopes", () => {
  it("reads a single scope", () => {
    expect(headerScopes("feat(broadlineavida): algo")).toEqual(["broadlineavida"]);
  });

  it("reads several comma-separated scopes", () => {
    expect(headerScopes("fix(broadlineavida,cli): algo")).toEqual(["broadlineavida", "cli"]);
  });

  it("trims whitespace around each scope", () => {
    expect(headerScopes("fix(broadlineavida, cli): algo")).toEqual(["broadlineavida", "cli"]);
  });

  it("is empty when the header has no scope at all", () => {
    expect(headerScopes("chore: algo")).toEqual([]);
  });

  it("handles a breaking-change bang before the colon", () => {
    expect(headerScopes("feat(broadlineavida)!: algo")).toEqual(["broadlineavida"]);
  });

  it("is empty for a message with no conventional header at all", () => {
    expect(headerScopes('Revert "feat(broadlineavida): algo"')).toEqual([]);
  });
});

describe("stripGitCleanup", () => {
  it("removes the trailing git status comment block a plain `git commit` pre-fills", () => {
    const message = [
      "feat(broadlineavida): algo",
      "",
      "Producto: nuevo",
      "",
      "# Please enter the commit message for your changes. Lines starting",
      "# with '#' will be ignored, and an empty message aborts the commit.",
      "#",
      "# On branch main",
      "# Changes to be committed:",
      "#\tmodified:   manuals/broadlineavida/seed.yaml",
      "#",
    ].join("\n");
    expect(stripGitCleanup(message, "#")).toBe("feat(broadlineavida): algo\n\nProducto: nuevo\n");
  });

  it("respects a non-default core.commentChar", () => {
    const message = "feat(m): algo\n\nProducto: nuevo\n\n; status stuff\n; more status";
    expect(stripGitCleanup(message, ";")).toBe("feat(m): algo\n\nProducto: nuevo\n");
  });

  it("cuts everything from the --verbose scissors line down, regardless of comment prefix", () => {
    const message = [
      "feat(broadlineavida): algo",
      "",
      "Producto: nuevo",
      "",
      "# ------------------------ >8 ------------------------",
      "# Do not modify or remove the line above.",
      "# Everything below it will be ignored.",
      "diff --git a/manuals/broadlineavida/seed.yaml b/manuals/broadlineavida/seed.yaml",
      "+Producto: retirado",
    ].join("\n");
    expect(stripGitCleanup(message, "#")).toBe("feat(broadlineavida): algo\n\nProducto: nuevo\n");
  });

  it("leaves an ordinary message with no comments untouched", () => {
    expect(stripGitCleanup("feat(m): algo\n\nProducto: nuevo", "#")).toBe(
      "feat(m): algo\n\nProducto: nuevo",
    );
  });
});

describe("productoTrailerValue", () => {
  it("reads the trailer from the last paragraph", () => {
    expect(
      productoTrailerValue(
        "feat(broadlineavida): the emergency release\n\nProducto: nuevo",
      ),
    ).toBe("nuevo");
  });

  it("reads it alongside another trailer in the same block", () => {
    expect(
      productoTrailerValue(
        "fix(broadlineavida): algo\n\nRefs: BM-123\nProducto: cambio",
      ),
    ).toBe("cambio");
  });

  it("is null when the message carries no trailer block at all", () => {
    expect(productoTrailerValue("feat(broadlineavida): algo")).toBeNull();
  });

  it("is null when the last paragraph is prose, not a trailer block", () => {
    expect(
      productoTrailerValue(
        "feat(broadlineavida): algo\n\nEsto se probó a mano contra el ambiente de staging.",
      ),
    ).toBeNull();
  });

  it("does not mistake a body paragraph containing a colon for a trailer block", () => {
    expect(
      productoTrailerValue(
        "feat(broadlineavida): algo\n\nNota: esto necesita revisión manual en producción.\n\nOtra nota final.",
      ),
    ).toBeNull();
  });

  it("takes the LAST Producto: line when the trailer was corrected", () => {
    expect(
      productoTrailerValue("feat(broadlineavida): algo\n\nProducto: cambio\nProducto: nuevo"),
    ).toBe("nuevo");
  });

  it("handles CRLF line endings", () => {
    expect(
      productoTrailerValue("feat(broadlineavida): algo\r\n\r\nProducto: retirado"),
    ).toBe("retirado");
  });

  /**
   * CRITICAL fix: with a plain `git commit` (no -m) or `--amend`, git runs
   * `commit-msg` BEFORE stripping comments — the message file still carries
   * the status comment block git pre-filled it with. Without stripping it
   * first, that block becomes the "last paragraph" and the real trailer above
   * it is missed entirely, falsely rejecting every editor commit.
   */
  it("finds the trailer even with a trailing git status comment block (plain `git commit`)", () => {
    const message = [
      "feat(broadlineavida): algo",
      "",
      "Producto: nuevo",
      "",
      "# Please enter the commit message for your changes. Lines starting",
      "# with '#' will be ignored, and an empty message aborts the commit.",
      "#",
      "# On branch main",
      "# Changes to be committed:",
      "#\tmodified:   manuals/broadlineavida/seed.yaml",
      "#",
    ].join("\n");
    expect(productoTrailerValue(message)).toBe("nuevo");
  });

  it("finds the trailer with a --verbose scissors diff below it", () => {
    const message = [
      "feat(broadlineavida): algo",
      "",
      "Producto: cambio",
      "",
      "# ------------------------ >8 ------------------------",
      "# Do not modify or remove the line above.",
      "# Everything below it will be ignored.",
      "diff --git a/manuals/broadlineavida/seed.yaml b/manuals/broadlineavida/seed.yaml",
      "+Producto: nuevo",
    ].join("\n");
    expect(productoTrailerValue(message)).toBe("cambio");
  });

  it("uses the given core.commentChar instead of assuming '#'", () => {
    const message = "feat(m): algo\n\nProducto: nuevo\n\n; status stuff\n; more status";
    expect(productoTrailerValue(message, ";")).toBe("nuevo");
  });

  it("matches the Producto key case-insensitively, same as git's own trailer matching", () => {
    expect(productoTrailerValue("feat(m): algo\n\nproducto: nuevo")).toBe("nuevo");
    expect(productoTrailerValue("feat(m): algo\n\nPRODUCTO: cambio")).toBe("cambio");
    expect(productoTrailerValue("feat(m): algo\n\nProDuCto: retirado")).toBe("retirado");
  });
});

describe("checkCommit", () => {
  it("passes a commit that touches no manual", () => {
    expect(checkCommit({ message: "chore(cli): algo", stagedPaths: ["packages/cli/src/main.ts"] }))
      .toEqual({ ok: true, problems: [] });
  });

  it("passes a well-formed manual-touching commit", () => {
    const result = checkCommit({
      message: "feat(broadlineavida): the emergency release\n\nProducto: nuevo",
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("passes a multi-scope commit that names the manual among others", () => {
    const result = checkCommit({
      message: "fix(broadlineavida,cli): correct the change-log date\n\nProducto: sin-cambio",
      stagedPaths: [
        "manuals/broadlineavida/sections/13-historial.yaml",
        "packages/cli/src/main.ts",
      ],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("rejects a manual-touching commit missing the scope", () => {
    const result = checkCommit({
      message: "feat: the emergency release\n\nProducto: nuevo",
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("broadlineavida");
    expect(result.problems.join("\n")).toContain("scope");
  });

  it("rejects a manual-touching commit missing the trailer", () => {
    const result = checkCommit({
      message: "feat(broadlineavida): the emergency release",
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("Producto");
  });

  it("rejects a trailer with an invalid value", () => {
    const result = checkCommit({
      message: "feat(broadlineavida): algo\n\nProducto: mejora",
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("mejora");
  });

  it("reports both problems at once when both are missing", () => {
    const result = checkCommit({
      message: "feat: algo",
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(2);
  });

  it("rejects a commit spanning two manuals outright, without checking scope or trailer", () => {
    const result = checkCommit({
      message: "chore: algo",
      stagedPaths: [
        "manuals/broadlineavida/sections/07-x.yaml",
        "manuals/bridge-manual/sections/01-x.yaml",
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain("broadlineavida");
    expect(result.problems[0]).toContain("bridge-manual");
  });

  it("exempts a merge commit even if it stages several manuals unscoped", () => {
    const result = checkCommit({
      message: "Merge branch 'feature-x' into main",
      stagedPaths: [
        "manuals/broadlineavida/sections/07-x.yaml",
        "manuals/bridge-manual/sections/01-x.yaml",
      ],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("rejects git revert's default message for a manual-touching commit", () => {
    const result = checkCommit({
      message: 'Revert "feat(broadlineavida): the emergency release"',
      stagedPaths: ["manuals/broadlineavida/sections/07-x.yaml"],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a deliberately declared revert", () => {
    const result = checkCommit({
      message:
        "revert(broadlineavida): mv v1.2.0 — entrega deshecha, no salió\n\nProducto: sin-cambio",
      stagedPaths: ["manuals/broadlineavida/sections/13-historial.yaml"],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("passes the exact shape the CLI's deliver stamp now writes", () => {
    const result = checkCommit({
      message: "chore(broadlineavida,deliver): mv v1.2.0 — sello de entrega\n\nProducto: sin-cambio",
      stagedPaths: ["manuals/broadlineavida/sections/13-historial.yaml"],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  /** CRITICAL fix — see `productoTrailerValue`'s own test with the same name. */
  it("passes a plain `git commit` message with a trailing status comment block", () => {
    const message = [
      "feat(broadlineavida): algo",
      "",
      "Producto: nuevo",
      "",
      "# Please enter the commit message for your changes. Lines starting",
      "# with '#' will be ignored, and an empty message aborts the commit.",
      "#",
      "# On branch main",
      "# Changes to be committed:",
      "#\tmodified:   manuals/broadlineavida/seed.yaml",
    ].join("\n");
    const result = checkCommit({
      message,
      stagedPaths: ["manuals/broadlineavida/seed.yaml"],
      commentChar: "#",
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("defaults commentChar to '#' when the caller does not supply one", () => {
    const message = "feat(broadlineavida): algo\n\nProducto: nuevo\n\n# status stuff\n# more";
    const result = checkCommit({
      message,
      stagedPaths: ["manuals/broadlineavida/seed.yaml"],
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it("respects a non-default commentChar passed through", () => {
    const message = "feat(broadlineavida): algo\n\nProducto: nuevo\n\n; status stuff";
    const result = checkCommit({
      message,
      stagedPaths: ["manuals/broadlineavida/seed.yaml"],
      commentChar: ";",
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });
});
