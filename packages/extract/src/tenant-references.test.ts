import { describe, expect, it } from "vitest";
import { findTenantReferences } from "./tenant-references.ts";

const CODES = ["MV", "MED", "AMVA", "ANT", "LV", "DEMO"];
const find = (src: string) => findTenantReferences("LayersMap.tsx", src, CODES);

describe("findTenantReferences", () => {
  it("finds a direct comparison, with its line and the code it names", () => {
    const [r] = find(`const a = 1;\nif (config.name === "MV") show();`);
    expect(r?.file).toBe("LayersMap.tsx");
    expect(r?.line).toBe(2);
    expect(r?.codes).toEqual(["MV"]);
    expect(r?.polarity).toBe("positive");
  });

  it("finds every code on a disjunction — the real shape of the AVL gate", () => {
    const [r] = find(`(config.name === "MV" || config.name === "DEMO")`);
    expect(r?.codes).toEqual(["MV", "DEMO"]);
    expect(r?.polarity).toBe("positive");
  });

  it("records a negation as negative rather than flipping it", () => {
    const [r] = find(`config.name !== "MV" ? null : go()`);
    expect(r?.polarity).toBe("negative");
    expect(r?.codes).toEqual(["MV"]);
  });

  // Resolving the logic is exactly where a confident wrong fact would come from,
  // so a line carrying both polarities is reported as mixed and low confidence.
  it("flags a line mixing both polarities instead of deciding what it means", () => {
    const [r] = find(`config.name === "MV" && config.name !== "AMVA"`);
    expect(r?.polarity).toBe("mixed");
    expect(r?.confidence).toBe("low");
  });

  it("gives a single-polarity reference high confidence", () => {
    const [r] = find(`config.name === "MV"`);
    expect(r?.confidence).toBe("high");
  });

  it("separates a route-level gate from an inline comparison", () => {
    const refs = find(`<RouteAccess allowedProjects={["DEMO", "MV"]}>\nconfig.name === "MED"`);
    expect(refs[0]?.kind).toBe("route-gate");
    expect(refs[0]?.codes).toEqual(["DEMO", "MV"]);
    expect(refs[1]?.kind).toBe("inline");
  });

  // A code that is not a declared deployment is not a deployment. Accepting it
  // would let the map invent tenants that no config backs.
  it("ignores a comparison against something that is not a declared deployment", () => {
    expect(find(`config.name === "SOMEWHERE"`)).toEqual([]);
  });

  it("ignores a commented-out gate, which gates nothing", () => {
    expect(find(`// if (config.name === "MV") show();`)).toEqual([]);
    expect(find(` * config.name === "MV"`)).toEqual([]);
  });

  it("keeps the line's own text, so a reviewer can judge without opening the file", () => {
    const [r] = find(`   if (config.name === "MV") show();   `);
    expect(r?.text).toBe(`if (config.name === "MV") show();`);
  });

  it("reports each line once, however many comparisons it carries", () => {
    expect(find(`config.name === "MV" || config.name === "MED"`)).toHaveLength(1);
  });

  it("finds a tenant-keyed membership check", () => {
    const [r] = find(`["MV", "DEMO"].includes(config.name)`);
    expect(r?.codes).toEqual(["MV", "DEMO"]);
    expect(r?.kind).toBe("inline");
  });

  it("returns nothing for a file that never mentions a deployment", () => {
    expect(find(`export const x = 1;\nconst y = "hello";`)).toEqual([]);
  });
});
