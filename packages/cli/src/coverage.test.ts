import { describe, expect, it } from "vitest";
import type { DocumentedFlag, DocumentedPath, DocumentsDeclaration } from "@broadsec-manual/core";
import type { JoinableFact, ManualWideFact } from "./extract.ts";
import { joinCoverage, type ModuleInput } from "./coverage.ts";

/**
 * `joinCoverage` — declarations x joinable facts -> per-module coverage
 * (ADR-007). Pure, no filesystem: every fixture below is handed in directly,
 * the way `packages/cli/src/extract.test.ts` hands `diffFacts` its maps.
 */

const path = (over: Partial<DocumentedPath> = {}): DocumentedPath =>
  ({ kind: "file", path: "src/render/components/AddObservation.tsx", ...over }) as DocumentedPath;

const flag = (over: Partial<DocumentedFlag> = {}): DocumentedFlag => ({
  flag: "canSeeBoT",
  ...over,
});

const declaration = (over: Partial<DocumentsDeclaration> = {}): DocumentsDeclaration => ({
  declaredIn: "sections/12-broadsec-of-things.yaml",
  section: "broadsec-of-things",
  paths: [],
  flags: [],
  ...over,
});

const module_ = (over: Partial<ModuleInput> = {}): ModuleInput => ({
  module: "sections/12-broadsec-of-things.yaml",
  documents: undefined,
  baseline: null,
  ...over,
});

const gateFact = (over: Partial<Extract<JoinableFact, { kind: "gate" }>> = {}): JoinableFact => ({
  kind: "gate",
  change: "changed",
  file: "src/render/components/AddObservation.tsx",
  codes: ["MV"],
  gateKind: "inline",
  was: "positive",
  now: "negative",
  ...over,
});

const capabilityFact = (
  over: Partial<Extract<JoinableFact, { kind: "capability" }>> = {},
): JoinableFact => ({
  kind: "capability",
  change: "added",
  flag: "canSeeBoT",
  now: ["mv"],
  ...over,
});

const SCAN_ROOTS = ["src/render/components", "src/render/pages"];

interface ContextOverrides {
  readonly manualWide?: readonly ManualWideFact[];
  readonly scanRoots?: readonly string[];
  readonly baselineKeys?: readonly string[];
}

const context = (over: ContextOverrides = {}) => ({
  manualWide: [] as readonly ManualWideFact[],
  scanRoots: SCAN_ROOTS,
  baselineKeys: [] as readonly string[],
  ...over,
});

describe("joinCoverage — match rules", () => {
  it("matches a `file` entry only on an exact path", () => {
    const modules = [
      module_({ documents: declaration({ paths: [path({ kind: "file", path: "a/b.tsx" })] }) }),
    ];
    const exact = gateFact({ file: "a/b.tsx" });
    const other = gateFact({ file: "a/c.tsx" });
    const report = joinCoverage(modules, [exact, other], context());
    expect(report.modules[0]?.entries[0]?.matched).toBe(1);
    expect(report.modules[0]?.facts).toEqual([exact]);
  });

  it("matches a `directory` entry by prefix, and does not let a sibling with a similar name leak in", () => {
    const modules = [
      module_({
        documents: declaration({
          paths: [path({ kind: "directory", path: "src/render/components/" })],
        }),
      }),
    ];
    const inside = gateFact({ file: "src/render/components/AddObservation.tsx" });
    // The exact defect a bare (non-trailing-slash) prefix would produce:
    // "components" as a string prefix also matches "components-old/…".
    const lookalike = gateFact({ file: "src/render/components-old/Foo.tsx" });
    const report = joinCoverage(modules, [inside, lookalike], context());
    expect(report.modules[0]?.entries[0]?.matched).toBe(1);
    expect(report.modules[0]?.facts).toEqual([inside]);
    expect(report.undeclared).toEqual([lookalike]);
  });

  it("matches a `glob` entry, and its `*` never crosses a `/`", () => {
    const modules = [
      module_({
        documents: declaration({
          paths: [path({ kind: "glob", path: "pages/BroadsecOfThings/*.tsx" })],
        }),
      }),
    ];
    const direct = gateFact({ file: "pages/BroadsecOfThings/Sidebar.tsx" });
    // `*` matching across a `/` would wrongly claim a file in a subdirectory.
    const nested = gateFact({ file: "pages/BroadsecOfThings/nested/Deep.tsx" });
    const report = joinCoverage(modules, [direct, nested], context());
    expect(report.modules[0]?.entries[0]?.matched).toBe(1);
    expect(report.modules[0]?.facts).toEqual([direct]);
    expect(report.undeclared).toEqual([nested]);
  });

  it("matches a `flag` entry by exact string, never a path-shaped fact", () => {
    const modules = [module_({ documents: declaration({ flags: [flag({ flag: "canSeeBoT" })] }) })];
    const matching = capabilityFact({ flag: "canSeeBoT" });
    const other = capabilityFact({ flag: "canViewFilterZone" });
    const report = joinCoverage(modules, [matching, other], context());
    expect(report.modules[0]?.entries[0]?.matched).toBe(1);
    expect(report.modules[0]?.facts).toEqual([matching]);
    expect(report.undeclared).toEqual([other]);
  });
});

