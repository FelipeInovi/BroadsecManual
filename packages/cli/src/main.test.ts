import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalog } from "@broadsec-manual/blocks";
import type { ManualDocument, ManualNode } from "@broadsec-manual/blocks";
import { assemble } from "@broadsec-manual/core";
import { readBaselines, stampBaseline } from "./baselines.ts";
import {
  assertChangeLog,
  deliveryProofFor,
  deliveredVersion,
  axisValueName,
  draftFilename,
  formatCliError,
  formatStaleReleaseNotesMessage,
  formatVersionMismatchMessage,
  imageRequests,
  manualConfigSchema,
  narrowHidden,
  outputFilename,
  reportStaleReleaseNotes,
  resolveTargetImages,
  workFilename,
  parseAxisFilters,
  parseOutPath,
  primaryAxis,
  releaseDate,
  releaseLede,
  releaseNotesFile,
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

describe("draftFilename", () => {
  // A draft carries slot paths, which invariant 4 keeps out of client-facing
  // output. The two files must not be distinguishable only by their contents.
  it("marks the draft before the extension", () => {
    expect(draftFilename("manual-operador-mv-v0.1.0.pdf")).toBe(
      "manual-operador-mv-v0.1.0-BORRADOR.pdf",
    );
  });

  it("appends when there is no extension", () => {
    expect(draftFilename("manual")).toBe("manual-BORRADOR");
  });

  // A version number is full of dots; the mark belongs before the LAST one.
  it("uses the last dot, not the first", () => {
    expect(draftFilename("a.b.c.pdf")).toBe("a.b.c-BORRADOR.pdf");
  });

  it("leaves a dotfile alone rather than splitting on its leading dot", () => {
    expect(draftFilename(".hidden")).toBe(".hidden-BORRADOR");
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
    indexed: entries.map((e) => e.slot),
  });

  const use = (nodeId: string, shows: string) => ({ nodeId, blockType: "icon-table", shows });

  it("lists one image once, naming every deployment that needs it", () => {
    const entry = { slot: "barra.busqueda", state: "pending" as const, uses: [use("barra.busqueda", "Buscar")] };
    const report = imageRequests(config, [target("mv", [entry]), target("lv", [entry])]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending).toHaveLength(1);
    expect(pending[0]?.["neededBy"]).toEqual(["mv", "lv"]);
  });

  // Flat, with the slot's dots kept in the filename, even though the resolver
  // accepts the same slot as a folder tree. The manifest is read by people
  // outside this repository who are handed a list and a folder, and asking them
  // to rebuild a directory structure from dotted names is how a file ends up one
  // level too deep and silently resolves to nothing.
  it("says where a pending image goes — one flat shared name, plus a per-deployment template", () => {
    const report = imageRequests(config, [
      target("mv", [{ slot: "barra.filtro.fig", state: "pending", uses: [use("barra.filtro.fig", "Filtros")] }]),
    ]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending[0]?.["deliverTo"]).toEqual({
      shared: "_common/barra.filtro.fig.png",
      override: "<tenant>/barra.filtro.fig.png",
    });
  });

  // The manifest spells the convention out for a reader who has never seen this
  // repository, and it spelled it out in tenant language whatever the manual was
  // conditioned on. The axis's own `label` is what the config author already
  // wrote to describe it to a human, so the document borrows that.
  it("describes the per-target folder in the manual's own words", () => {
    const byPermission: ManualConfig = {
      ...baseConfig,
      axes: { permission: { label: "Permission profile", values: [{ id: "todas", name: "Todas" }] } },
      targets: [{ permission: "todas" }],
    };
    const report = imageRequests(byPermission, [
      target("todas", [{ slot: "seatmap.fig", state: "pending", uses: [use("seatmap.fig", "Seatmap")] }]),
    ]);
    const convention = report["convention"] as Record<string, unknown>;
    expect((convention["resolution"] as string[])[0]).toBe(
      "<permission>/<slot path>.<ext> — an image made for that one permission profile",
    );
  });

  it("leaves the shipping manual's wording exactly as it was", () => {
    const byTenant: ManualConfig = {
      ...baseConfig,
      axes: { tenant: { label: "Deployment", values: [{ id: "mv", name: "MV" }] } },
      targets: [{ tenant: "mv" }],
    };
    const report = imageRequests(byTenant, [
      target("mv", [{ slot: "barra.fig", state: "pending", uses: [use("barra.fig", "Barra")] }]),
    ]);
    const convention = report["convention"] as Record<string, unknown>;
    expect((convention["resolution"] as string[])[0]).toBe(
      "<tenant>/<slot path>.<ext> — an image made for that one deployment",
    );
  });

  // The template names a FOLDER, and the folder is named after the axis value.
  // For a manual conditioned on anything but tenants it named a directory that
  // will never exist, in a document handed to the team doing the delivering.
  it("names the override folder after the manual's own axis", () => {
    const byPermission: ManualConfig = {
      ...baseConfig,
      axes: { permission: { values: [{ id: "todas", name: "Todas" }] } },
      targets: [{ permission: "todas" }],
    };
    const report = imageRequests(byPermission, [
      target("todas", [{ slot: "seatmap.fig", state: "pending", uses: [use("seatmap.fig", "Seatmap")] }]),
    ]);
    const pending = report["pending"] as Array<Record<string, unknown>>;
    expect(pending[0]?.["deliverTo"]).toEqual({
      shared: "_common/seatmap.fig.png",
      override: "<permission>/seatmap.fig.png",
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

  it("reports an image no deployment asked for", () => {
    const report = imageRequests(config, [
      { tenant: "mv", entries: [], indexed: ["barra.buscar"] },
      { tenant: "lv", entries: [], indexed: ["barra.buscar", "otro.slot"] },
    ]);
    expect(report["undeclared"]).toEqual(["barra.buscar", "otro.slot"]);
  });

  // The false positive that made the check worthless: a slot only ONE deployment
  // needs sits in the shared set, so every other deployment sees a file it never
  // asked for. Judged per deployment, every tenant-specific image was an orphan.
  it("does not report an image that only one deployment asked for", () => {
    const mvOnly = {
      slot: "mapa.capa.camaras",
      state: "common" as const,
      file: "_common/mapa/capa/camaras.webp",
      uses: [use("mapa.capa.camaras", "Cámaras")],
    };
    const report = imageRequests(config, [
      { tenant: "mv", entries: [mvOnly], indexed: ["mapa.capa.camaras"] },
      { tenant: "lv", entries: [], indexed: ["mapa.capa.camaras"] },
    ]);
    expect("undeclared" in report).toBe(false);
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

// The engine conditions on whatever axis a target names (`core/src/condition.ts`),
// and invariant 3 says tenant is one named axis among possible others. The CLI
// did not honour that: it asked for an axis literally called `tenant`, so a
// manual conditioned on permissions could not be built at all — and the only way
// to make it build was to call a permission profile a deployment on the cover,
// in the filename and in the figure folders.
describe("primaryAxis", () => {
  const withAxes = (axes: ManualConfig["axes"]): ManualConfig => ({ ...baseConfig, axes });

  it("is the only axis a manual declares, whatever it is called", () => {
    expect(primaryAxis(withAxes({ permission: { values: [{ id: "propia", name: "Propia" }] } }))).toBe(
      "permission",
    );
  });

  it("is still `tenant` for a manual whose one axis is tenant", () => {
    expect(primaryAxis(baseConfig)).toBe("tenant");
  });

  // Picking the first key would make the output filename depend on the order
  // somebody happened to write the YAML in.
  it("refuses to guess between two axes, naming both", () => {
    const two = withAxes({
      tenant: { values: [{ id: "mv", name: "MV" }] },
      permission: { values: [{ id: "propia", name: "Propia" }] },
    });
    expect(() => primaryAxis(two)).toThrow(/tenant/);
    expect(() => primaryAxis(two)).toThrow(/permission/);
  });

  it("says what is missing when a manual declares no axis at all", () => {
    expect(() => primaryAxis(withAxes({}))).toThrow(/no axes/);
  });
});

describe("outputFilename", () => {
  it("expands the axis token by the axis's own name", () => {
    const config: ManualConfig = {
      ...baseConfig,
      axes: { permission: { values: [{ id: "todas", name: "Todas" }] } },
      output: { dir: "output", filename: "manual-{permission}-v{contentVersion}.pdf" },
    };
    expect(outputFilename(config, { permission: "todas" }, "0.1.0")).toBe("manual-todas-v0.1.0.pdf");
  });

  it("keeps expanding `{tenant}` for the manual that already ships", () => {
    const config: ManualConfig = {
      ...baseConfig,
      output: { dir: "output", filename: "manual-operador-{tenant}-v{contentVersion}.pdf" },
    };
    expect(outputFilename(config, { tenant: "mv" }, "0.1.0")).toBe("manual-operador-mv-v0.1.0.pdf");
  });
});

describe("workFilename", () => {
  const config: ManualConfig = {
    ...baseConfig,
    output: { dir: "output", filename: "manual-operador-{tenant}-v{contentVersion}.pdf" },
  };

  it("replaces the whole version segment, `v` included", () => {
    expect(workFilename(config, { tenant: "mv" }, 8)).toBe("manual-operador-mv-trabajo-08.pdf");
  });

  it("never produces a name that could be read as a version", () => {
    expect(workFilename(config, { tenant: "mv" }, 8)).not.toMatch(/-v/);
  });

  it("keeps the prefix a template chose when it writes the token bare", () => {
    const bare: ManualConfig = {
      ...baseConfig,
      output: { dir: "output", filename: "catalogo-{tenant}-{contentVersion}.pdf" },
    };
    expect(workFilename(bare, { tenant: "mv" }, 3)).toBe("catalogo-mv-trabajo-03.pdf");
  });

  it("stops padding once the number outgrows two digits", () => {
    expect(workFilename(config, { tenant: "mv" }, 117)).toBe("manual-operador-mv-trabajo-117.pdf");
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

describe("assertChangeLog", () => {
  const block = (type: string): ManualNode => ({
    kind: "block",
    id: `b.${type}`,
    type,
    props: {},
  });

  const section = (id: string, children: readonly ManualNode[]): ManualNode => ({
    kind: "section",
    id,
    title: [{ kind: "text", value: id }],
    children,
  });

  const prose = section("s.prose", [block("prose")]);
  const log = section("s.log", [block("change-log")]);
  const files = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => `0${i + 1}-section.yaml`);

  it("passes a manual with no change log at all", () => {
    expect(() => assertChangeLog([prose, prose], files(2))).not.toThrow();
  });

  it("passes when the change log is the final section", () => {
    expect(() => assertChangeLog([prose, prose, log], files(3))).not.toThrow();
  });

  /**
   * The failure this exists for. Sections load in filename order, so a change
   * log stops being last the moment someone adds a section that sorts after it
   * — a decision made while naming a file, not while thinking about the change
   * log. Nothing else in the build would notice.
   */
  it("rejects a change log that something else follows, and names what follows it", () => {
    expect(() => assertChangeLog([log, prose], files(2))).toThrow(
      /FINAL module.*02-section\.yaml/s,
    );
  });

  it("rejects two change logs, because two delivery histories cannot both be current", () => {
    expect(() => assertChangeLog([log, prose, log], files(3))).toThrow(
      /2 `change-log` blocks/,
    );
  });

  it("rejects rows that do not ascend, so the cover matches the table's last row", () => {
    const backwards: ManualNode = {
      kind: "section",
      id: "s.log",
      title: [{ kind: "text", value: "s.log" }],
      children: [
        {
          kind: "block",
          id: "b.log",
          type: "change-log",
          props: {
            rows: [
              { id: "r1", version: "1.5.0" },
              { id: "r2", version: "1.4.7" },
            ],
          },
        },
      ],
    };
    expect(() => assertChangeLog([prose, backwards], files(2))).toThrow(/must ASCEND/);
  });

  /** The block sits inside a subsection in real content, never at section root. */
  it("finds a change log nested below the top level", () => {
    const nested = section("s.top", [section("s.sub", [block("change-log")])]);
    expect(() => assertChangeLog([prose, nested], files(2))).not.toThrow();
    expect(() => assertChangeLog([nested, prose], files(2))).toThrow(/FINAL module/);
  });
});

describe("deliveredVersion", () => {
  const logWith = (...versions: string[]): ManualNode => ({
    kind: "section",
    id: "s.log",
    title: [{ kind: "text", value: "Historial" }],
    children: [
      {
        kind: "block",
        id: "b.log",
        type: "change-log",
        props: { rows: versions.map((version, i) => ({ id: `r${i}`, version })) },
      },
    ],
  });

  it("falls back to the config field when the manual has no change log", () => {
    const plain: ManualNode = {
      kind: "section",
      id: "s",
      title: [{ kind: "text", value: "s" }],
      children: [{ kind: "block", id: "b", type: "prose", props: { text: "x" } }],
    };
    expect(deliveredVersion([plain], "0.6.9")).toBe("0.6.9");
  });

  it("takes the highest row, not the config field", () => {
    expect(deliveredVersion([logWith("1.4.7", "1.5.0")], "0.1.0")).toBe("1.5.0");
  });

  /**
   * The case the whole derivation exists for. Rows carry their own selectors,
   * so an ASSEMBLED med manual holds only 1.4.7 while mv holds both — and each
   * cover prints what that target actually received. One `contentVersion`
   * scalar could never say this.
   */
  it("reports what one target received, once its rows have been conditioned away", () => {
    expect(deliveredVersion([logWith("1.4.7")], "0.1.0")).toBe("1.4.7");
    expect(deliveredVersion([logWith("1.4.7", "1.5.0")], "0.1.0")).toBe("1.5.0");
  });

  /** String comparison puts 1.9.0 above 1.10.0. Numeric comparison does not. */
  it("compares version parts numerically", () => {
    expect(deliveredVersion([logWith("1.9.0", "1.10.0")], "0.0.0")).toBe("1.10.0");
    expect(deliveredVersion([logWith("0.0.1")], "0.6.9")).toBe("0.0.1");
  });
});

describe("the working number and the draft marker compose", () => {
  const config: ManualConfig = {
    ...baseConfig,
    output: { dir: "output", filename: "manual-operador-{tenant}-v{contentVersion}.pdf" },
  };

  it("marks a draft of a working build without either marker eating the other", () => {
    expect(draftFilename(workFilename(config, { tenant: "mv" }, 8))).toBe(
      "manual-operador-mv-trabajo-08-BORRADOR.pdf",
    );
  });
});

describe("deliveryProofFor", () => {
  const SHA_A = "a".repeat(64);
  const SHA_B = "b".repeat(64);

  const log = (rows: readonly Record<string, unknown>[]): ManualNode => ({
    kind: "section",
    id: "s.log",
    title: [{ kind: "text", value: "Historial" }],
    children: [{ kind: "block", id: "b.log", type: "change-log", props: { rows } }],
  });

  const delivered = log([
    {
      id: "r1",
      version: "1.0.0",
      delivered: { mv: { commit: "a9f780e", files: { "m-mv.pdf": SHA_A } } },
    },
    {
      id: "r2",
      version: "1.1.0",
      delivered: {
        mv: { commit: "cd40d46", files: { "m-mv.pdf": SHA_B } },
        // Its own commit, because it was handed over on its own day.
        med: { commit: "8a0ab58", files: { "m-med.pdf": SHA_A } },
      },
    },
  ]);

  it("finds the proof for one version and one target", () => {
    expect(deliveryProofFor([delivered], "1.0.0", "mv")).toEqual({
      commit: "a9f780e",
      files: { "m-mv.pdf": SHA_A },
    });
  });

  /**
   * The distinction the whole guard rests on. A version handed to `mv` and not
   * to `med` is the normal case, so "this version was delivered" is never a
   * fact about the manual — only ever about a target.
   */
  it("returns nothing for a target that version was never handed to", () => {
    expect(deliveryProofFor([delivered], "1.0.0", "med")).toBeUndefined();
    expect(deliveryProofFor([delivered], "1.1.0", "med")).toBeDefined();
  });

  it("returns nothing for a row that carries no proof", () => {
    const undelivered = log([{ id: "r1", version: "2.0.0" }]);
    expect(deliveryProofFor([undelivered], "2.0.0", "mv")).toBeUndefined();
  });

  it("returns nothing when the manual has no change log at all", () => {
    const plain: ManualNode = {
      kind: "section",
      id: "s",
      title: [{ kind: "text", value: "s" }],
      children: [{ kind: "block", id: "b", type: "prose", props: { text: "x" } }],
    };
    expect(deliveryProofFor([plain], "1.0.0", "mv")).toBeUndefined();
  });

  /** A half-written proof must not read as a delivery. */
  it("ignores a proof missing its commit or its hash", () => {
    const broken = log([
      { id: "r1", version: "3.0.0", delivered: { files: { mv: { "m.pdf": SHA_A } } } },
      { id: "r2", version: "3.1.0", delivered: { commit: "a9f780e", files: {} } },
    ]);
    expect(deliveryProofFor([broken], "3.0.0", "mv")).toBeUndefined();
    expect(deliveryProofFor([broken], "3.1.0", "mv")).toBeUndefined();
  });
});

describe("releaseNotesFile", () => {
  it("keys the notes by version, inside the manual", () => {
    // Inside the manual so they share its axis, targets, theme and change log.
    // The filename is what ties them to a version, rather than a field that
    // could disagree with the row.
    expect(releaseNotesFile("manuals/bridge-manual", "1.1.0")).toBe(
      join("manuals/bridge-manual", "release-notes", "v1.1.0.yaml"),
    );
  });

  it("does not collapse versions that differ only in the patch", () => {
    const a = releaseNotesFile("m", "1.1.0");
    const b = releaseNotesFile("m", "1.1.10");
    expect(a).not.toBe(b);
  });
});

describe("releaseDate", () => {
  it("names the day, because two sets of notes can share a month", () => {
    expect(releaseDate(new Date(2026, 7, 7))).toBe("7 de agosto de 2026");
  });

  it("keeps the month lowercase, which is what Spanish does inside a date", () => {
    expect(releaseDate(new Date(2026, 11, 24))).toBe("24 de diciembre de 2026");
  });

  it("does not pad the day, because no one writes 07 de agosto", () => {
    expect(releaseDate(new Date(2026, 0, 1))).toBe("1 de enero de 2026");
  });

  it("distinguishes two dates inside one month, which is the whole point", () => {
    const first = releaseDate(new Date(2026, 7, 7));
    const second = releaseDate(new Date(2026, 7, 21));
    expect(first).not.toBe(second);
  });
});

describe("releaseLede", () => {
  const file = "release-notes/v1.1.0.yaml";

  it("takes the standfirst the notes declare about themselves", () => {
    const lede = releaseLede({ id: "notas", lede: "Menú nuevo y cierre desde la lista." }, file);
    expect(lede).toBe("Menú nuevo y cierre desde la lista.");
  });

  it("trims it, because a block scalar carries the newline it was folded on", () => {
    expect(releaseLede({ lede: "  Dos cambios visibles.\n" }, file)).toBe("Dos cambios visibles.");
  });

  it("refuses notes that declare none", () => {
    // The cover would otherwise print the manual's standfirst — a sentence about
    // what the product IS, identical in every version — where the reader expects
    // what THIS version brings.
    expect(() => releaseLede({ id: "notas" }, file)).toThrow(/lede/);
  });

  it("refuses a blank one, which is the same absence written differently", () => {
    expect(() => releaseLede({ lede: "   \n " }, file)).toThrow(/lede/);
  });

  it("refuses one that is not a sentence", () => {
    expect(() => releaseLede({ lede: ["a", "b"] }, file)).toThrow(/lede/);
    expect(() => releaseLede({ lede: 3 }, file)).toThrow(/lede/);
  });

  it("names the file and points at the skill that writes it", () => {
    let message = "";
    try {
      releaseLede({}, file);
    } catch (error) {
      message = formatCliError(error);
    }
    expect(message).toContain(file);
    expect(message).toContain("skill");
  });

  it("refuses a file that is not a mapping at all", () => {
    expect(() => releaseLede(null, file)).toThrow(/lede/);
    expect(() => releaseLede("notas", file)).toThrow(/lede/);
  });
});

/**
 * GUARD 2 — `deliverManual` refuses BEFORE rendering anything when a target's
 * highest change-log row does not reach the version being delivered. See
 * `versionMismatches` (`delivery-state.ts`) for the predicate; this is only
 * the message `deliverManual` prints alongside the refusal.
 */
describe("formatVersionMismatchMessage", () => {
  it("names the short target, its actual version, and both ways out", () => {
    const message = formatVersionMismatchMessage("1.2.0", [{ value: "med", highestRow: "1.0.0" }]);
    expect(message).toContain("med");
    expect(message).toContain("1.0.0");
    expect(message).toContain("1.2.0");
    expect(message).toContain("--tenant");
  });

  it("names every falling-short target when there is more than one", () => {
    const message = formatVersionMismatchMessage("1.2.0", [
      { value: "med", highestRow: "1.0.0" },
      { value: "agencia-propia", highestRow: "1.1.0" },
    ]);
    expect(message).toContain("med");
    expect(message).toContain("agencia-propia");
  });
});

/**
 * GUARD 1 — `deliverManual` REPORTS (never refuses) when commits since the
 * last delivery declare product news the release notes do not reflect. See
 * `staleReleaseNotesReport` (`delivery-state.ts`) for the decision; this
 * covers the message text and `reportStaleReleaseNotes`, the wiring that
 * reads git and the filesystem and calls that decision.
 */
describe("formatStaleReleaseNotesMessage", () => {
  it("names the target, the version, the offending commits, and the skill", () => {
    const message = formatStaleReleaseNotesMessage("mv", "1.2.0", [
      { commit: "aaaaaaaaaa", subject: "feat: nuevo modulo" },
    ]);
    expect(message).toContain("mv");
    expect(message).toContain("1.2.0");
    expect(message).toContain("aaaaaaa"); // short hash
    expect(message).toContain("feat: nuevo modulo");
    expect(message).toContain("release-notes");
  });
});

describe("reportStaleReleaseNotes", () => {
  const roots: string[] = [];

  const gitInit = (dir: string): void => {
    execFileSync("git", ["-C", dir, "init", "-q"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "T"]);
    execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", "seed"]);
  };

  const scratch = (): string => {
    const root = mkdtempSync(join(tmpdir(), "stale-notes-"));
    roots.push(root);
    gitInit(root);
    return root;
  };

  const headSha = (root: string): string =>
    execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

  const commit = (root: string, message: string): string => {
    execFileSync("git", ["-C", root, "commit", "-q", "--allow-empty", "-m", message]);
    return headSha(root);
  };

  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("reports nothing for a target with no anchor — a first delivery has nothing to diff against", () => {
    const root = scratch();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reportStaleReleaseNotes(root, root, "1.0.0", [{ value: "mv", anchor: undefined }]);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("reports nothing when no commit since the anchor declares product news", () => {
    const root = scratch();
    const anchor = headSha(root);
    commit(root, "chore: nada de producto");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reportStaleReleaseNotes(root, root, "1.1.0", [{ value: "mv", anchor }]);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("reports when product news exists and the notes file for this version does not", () => {
    const root = scratch();
    const anchor = headSha(root);
    commit(root, "feat: nuevo modulo\n\nProducto: nuevo");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reportStaleReleaseNotes(root, root, "1.1.0", [{ value: "mv", anchor }]);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const message = String(errorSpy.mock.calls[0]?.[0]);
      expect(message).toContain("mv");
      expect(message).toContain("1.1.0");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("stays quiet when the notes were written AFTER the declaring commit", () => {
    const root = scratch();
    const anchor = headSha(root);
    commit(root, "feat: nuevo modulo\n\nProducto: nuevo");
    mkdirSync(join(root, "release-notes"), { recursive: true });
    writeFileSync(join(root, "release-notes", "v1.1.0.yaml"), "id: notas\n");
    execFileSync("git", ["-C", root, "add", "-A"]);
    commit(root, "docs: notas de la 1.1.0");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reportStaleReleaseNotes(root, root, "1.1.0", [{ value: "mv", anchor }]);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("reports when the notes file exists but predates the declaring commit", () => {
    const root = scratch();
    mkdirSync(join(root, "release-notes"), { recursive: true });
    writeFileSync(join(root, "release-notes", "v1.1.0.yaml"), "id: notas\n");
    execFileSync("git", ["-C", root, "add", "-A"]);
    commit(root, "docs: notas viejas");
    const anchor = headSha(root);
    commit(root, "feat: cambia el flujo\n\nProducto: cambio");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reportStaleReleaseNotes(root, root, "1.1.0", [{ value: "mv", anchor }]);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});

/**
 * `deliver <manual> --version <N.N.N>` end to end, against a real (throwaway)
 * git repository — the exact scenario reproduced today: `--version` given, no
 * `--tenant`, and one target's highest change-log row falls short of it.
 *
 * Stops at GUARD 2, before `build()` is ever called — no PDF is rendered and
 * no headless Chrome is launched, which is why this can run in the ordinary
 * suite rather than needing the infrastructure a real render would.
 */
describe("deliver — cross-target version guard", () => {
  const roots: string[] = [];

  const CONFIG = [
    "manual:",
    "  id: un-manual",
    "  title: Un Manual",
    "  product: Producto",
    "  contentVersion: 0.1.0",
    "axes:",
    "  tenant:",
    "    values:",
    "      - id: mv",
    "        name: MV",
    "      - id: med",
    "        name: MED",
    "targets:",
    "  - tenant: mv",
    "  - tenant: med",
    "output:",
    "  dir: output",
    "  filename: x.pdf",
    "",
  ].join("\n");

  const INTRO = ["id: s", "title: S", "children:", "  - id: s.p1", "    type: prose", "    props:", "      text: Texto.", ""].join(
    "\n",
  );

  // `mv` reaches 1.2.0; `med` — with no `when` on that row — never sees it,
  // so its table's highest stays 1.0.0. Reproduces exactly what crashed
  // `build()` today.
  const CHANGE_LOG = [
    "id: cambios",
    "title: Historial de cambios",
    "children:",
    "  - id: cambios.tabla",
    "    type: change-log",
    "    props:",
    "      versionHeader: Versión",
    "      dateHeader: Fecha",
    "      descriptionHeader: Descripción",
    "      rows:",
    "        - id: cambios.tabla.1",
    "          version: 1.0.0",
    "          date: 2026-01-01",
    "          description: Primera entrega.",
    "        - id: cambios.tabla.2",
    "          version: 1.2.0",
    "          date: 2026-06-01",
    "          description: Segunda entrega.",
    "          when:",
    "            tenant: [mv]",
    "",
  ].join("\n");

  const repoRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "deliver-guard-"));
    roots.push(root);
    mkdirSync(join(root, "manuals", "un-manual", "sections"), { recursive: true });
    writeFileSync(join(root, "manuals", "un-manual", "manual.config.yaml"), CONFIG);
    writeFileSync(join(root, "manuals", "un-manual", "sections", "01-intro.yaml"), INTRO);
    writeFileSync(join(root, "manuals", "un-manual", "sections", "99-cambios.yaml"), CHANGE_LOG);
    execFileSync("git", ["-C", root, "init", "-q"]);
    execFileSync("git", ["-C", root, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", root, "config", "user.name", "T"]);
    execFileSync("git", ["-C", root, "add", "-A"]);
    execFileSync("git", ["-C", root, "commit", "-q", "-m", "seed"]);
    return root;
  };

  const runIn = async (root: string, argv: readonly string[]): Promise<number> => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      return await run(argv);
    } finally {
      process.chdir(cwd);
    }
  };

  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("refuses before rendering anything when med's highest row falls short of the requested 1.2.0", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(repoRoot(), ["deliver", "un-manual", "--version", "1.2.0"]);
      expect(code).toBe(1);

      const messages = errorSpy.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes("med") && m.includes("1.0.0") && m.includes("1.2.0"))).toBe(
        true,
      );
      expect(messages.some((m) => m.includes("--tenant"))).toBe(true);

      // NOTHING RENDERED: the guard fired before `build()`'s own log line.
      const logs = logSpy.mock.calls.map((c) => String(c[0]));
      expect(logs.some((l) => l.includes("construyendo el documento oficial"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
    }
  });

  // A `--tenant mv`-scoped call is deliberately NOT exercised here: mv's own
  // table already reaches 1.2.0, so the guard steps aside and the run
  // proceeds into `build()` — real headless Chrome rendering, which no test
  // in this suite invokes (see `packages/cli/AGENTS.md`: pipeline behaviour
  // beyond CLI wiring is tested in `core`, not through a rendered PDF here).
});

/**
 * `verified <manual> --module <sections/NN-....yaml>` — records which product
 * commit a module was verified against. Every scenario runs against a
 * throwaway repository root, chdir'd into for the duration of the call: `run`
 * resolves `manualDir` and the product checkout off `process.cwd()`, exactly
 * as every other command does.
 */
describe("verified", () => {
  const MODULE = "sections/07-interfaz-general.yaml";
  const roots: string[] = [];

  const gitInit = (dir: string): void => {
    execFileSync("git", ["-C", dir, "init", "-q"]);
    execFileSync("git", ["-C", dir, "config", "user.email", "t@example.com"]);
    execFileSync("git", ["-C", dir, "config", "user.name", "T"]);
    execFileSync("git", ["-C", dir, "add", "-A"]);
    execFileSync("git", ["-C", dir, "commit", "-q", "-m", "seed"]);
  };

  /** A repository root with one manual, one registered source, and a product checkout. */
  const repoRoot = (product: "clean" | "dirty" | "detached" | "none"): string => {
    const root = mkdtempSync(join(tmpdir(), "verified-"));
    roots.push(root);
    mkdirSync(join(root, "sources"), { recursive: true });
    mkdirSync(join(root, "manuals", "un-manual", "sections"), { recursive: true });
    writeFileSync(
      join(root, "manuals", "un-manual", "manual.config.yaml"),
      "manual:\n  source: producto\n",
    );
    writeFileSync(join(root, "manuals", "un-manual", "sections", "07-interfaz-general.yaml"), "id: s\ntitle: S\nchildren: []\n");
    writeFileSync(
      join(root, "sources", "registry.yaml"),
      [
        "version: 1",
        "sources:",
        "  producto:",
        "    name: Producto",
        "    path: ./producto",
        "    extract:",
        "      components: src",
        "      pages: src",
        "",
      ].join("\n"),
    );

    const productDir = join(root, "producto");
    mkdirSync(productDir, { recursive: true });
    writeFileSync(join(productDir, "seed.txt"), "seed\n");

    if (product !== "none") {
      gitInit(productDir);
      if (product === "dirty") writeFileSync(join(productDir, "seed.txt"), "dirty\n");
      if (product === "detached") {
        const head = execFileSync("git", ["-C", productDir, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim();
        execFileSync("git", ["-C", productDir, "checkout", "-q", "--detach", head]);
      }
    }
    return root;
  };

  const runIn = async (root: string, argv: readonly string[]): Promise<number> => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      return await run(argv);
    } finally {
      process.chdir(cwd);
    }
  };

  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("with no manual id falls through to usage and returns 2", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await run(["verified"])).toBe(2);
    } finally {
      errorSpy.mockRestore();
    }
  });

  // The message is the discriminating signal: an unknown `--module` also
  // returns 1 (`no such section file: …`), so asserting the code alone cannot
  // tell "the `!module` guard ran" apart from "the guard was removed and
  // `module` fell through as `undefined` to the unknown-module check". Only
  // the wording pins which branch actually refused.
  it("refuses with no --module, naming the missing flag rather than an unknown module", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runIn(repoRoot("clean"), ["verified", "un-manual"])).toBe(1);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("needs --module"))).toBe(true);
      expect(messages.some((m) => m.includes("no such section file"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses --all loudly rather than silently ignoring it (ADR-005)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runIn(repoRoot("clean"), ["verified", "un-manual", "--all"])).toBe(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses a --module naming a section file that does not exist, before touching baselines.json", async () => {
    const root = repoRoot("clean");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, [
        "verified",
        "un-manual",
        "--module",
        "sections/99-does-not-exist.yaml",
      ]);
      expect(code).toBe(1);
      expect(existsSync(join(root, "manuals", "un-manual", "baselines.json"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses on a dirty product checkout, writing nothing (S-2)", async () => {
    const root = repoRoot("dirty");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["verified", "un-manual", "--module", MODULE]);
      expect(code).toBe(1);
      expect(existsSync(join(root, "manuals", "un-manual", "baselines.json"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('refuses when the product checkout is not a repository — "cannot tell" is never read as clean (S-2)', async () => {
    const root = repoRoot("none");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["verified", "un-manual", "--module", MODULE]);
      expect(code).toBe(1);
      expect(existsSync(join(root, "manuals", "un-manual", "baselines.json"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("succeeds on a clean checkout and stamps exactly the named module", async () => {
    const root = repoRoot("clean");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["verified", "un-manual", "--module", MODULE]);
      expect(code).toBe(0);
      const baselines = readBaselines(join(root, "manuals", "un-manual"));
      expect(baselines?.source).toBe("producto");
      expect(baselines?.modules[MODULE]?.productCommit).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      logSpy.mockRestore();
    }
  });

  // The one place the exploration's language and the code's actual behaviour
  // diverge (S-3): a detached HEAD is a successful read, not a refusal. Code
  // 0 alone would also pass if `verified` silently wrote no commit or a wrong
  // one — matching the rigor of the clean-checkout test above, this asserts
  // the STAMPED commit is exactly the detached HEAD's sha, not merely that
  // something was written.
  it("succeeds on a detached HEAD with a clean tree, stamping that exact commit", async () => {
    const root = repoRoot("detached");
    const productDir = join(root, "producto");
    const headSha = execFileSync("git", ["-C", productDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["verified", "un-manual", "--module", MODULE]);
      expect(code).toBe(0);
      const baselines = readBaselines(join(root, "manuals", "un-manual"));
      expect(baselines?.modules[MODULE]?.productCommit).toBe(headSha);
    } finally {
      logSpy.mockRestore();
    }
  });
});

/**
 * `hidden <manual> [--hide <slot>] [--show <slot>]` — temporarily hide a
 * pending image slot from a build. Reuses `verified`'s temp-repo/`runIn`
 * idiom: no product checkout is needed here, only a manual with one image
 * slot to hide.
 */
describe("hidden", () => {
  const roots: string[] = [];

  /** A repository root with one manual, one section declaring one figure slot. */
  const repoRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "hidden-cmd-"));
    roots.push(root);
    mkdirSync(join(root, "manuals", "un-manual", "sections"), { recursive: true });
    writeFileSync(
      join(root, "manuals", "un-manual", "manual.config.yaml"),
      [
        "manual:",
        "  id: un-manual",
        "  title: Un Manual",
        "  product: Producto",
        "  contentVersion: 0.1.0",
        "axes:",
        "  tenant:",
        "    values:",
        "      - id: mv",
        "        name: MV",
        "targets:",
        "  - tenant: mv",
        "output:",
        "  dir: output",
        "  filename: x.pdf",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "manuals", "un-manual", "sections", "01-modulo.yaml"),
      [
        "id: s",
        "title: S",
        "children:",
        "  - id: s.fig",
        "    type: figure",
        "    props:",
        "      caption: Vista",
        "      widthPercent: 100",
        "",
      ].join("\n"),
    );
    return root;
  };

  const runIn = async (root: string, argv: readonly string[]): Promise<number> => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      return await run(argv);
    } finally {
      process.chdir(cwd);
    }
  };

  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("with no flags, reports nothing hidden on a fresh manual", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(repoRoot(), ["hidden", "un-manual"]);
      expect(code).toBe(0);
      const messages = logSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no image slot is hidden"))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("hides a pending slot and then reports it", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await runIn(root, ["hidden", "un-manual", "--hide", "s.fig"])).toBe(0);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(true);

      logSpy.mockClear();
      expect(await runIn(root, ["hidden", "un-manual"])).toBe(0);
      const messages = logSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("s.fig"))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("un-hides a slot, leaving nothing hidden again", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["hidden", "un-manual", "--hide", "s.fig"]);
      expect(await runIn(root, ["hidden", "un-manual", "--show", "s.fig"])).toBe(0);

      logSpy.mockClear();
      await runIn(root, ["hidden", "un-manual"]);
      const messages = logSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no image slot is hidden"))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  // The guard: a slot can be pending for one tenant and delivered for
  // another, and hiding it globally would strip the image from a tenant that
  // already has it. Here the single configured tenant already has it.
  it("refuses to hide a slot that already resolves to a delivered image", async () => {
    const root = repoRoot();
    mkdirSync(join(root, "manuals", "un-manual", "assets", "figures", "_common", "s"), {
      recursive: true,
    });
    writeFileSync(
      join(root, "manuals", "un-manual", "assets", "figures", "_common", "s", "fig.png"),
      "not a real png, but the resolver only checks the extension and presence",
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "s.fig"]);
      expect(code).toBe(1);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(false);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("ya está entregada"))).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses --hide with no slot name", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runIn(repoRoot(), ["hidden", "un-manual", "--hide"])).toBe(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses --show with no slot name", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runIn(repoRoot(), ["hidden", "un-manual", "--show"])).toBe(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  // The confirmed bug: a user typed the delivered FILE name instead of the
  // slot. The refusal must name the real slot, not just say "invalid".
  it("refuses to hide the delivered file name instead of the slot, naming the real slot", async () => {
    const root = repoRoot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "s.fig.png"]);
      expect(code).toBe(1);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(false);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("s.fig.png") && m.includes("s.fig"))).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses to hide a slot name with a path separator", async () => {
    const root = repoRoot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "s/fig"]);
      expect(code).toBe(1);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(false);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no es un nombre de slot válido"))).toBe(true);
      expect(messages.some((m) => m.includes("barras"))).toBe(true);
      // The refusal states the slot rule. It must NOT hand someone hiding an
      // image the validator's advice about authoring `image:` in a section.
      expect(messages.some((m) => m.includes("image: true"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses to hide an uppercase slot name", async () => {
    const root = repoRoot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "S.fig"]);
      expect(code).toBe(1);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(false);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no es un nombre de slot válido"))).toBe(true);
      expect(messages.some((m) => m.includes("minúsculas"))).toBe(true);
      expect(messages.some((m) => m.includes("image: true"))).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses to hide a well-formed slot name the content never declares", async () => {
    const root = repoRoot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "no.existe"]);
      expect(code).toBe(1);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(false);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no.existe"))).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("refuses --show for a slot the content never declares", async () => {
    const root = repoRoot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--show", "no.existe"]);
      expect(code).toBe(1);
      const messages = errorSpy.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes("no.existe"))).toBe(true);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("still hides a real, fully-pending slot exactly as before", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["hidden", "un-manual", "--hide", "s.fig"]);
      expect(code).toBe(0);
      expect(
        existsSync(join(root, "manuals", "un-manual", "hidden-images.json")),
      ).toBe(true);
      const file = JSON.parse(
        readFileSync(join(root, "manuals", "un-manual", "hidden-images.json"), "utf8"),
      );
      expect(file.hidden["s.fig"]).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("records an optional --note alongside the hide", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, [
        "hidden",
        "un-manual",
        "--hide",
        "s.fig",
        "--note",
        "llega en la 1.1.0",
      ]);
      const file = JSON.parse(
        readFileSync(join(root, "manuals", "un-manual", "hidden-images.json"), "utf8"),
      );
      expect(file.hidden["s.fig"].note).toBe("llega en la 1.1.0");
    } finally {
      logSpy.mockRestore();
    }
  });
});

/**
 * `documents <manual>` — reports each module's coverage of today's drift
 * (MUF-101..104, MUF-306), including ADR-007's per-entry match counts and
 * unjoinable-path annotation. `documents`'s real-product correctness against
 * `broadlineavida` is separately verified in slice 5's manual smoke test;
 * here the CLI's ACTUAL PRINTED OUTPUT is pinned against a small, real (if
 * synthetic) product checkout — reusing `verified`'s existing temp-repo/git
 * harness idiom rather than building a new fixture.
 */
describe("documents <manual>", () => {
  const roots: string[] = [];

  /**
   * A repository root with one manual (three sections, one per join state)
   * and one registered source with a real tenant config and two gate
   * references: one inside a declared path (joinable, claimed), one left
   * undeclared by every module so it surfaces under "undeclared coverage"
   * (MUF-103).
   */
  const repoRoot = (): string => {
    const root = mkdtempSync(join(tmpdir(), "documents-"));
    roots.push(root);

    mkdirSync(join(root, "sources"), { recursive: true });
    writeFileSync(
      join(root, "sources", "registry.yaml"),
      [
        "version: 1",
        "sources:",
        "  producto:",
        "    name: Producto",
        "    path: ./producto",
        "    framework: react-vite-ts",
        "    extract:",
        "      tenantConfigs: src/config/*.config.ts",
        "      components: src/components",
        "      pages: src/pages",
        "",
      ].join("\n"),
    );

    const configDir = join(root, "producto", "src", "config");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "mv.config.ts"),
      'export default {\n  name: "MV",\n  canSeeBoT: true,\n}\n',
    );
    const componentsDir = join(root, "producto", "src", "components");
    mkdirSync(componentsDir, { recursive: true });
    // Declared by module 01, inside the scanned `src/components` root —
    // joinable, and claims the gate fact it produces.
    writeFileSync(join(componentsDir, "Panel.tsx"), 'if (config.name === "MV") show()\n');
    // Declared by NO module — surfaces under "undeclared coverage" (MUF-103).
    writeFileSync(join(componentsDir, "Extra.tsx"), 'if (config.name === "MV") show()\n');

    mkdirSync(join(root, "manuals", "un-manual", "sections"), { recursive: true });
    writeFileSync(
      join(root, "manuals", "un-manual", "manual.config.yaml"),
      [
        "manual:",
        "  id: un-manual",
        "  title: Un Manual",
        "  product: Producto",
        "  contentVersion: 0.1.0",
        "  source: producto",
        "axes:",
        "  tenant:",
        "    values:",
        "      - id: mv",
        "        name: MV",
        "targets:",
        "  - tenant: mv",
        "output:",
        "  dir: output",
        "  filename: x.pdf",
        "",
      ].join("\n"),
    );
    // `covered`: one joinable path (matches), one path OUTSIDE the scanned
    // roots (unjoinable — ADR-007), one flag that matches.
    writeFileSync(
      join(root, "manuals", "un-manual", "sections", "01-covered.yaml"),
      [
        "id: s1",
        "title: S1",
        "children: []",
        "documents:",
        "  paths:",
        "    - src/components/Panel.tsx",
        "    - routes/AppRoutes.tsx",
        "  flags:",
        "    - canSeeBoT",
        "",
      ].join("\n"),
    );
    // `clean`: declares a flag absent from the capability matrix (MUF-102).
    writeFileSync(
      join(root, "manuals", "un-manual", "sections", "02-flag-gone.yaml"),
      ["id: s2", "title: S2", "children: []", "documents:", "  flags:", "    - neverExistedFlag", ""].join(
        "\n",
      ),
    );
    // `unknown`: declares no `documents:` at all.
    writeFileSync(
      join(root, "manuals", "un-manual", "sections", "03-unknown.yaml"),
      ["id: s3", "title: S3", "children: []", ""].join("\n"),
    );

    return root;
  };

  const runIn = async (root: string, argv: readonly string[]): Promise<number> => {
    const cwd = process.cwd();
    process.chdir(root);
    try {
      return await run(argv);
    } finally {
      process.chdir(cwd);
    }
  };

  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it("with no manual id falls through to usage and returns 2", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await run(["documents"])).toBe(2);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("MUF-101: reports a declared path gone from the product, never blocking", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(code).toBe(0);
      expect(printed).toContain('declared path "routes/AppRoutes.tsx" is gone from the product');
    } finally {
      logSpy.mockRestore();
    }
  });

  it("MUF-102: reports a declared flag absent from the capability matrix, never blocking", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const code = await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(code).toBe(0);
      expect(printed).toContain(
        'declared flag "neverExistedFlag" is absent from the capability matrix',
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("MUF-103: a drift fact no module declares surfaces under undeclared coverage", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toContain("undeclared coverage");
      expect(printed).toContain("src/components/Extra.tsx");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("MUF-104: reports each module's baseline state, verified vs never verified", async () => {
    const root = repoRoot();
    stampBaseline(join(root, "manuals", "un-manual"), "producto", "sections/01-covered.yaml", {
      productCommit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      verifiedAt: "2024-01-01T00:00:00.000Z",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toContain(
        "sections/01-covered.yaml: covered — verified at deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      );
      expect(printed).toContain("sections/02-flag-gone.yaml: clean — never verified");
      expect(printed).toContain(
        "sections/03-unknown.yaml: unknown coverage (declares no `documents:`) — never verified",
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it('MUF-306: the three module states print, and the word "unaffected" never appears', async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toContain("sections/01-covered.yaml: covered — never verified");
      expect(printed).toContain("sections/02-flag-gone.yaml: clean — never verified");
      expect(printed).toContain("sections/03-unknown.yaml: unknown coverage");
      expect(printed).not.toContain("unaffected");
    } finally {
      logSpy.mockRestore();
    }
  });

  // Discriminating on purpose: a count-style assertion ("3 facts") would pass
  // even if the handler printed a bare number instead of the full list MUF-306
  // requires. This walks the exact console.log sequence and counts the
  // 4-space-indented fact lines directly under the `unknown` module's header.
  it("MUF-306: an unknown module repeats the full current fact list, never a bare count", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const lines = logSpy.mock.calls.map((c) => String(c[0]));
      const at = lines.findIndex((l) => l.includes("sections/03-unknown.yaml: unknown coverage"));
      expect(at).toBeGreaterThan(-1);
      const block: string[] = [];
      for (let i = at + 1; i < lines.length && lines[i]?.startsWith("    "); i++) {
        block.push(lines[i] as string);
      }
      // Three joinable facts exist in this fixture (2 gates + 1 capability) —
      // the full list, one line per fact, never a count summary.
      expect(block.length).toBe(3);
      expect(block.some((l) => /^\s*\d+\s+facts?\b/.test(l))).toBe(false);
    } finally {
      logSpy.mockRestore();
    }
  });

  // CRITICAL-1 (ADR-007): `joinCoverage` already computes `joinable`/`matched`
  // per entry — this is the test that would have caught it being silently
  // dropped from the printed report, never reaching an operator.
  it("ADR-007: annotates a module whose declared paths partly lie outside the scanned roots", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const printed = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(printed).toContain(
        "1 of this module's 2 declared paths lie outside the scanned roots " +
          "(`src/components`, `src/pages`), so drift in them cannot be reported today",
      );
      expect(printed).toContain("source-extraction");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("ADR-007: reports each entry's matched count and kind, sorted descending", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const lines = logSpy.mock.calls.map((c) => String(c[0]));
      expect(lines).toContain("    src/components/Panel.tsx (file) — 1 of 3 facts");
      expect(lines).toContain("    canSeeBoT (flag) — 1 of 3 facts");
      expect(lines).toContain("    routes/AppRoutes.tsx (file) — 0 of 3 facts");
      // Descending by `matched`: the two 1-of-3 entries sort ahead of the
      // unmatched, unjoinable 0-of-3 entry.
      const panelAt = lines.indexOf("    src/components/Panel.tsx (file) — 1 of 3 facts");
      const appRoutesAt = lines.indexOf("    routes/AppRoutes.tsx (file) — 0 of 3 facts");
      const flagAt = lines.indexOf("    canSeeBoT (flag) — 1 of 3 facts");
      expect(appRoutesAt).toBeGreaterThan(panelAt);
      // This pair is the one that discriminates the sort. `joinCoverage` builds
      // `entries` in declaration order — paths first, then flags — so the fixture
      // reaches the printer as Panel(1), AppRoutes(0), canSeeBoT(1). Panel before
      // AppRoutes holds either way; only sorting moves the flag ahead of the
      // unmatched path. Drop the sort and this assertion is the one that fails.
      expect(appRoutesAt).toBeGreaterThan(flagAt);
    } finally {
      logSpy.mockRestore();
    }
  });

  // CRITICAL-1 (ADR-004, spec MUF-303/MUF-305): an `axis-value` fact is a
  // `ManualWideFact` — it has neither a `file` nor a `flag`, so no module's
  // `documents:` can ever join it, and ADR-004 excludes `ManualWideFact`
  // structurally from `CoverageReport.undeclared`. It must print under its
  // own "N manual-wide change(s):" heading, never under "undeclared
  // coverage". This fixture's product has one tenant config (`mv.config.ts`)
  // and no prior `knowledge/module-map.json`, so `diffFacts` reports an
  // `axis-value: "added"` fact for `mv` on every run in this describe block —
  // exercised here for the first time; no earlier test named it.
  it("CRITICAL-1 (ADR-004): an axis-value fact prints under manual-wide, never under undeclared coverage", async () => {
    const root = repoRoot();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runIn(root, ["documents", "un-manual"]);
      const lines = logSpy.mock.calls.map((c) => String(c[0]));

      const manualWideAt = lines.findIndex((l) => l.includes("manual-wide change(s):"));
      expect(manualWideAt).toBeGreaterThan(-1);
      expect(lines[manualWideAt + 1]).toBe("  tenant added: mv");

      // Discriminates the routing rather than merely asserting presence: the
      // old (contradicted) spec reading would print this same line under
      // "undeclared coverage" instead, and `printed.includes("tenant added:
      // mv")` alone would pass either way. Walk the "undeclared coverage"
      // block specifically and assert the fact is absent from it.
      const undeclaredAt = lines.findIndex((l) => l.includes("fact(s) under undeclared coverage:"));
      if (undeclaredAt > -1) {
        const undeclaredBlock: string[] = [];
        for (let i = undeclaredAt + 1; i < lines.length && lines[i]?.startsWith("  "); i++) {
          undeclaredBlock.push(lines[i] as string);
        }
        expect(undeclaredBlock).not.toContain("tenant added: mv");
      }
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe("usage text", () => {
  // MUF-810: the allow-list at `main.ts:1873-1884` gains `documents` and
  // `verified`, drops none of the nine it already had.
  it("names all 11 commands", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await run([])).toBe(2);
      const printed = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
      for (const command of [
        "build",
        "images",
        "awaiting",
        "labels",
        "extract",
        "deliver",
        "undeliver",
        "capture",
        "release-notes",
      ]) {
        expect(printed).toContain(command);
      }
      // Checked as an invocation line, not the bare word: "documents" already
      // appears in unrelated prose ("...which the manual documents around"),
      // so a substring match on the word alone would pass before either
      // command exists.
      expect(printed).toContain("broadsec-manual documents <manual>");
      expect(printed).toContain("broadsec-manual verified <manual>");
    } finally {
      errorSpy.mockRestore();
    }
  });
});

/**
 * `resolveTargetImages` is the one line (`main.ts`'s `visible` filter) that
 * keeps a hidden slot away from the renderer — nothing exercised it before.
 * Inverting or deleting that filter must turn this red.
 */
describe("resolveTargetImages", () => {
  const twoFigures = (): ManualDocument => ({
    manualId: "m",
    version: "0.1.0",
    children: [
      {
        kind: "section",
        id: "s",
        title: [{ kind: "text", value: "S" }],
        children: [
          { kind: "block", id: "s.f1", type: "figure", props: { caption: "Uno", widthPercent: 100 } },
          { kind: "block", id: "s.f2", type: "figure", props: { caption: "Dos", widthPercent: 100 } },
        ],
      },
    ],
  });

  it("keeps a hidden slot in `entries` (the manifest) but drops it from `slots` (what the renderer draws)", () => {
    const hidden = new Set(["s.f1"]);
    const manual = assemble(twoFigures(), { tenant: "mv" }, catalog, hidden);
    // A non-existent figures dir resolves every slot to "pending" — no files
    // need to exist on disk for this to constrain the hiding behaviour.
    const { entries, slots } = resolveTargetImages(manual, "/nowhere/figures", "mv", hidden);

    expect(entries.map((e) => e.slot).sort()).toEqual(["s.f1", "s.f2"]);
    expect([...slots.keys()]).toEqual(["s.f2"]);
    expect([...slots.values()]).toEqual(["s.f2"]);
  });

  it("with nothing hidden, every declared slot is both in `entries` and in `slots`", () => {
    const manual = assemble(twoFigures(), { tenant: "mv" }, catalog);
    const { entries, slots } = resolveTargetImages(manual, "/nowhere/figures", "mv");
    expect(entries.map((e) => e.slot).sort()).toEqual(["s.f1", "s.f2"]);
    expect([...slots.keys()].sort()).toEqual(["s.f1", "s.f2"]);
  });
});

/**
 * FINDING 1 (judgment-day, hidden-image-slots): the cross-tenant guard used
 * to be check-time only. `hideCommand` refuses to hide a slot any tenant
 * already has, but nothing re-checked that once a hidden slot was LATER
 * delivered for one tenant and not another — `build`/`deliver` applied the
 * same global hidden set to every target regardless.
 */
describe("narrowHidden (finding 1: per-target hidden narrowing)", () => {
  const twoFigures = (): ManualDocument => ({
    manualId: "m",
    version: "0.1.0",
    children: [
      {
        kind: "section",
        id: "s",
        title: [{ kind: "text", value: "S" }],
        children: [
          { kind: "block", id: "s.f1", type: "figure", props: { caption: "Uno", widthPercent: 100 } },
          { kind: "block", id: "s.f2", type: "figure", props: { caption: "Dos", widthPercent: 100 } },
        ],
      },
    ],
  });

  it(
    "a slot hidden then delivered for one tenant renders for that tenant and stays hidden " +
      "for the tenant that still lacks it, with figure numbering consistent per tenant",
    () => {
      const root = mkdtempSync(join(tmpdir(), "narrow-hidden-"));
      try {
        const figuresDir = join(root, "figures");
        mkdirSync(join(figuresDir, "mv"), { recursive: true });
        writeFileSync(join(figuresDir, "mv", "s.f1.png"), "not a real png, resolver only checks presence");

        const hidden = new Set(["s.f1"]);
        const doc = twoFigures();

        // mv already has its own delivered image for s.f1 — the narrowed set
        // must drop it, so it renders and is numbered.
        const mvHidden = narrowHidden(hidden, figuresDir, "mv");
        expect(mvHidden.has("s.f1")).toBe(false);
        const mvManual = assemble(doc, { tenant: "mv" }, catalog, mvHidden);
        const mvResolved = resolveTargetImages(mvManual, figuresDir, "mv", mvHidden);
        expect([...mvResolved.slots.values()]).toContain("s.f1");
        expect(mvManual.figures.get("s.f1")).toBe("1.1");
        expect(mvManual.figures.get("s.f2")).toBe("1.2");

        // med has nothing delivered — it stays hidden, gets no figure number,
        // and s.f2 takes the number s.f1 would otherwise have taken.
        const medHidden = narrowHidden(hidden, figuresDir, "med");
        expect(medHidden.has("s.f1")).toBe(true);
        const medManual = assemble(doc, { tenant: "med" }, catalog, medHidden);
        const medResolved = resolveTargetImages(medManual, figuresDir, "med", medHidden);
        expect([...medResolved.slots.values()]).not.toContain("s.f1");
        expect(medManual.figures.has("s.f1")).toBe(false);
        expect(medManual.figures.get("s.f2")).toBe("1.1");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("returns the same set instance when nothing is hidden — no image index needs building", () => {
    const empty = new Set<string>();
    expect(narrowHidden(empty, "/nowhere", "mv")).toBe(empty);
  });

  it("narrows to nothing when every hidden slot is still pending for the target", () => {
    const hidden = new Set(["s.f1", "s.f2"]);
    expect(narrowHidden(hidden, "/nowhere/figures", "mv")).toEqual(new Set(["s.f1", "s.f2"]));
  });
});
