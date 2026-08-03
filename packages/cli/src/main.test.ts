import { describe, expect, it, vi } from "vitest";
import {
  axisValueName,
  formatCliError,
  manualConfigSchema,
  parseAxisFilters,
  run,
  type ManualConfig,
} from "./main.ts";

const baseConfig: ManualConfig = {
  manual: { id: "m", title: "Manual", product: "P", contentVersion: "0.1.0" },
  axes: {
    tenant: { values: [{ id: "mv", name: "Movilidad Medellín" }] },
  },
  targets: [{ tenant: "mv" }],
  output: { dir: "output", filename: "x.pdf" },
};

describe("parseAxisFilters", () => {
  it("parses --tenant as shorthand for the tenant axis", () => {
    expect(parseAxisFilters(["--tenant", "mv"])).toEqual(new Map([["tenant", "mv"]]));
  });

  it("parses a general --axis <name>=<value> flag", () => {
    expect(parseAxisFilters(["--axis", "role=operator"])).toEqual(
      new Map([["role", "operator"]]),
    );
  });

  it("supports repeated --axis flags for multiple axes", () => {
    expect(parseAxisFilters(["--axis", "tenant=mv", "--axis", "role=operator"])).toEqual(
      new Map([
        ["tenant", "mv"],
        ["role", "operator"],
      ]),
    );
  });

  it("returns an empty map when no filter flag is given", () => {
    expect(parseAxisFilters([])).toEqual(new Map());
  });

  it("rejects an --axis value with no `=`", () => {
    expect(() => parseAxisFilters(["--axis", "tenant"])).toThrow();
  });
});

describe("manualConfigSchema", () => {
  it("accepts a well-formed config", () => {
    expect(manualConfigSchema.safeParse(baseConfig).success).toBe(true);
  });

  it("rejects a config missing required manual fields", () => {
    const bad = { ...baseConfig, manual: { id: "m" } };
    expect(manualConfigSchema.safeParse(bad).success).toBe(false);
  });

  it("requires every target to declare a value for every declared axis", () => {
    const bad: ManualConfig = {
      ...baseConfig,
      axes: {
        tenant: { values: [{ id: "mv", name: "Movilidad Medellín" }] },
        role: { values: [{ id: "operator", name: "Operador" }] },
      },
      // Missing `role` — must be a hard error, not a permissive default that
      // leaves the `role` axis unconstrained and merges every role together.
      targets: [{ tenant: "mv" }],
    };
    expect(manualConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe("axisValueName", () => {
  it("resolves the declared display name for an axis value", () => {
    expect(axisValueName(baseConfig, "tenant", "mv")).toBe("Movilidad Medellín");
  });

  it("throws instead of falling back to a stringified id for an unresolved value", () => {
    // A client-facing PDF must never print a literal "undefined" or raw id.
    expect(() => axisValueName(baseConfig, "tenant", "unknown-id")).toThrow();
  });
});

describe("formatCliError", () => {
  it("formats a plain Error into an actionable message, not a raw stack trace", () => {
    const message = formatCliError(new Error("--tenant requires a value"));
    expect(message).toBe("error: --tenant requires a value");
    expect(message).not.toContain("\n    at ");
  });
});

describe("run", () => {
  it("turns a bad --tenant invocation (a plain CLI typo) into a formatted error, not an uncaught stack trace", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      // `parseAxisFilters` throws a plain `Error` here — it must be caught
      // by `run()`'s guarded region, not escape as a raw stack trace.
      const exitCode = await run(["build", "some-manual", "--tenant"]);
      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("error: --tenant requires a value"),
      );
      for (const call of errorSpy.mock.calls) {
        expect(String(call[0])).not.toContain("\n    at ");
      }
    } finally {
      errorSpy.mockRestore();
    }
  });
});
