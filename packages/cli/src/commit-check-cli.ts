#!/usr/bin/env node
/**
 * The `commit-msg` hook's thin wrapper: reads what git hands a `commit-msg`
 * hook (the message file's path as `argv[2]`), asks git for the paths staged
 * for this commit, and hands both to `checkCommit` — the pure decision, in
 * `commit-check.ts`.
 *
 * `.githooks/commit-msg` runs this with `node`, exactly the way the rest of
 * this CLI runs: `node packages/cli/src/main.ts <command>`. This file is
 * deliberately NOT wired into `main.ts`'s own command table — it is not a
 * `broadsec-manual` subcommand, it is what git itself invokes.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { checkCommit } from "./commit-check.ts";

/**
 * The paths staged for the commit being checked, or `null` when git could
 * not answer — the same "cannot tell" discipline `git.ts` follows: a hook
 * that cannot ask git must not silently treat that as "nothing staged", or
 * it would wave every commit through the moment git itself is unreachable.
 */
export function readStagedPaths(cwd: string): readonly string[] | null {
  try {
    const out = execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter((line) => line.trim() !== "");
  } catch {
    return null;
  }
}

/**
 * The repository's `core.commentChar`, or `"#"` — git's own default — when
 * nothing overrides it, the config value is the special `auto` (git picks a
 * character at commit time; there is no message here to pick one against),
 * or git could not be asked at all.
 *
 * CRITICAL to read this for real rather than assuming `#`: a plain `git
 * commit` hands `commit-msg` a message file that still carries git's own
 * pre-filled status comment block (stripped only AFTER the hook runs), and
 * `checkCommit` has to know which character marks those lines as comments to
 * strip them — see `commit-check.ts`'s `stripGitCleanup`.
 */
export function readCommentChar(cwd: string): string {
  try {
    const out = execFileSync("git", ["config", "core.commentChar"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === "" || out === "auto" ? "#" : out;
  } catch {
    return "#";
  }
}

/** The whole hook, given what would otherwise be read from `process` — testable without a real invocation. */
export function runCommitCheck(
  messageFile: string | undefined,
  cwd: string,
  readMessage: (path: string) => string,
  getStagedPaths: (cwd: string) => readonly string[] | null,
  getCommentChar: (cwd: string) => string,
): { readonly code: number; readonly report: string | null } {
  if (messageFile === undefined) {
    return {
      code: 1,
      report: "commit-check: falta la ruta del archivo de mensaje (git la pasa como $1).",
    };
  }

  const message = readMessage(messageFile);
  const stagedPaths = getStagedPaths(cwd);
  if (stagedPaths === null) {
    return {
      code: 1,
      report:
        "commit-check: no se pudo preguntarle a git qué está en stage — el commit no se puede validar.",
    };
  }

  const result = checkCommit({ message, stagedPaths, commentChar: getCommentChar(cwd) });
  if (result.ok) return { code: 0, report: null };

  const lines = ["", "commit-msg rechazado:", "", ...result.problems.map((p) => `  - ${p}`), ""];
  return { code: 1, report: lines.join("\n") };
}

// Only when run as a script — not when imported, e.g. by this file's own
// tests, which call `runCommitCheck` and `readStagedPaths` directly and must
// not have this module's `process.exit` fire out from under them.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, report } = runCommitCheck(
    process.argv[2],
    process.cwd(),
    (path) => readFileSync(path, "utf8"),
    readStagedPaths,
    readCommentChar,
  );
  if (report !== null) console.error(report);
  process.exit(code);
}
