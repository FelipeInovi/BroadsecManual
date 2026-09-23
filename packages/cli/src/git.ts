import { execFileSync } from "node:child_process";
import { relative, sep } from "node:path";

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
 * Commit ONE file, with a message, and nothing else.
 *
 * NAMES THE PATH IN BOTH HALVES — staged explicitly and passed to `commit`, so
 * a file that arrived in the tree between the stage and the commit cannot ride
 * along. `commit -a` or a bare `commit` after `add` would both sweep it up.
 *
 * Only safe because of where it is called from: a delivery refuses to start on
 * a dirty tree, so the file it stamps is the only change in existence by the
 * time this runs. Do not reach for it from anywhere that cannot make the same
 * promise.
 *
 * Returns false when git could not do it. The caller has already archived by
 * then and cannot roll that back, so a false here is something to REPORT
 * loudly, never to swallow.
 */
export function commitFile(repoRoot: string, path: string, message: string): boolean {
  if (git(repoRoot, ["add", "--", path]) === null) return false;
  return git(repoRoot, ["commit", "-m", message, "--", path]) !== null;
}

/**
 * Commit SEVERAL files in one commit, and nothing else.
 *
 * THE MULTI-FILE TWIN OF `commitFile`, for the one case a single delivery
 * commit needs more than one path: undoing a delivery for regeneration
 * (`undeliver --regenerate`) touches the change-log row AND, when nothing
 * else still needs it, the release notes file that row's version owned. Both
 * belong in ONE commit — splitting them across two would let one land
 * without the other if the second ever failed.
 *
 * NAMES EVERY PATH IN BOTH HALVES, same reasoning as `commitFile`: staged
 * explicitly and passed to `commit`, so nothing that arrived in the tree
 * between the two can ride along.
 *
 * `git add -- <paths>` stages a path's DELETION as readily as an edit, so a
 * removed release-notes file commits the same way as the edited row.
 */
export function commitFiles(repoRoot: string, paths: readonly string[], message: string): boolean {
  if (paths.length === 0) return false;
  if (git(repoRoot, ["add", "--", ...paths]) === null) return false;
  return git(repoRoot, ["commit", "-m", message, "--", ...paths]) !== null;
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

/**
 * `manualDir`, as a path relative to the repository root — the form
 * `productTrailers`'s `path` argument wants, and `git log -- <path>` wants.
 *
 * Forward slashes always, even on Windows: git pathspecs are POSIX-shaped
 * regardless of platform, and `relative()` returns backslashes there.
 *
 * THE FIX for the leak layer 3 exists to close: a range read without a path
 * runs over the WHOLE repository, so a commit that only ever touched
 * `manuals/bridge-manual/` and happens to declare `Producto: nuevo` would
 * otherwise surface inside `broadlineavida`'s own release-notes range.
 *
 * Lives here, not in `main.ts` or `wizard.ts`, because both call it before
 * calling `productTrailers` — one shared function beats two call sites
 * computing the same `relative().split(sep).join("/")` and drifting.
 */
export function manualGitPath(repoRoot: string, manualDir: string): string {
  return relative(repoRoot, manualDir).split(sep).join("/");
}

/** One commit's declared `Producto:` trailer, over a `since..HEAD` range. */
export interface ProductTrailer {
  readonly commit: string;
  readonly subject: string;
  /** The trailer's raw value, or `""` when the commit carries none — read as `sin-cambio`. */
  readonly value: string;
}

/**
 * Every commit strictly after `since`, up to `HEAD`, with its `Producto:`
 * trailer — newest first, `git log`'s own order.
 *
 * `path`, WHEN GIVEN, narrows the range with `git log … -- <path>`: only
 * commits that touched that path (repo-relative, e.g. `manuals/broadlineavida`)
 * are considered. This is what keeps one manual's release-notes range from
 * picking up another manual's `Producto:` commits — `git log <since>..HEAD`
 * over the whole repository, with no path, is exactly the bug this parameter
 * exists to fix. Omitted entirely, the range is repository-wide, which is
 * only ever correct for a caller that has no single manual to narrow to (see
 * this module's own tests, which use generic scratch repositories with
 * nothing under `manuals/`).
 *
 * `null` when git cannot answer: `since` unknown to this repository, git
 * missing, not a repository. See the module doc — a guard reading this must
 * degrade to silence, never invent an answer.
 */
export function productTrailers(
  repoRoot: string,
  since: string,
  path?: string,
): readonly ProductTrailer[] | null {
  const out = git(repoRoot, [
    "log",
    "--format=%H%x09%s%x09%(trailers:key=Producto,valueonly)",
    `${since}..HEAD`,
    ...(path === undefined ? [] : ["--", path]),
  ]);
  if (out === null) return null;
  if (out === "") return [];
  return out.split("\n").map((line) => {
    const [commit = "", subject = "", value = ""] = line.split("\t");
    return { commit, subject, value: value.trim() };
  });
}

/**
 * The most recent commit that touched `path`, or `null` if git cannot say or
 * no commit ever has.
 */
export function lastCommitTouching(repoRoot: string, path: string): string | null {
  const out = git(repoRoot, ["log", "-1", "--format=%H", "--", path]);
  return out === null || out === "" ? null : out;
}

/**
 * Whether `ancestor` is `descendant` itself, or reachable from it by
 * following parent links — i.e. whether `descendant`'s history already
 * contains `ancestor`.
 *
 * `null` when git cannot answer (an unknown commit, git missing, not a
 * repository) — deliberately NOT the same as `false`. `git merge-base
 * --is-ancestor` itself distinguishes "not an ancestor" (exit 1, a real
 * negative answer) from every other failure (exit >1, unreadable); collapsing
 * the two into one `false` would let an unrelated git failure quietly read as
 * "the notes are stale" instead of "cannot tell".
 */
export function isAncestorOrSame(
  repoRoot: string,
  ancestor: string,
  descendant: string,
): boolean | null {
  if (ancestor === descendant) return true;
  try {
    execFileSync("git", ["-C", repoRoot, "merge-base", "--is-ancestor", ancestor, descendant], {
      stdio: "ignore",
    });
    return true;
  } catch (error) {
    const status = (error as { status?: number | null }).status;
    return status === 1 ? false : null;
  }
}
