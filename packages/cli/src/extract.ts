import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, posix, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  capabilityMatrix,
  findTenantReferences,
  parseTenantConfig,
  reconcileAxisValues,
  type AxisReference,
  type CapabilityRow,
  type TenantConfig,
} from "@broadsec-manual/extract";
import { soleAxis } from "./axis.ts";

/**
 * `extract` — read a source product and write the module map.
 *
 * The map is the only bridge between product code and manual content: content is
 * written against the map, never against source read ad hoc. Everything here
 * carries the file and line it came from, because a fact nobody can point at is
 * a guess, and a guess about which deployment sees what is the one defect a
 * reader cannot detect.
 *
 * The source repository is READ-ONLY. Nothing in this file writes outside
 * `manuals/<manual>/knowledge/`.
 */

const registrySchema = z.object({
  sources: z.record(
    z.string().min(1),
    z
      .object({
        name: z.string().min(1),
        path: z.string().min(1),
        extract: z
          .object({
            // OPTIONAL, because a product can be genuinely multi-tenant without
            // saying so anywhere in its own repository — Bridge360 resolves the
            // tenant from a JWT claim and routes on it server-side. Requiring
            // this field forced such a product to be described with an invented
            // path, which is the one failure this layer exists to prevent.
            tenantConfigs: z.string().min(1).optional(),
            components: z.string().min(1),
            pages: z.string().min(1),
          })
          .passthrough(),
      })
      .passthrough(),
  ),
});

/** Source files worth scanning for an axis comparison. */
const SCANNED = /\.(tsx?|jsx?)$/;

