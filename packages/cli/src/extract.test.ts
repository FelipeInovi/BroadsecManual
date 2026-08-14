import { describe, expect, it } from "vitest";
import type { CapabilityRow, TenantReference } from "@broadsec-manual/extract";
import { diffMaps, type ModuleMap } from "./extract.ts";

const ref = (over: Partial<TenantReference> = {}): TenantReference => ({
  file: "src/render/components/AddObservation.tsx",
  line: 133,
  codes: ["MV"],
  polarity: "positive",
  kind: "inline",
  text: 'config.name === "MV"',
  confidence: "high",
  ...over,
});

const cap = (over: Partial<CapabilityRow> = {}): CapabilityRow => ({
  flag: "canSeeBoT",
  tenants: { mv: { value: true, line: 12 } },
  enabledFor: ["mv"],
  ...over,
});

const map = (over: Partial<ModuleMap> = {}): ModuleMap => ({
  source: "broadlineavida",
  tenants: [{ id: "mv", code: "MV", source: "src/render/config/mv.config.ts:2" }],
  capabilities: [],
  tenantReferences: [],
  ...over,
});

const report = (before: ModuleMap, after: ModuleMap) => diffMaps(before, after).join("\n");

describe("diffMaps — deployments and capabilities", () => {
  it("reports a deployment the product gained", () => {
    const after = map({
      tenants: [...map().tenants, { id: "med", code: "MED", source: "med.config.ts:2" }],
    });
    expect(report(map(), after)).toContain("deployment added: med");
  });

  it("reports a deployment the product lost", () => {
    const before = map({
      tenants: [...map().tenants, { id: "med", code: "MED", source: "med.config.ts:2" }],
    });
    expect(report(before, map())).toContain("deployment removed: med");
  });

  it("reports a capability that changed hands, naming both sides", () => {
    const before = map({ capabilities: [cap()] });
    const after = map({ capabilities: [cap({ enabledFor: ["mv", "med"] })] });
    const out = report(before, after);
    expect(out).toContain("capability changed: canSeeBoT");
    expect(out).toContain("was on for [mv]");
    expect(out).toContain("now [mv,med]");
  });

  it("says nothing when neither moved", () => {
    expect(diffMaps(map({ capabilities: [cap()] }), map({ capabilities: [cap()] }))).toEqual([]);
  });
});

describe("diffMaps — deployment gates", () => {
  // The reason this comparison exists. Divergence in the product is mostly
  // element-level: a gate that flips polarity silently invalidates tenant
  // tagging already written, and no other stage of the pipeline can notice.
  it("reports a gate that flipped polarity", () => {
    const before = map({ tenantReferences: [ref({ polarity: "negative" })] });
    const after = map({ tenantReferences: [ref({ polarity: "positive" })] });
    const out = report(before, after);
    expect(out).toContain("gating changed");
    expect(out).toContain("AddObservation.tsx");
    expect(out).toContain("was negative, now positive");
    expect(out).toContain("content tagged on this may be wrong");
  });

  it("reports a gate that appeared in a file that had none", () => {
    const after = map({
      tenantReferences: [ref({ file: "src/render/pages/Dashboard/CallAI.tsx", codes: ["MED"] })],
    });
    const out = report(map(), after);
    expect(out).toContain("gating added");
    expect(out).toContain("CallAI.tsx");
    expect(out).toContain("MED");
  });

  it("reports a gate that disappeared", () => {
    const before = map({ tenantReferences: [ref()] });
    expect(report(before, map())).toContain("gating removed");
  });

  // The noise guard, and the reason a gate is not identified by its position.
  // Someone adding an import shifts every line below it; reporting that would
  // drown the drift this file exists to show.
  it("says nothing when a gate only moved down the file", () => {
    const before = map({ tenantReferences: [ref({ line: 133 })] });
    const after = map({ tenantReferences: [ref({ line: 134 })] });
    expect(diffMaps(before, after)).toEqual([]);
  });

  // Same decision, rewritten. The gate still names MV, still positively, still
  // inline — the manual's tagging is unaffected.
  it("says nothing when the line was reworded but decides the same thing", () => {
    const before = map({ tenantReferences: [ref({ text: 'config.name === "MV"' })] });
    const after = map({
      tenantReferences: [ref({ text: "useClosedReasonsList(config.name === \"MV\")", line: 180 })],
    });
    expect(diffMaps(before, after)).toEqual([]);
  });

  // A second identical gate in the same file is a new gated place, not a
  // duplicate to fold away: the count is part of what changed.
  it("reports a second gate added beside an identical one", () => {
    const before = map({ tenantReferences: [ref()] });
    const after = map({ tenantReferences: [ref(), ref({ line: 918 })] });
    const out = report(before, after);
    expect(out).toContain("gating changed");
    expect(out).toContain("now positive x2");
  });

  // Gates are told apart by what they decide, not only by where they live: two
  // deployments gated in one file are two facts.
  it("keeps gates in the same file apart when they name different deployments", () => {
    const before = map({ tenantReferences: [ref({ codes: ["MV"] }), ref({ codes: ["MED"] })] });
    const after = map({
      tenantReferences: [ref({ codes: ["MV"] }), ref({ codes: ["MED"], polarity: "negative" })],
    });
    const out = report(before, after);
    expect(out).toContain("MED");
    expect(out).toContain("was positive, now negative");
    expect(out).not.toContain("MV —");
  });

  it("tells a route gate apart from an inline comparison in the same file", () => {
    const before = map({ tenantReferences: [ref({ kind: "route-gate" })] });
    const after = map({ tenantReferences: [ref({ kind: "inline" })] });
    const out = report(before, after);
    expect(out).toContain("gating added");
    expect(out).toContain("gating removed");
  });
});
