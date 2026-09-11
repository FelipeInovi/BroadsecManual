import { matchesPath, type DocumentedFlag, type DocumentedPath, type DocumentsDeclaration } from "@broadsec-manual/core";
import type { Baseline } from "./baselines.ts";
import type { JoinableFact, ManualWideFact } from "./extract.ts";

/**
 * The join: declarations x joinable facts -> per-module coverage (ADR-007).
 *
 * Pure. Needs `core`'s declaration type (`DocumentsDeclaration`) and
 * `extract`'s fact type (`JoinableFact`) at once, and `packages/extract`
 * declares no `@broadsec-manual/*` dependency at all — so this cannot live
 * there. It lives in `cli`, the one package both are visible from (ADR-003).
 */

export interface EntryMatch {
  readonly entry: DocumentedPath | DocumentedFlag;
  /** How many facts this one entry claimed. */
  readonly matched: number;
  /**
   * False when this entry lies outside every scanned root, so no fact about
   * it can ever be produced. NOT the same as `matched: 0` — a `matched: 0`
   * entry inside the scanned roots is a real "nothing changed here"; one
   * outside them is "this could never be reported today" (`source-extraction`
   * steps 3 and 5 are not implemented). Always `true` for a `flag` entry: a
   * capability fact comes from the parsed config, never from a scanned file.
   */
  readonly joinable: boolean;
}

export interface ModuleCoverage {
  /** `sections/<name>.yaml` — ADR-001's module id. */
  readonly module: string;
  readonly state: "covered" | "clean" | "unknown";
  /** Every fact this module's `documents:` claimed. Empty unless `covered`. */
  readonly facts: readonly JoinableFact[];
  /** Empty when `unknown` — an undeclared module has no entries to report on. */
  readonly entries: readonly EntryMatch[];
  readonly baseline: Baseline | null;
}

export interface CoverageReport {
  readonly modules: readonly ModuleCoverage[];
  /** Facts no module could ever have declared — never matched, never reported as undeclared. */
  readonly manualWide: readonly ManualWideFact[];
  /** Facts matched by no module's `documents:` at all — MUF-103/MUF-305. */
  readonly undeclared: readonly JoinableFact[];
  /** A baseline key whose section file no longer exists — ADR-001's stale-entry case. */
  readonly staleBaselines: readonly string[];
}

/** One module's input to the join: its id, its declaration (if any), and its baseline. */
export interface ModuleInput {
  /** `sections/<name>.yaml` — ADR-001's module id. */
  readonly module: string;
  /** `undefined` when the section declares no `documents:` — the `unknown` state (MUF-003). */
  readonly documents: DocumentsDeclaration | undefined;
  readonly baseline: Baseline | null;
}

/** Everything the join needs beyond the per-module declarations and the facts. */
export interface JoinContext {
  /** Facts that name nothing a module could have declared — reported once, never joined. */
  readonly manualWide: readonly ManualWideFact[];
  /** The directories the extractor actually scans (relative, e.g. `src/render/components`). */
  readonly scanRoots: readonly string[];
  /** Every module key `baselines.json` carries, whether or not a section file still has that name. */
  readonly baselineKeys: readonly string[];
}

function isPathEntry(entry: DocumentedPath | DocumentedFlag): entry is DocumentedPath {
  return "kind" in entry;
}

function matchesFlagEntry(entry: DocumentedFlag, fact: JoinableFact): boolean {
  return fact.kind === "capability" && fact.flag === entry.flag;
}

function matchesGateEntry(entry: DocumentedPath, fact: JoinableFact): boolean {
  return fact.kind === "gate" && matchesPath(entry, fact.file);
}

/**
 * An entry is joinable when its path could ever be produced by today's scan.
 * A `flag` entry is always joinable: capability facts come from the parsed
 * tenant config, never from a scanned file, so no root can exclude one.
 */
function isJoinable(entry: DocumentedPath | DocumentedFlag, scanRoots: readonly string[]): boolean {
  if (!isPathEntry(entry)) return true;
  return scanRoots.some((root) => entry.path === root || entry.path.startsWith(`${root}/`));
}

export function joinCoverage(
  modules: readonly ModuleInput[],
  facts: readonly JoinableFact[],
  context: JoinContext,
): CoverageReport {
  const claimed = new Set<JoinableFact>();
  const moduleReports: ModuleCoverage[] = [];

  for (const input of modules) {
    if (input.documents === undefined) {
      moduleReports.push({
        module: input.module,
        state: "unknown",
        facts: [],
        entries: [],
        baseline: input.baseline,
      });
      continue;
    }

    const entries: EntryMatch[] = [];
    const moduleFacts: JoinableFact[] = [];

    for (const entry of input.documents.paths) {
      const matches = facts.filter((f) => matchesGateEntry(entry, f));
      for (const f of matches) {
        claimed.add(f);
        if (!moduleFacts.includes(f)) moduleFacts.push(f);
      }
      entries.push({ entry, matched: matches.length, joinable: isJoinable(entry, context.scanRoots) });
    }
    for (const entry of input.documents.flags) {
      const matches = facts.filter((f) => matchesFlagEntry(entry, f));
      for (const f of matches) {
        claimed.add(f);
        if (!moduleFacts.includes(f)) moduleFacts.push(f);
      }
      entries.push({ entry, matched: matches.length, joinable: true });
    }

    moduleReports.push({
      module: input.module,
      state: moduleFacts.length > 0 ? "covered" : "clean",
      facts: moduleFacts,
      entries,
      baseline: input.baseline,
    });
  }

  // Reported, never resolved: a fact belongs under every module that claimed
  // it (MUF-304). What is left here is unclaimed by ANY module — the reverse
  // index MUF-305 requires, and the count that must sum back to the total.
  const undeclared = facts.filter((f) => !claimed.has(f));

  const knownModules = new Set(modules.map((m) => m.module));
  const staleBaselines = context.baselineKeys.filter((key) => !knownModules.has(key));

  return {
    modules: moduleReports,
    manualWide: context.manualWide,
    undeclared,
    staleBaselines,
  };
}
