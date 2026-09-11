import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A module's baseline — the product commit it was last verified against.
 *
 * There is no `null` half of this shape. An absent module key in
 * `BaselineFile.modules` already means "never verified" (ADR-005) — a file
 * of seeded nulls would assert two spellings of the same fact.
 */
export interface Baseline {
  /** The FULL 40-char sha `rev-parse HEAD` gave. Never abbreviated on disk. */
  readonly productCommit: string;
  /** ISO date, from the stamping run. */
  readonly verifiedAt: string;
}

export interface BaselineFile {
  readonly source: string;
  /** Keyed by `sections/<name>.yaml` (module identity — ADR-001). Always sorted. */
  readonly modules: Readonly<Record<string, Baseline>>;
}

const baselinesPath = (manualDir: string): string => join(manualDir, "baselines.json");

/** `null` when the file does not exist — no module of this manual has been stamped yet. */
export function readBaselines(manualDir: string): BaselineFile | null {
  const file = baselinesPath(manualDir);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as BaselineFile;
}

/**
 * Stamp ONE module. `module` is a single `string`, not an array — this module
 * exports no array-taking function, so "stamp them all" is unrepresentable
 * rather than merely discouraged (ADR-005).
 *
 * Leaves `source` and every other module's entry byte-identical. Keys are
 * always written sorted, so "stamping A leaves B unchanged" holds regardless
 * of the order modules were stamped in.
 */
export function stampBaseline(
  manualDir: string,
  source: string,
  module: string,
  at: Baseline,
): BaselineFile {
  const existing = readBaselines(manualDir);
  const modules: Record<string, Baseline> = { ...(existing?.modules ?? {}), [module]: at };

  const sorted: Record<string, Baseline> = {};
  for (const key of Object.keys(modules).sort()) {
    sorted[key] = modules[key] as Baseline;
  }

  const result: BaselineFile = { source: existing?.source ?? source, modules: sorted };
  writeFileSync(baselinesPath(manualDir), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}