function walkFiles(root: string, out: string[] = []): string[] {
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) walkFiles(path, out);
    else if (SCANNED.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Every fact one extraction produced.
 *
 * The map NAMES the axis it describes. It used to assume tenant in its field
 * names — `tenants`, `tenantReferences` — while the conditioning engine
 * (invariant 3) and the CLI (`primaryAxis`) had already been made agnostic. That
 * left the map as the last place asserting that a product's divergence is a
 * deployment, which for a manual conditioned on permission profiles is the
 * mislabelling invariant 3 exists to prevent: it reached the drift report, which
 * is read by whoever decides what content gets tagged with.
 */
export interface ModuleMap {
  readonly source: string;
  /** The axis this map describes — `tenant`, `permission`, whatever varies. */
  readonly axis: string;
  /** The axis's values, as the product itself declares them. */
  readonly values: ReadonlyArray<{ id: string; code: string; source: string }>;
  readonly capabilities: readonly CapabilityRow[];
  /** Every line of product code that decides along this axis. */
  readonly references: readonly AxisReference[];
  /**
   * Where the manual's declared axis values and the product's configs disagree.
   * Absent when they match. Reported, never reconciled automatically.
   */
  readonly registryMismatch?: readonly string[];
}

/**
 * A map read off disk.
 *
 * `axis` is optional here and required in `ModuleMap`, and that asymmetry is the
 * point: a freshly built map always knows its axis, and a map written by an
 * earlier version never recorded one. Typing both as the same thing would make
 * the code claim to know something it read from a file that predates the field.
 */
export type PreviousMap = Omit<ModuleMap, "axis"> & { readonly axis?: string };

/** The field names a map written before the axis was named used. */
interface LegacyFields {
  readonly tenants?: ModuleMap["values"];
  readonly tenantReferences?: readonly AxisReference[];
}

/** A capability row from either shape. */
type LegacyCapabilityRow = CapabilityRow & { readonly tenants?: CapabilityRow["values"] };

/**
 * Read a previous map whatever shape it was written in.
 *
 * Without this the rename IS the drift report: `broadlineavida`'s map on disk
 * holds 7 values and 100 gates, and every one of them would read as removed and
 * re-added. A report that fires on its own field rename is a report nobody reads
 * the next time it fires for a reason — and the reason it fires for is content
 * tagging that has silently gone wrong.
 *
 * `axis` is deliberately NOT defaulted. An absent axis is unknown, not `tenant`:
 * filling it in would be inventing the one fact this whole change exists to stop
 * being assumed. One regeneration re-establishes the baseline.
 */
export function normalizeMap(raw: PreviousMap): PreviousMap {
  const legacy = raw as PreviousMap & LegacyFields;
  return {
    source: raw.source,
    ...(raw.axis !== undefined ? { axis: raw.axis } : {}),
    values: raw.values ?? legacy.tenants ?? [],
    capabilities: (raw.capabilities ?? []).map((row) => {
      const { tenants, ...rest } = row as LegacyCapabilityRow;
      return { ...rest, values: row.values ?? tenants ?? {} };
    }),
    references: raw.references ?? legacy.tenantReferences ?? [],
    ...(raw.registryMismatch !== undefined ? { registryMismatch: raw.registryMismatch } : {}),
  };
}

const POLARITIES = ["positive", "negative", "mixed"] as const;
type PolarityCounts = Record<(typeof POLARITIES)[number], number>;

/**
 * Identity of an axis gate: where it lives and what it decides — never its
 * line, never its text.
 *
 * Keying on position would report every gate below an added import, and every
 * rewrite that decides exactly the same thing. Both are noise, and a report that
 * fires on noise is a report nobody reads.
 */
const gateKey = (r: AxisReference): string => `${r.file}|${r.codes.join(",")}|${r.kind}`;

/** `positive, negative x2` — what the gate decides, and in how many places. */
function summarise(counts: PolarityCounts): string {
  return POLARITIES.filter((p) => counts[p] > 0)
    .map((p) => (counts[p] > 1 ? `${p} x${counts[p]}` : p))
    .join(", ");
}

/** Everything one gate key carries: its identity fields, plus the tally of every reference sharing that key. */
interface GateGroup {
  readonly file: string;
  readonly codes: readonly string[];
  readonly kind: AxisReference["kind"];
  readonly counts: PolarityCounts;
}

function gateGroups(m: PreviousMap | ModuleMap): Map<string, GateGroup> {
  const out = new Map<string, GateGroup>();
  for (const r of m.references) {
    const key = gateKey(r);
    const existing = out.get(key);
    const counts = existing?.counts ?? { positive: 0, negative: 0, mixed: 0 };
    counts[r.polarity] += 1;
    out.set(key, { file: r.file, codes: r.codes, kind: r.kind, counts });
  }
  return out;
}

/**
 * A fact that names something a module could have declared it documents —
 * `documents.paths` joins a `gate` fact by `file`, `documents.flags` joins a
 * `capability` fact by `flag` (see `packages/cli/src/coverage.ts`).
 */
export type JoinableFact =
  | {
      readonly kind: "capability";
      readonly change: "added" | "removed" | "changed";
      readonly flag: string;
      readonly was?: readonly string[];
      readonly now?: readonly string[];
    }
  | {
      readonly kind: "gate";
      readonly change: "added" | "removed" | "changed";
      readonly file: string;
      readonly codes: readonly string[];
      readonly gateKind: AxisReference["kind"];
      readonly was?: string;
      readonly now?: string;
    };

/**
 * A fact no module documents, because it is true of the whole manual.
 *
 * Separated in the TYPE rather than filtered at runtime: a consumer that only
 * accepts `JoinableFact[]` cannot be handed a `ManualWideFact` by mistake —
 * that would be a type error instead of a judgement somebody has to remember
 * to make (see `packages/cli/src/coverage.ts`, `joinCoverage`).
 */
export type ManualWideFact =
  | { readonly kind: "axis-changed"; readonly before: string; readonly after: string }
  | {
      readonly kind: "axis-value";
      readonly change: "added" | "removed";
      readonly axis: string;
      readonly id: string;
    };

export type DriftFact = JoinableFact | ManualWideFact;

/**
 * Every drift item `diffMaps` reports today, as structured facts rather than
 * pre-rendered strings — so a module's `documents:` can join against `file`
 * or `flag` directly instead of parsing a sentence back apart.
 *
 * Emission order matches `diffMaps`'s today, exactly, because that order is
 * part of the additivity proof (MUF-302): axis values added then removed;
 * capabilities by iterating `after` for added/changed, then `before` for
 * removed; gates the same way.
 */
export function diffFacts(rawBefore: PreviousMap, after: ModuleMap): readonly DriftFact[] {
  const before = normalizeMap(rawBefore);

  // A map repointed at a different axis is not a diff, it is a different
  // question: every value and every gate below it means something else, so
  // pairing them up would produce a page of changes describing nothing that
  // happened. An absent axis is not a change — see `normalizeMap`.
  if (before.axis !== undefined && before.axis !== after.axis) {
    return [{ kind: "axis-changed", before: before.axis, after: after.axis }];
  }

  const axis = after.axis;
  const out: DriftFact[] = [];

  const ids = (m: PreviousMap | ModuleMap) => new Set(m.values.map((v) => v.id));
  for (const id of ids(after)) {
    if (!ids(before).has(id)) out.push({ kind: "axis-value", change: "added", axis, id });
  }
  for (const id of ids(before)) {
    if (!ids(after).has(id)) out.push({ kind: "axis-value", change: "removed", axis, id });
  }

  const byFlag = (m: PreviousMap | ModuleMap) => new Map(m.capabilities.map((c) => [c.flag, c]));
  const b = byFlag(before);
  const a = byFlag(after);
  for (const [flag, row] of a) {
    const old = b.get(flag);
    if (!old) {
      out.push({ kind: "capability", change: "added", flag, now: row.enabledFor });
      continue;
    }
    const was = old.enabledFor.join(",");
    const now = row.enabledFor.join(",");
    if (was !== now) {
      out.push({
        kind: "capability",
        change: "changed",
        flag,
        was: old.enabledFor,
        now: row.enabledFor,
      });
    }
  }
  for (const flag of b.keys()) if (!a.has(flag)) out.push({ kind: "capability", change: "removed", flag });

  const gatesBefore = gateGroups(before);
  const gatesAfter = gateGroups(after);
  for (const [key, now] of gatesAfter) {
    const was = gatesBefore.get(key);
    if (!was) {
      out.push({
        kind: "gate",
        change: "added",
        file: now.file,
        codes: now.codes,
        gateKind: now.kind,
        now: summarise(now.counts),
      });
      continue;
    }
    const wasText = summarise(was.counts);
    const nowText = summarise(now.counts);
    if (wasText !== nowText) {
      out.push({
        kind: "gate",
        change: "changed",
        file: now.file,
        codes: now.codes,
        gateKind: now.kind,
        was: wasText,
        now: nowText,
      });
    }
  }
  for (const [key, was] of gatesBefore) {
    if (!gatesAfter.has(key)) {
      out.push({
        kind: "gate",
        change: "removed",
        file: was.file,
        codes: was.codes,
        gateKind: was.kind,
      });
    }
  }

  return out;
}

/**
 * Render one `DriftFact` as `diffMaps` renders it today. Byte-identical is the
 * additivity proof (MUF-302) — if one string moves by a character, the
 * refactor is rejected, not the test.
 */
export function describeDrift(fact: DriftFact): string {
  if (fact.kind === "axis-changed") {
    return (
      `axis changed: ${fact.before} -> ${fact.after} — every value and gate below ` +
      `it answers a different question, so nothing under it was compared. ` +
      `Review the content's tagging against the new axis in full.`
    );
  }

  if (fact.kind === "axis-value") {
    return `${fact.axis} ${fact.change}: ${fact.id}`;
  }

  if (fact.kind === "capability") {
    if (fact.change === "added") {
      return `capability added: ${fact.flag} (on for ${fact.now?.join(", ") || "nobody"})`;
    }
    if (fact.change === "changed") {
      return (
        `capability changed: ${fact.flag} was on for [${fact.was?.join(",") || "nobody"}], ` +
        `now [${fact.now?.join(",") || "nobody"}] — content tagged on this may be wrong`
      );
    }
    return `capability removed: ${fact.flag}`;
  }

  const gate = `${fact.file} — ${fact.codes.join(",")} (${fact.gateKind})`;
  if (fact.change === "added") return `gating added: ${gate} — ${fact.now}`;
  if (fact.change === "changed") {
    return `gating changed: ${gate} — was ${fact.was}, now ${fact.now} — content tagged on this may be wrong`;
  }
  return `gating removed: ${gate}`;
}

/**
 * Compare two maps and report what moved.
 *
 * This diff IS the drift report, and it is the reason to regenerate the map at
 * all: a capability that changed hands means tagging in the content may now be
 * wrong, and nothing else in the pipeline can notice that.
 *
 * Gates are compared for the same reason and matter more often. Divergence is
 * mostly element-level — inline comparisons scattered through components — so a
 * gate that flips polarity invalidates tagging already written while every other
 * stage of the pipeline succeeds.
 *
 * Every line names the axis. `deployment added: supervisor` at a manual
 * conditioned on permissions is the same lie as printing that word on a cover.
 *
 * Kept as the exported name, signature and output (ADR-004): this line is
 * simultaneously the design and the additivity proof for `diffFacts`/`describeDrift`.
 */
export function diffMaps(rawBefore: PreviousMap, after: ModuleMap): readonly string[] {
  return diffFacts(rawBefore, after).map(describeDrift);
}

export interface ExtractResult {
  readonly map: ModuleMap;
  readonly drift: readonly string[];
  readonly outPath: string;
}

/**
 * Run the extraction for one manual.
 *
 * Takes the MANUAL id rather than the source id, matching `build` and `images`,
 * and reads which source it documents from its own config. One manual documents
 * one product; the reverse is not guaranteed.
 */
/** A manual's source product, resolved through the registry. */
export interface ResolvedSource {
  readonly sourceId: string;
  /** Absolute path to the product checkout. READ-ONLY. */
  readonly sourceRoot: string;
  readonly entry: z.infer<typeof registrySchema>["sources"][string];
}

/**
 * Where the product a manual documents actually lives.
 *
 * Shared rather than repeated: every command that reads the source has to agree
 * about which checkout that is, and two readers of the registry are two places
 * for the answer to differ.
 */
export function sourceRootFor(repoRoot: string, manualId: string): ResolvedSource {
  const manualDir = join(repoRoot, "manuals", manualId);
  const manualConfig = parseYaml(readFileSync(join(manualDir, "manual.config.yaml"), "utf8")) as {
    manual?: { source?: string };
  };
  const sourceId = manualConfig.manual?.source;
  if (!sourceId) {
    throw new Error(
      `manuals/${manualId}/manual.config.yaml declares no \`manual.source\`, so there ` +
        `is no way to know which product it documents.`,
    );
  }

  const registryFile = join(repoRoot, "sources", "registry.yaml");
  const registry = registrySchema.parse(parseYaml(readFileSync(registryFile, "utf8")));
  const entry = registry.sources[sourceId];
  if (!entry) {
    throw new Error(
      `sources/registry.yaml has no source "${sourceId}". Add it there before ` +
        `reading the product: the registry is what says where it lives and which ` +
        `files to read.`,
    );
  }

  const sourceRoot = join(repoRoot, entry.path);
  if (!existsSync(sourceRoot)) {
    throw new Error(
      `the source repository is not at "${entry.path}" (resolved to ${sourceRoot}). ` +
        `\`path\` in sources/registry.yaml is relative to this repository's root.`,
    );
  }

  return { sourceId, sourceRoot, entry };
}

export function extract(repoRoot: string, manualId: string): ExtractResult {
  const manualDir = join(repoRoot, "manuals", manualId);
  const manualConfig = parseYaml(readFileSync(join(manualDir, "manual.config.yaml"), "utf8")) as {
    axes?: Record<string, { values?: Array<{ id?: string }> }>;
  };
  const { sourceId, sourceRoot, entry } = sourceRootFor(repoRoot, manualId);

  // --- the product's own registry of axis values ---------------------------
  //
  // Refused rather than answered with an empty map. `values: []` is not the
  // absence of a claim, it IS a claim — that the product ships one deployment —
  // and content conditioned on it would be wrong in the direction nobody checks.
  // The honest outcome for a product this extractor cannot read is no map.
  //
  // This comes BEFORE the manual's axis is derived, deliberately: a manual
  // documenting a product this extractor cannot read must hear that, not a
  // complaint about its own axes. Its axes are fine; the extractor is the thing
  // that does not fit.
  const configGlob = entry.extract.tenantConfigs;
  if (configGlob === undefined) {
    throw new Error(
      `the registry entry for "${sourceId}" declares no \`tenantConfigs\`, so this ` +
        `extractor has no tenant registry to read. That is a legitimate product ` +
        `shape: tenancy can be resolved server-side and never appear in the ` +
        `client repository at all. It is also the "needs a new extractor" verdict ` +
        `that step 2 of "Adding a source" asks for — the seam is \`framework\` in ` +
        `sources/registry.yaml, described in packages/extract/AGENTS.md. Nothing ` +
        `was written: content can still be authored against facts cited from the ` +
        `source by file and line, on whichever axis actually varies.`,
    );
  }
  const configDir = join(sourceRoot, configGlob.slice(0, configGlob.lastIndexOf("/")));
  if (!existsSync(configDir)) {
    throw new Error(
      `\`tenantConfigs\` points at "${configGlob}", but that directory does not ` +
        `exist in the source repository (looked in ${configDir}). The entry ` +
        `describes a shape this product does not have — survey the product and ` +
        `fix the entry, rather than widening the glob until something matches. ` +
        `Widening it is how a build ends up reporting a tenant for every stray ` +
        `config file in the repository.`,
    );
  }

  // Derived from the manual, through the same rule the build uses, so the map
  // and the documents can never disagree about what this manual varies on.
  const axis = soleAxis(Object.keys(manualConfig.axes ?? {}));

  const configs: TenantConfig[] = readdirSync(configDir)
    .filter((f) => f.endsWith(".config.ts"))
    .map((f) => parseTenantConfig(f, readFileSync(join(configDir, f), "utf8")))
    .sort((x, y) => x.id.localeCompare(y.id));
  if (configs.length === 0) {
    throw new Error(`no \`*.config.ts\` found in ${configDir} — the tenant registry is empty.`);
  }

  // --- axis references in code ---------------------------------------------
  const codes = configs.map((c) => c.code);
  const scanRoots = [entry.extract.components, entry.extract.pages].map((p) => join(sourceRoot, p));
  const references: AxisReference[] = [];
  for (const root of scanRoots) {
    for (const file of walkFiles(root)) {
      const rel = relative(sourceRoot, file).split(sep).join(posix.sep);
      references.push(...findTenantReferences(rel, readFileSync(file, "utf8"), codes));
    }
  }

  const declared = (manualConfig.axes?.[axis]?.values ?? [])
    .map((v) => v.id)
    .filter((id): id is string => typeof id === "string");
  const mismatch = reconcileAxisValues(axis, configs.map((c) => c.id), declared);

  const map: ModuleMap = {
    source: sourceId,
    axis,
    values: configs.map((c) => ({
      id: c.id,
      code: c.code,
      source: `${configGlob.slice(0, configGlob.lastIndexOf("/"))}/${c.source}`,
    })),
    capabilities: capabilityMatrix(configs),
    references,
    ...(mismatch.length > 0 ? { registryMismatch: mismatch } : {}),
  };

  const outPath = join(manualDir, "knowledge", "module-map.json");
  const drift = existsSync(outPath)
    ? diffMaps(JSON.parse(readFileSync(outPath, "utf8")) as PreviousMap, map)
    : [];

  mkdirSync(join(manualDir, "knowledge"), { recursive: true });
  // No timestamp: the map is regenerated constantly and a clock would make every
  // regeneration a diff, drowning the drift this file exists to show.
  writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");

  return { map, drift, outPath };
}