describe("joinCoverage — the three states (MUF-306)", () => {
  it("reports `unknown` when the module declares no `documents:` at all", () => {
    const report = joinCoverage([module_({ documents: undefined })], [gateFact()], context());
    expect(report.modules[0]?.state).toBe("unknown");
    expect(report.modules[0]?.entries).toEqual([]);
    expect(report.modules[0]?.facts).toEqual([]);
  });

  it("reports `covered` when the module declares `documents:` and at least one fact matched", () => {
    const modules = [
      module_({ documents: declaration({ paths: [path({ kind: "file", path: "a/b.tsx" })] }) }),
    ];
    const report = joinCoverage(modules, [gateFact({ file: "a/b.tsx" })], context());
    expect(report.modules[0]?.state).toBe("covered");
  });

  it("reports `clean` when the module declares `documents:` and no fact matched", () => {
    const modules = [
      module_({ documents: declaration({ paths: [path({ kind: "file", path: "a/b.tsx" })] }) }),
    ];
    const report = joinCoverage(modules, [gateFact({ file: "z/unrelated.tsx" })], context());
    expect(report.modules[0]?.state).toBe("clean");
  });

  // Every module's `state` is drawn from a closed set. Guards against a
  // future refactor widening `state` to a plain `string` and reintroducing
  // "unaffected" — the exact word MUF-306 forbids.
  it("never reports a module's state as \"unaffected\"", () => {
    const modules = [module_({ documents: undefined })];
    const report = joinCoverage(modules, [gateFact()], context());
    for (const m of report.modules) {
      expect(["covered", "clean", "unknown"]).toContain(m.state);
      expect(m.state).not.toBe("unaffected");
    }
  });
});

describe("joinCoverage — multiplicity (MUF-304)", () => {
  it("reports one fact under every matching module, never picking one", () => {
    const shared = gateFact({ file: "src/render/components/Shared.tsx" });
    const modules = [
      module_({
        module: "sections/07-interfaz-general.yaml",
        documents: declaration({
          declaredIn: "sections/07-interfaz-general.yaml",
          paths: [path({ kind: "directory", path: "src/render/components/" })],
        }),
      }),
      module_({
        module: "sections/12-broadsec-of-things.yaml",
        documents: declaration({
          paths: [path({ kind: "file", path: "src/render/components/Shared.tsx" })],
        }),
      }),
    ];
    const report = joinCoverage(modules, [shared], context());
    expect(report.modules[0]?.facts).toEqual([shared]);
    expect(report.modules[1]?.facts).toEqual([shared]);
    expect(report.modules[0]?.state).toBe("covered");
    expect(report.modules[1]?.state).toBe("covered");
    // A fact matched by two modules is not double-counted as undeclared —
    // it is not undeclared at all.
    expect(report.undeclared).toEqual([]);
  });
});

