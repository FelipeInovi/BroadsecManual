/**
 * The PURE decision behind the `commit-msg` hook (`.githooks/commit-msg`,
 * wired through `commit-check-cli.ts`).
 *
 * Takes exactly what a commit-msg hook has: the message being committed, and
 * the paths staged for it. Everything else — reading the message file,
 * running `git diff --cached --name-only`, printing to stderr, the process
 * exit code — belongs in `commit-check-cli.ts`. See `commit-messages` (the
 * skill) for the rule this enforces and why it exists.
 *
 * DECIDES, so it is tested here rather than through the CLI — same split
 * `packages/cli/AGENTS.md` asks of every command.
 */

/** One manual a commit's staged paths touch, e.g. `broadlineavida`. */
export function manualsFromPaths(paths: readonly string[]): readonly string[] {
  const ids = new Set<string>();
  for (const raw of paths) {
    // Git always reports staged paths with forward slashes, even on Windows —
    // but a caller that assembled this list some other way might not have,
    // so normalise rather than trust it.
    const path = raw.replace(/\\/g, "/");
    // `manuals/<id>/…` only — a file directly under `manuals/` (like
    // `manuals/AGENTS.md`) belongs to no single manual and must not be read
    // as one, or every repo-wide edit under `manuals/` would demand a
    // `Producto:` trailer it has no product to be about.
    const match = /^manuals\/([^/]+)\/.+/.exec(path);
    if (match) ids.add(match[1] as string);
  }
  return [...ids].sort();
}

/**
 * Commits this hook does not judge at all.
 *
 * Merge commits (git's own generated message, `Merge …`) and
 * `fixup!`/`squash!` commits (destined to be folded into another commit by
 * `rebase --autosquash`, where the REAL message is what gets checked) are
 * exempt.
 *
 * `git revert`'s default message is deliberately NOT here — see
 * `commit-messages` for why a revert of a manual change is itself a
 * product-facing fact that must be declared, not waved through.
 */
export function isExemptMessage(message: string): boolean {
  const subject = (message.split("\n")[0] ?? "").trim();
  return /^Merge /.test(subject) || /^(fixup|squash)!\s/.test(subject);
}

/**
 * The scopes named in the commit's conventional-commit header, e.g.
 * `fix(broadlineavida,cli): …` -> `["broadlineavida", "cli"]`.
 *
 * A header with no parenthesised scope at all (`chore: …`) returns an empty
 * list rather than `null` — a real answer, "this commit names no scope",
 * which is exactly what a manual-touching commit without one is missing.
 */
