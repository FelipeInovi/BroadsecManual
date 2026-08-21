import { describe, expect, it } from "vitest";
import { capabilityMatrix, parseTenantConfig } from "./tenant-config.ts";

const MV = `export default {
  name: "MV",
  basePath: "mv",
  title: "Traffic Dashboard",
  apiURL: "https://medellin.inovisec.com",
  canViewFilterZone: true,
  canViewFilterUNP: false,
  canSeeBoT: true,
};
`;

describe("parseTenantConfig", () => {
  it("takes the tenant code from the config, never from the filename", () => {
    // The manual's axis ids are lowercase; the product's own code is not. Only
    // the file says which is which, so both are recorded.
    const c = parseTenantConfig("mv.config.ts", MV);
    expect(c.id).toBe("mv");
    expect(c.code).toBe("MV");
    expect(c.source).toBe("mv.config.ts:2");
  });

  it("records every boolean flag with the line it came from", () => {
    const c = parseTenantConfig("mv.config.ts", MV);
    expect(c.flags["canViewFilterZone"]).toEqual({ value: true, line: 6 });
    expect(c.flags["canViewFilterUNP"]).toEqual({ value: false, line: 7 });
    expect(c.flags["canSeeBoT"]).toEqual({ value: true, line: 8 });
  });

  it("ignores non-boolean settings — a URL is not a capability", () => {
    const c = parseTenantConfig("mv.config.ts", MV);
    expect(Object.keys(c.flags).sort()).toEqual([
      "canSeeBoT",
      "canViewFilterUNP",
      "canViewFilterZone",
    ]);
  });

  it("accepts a flag whose line has no trailing comma", () => {
    const c = parseTenantConfig("x.config.ts", `export default {\n  name: "X",\n  canSeeBoT: true\n};`);
    expect(c.flags["canSeeBoT"]?.value).toBe(true);
  });

  it("refuses a config with no name — the code is not optional", () => {
    expect(() => parseTenantConfig("x.config.ts", `export default { basePath: "x" };`)).toThrow(
      /name/,
    );
  });
});

describe("capabilityMatrix", () => {
  const withFlags = (id: string, code: string, flags: Record<string, boolean>) =>
    parseTenantConfig(
      `${id}.config.ts`,
      `export default {\n  name: "${code}",\n` +
        Object.entries(flags)
          .map(([k, v]) => `  ${k}: ${v},`)
          .join("\n") +
        `\n};`,
    );

  it("puts one row per flag and one column per axis value", () => {
    const m = capabilityMatrix([
      withFlags("mv", "MV", { canSeeBoT: true }),
      withFlags("med", "MED", { canSeeBoT: false }),
    ]);
    const row = m.find((r) => r.flag === "canSeeBoT");
    expect(row?.values["mv"]?.value).toBe(true);
    expect(row?.values["med"]?.value).toBe(false);
  });

  // The hazard this exists to surface: `med` declares 92 settings and `mv` 47,
  // so a flag simply missing from one config is routine — and it is NOT `false`.
  // Treating absent as off would silently claim a deployment lacks a feature.
  it("marks a flag absent from a config as absent, never as false", () => {
    const m = capabilityMatrix([
      withFlags("mv", "MV", { canSeeBoT: true }),
      withFlags("med", "MED", {}),
    ]);
    const row = m.find((r) => r.flag === "canSeeBoT");
    expect(row?.values["med"]).toBeUndefined();
    expect(row?.absentFrom).toEqual(["med"]);
  });

  it("says nothing is absent when every config declares the flag", () => {
    const m = capabilityMatrix([
      withFlags("mv", "MV", { canSeeBoT: true }),
      withFlags("med", "MED", { canSeeBoT: true }),
    ]);
    expect(m.find((r) => r.flag === "canSeeBoT")?.absentFrom).toBeUndefined();
  });

  it("names the tenants a capability is on for, which is what content needs", () => {
    const m = capabilityMatrix([
      withFlags("mv", "MV", { canSeeBoT: true }),
      withFlags("med", "MED", { canSeeBoT: false }),
      withFlags("lv", "LV", { canSeeBoT: true }),
    ]);
    expect(m.find((r) => r.flag === "canSeeBoT")?.enabledFor).toEqual(["mv", "lv"]);
  });

  it("orders rows by flag name so two extractions of the same source diff cleanly", () => {
    const m = capabilityMatrix([withFlags("mv", "MV", { zeta: true, alpha: false })]);
    expect(m.map((r) => r.flag)).toEqual(["alpha", "zeta"]);
  });
});
