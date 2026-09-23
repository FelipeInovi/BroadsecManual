import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCommentChar, readStagedPaths, runCommitCheck } from "./commit-check-cli.ts";

const CLI = fileURLToPath(new URL("./commit-check-cli.ts", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * A THROWAWAY repository, same reasoning as `git.test.ts`: this scratch repo
 * gets real staged files and real commits made against it, so it must never
 * be this repository.
 */
const scratch = (): string => {
  const root = mkdtempSync(join(tmpdir(), "commit-check-"));
  execFileSync("git", ["-C", root, "init", "-q"]);
  execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "T"]);
  execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "seed"]);
  return root;
};

const stage = (root: string, relPath: string, contents = "x\n"): void => {
  const parts = relPath.split("/");
  const abs = join(root, ...parts);
  mkdirSync(join(root, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(abs, contents);
  execFileSync("git", ["-C", root, "add", "--", relPath]);
};

describe("readStagedPaths", () => {
  it("lists exactly the staged paths", () => {
    const root = scratch();
    stage(root, "manuals/broadlineavida/sections/07-x.yaml");
    stage(root, "packages/cli/src/main.ts");
    const paths = readStagedPaths(root);
    expect(paths).not.toBeNull();
    expect([...(paths ?? [])].sort()).toEqual(
      ["manuals/broadlineavida/sections/07-x.yaml", "packages/cli/src/main.ts"].sort(),
    );
  });

  it("is empty, not null, when nothing is staged", () => {
    const root = scratch();
    expect(readStagedPaths(root)).toEqual([]);
  });

  it("returns null outside a repository, never throwing", () => {
    expect(() => readStagedPaths("/definitely/not/a/repository/anywhere")).not.toThrow();
    expect(readStagedPaths("/definitely/not/a/repository/anywhere")).toBeNull();
  });
});

describe("readCommentChar", () => {
  it("defaults to '#' when core.commentChar is not configured", () => {
    const root = scratch();
    expect(readCommentChar(root)).toBe("#");
  });

  it("reads a configured core.commentChar", () => {
    const root = scratch();
    execFileSync("git", ["-C", root, "config", "core.commentChar", ";"]);
    expect(readCommentChar(root)).toBe(";");
  });

  // `core.commentChar auto` tells git to PICK a character not present in the
  // message, at commit time — this function has no message to pick against,
  // so it falls back to the ordinary default rather than propagating "auto"
  // as if it were a literal comment character.
  it("falls back to '#' for the special 'auto' value", () => {
    const root = scratch();
    execFileSync("git", ["-C", root, "config", "core.commentChar", "auto"]);
    expect(readCommentChar(root)).toBe("#");
  });

  it("falls back to '#' outside a repository, never throwing", () => {
    expect(() => readCommentChar("/definitely/not/a/repository/anywhere")).not.toThrow();
    expect(readCommentChar("/definitely/not/a/repository/anywhere")).toBe("#");
  });
});

describe("runCommitCheck (dependencies injected)", () => {
  it("reports failure when no message file path was given", () => {
    const result = runCommitCheck(undefined, "/wherever", () => "", () => [], () => "#");
    expect(result.code).toBe(1);
    expect(result.report).toContain("falta la ruta");
  });

  it("reports failure when git could not be asked for staged paths", () => {
    const result = runCommitCheck(
      "/tmp/MSG",
      "/wherever",
      () => "feat(broadlineavida): algo\n\nProducto: nuevo",
      () => null,
      () => "#",
    );
    expect(result.code).toBe(1);
    expect(result.report).toContain("no se pudo preguntarle a git");
  });

  it("passes a well-formed commit through with no report", () => {
    const result = runCommitCheck(
      "/tmp/MSG",
      "/wherever",
      () => "feat(broadlineavida): algo\n\nProducto: nuevo",
      () => ["manuals/broadlineavida/sections/07-x.yaml"],
      () => "#",
    );
    expect(result).toEqual({ code: 0, report: null });
  });

  it("rejects a malformed commit with an actionable report", () => {
    const result = runCommitCheck(
      "/tmp/MSG",
      "/wherever",
      () => "feat: algo",
      () => ["manuals/broadlineavida/sections/07-x.yaml"],
      () => "#",
    );
    expect(result.code).toBe(1);
    expect(result.report).toContain("rechazado");
    expect(result.report).toContain("broadlineavida");
  });

  /**
   * CRITICAL fix, wired end to end: a message file carrying the trailer PLUS
   * a trailing git status comment block (exactly what a plain `git commit`
   * hands the hook) must still pass, once `getCommentChar` supplies the real
   * comment character.
   */
  it("passes a plain `git commit`-shaped message once the comment char is threaded through", () => {
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
    const result = runCommitCheck(
      "/tmp/MSG",
      "/wherever",
      () => message,
      () => ["manuals/broadlineavida/seed.yaml"],
      () => "#",
    );
    expect(result).toEqual({ code: 0, report: null });
  });
});

/**
 * End-to-end: the script actually spawned with `node`, exactly the way
 * `.githooks/commit-msg` runs it, against a THROWAWAY repository with real
 * staged files and a real commit message file. This is the check that a
 * CLI-style commit — the shape `deliver`/`undeliver` themselves now write —
 * passes.
 */
describe("commit-check-cli.ts, spawned like the hook spawns it", () => {
  const run = (root: string, message: string): { readonly code: number; readonly stderr: string } => {
    const msgFile = join(root, "MSG");
    writeFileSync(msgFile, message);
    const result = spawnSync(process.execPath, [CLI, msgFile], { cwd: root, encoding: "utf8" });
    return { code: result.status ?? 1, stderr: result.stderr };
  };

  it("rejects a manual-touching commit with neither scope nor trailer", () => {
    const root = scratch();
    stage(root, "manuals/broadlineavida/sections/07-x.yaml");
    const { code, stderr } = run(root, "feat: algo sin declarar nada\n");
    expect(code).toBe(1);
    expect(stderr).toContain("broadlineavida");
  });

  it("passes the exact shape the CLI's own deliver stamp now writes", () => {
    const root = scratch();
    stage(root, "manuals/broadlineavida/sections/13-historial.yaml");
    const { code, stderr } = run(
      root,
      "chore(broadlineavida,deliver): mv v1.2.0 — sello de entrega\n\nProducto: sin-cambio\n",
    );
    expect(stderr).toBe("");
    expect(code).toBe(0);
  });

  it("passes a commit that touches no manual, unconditionally", () => {
    const root = scratch();
    stage(root, "packages/cli/src/main.ts");
    const { code } = run(root, "chore(cli): reordenar imports\n");
    expect(code).toBe(0);
  });
});

/**
 * CRITICAL fix, proven with an actual `git commit` (no `-m`) rather than a
 * pre-written message file: git pre-fills the editor buffer with its own
 * status comment block, then runs `commit-msg` BEFORE stripping it — so this
 * is the one test that reproduces the exact shape git hands the real hook,
 * not an approximation of it. The scratch repo gets its OWN copy of
 * `.githooks/commit-msg` and the two `commit-check*.ts` files, because the
 * hook resolves them relative to `git rev-parse --show-toplevel`, which for
 * a commit made HERE is this scratch repo, never this one.
 */
describe("the wired hook, end to end with a real `git commit` (no -m)", () => {
  const wiredScratch = (): string => {
    const root = mkdtempSync(join(tmpdir(), "commit-check-hook-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    mkdirSync(join(root, ".githooks"), { recursive: true });
    mkdirSync(join(root, "packages", "cli", "src"), { recursive: true });
    copyFileSync(
      join(REPO_ROOT, ".githooks", "commit-msg"),
      join(root, ".githooks", "commit-msg"),
    );
    chmodSync(join(root, ".githooks", "commit-msg"), 0o755);
    copyFileSync(
      join(REPO_ROOT, "packages", "cli", "src", "commit-check.ts"),
      join(root, "packages", "cli", "src", "commit-check.ts"),
    );
    copyFileSync(
      join(REPO_ROOT, "packages", "cli", "src", "commit-check-cli.ts"),
      join(root, "packages", "cli", "src", "commit-check-cli.ts"),
    );
    // Node needs "type": "module" in the nearest package.json to run these
    // files as ESM directly — see the scratch verification this mirrors.
    writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
    execFileSync("git", ["-C", root, "config", "core.hooksPath", ".githooks"]);
    mkdirSync(join(root, "manuals", "broadlineavida"), { recursive: true });
    writeFileSync(join(root, "manuals", "broadlineavida", "seed.yaml"), "id: seed\n");
    execFileSync("git", ["-C", root, "add", "-A"]);
    return root;
  };

  /** A `GIT_EDITOR` script that PREPENDS `prefixFile`'s content onto whatever git pre-filled. */
  const editorScript = (root: string, prefixFile: string): string => {
    const script = join(root, "editor.sh");
    writeFileSync(
      script,
      ["#!/bin/sh", 'file="$1"', `cat "${prefixFile.split("\\").join("/")}" "$file" > "$file.new"`, 'mv "$file.new" "$file"', ""].join(
        "\n",
      ),
    );
    chmodSync(script, 0o755);
    return script;
  };

  const commitWithEditor = (
    root: string,
    prefix: string,
  ): { readonly status: number | null; readonly stderr: string } => {
    const prefixFile = join(root, "prefix.txt");
    writeFileSync(prefixFile, prefix);
    const editor = editorScript(root, prefixFile);
    const result = spawnSync("git", ["-C", root, "commit", "-q"], {
      cwd: root,
      env: { ...process.env, GIT_EDITOR: editor.split("\\").join("/") },
      encoding: "utf8",
    });
    return { status: result.status, stderr: result.stderr };
  };

  it("accepts a well-formed message typed above git's pre-filled status comment block", () => {
    const root = wiredScratch();
    const { status, stderr } = commitWithEditor(
      root,
      "feat(broadlineavida): algo\n\nProducto: nuevo\n\n",
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
    const subject = execFileSync("git", ["-C", root, "log", "-1", "--format=%s"], {
      encoding: "utf8",
    }).trim();
    expect(subject).toBe("feat(broadlineavida): algo");
  });

  it("still rejects a message with neither scope nor trailer, typed the same way", () => {
    const root = wiredScratch();
    const { status, stderr } = commitWithEditor(root, "algo sin declarar nada\n\n");
    expect(status).not.toBe(0);
    expect(stderr).toContain("broadlineavida");
  });
});
