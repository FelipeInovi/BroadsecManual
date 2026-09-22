import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitFile,
  headCommit,
  isAncestorOrSame,
  isDirty,
  isExactly,
  lastCommitTouching,
  productTrailers,
} from "./git.ts";

/**
 * These run against THIS repository, which is the only honest way to test a
 * module whose whole job is talking to a real git.
 */
// `fileURLToPath`, not `.pathname`: this repository's path contains spaces,
// and a URL keeps them as %20 — which git resolves to nothing at all.
const REPO = fileURLToPath(new URL("../../..", import.meta.url));

describe("git access, against this repository", () => {
  it("reads HEAD as a full SHA", () => {
    expect(headCommit(REPO)).toMatch(/^[0-9a-f]{40}$/);
  });

  it("answers whether the tree is dirty with a boolean, not a guess", () => {
    expect(typeof isDirty(REPO)).toBe("boolean");
  });

  it("recognises HEAD as itself when the tree is clean", () => {
    const head = headCommit(REPO);
    expect(head).not.toBeNull();
    // Only meaningful on a clean tree; on a dirty one the answer is correctly
    // false, which is the point of `isExactly` requiring both halves.
    if (isDirty(REPO) === false) expect(isExactly(REPO, head as string)).toBe(true);
  });

  it("compares an abbreviated commit against a full HEAD", () => {
    const head = headCommit(REPO) as string;
    if (isDirty(REPO) === false) expect(isExactly(REPO, head.slice(0, 7))).toBe(true);
  });

  it("does not mistake another commit for HEAD", () => {
    expect(isExactly(REPO, "0".repeat(40))).toBe(false);
  });
});

/**
 * The half that matters most. A guard whose dependency is missing must say so,
 * never quietly answer "fine" — that is a guard that has stopped guarding while
 * still appearing to run.
 */
describe("when git cannot answer", () => {
  const NOWHERE = "/definitely/not/a/repository/anywhere";

  it("returns null rather than throwing, so a build is never blocked by git", () => {
    expect(() => headCommit(NOWHERE)).not.toThrow();
    expect(headCommit(NOWHERE)).toBeNull();
    expect(isDirty(NOWHERE)).toBeNull();
    expect(isExactly(NOWHERE, "a9f780e")).toBeNull();
  });

  it("returns null and NOT false, which the caller must treat as unsafe", () => {
    expect(isExactly(NOWHERE, "a9f780e")).not.toBe(false);
    expect(isExactly(NOWHERE, "a9f780e")).not.toBe(true);
  });
});

/**
 * Against a THROWAWAY repository, never this one. Every other test here reads;
 * this one writes, and a test that leaves commits in the repository it is
 * testing has changed the thing it was measuring.
 */
