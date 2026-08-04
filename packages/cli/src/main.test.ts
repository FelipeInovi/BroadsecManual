import { describe, expect, it, vi } from "vitest";
import {
  axisValueName,
  formatCliError,
  imageRequests,
  manualConfigSchema,
  parseAxisFilters,
  parseOutPath,
  run,
  type ManualConfig,
  type TargetImages,
} from "./main.ts";

const baseConfig: ManualConfig = {
  manual: { id: "m", title: "Manual", product: "P", contentVersion: "0.1.0" },
  axes: {
    tenant: { values: [{ id: "mv", name: "Movilidad Medellín" }] },
  },
  targets: [{ tenant: "mv" }],
  output: { dir: "output", filename: "x.pdf" },
};

describe("parseOutPath", () => {
  // Not in `output/`: `.gitignore` excludes it, and this file is handed to
  // another team rather than regenerated per build.
  it("defaults next to the manual, outside the ignored output folder", () => {
    expect(parseOutPath([], "broadlineavida")).toBe("manuals/broadlineavida/image-requests.json");
  });

  it("takes an explicit --out", () => {
    expect(parseOutPath(["--out", "requests/x.json"], "m")).toBe("requests/x.json");
  });

  it("rejects --out with no value, and with a following flag", () => {
    expect(() => parseOutPath(["--out"], "m")).toThrow(/requires a path/);
    expect(() => parseOutPath(["--out", "--tenant"], "m")).toThrow(/requires a path/);
  });
});

describe("imageRequests", () => {
  const config: ManualConfig = {
    ...baseConfig,
    targets: [{ tenant: "mv" }, { tenant: "lv" }],
  };

  const target = (tenant: string, entries: TargetImages["entries"]): TargetImages => ({
    tenant,
    entries,
    undeclared: [],
  });

  const use = (nodeId: string, shows: string) => ({ nodeId, blockType: "icon-table", shows });

  it("lists one image once, naming every deployment that needs it", () => {
    const entry = { slot: "barra.busqueda", state: "pending" as const, uses: [use("barra.busqueda", "Buscar")] };
    const report = imageRequests(config, [target("mv", [entry]), target("lv", [entry])]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.["neededBy"]).toEqual(["mv", "lv"]);
  });

  it("says where a pending image goes — shared, with a per-deployment template", () => {
    const report = imageRequests(config, [
      target("mv", [{ slot: "barra.filtro.fig", state: "pending", uses: [use("barra.filtro.fig", "Filtros")] }]),
    ]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending[0]?.["deliverTo"]).toEqual({
      shared: "_common/barra/filtro/fig.png",
      override: "<tenant>/barra/filtro/fig.png",
    });
  });

  // Resolution is per deployment, so a tenant-specific delivery makes one slot
  // done for one deployment and outstanding for another. Reporting it as
  // finished would leave a deployment rendering the placeholder unnoticed.
  it("keeps a slot pending when only one deployment has the image", () => {
    const report = imageRequests(config, [
      target("mv", [
        { slot: "barra.busqueda", state: "tenant", file: "mv/barra/busqueda.png", uses: [use("barra.busqueda", "Buscar")] },
      ]),
      target("lv", [{ slot: "barra.busqueda", state: "pending", uses: [use("barra.busqueda", "Buscar")] }]),
    ]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.["pendingFor"]).toEqual(["lv"]);
    expect(pending[0]?.["files"]).toEqual(["mv/barra/busqueda.png"]);
    expect(report["counts"]).toEqual({ total: 1, delivered: 0, pending: 1 });
  });

  it("counts a slot delivered only when no deployment is missing it", () => {
    const entry = {
      slot: "barra.busqueda",
      state: "common" as const,
      file: "_common/barra/busqueda.png",
      uses: [use("barra.busqueda", "Buscar")],
    };
    const report = imageRequests(config, [target("mv", [entry]), target("lv", [entry])]);
    expect(report["counts"]).toEqual({ total: 1, delivered: 1, pending: 0 });
    expect(report["pending"]).toEqual([]);
  });

  it("deduplicates the places one shared image is used", () => {
    const entry = {
      slot: "compartido.buscar",
      state: "pending" as const,
      uses: [use("barra.busqueda", "Buscar"), use("paso.buscar", "Buscar el caso")],
    };
    const report = imageRequests(config, [target("mv", [entry]), target("lv", [entry])]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect((pending[0]?.["uses"] as unknown[]).map((u) => (u as { nodeId: string }).nodeId)).toEqual([
      "barra.busqueda",
      "paso.buscar",
    ]);
  });

  it("unions undeclared deliveries across deployments", () => {
    const report = imageRequests(config, [
      { tenant: "mv", entries: [], undeclared: ["barra.buscar"] },
      { tenant: "lv", entries: [], undeclared: ["barra.buscar", "otro.slot"] },
    ]);
    expect(report["undeclared"]).toEqual(["barra.buscar", "otro.slot"]);
  });

  it("omits the undeclared key entirely when every delivery is claimed", () => {
    const report = imageRequests(config, [target("mv", [])]);
    expect("undeclared" in report).toBe(false);
  });

  it("records which deployments the export actually covers", () => {
    const report = imageRequests(config, [target("mv", [])]);
    expect(report["deploymentsCovered"]).toEqual(["mv"]);
    expect(report["deploymentsConfigured"]).toBe(2);
  });
});

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