describe("joinCoverage — undeclared coverage (MUF-305)", () => {
  it("reports a fact matched by no module's entries under `undeclared`, and preserves the total count", () => {
    const modules = [
      module_({ documents: declaration({ paths: [path({ kind: "file", path: "a/b.tsx" })] }) }),
    ];
    const matched = gateFact({ file: "a/b.tsx" });
    const unmatched = gateFact({ file: "z/gone.tsx" });
    const report = joinCoverage(modules, [matched, unmatched], context());
    expect(report.undeclared).toEqual([unmatched]);
    // N facts total, M matched by at least one module -> exactly N - M undeclared.
    const totalMatched = new Set(report.modules.flatMap((m) => m.facts)).size;
    expect(totalMatched + report.undeclared.length).toBe(2);
  });
});

describe("joinCoverage — per-entry counts and `joinable` (ADR-007)", () => {
  it("reports a `matched` count of every fact an entry claims, not merely whether any matched", () => {
    const modules = [
      module_({
        documents: declaration({
          paths: [path({ kind: "directory", path: "src/render/components/" })],
        }),
      }),
    ];
    const facts = [
      gateFact({ file: "src/render/components/A.tsx" }),
      gateFact({ file: "src/render/components/B.tsx" }),
      gateFact({ file: "src/render/components/C.tsx" }),
    ];
    const report = joinCoverage(modules, facts, context());
    expect(report.modules[0]?.entries[0]?.matched).toBe(3);
  });

  it("marks an entry `joinable: false` when its path lies outside every scanned root", () => {
    const modules = [
      module_({
        documents: declaration({
          paths: [path({ kind: "file", path: "routes/AppRoutes.tsx" })],
        }),
      }),
    ];
    const report = joinCoverage(modules, [], context());
    expect(report.modules[0]?.entries[0]?.joinable).toBe(false);
  });

  it("marks an entry `joinable: true` when its path lies inside a scanned root, even with zero matches", () => {
    const modules = [
      module_({
        documents: declaration({
          paths: [path({ kind: "file", path: "src/render/components/Never.tsx" })],
        }),
      }),
    ];
    const report = joinCoverage(modules, [], context());
    expect(report.modules[0]?.entries[0]?.joinable).toBe(true);
    expect(report.modules[0]?.entries[0]?.matched).toBe(0);
  });

  it("marks a `flag` entry always `joinable`, since it never depends on a scanned root", () => {
    const modules = [module_({ documents: declaration({ flags: [flag()] }) })];
    const report = joinCoverage(modules, [], context());
    expect(report.modules[0]?.entries[0]?.joinable).toBe(true);
  });
});

describe("joinCoverage — stale baselines (ADR-001)", () => {
  it("reports a baseline key with no matching section file as stale", () => {
    const modules = [module_({ module: "sections/07-interfaz-general.yaml" })];
    const report = joinCoverage(
      modules,
      [],
      context({ baselineKeys: ["sections/07-interfaz-general.yaml", "sections/99-renamed.yaml"] }),
    );
    expect(report.staleBaselines).toEqual(["sections/99-renamed.yaml"]);
  });

  it("reports no stale entry when every baseline key still has a section file", () => {
    const modules = [module_({ module: "sections/07-interfaz-general.yaml" })];
    const report = joinCoverage(
      modules,
      [],
      context({ baselineKeys: ["sections/07-interfaz-general.yaml"] }),
    );
    expect(report.staleBaselines).toEqual([]);
  });
});

describe("joinCoverage — manual-wide facts pass through untouched", () => {
  it("echoes manual-wide facts on the report without attempting to join them to a module", () => {
    const manualWide = [{ kind: "axis-value", change: "added", axis: "tenant", id: "med" } as const];
    const report = joinCoverage([module_()], [], { ...context(), manualWide });
    expect(report.manualWide).toEqual(manualWide);
  });
});
