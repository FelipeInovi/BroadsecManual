import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { headCommit, isDirty, isExactly } from "./git.ts";

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