describe("commitFile", () => {
  const scratch = (): string => {
    const root = mkdtempSync(join(tmpdir(), "git-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    // Set locally: a machine with no global identity cannot commit at all, and
    // the failure would look like a bug in commitFile.
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    writeFileSync(join(root, "seed.txt"), "seed\n");
    execFileSync("git", ["-C", root, "add", "-A"]);
    execFileSync("git", ["-C", root, "commit", "-q", "-m", "seed"]);
    return root;
  };

  it("commits the named file and leaves the tree clean", () => {
    const root = scratch();
    writeFileSync(join(root, "seed.txt"), "stamped\n");
    expect(commitFile(root, join(root, "seed.txt"), "chore: stamp")).toBe(true);
    expect(isDirty(root)).toBe(false);
  });

  /**
   * The guarantee the delivery leans on. `commit -a`, or a bare commit after an
   * `add`, would take the other file too — and a delivery that quietly commits
   * unrelated work is worse than one that commits nothing.
   */
  it("takes ONLY that file, leaving anything else dirty", () => {
    const root = scratch();
    writeFileSync(join(root, "seed.txt"), "stamped\n");
    writeFileSync(join(root, "otra.txt"), "trabajo ajeno\n");
    expect(commitFile(root, join(root, "seed.txt"), "chore: stamp")).toBe(true);
    expect(isDirty(root)).toBe(true);
    const listed = execFileSync("git", ["-C", root, "status", "--porcelain"], { encoding: "utf8" });
    expect(listed).toContain("otra.txt");
    expect(listed).not.toContain("seed.txt");
  });

  it("does not sweep in a file somebody else staged", () => {
    const root = scratch();
    writeFileSync(join(root, "seed.txt"), "stamped\n");
    writeFileSync(join(root, "colada.txt"), "ya estaba en el índice\n");
    execFileSync("git", ["-C", root, "add", "--", join(root, "colada.txt")]);
    expect(commitFile(root, join(root, "seed.txt"), "chore: stamp")).toBe(true);
    const shown = execFileSync("git", ["-C", root, "show", "--name-only", "--format=", "HEAD"], {
      encoding: "utf8",
    });
    expect(shown).toContain("seed.txt");
    expect(shown).not.toContain("colada.txt");
  });

  /** Reported, never thrown — the caller has already archived and cannot undo it. */
  it("returns false outside a repository instead of throwing", () => {
    expect(commitFile(mkdtempSync(join(tmpdir(), "git-")), "x.txt", "chore: nada")).toBe(false);
  });

  it("returns false when there is nothing to commit", () => {
    const root = scratch();
    expect(commitFile(root, join(root, "seed.txt"), "chore: nada cambió")).toBe(false);
  });
});

/**
 * Git plumbing for GUARD 1 (stale/missing release notes) — against a
 * THROWAWAY repository, same reasoning as `commitFile`'s tests: this one
 * writes commits, so it must never run against the repository it is testing.
 */
describe("productTrailers", () => {
  const scratch = (): string => {
    const root = mkdtempSync(join(tmpdir(), "git-trailers-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "seed"]);
    return root;
  };

  const commit = (root: string, message: string): string => {
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", message]);
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  };

  it("reads the trailer's value, newest commit first", () => {
    const root = scratch();
    const since = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    commit(root, "feat: nuevo modulo\n\nProducto: nuevo");
    const last = commit(root, "chore: sin novedad");
    const trailers = productTrailers(root, since);
    expect(trailers).toEqual([
      { commit: last, subject: "chore: sin novedad", value: "" },
      { commit: expect.any(String), subject: "feat: nuevo modulo", value: "nuevo" },
    ]);
  });

  it("is empty over a range with no commits, without treating that as failure", () => {
    const root = scratch();
    const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    expect(productTrailers(root, head)).toEqual([]);
  });

  it("returns null rather than throwing when the anchor is unknown here", () => {
    const root = scratch();
    expect(() => productTrailers(root, "0".repeat(40))).not.toThrow();
    expect(productTrailers(root, "0".repeat(40))).toBeNull();
  });

  it("returns null outside a repository", () => {
    expect(productTrailers("/definitely/not/a/repository/anywhere", "HEAD~1")).toBeNull();
  });
});

describe("lastCommitTouching", () => {
  const scratch = (): string => {
    const root = mkdtempSync(join(tmpdir(), "git-touch-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    return root;
  };

  it("names the commit that last touched the path", () => {
    const root = scratch();
    writeFileSync(join(root, "notas.yaml"), "id: notas\n");
    execFileSync("git", ["-C", root, "add", "-A"]);
    execFileSync("git", ["-C", root, "commit", "-q", "-m", "notas: primera version"]);
    const first = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "algo no relacionado"]);
    expect(lastCommitTouching(root, join(root, "notas.yaml"))).toBe(first);
  });

  it("is null for a path no commit ever touched", () => {
    const root = scratch();
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "seed"]);
    expect(lastCommitTouching(root, join(root, "nunca-existio.yaml"))).toBeNull();
  });

  it("returns null outside a repository", () => {
    expect(lastCommitTouching("/definitely/not/a/repository/anywhere", "x.yaml")).toBeNull();
  });
});

describe("isAncestorOrSame", () => {
  const scratch = (): { root: string; c0: string; c1: string; c2: string } => {
    const root = mkdtempSync(join(tmpdir(), "git-ancestor-"));
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "c0"]);
    const c0 = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "c1"]);
    const c1 = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", "c2"]);
    const c2 = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    return { root, c0, c1, c2 };
  };

  it("is true when the two commits are the same", () => {
    const { root, c1 } = scratch();
    expect(isAncestorOrSame(root, c1, c1)).toBe(true);
  });

  it("is true when the first commit precedes the second", () => {
    const { root, c1, c2 } = scratch();
    expect(isAncestorOrSame(root, c1, c2)).toBe(true);
  });

  it("is false when the first commit comes AFTER the second — a real negative, not `null`", () => {
    const { root, c1, c2 } = scratch();
    expect(isAncestorOrSame(root, c2, c1)).toBe(false);
  });

  it("returns null, not false, for a commit unknown to this repository", () => {
    const { root, c1 } = scratch();
    expect(isAncestorOrSame(root, "f".repeat(40), c1)).toBeNull();
  });

  it("returns null outside a repository", () => {
    expect(
      isAncestorOrSame("/definitely/not/a/repository/anywhere", "a".repeat(40), "b".repeat(40)),
    ).toBeNull();
  });
});