export function headerScopes(message: string): readonly string[] {
  const subject = (message.split("\n")[0] ?? "").trim();
  const match = /^[a-zA-Z][a-zA-Z0-9_-]*\(([^)]*)\)!?:/.exec(subject);
  if (!match) return [];
  return (match[1] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/**
 * The four values `Producto:` is allowed to take. Exported so the CLI and
 * tests both name the source of truth rather than retyping the list.
 */
export const PRODUCTO_VALUES = ["nuevo", "cambio", "retirado", "sin-cambio"] as const;
export type ProductoValue = (typeof PRODUCTO_VALUES)[number];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strips what git itself would strip before a REAL commit lands — the part
 * of `commit-msg`'s message file that is never part of the commit.
 *
 * CRITICAL to call before parsing a message for a trailer: with a plain
 * `git commit` (no `-m`) or `--amend`, git pre-fills the editor with the
 * status comment block ("# Please enter the commit message…", "# On branch
 * …") and only strips it AFTER `commit-msg` runs, as part of its own
 * cleanup. The `commit-msg` hook therefore sees the raw, uncleaned file —
 * with the block still attached below the real message. Parsing that file's
 * "last paragraph" without stripping first finds the comment block, not the
 * trailer paragraph above it, and falsely rejects a well-formed commit.
 *
 * Two things, in order:
 *
 * 1. Everything from the `--verbose` scissors line down (`# --- >8 ---`,
 *    with the real comment character) is cut. Content below it — normally a
 *    diff — is NOT itself comment-prefixed, so it has to be cut wholesale
 *    rather than filtered line by line.
 * 2. Every remaining line that STARTS with `commentChar` is dropped, mirroring
 *    git's own rule (`core.commentChar`, default `#`) for which lines never
 *    reach the final message.
 */
export function stripGitCleanup(message: string, commentChar: string): string {
  const lines = message.replace(/\r\n/g, "\n").split("\n");

  const scissors = new RegExp(`^\\s*${escapeRegExp(commentChar)}\\s*-+\\s*>8\\s*-+\\s*$`);
  const cutAt = lines.findIndex((l) => scissors.test(l));
  const aboveScissors = cutAt === -1 ? lines : lines.slice(0, cutAt);

  return aboveScissors.filter((l) => !l.startsWith(commentChar)).join("\n");
}

/**
 * The `Producto:` trailer's raw value, or `null` when the message carries no
 * such trailer at all.
 *
 * FIRST runs `stripGitCleanup` — see its own doc for why this is not
 * optional — THEN trims the whole result before splitting into paragraphs.
 * The trim matters on its own: without it, a message that stripped down to
 * `"...Producto: nuevo\n\n"` (trailing blank lines where a now-removed
 * comment block used to be) would split into a spurious EMPTY last
 * paragraph, which reads exactly like "no trailer" and loses the real one.
 *
 * A SIMPLIFIED trailer-block parser, not `git interpret-trailers` — this
 * function takes a raw string, not a repository, so it cannot shell out.
 * Equivalent for how this repository actually writes trailers: git's own
 * rule is "the last paragraph, if every line in it looks like `Token:
 * value`"; that is what this checks. Multi-line folded trailer values (a
 * continuation line git indents under the token above it) are not produced
 * by anything in this repository and are not recognised here.
 *
 * The `Producto` KEY is matched case-insensitively — git itself treats
 * trailer keys case-insensitively (`Producto:`, `producto:`, `PRODUCTO:` are
 * the same trailer to `git interpret-trailers`). The VALUE is not touched —
 * validating it against the four allowed spellings is `checkCommit`'s job.
 *
 * When `Producto:` appears more than once in the trailer block, the LAST one
 * wins — the same "last wins" rule `git interpret-trailers` itself applies,
 * so a commit amended to correct its own trailer reads as the correction.
 */
export function productoTrailerValue(message: string, commentChar = "#"): string | null {
  const cleaned = stripGitCleanup(message, commentChar).trim();
  if (cleaned === "") return null;

  const paragraphs = cleaned.split(/\n{2,}/);
  const last = paragraphs.at(-1)?.trim() ?? "";
  if (last === "") return null;

  const lines = last.split("\n").map((l) => l.trim());
  // Every line in the paragraph must look like a trailer (`Token: value`) for
  // the paragraph to count as a trailer block at all — a closing sentence of
  // ordinary prose ("Fixes the thing.") does not, and must not be scanned for
  // a `Producto:` line that happens to share its paragraph with prose.
  const TRAILER_LINE = /^[A-Za-z][A-Za-z0-9-]*:\s*.*$/;
  if (!lines.every((l) => TRAILER_LINE.test(l))) return null;

  let value: string | null = null;
  for (const line of lines) {
    const match = /^producto:\s*(.*)$/i.exec(line);
    if (match) value = (match[1] ?? "").trim();
  }
  return value;
}

export interface CommitCheckInput {
  readonly message: string;
  readonly stagedPaths: readonly string[];
  /**
   * `core.commentChar`, as the committing repository has it configured —
   * `commit-check-cli.ts` reads it with `git config core.commentChar` and
   * passes it through, keeping this function itself free of any git call.
   * Defaults to `#`, git's own default when nothing overrides it.
   */
  readonly commentChar?: string;
}

export interface CommitCheckResult {
  readonly ok: boolean;
  /** Actionable, in Spanish, one per problem — empty when `ok`. */
  readonly problems: readonly string[];
}

/**
 * The whole decision: is this commit message allowed to land, given what it
 * stages?
 *
 * - Zero manuals touched -> nothing required.
 * - Two or more manuals touched -> rejected outright; no `Producto:` value
 *   could describe two products at once. See `commit-messages`.
 * - Exactly one -> the header's scope must name it, and the message must
 *   carry a `Producto:` trailer with one of the four allowed values.
 */
export function checkCommit(input: CommitCheckInput): CommitCheckResult {
  if (isExemptMessage(input.message)) return { ok: true, problems: [] };

  const manuals = manualsFromPaths(input.stagedPaths);
  if (manuals.length === 0) return { ok: true, problems: [] };

  if (manuals.length > 1) {
    return {
      ok: false,
      problems: [
        `Este commit toca más de un manual (${manuals.join(", ")}). Un trailer ` +
          `\`Producto:\` no puede describir dos productos a la vez — dividí el ` +
          `commit en uno por manual.`,
      ],
    };
  }

  const manualId = manuals[0] as string;
  const problems: string[] = [];

  const scopes = headerScopes(input.message);
  if (!scopes.includes(manualId)) {
    problems.push(
      `El commit toca manuals/${manualId}/ pero el scope de su encabezado no lo ` +
        `nombra. Usá algo como \`fix(${manualId}): …\` o \`fix(${manualId},cli): …\`.`,
    );
  }

  const trailerValue = productoTrailerValue(input.message, input.commentChar ?? "#");
  if (trailerValue === null) {
    problems.push(
      `El commit toca manuals/${manualId}/ y necesita un trailer \`Producto:\` ` +
        `(nuevo, cambio, retirado o sin-cambio) que declare qué significa para el ` +
        `operador. Ver la skill \`commit-messages\`.`,
    );
  } else if (!(PRODUCTO_VALUES as readonly string[]).includes(trailerValue)) {
    problems.push(
      `El trailer \`Producto: ${trailerValue}\` no es un valor válido — usá ` +
        `nuevo, cambio, retirado o sin-cambio.`,
    );
  }

  return { ok: problems.length === 0, problems };
}
