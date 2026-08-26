import { execFileSync } from "node:child_process";

/**
 * The little git this pipeline needs, and nothing more.
 *
 * EVERY FUNCTION HERE RETURNS `null` RATHER THAN THROWING when git cannot be
 * consulted — not installed, not a repository, a corrupt index. That is the
 * whole point of the module. The build's job is to produce a manual; a guard
 * that turns "git is missing" into "you cannot build" would be a worse defect
 * than the one it guards against, and it would fire on exactly the machines
 * least able to diagnose it.
 *
 * `execFileSync`, never `execSync`: no shell, so a repository path containing a
 * space or a quote is an argument rather than something the shell reinterprets.
 * This repository's own path has three spaces in it.
 */

function git(repoRoot: string, args: readonly string[]): string | null {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** The commit `HEAD` points at, or `null` if git cannot say. */
export function headCommit(repoRoot: string): string | null {
  const out = git(repoRoot, ["rev-parse", "HEAD"]);
  return out === null || out === "" ? null : out;
}

/**
 * Whether the working tree has changes git is tracking or would track.
 *
 * `null` means "cannot tell", which callers must not read as "clean": an
 * unanswerable question and a negative answer are different, and collapsing
 * them is how a guard silently stops guarding.
 */
export function isDirty(repoRoot: string): boolean | null {
  const out = git(repoRoot, ["status", "--porcelain"]);
  return out === null ? null : out !== "";
}

/**
 * Whether `commit` is what the tree currently holds, unmodified.
 *
 * Both halves are required. A build sitting on the delivered commit but with
 * edits in the tree produces a different document from the delivered one, and
 * the commit alone would call it identical.
 */
export function isExactly(repoRoot: string, commit: string): boolean | null {
  const head = headCommit(repoRoot);
  if (head === null) return null;
  const dirty = isDirty(repoRoot);
  if (dirty === null) return null;
  // The recorded commit may be abbreviated; compare on the shorter of the two.
  const n = Math.min(commit.length, head.length);
  return head.slice(0, n) === commit.slice(0, n) && !dirty;
}
