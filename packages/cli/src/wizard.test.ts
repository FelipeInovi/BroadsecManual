import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assemblePrompt,
  findExecutable,
  isShellSafePath,
  knownTenants,
  themeUsage,
  launchPlan,
  normaliseSourcePath,
  readRegistrySources,
  validateManualId,
  type WizardAnswers,
} from "./wizard.ts";

const answers = (over: Partial<WizardAnswers> = {}): WizardAnswers => ({
  sourcePath: "../broadsecInternacional",
  sourceId: null,
  manualId: "broadsec-internacional",
  scope: "spike",
  target: null,
  design: { kind: "existing", theme: "broadsec" },
  ...over,
});

/** A throwaway repo root, so nothing here reads the real one. */
function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "wizard-"));
  mkdirSync(join(root, "sources"), { recursive: true });
  mkdirSync(join(root, "manuals"), { recursive: true });
  return root;
}

describe("findExecutable", () => {
  const probe = (present: readonly string[], pathext?: string) => ({
    path: ["/bin", "/opt/tools"].join(":"),
    pathext,
    delimiter: ":",
    exists: (c: string) => present.includes(c.split("\\").join("/")),
  });

  it("finds a bare executable on PATH", () => {
    expect(findExecutable("claude", probe(["/opt/tools/claude"]))).toMatch(/claude$/);
  });

  it("searches PATH in order, so the first hit wins", () => {
    const found = findExecutable("claude", probe(["/bin/claude", "/opt/tools/claude"]));
    expect(found).toMatch(/^[/\\]bin/);
  });

  it("finds a Windows .cmd shim through PATHEXT — which is what decides the launch", () => {
    const found = findExecutable("claude", probe(["/opt/tools/claude.cmd"], ".COM;.EXE;.CMD"));
    expect(found).toMatch(/claude\.cmd$/);
  });

  it("prefers the .cmd over the bare name when BOTH exist, as npm installs them", () => {
    // The bare `claude` an npm global install drops beside `claude.cmd` is a shell
    // script. Picking it on Windows means spawn fails with ENOEXEC after the
    // wizard has already said it was starting.
    const found = findExecutable(
      "claude",
      probe(["/opt/tools/claude", "/opt/tools/claude.cmd"], ".COM;.EXE;.CMD"),
    );
    expect(found).toMatch(/claude\.cmd$/);
  });

  it("uses the bare name where PATHEXT is unset, which is POSIX", () => {
    expect(findExecutable("claude", probe(["/opt/tools/claude"]))).toMatch(/claude$/);
  });

  it("is null when nothing matches, rather than guessing a path", () => {
    expect(findExecutable("claude", probe([]))).toBeNull();
  });

  it("survives an empty PATH", () => {
    expect(
      findExecutable("claude", { path: undefined, pathext: undefined, delimiter: ":", exists: () => true }),
    ).toBeNull();
  });
});

describe("launchPlan", () => {
  it("passes only a filename, never the prompt text", () => {
    const plan = launchPlan("/usr/bin/claude", ".broadsec-manual/new-x.md");
    expect(plan.args).toEqual([
      "Lee el archivo .broadsec-manual/new-x.md y aplica sus instrucciones.",
    ]);
    expect(plan.shell).toBe(false);
  });

  it("uses a shell only for a .cmd shim, and pre-quotes the argument for it", () => {
    const plan = launchPlan("C:\\npm\\claude.cmd", ".broadsec-manual/new-x.md");
    expect(plan.shell).toBe(true);
    expect(plan.args).toEqual([
      '"Lee el archivo .broadsec-manual/new-x.md y aplica sus instrucciones."',
    ]);
  });

  // The one string in the CLI that crosses a shell boundary. `cmd.exe` does not
  // default to a UTF-8 codepage, so an accent here can reach the agent mojibaked.
  it("keeps the sentence ASCII, because a .cmd shim goes through cmd.exe", () => {
    const plan = launchPlan("C:\\npm\\claude.cmd", ".broadsec-manual/new-x.md");
    expect(plan.args[0]).toMatch(/^[\x20-\x7E]+$/);
  });

  it("treats .bat the same as .cmd", () => {
    expect(launchPlan("C:\\npm\\claude.BAT", "x.md").shell).toBe(true);
  });
});

describe("isShellSafePath", () => {
  it("accepts the names this tool generates", () => {
    expect(isShellSafePath(".broadsec-manual/new-bridge-manual.md")).toBe(true);
  });

  it.each([" ", '"', "'", "&", "|", "$", "`", ";", "(", ">"])(
    "rejects a path containing %s",
    (ch) => {
      expect(isShellSafePath(`.broadsec-manual/new${ch}x.md`)).toBe(false);
    },
  );
});

describe("normaliseSourcePath", () => {
  /** A repo root with a sibling product beside it, as the real layout has. */
  function siblings(): { root: string; product: string } {
    const parent = mkdtempSync(join(tmpdir(), "wizard-"));
    const root = join(parent, "TheManualRepo");
    const product = join(parent, "the-product");
    mkdirSync(join(root, "sources"), { recursive: true });
    mkdirSync(product, { recursive: true });
    return { root, product };
  }

  it("accepts an ABSOLUTE path and returns it relative to the repository root", () => {
    const { root, product } = siblings();
    expect(normaliseSourcePath(product, root)).toEqual({ path: "../the-product" });
  });

  it("accepts a relative path unchanged in meaning", () => {
    const { root } = siblings();
    expect(normaliseSourcePath("../the-product", root)).toEqual({ path: "../the-product" });
  });

  it("emits forward slashes, so a Windows answer produces a POSIX registry entry", () => {
    const { root, product } = siblings();
    const result = normaliseSourcePath(product, root);
    expect("path" in result && result.path.includes("\\")).toBe(false);
  });

  it("strips quotes, because a pasted path with spaces usually arrives wrapped", () => {
    const { root, product } = siblings();
    expect(normaliseSourcePath(`"${product}"`, root)).toEqual({ path: "../the-product" });
  });

  it("reports the resolved path when nothing is there", () => {
    const { root } = siblings();
    const result = normaliseSourcePath("../nope", root);
    expect("problem" in result && result.problem).toMatch(/^no hay nada en .*nope$/);
  });

  it("rejects a file", () => {
    const { root } = siblings();
    writeFileSync(join(root, "sources", "registry.yaml"), "version: 1\n");
    expect(normaliseSourcePath("sources/registry.yaml", root)).toEqual({
      problem: "eso es un archivo, no un repositorio",
    });
  });

  it("rejects the manual repository itself", () => {
    const { root } = siblings();
    expect(normaliseSourcePath(root, root)).toEqual({
      problem: "eso es este repositorio, no un producto fuente",
    });
  });

  it("requires an answer", () => {
    expect(normaliseSourcePath("   ", siblings().root)).toEqual({ problem: "hace falta una ruta" });
  });
});

describe("validateManualId", () => {
  it("accepts a lowercase hyphenated id", () => {
    expect(validateManualId("bridge-primera-entrega", repo())).toBeNull();
  });

  it.each(["Bridge", "con_guion_bajo", "-leading", "trailing-", "doble--guion", "con espacio"])(
    "rejects %s, because the id becomes a folder name",
    (id) => {
      expect(validateManualId(id, repo())).toMatch(/nombre de una carpeta/);
    },
  );

  it("rejects an id whose folder already exists, rather than writing into it", () => {
    const root = repo();
    mkdirSync(join(root, "manuals", "taken"));
    expect(validateManualId("taken", root)).toBe("manuals/taken/ ya existe");
  });
});

describe("readRegistrySources", () => {
  it("is empty when there is no registry, instead of throwing", () => {
    expect(readRegistrySources(mkdtempSync(join(tmpdir(), "wizard-")))).toEqual([]);
  });

  it("reads each source's id, name and path", () => {
    const root = repo();
    writeFileSync(
      join(root, "sources", "registry.yaml"),
      `version: 1\nsources:\n  alfa:\n    name: Alfa Product\n    path: ../alfa\n`,
    );
    expect(readRegistrySources(root)).toEqual([{ id: "alfa", name: "Alfa Product", path: "../alfa" }]);
  });
});

describe("knownTenants", () => {
  const withManual = (root: string, id: string, source: string, tenants: string[]) => {
    mkdirSync(join(root, "manuals", id, "knowledge"), { recursive: true });
    writeFileSync(join(root, "manuals", id, "manual.config.yaml"), `manual:\n  source: ${source}\n`);
    writeFileSync(
      join(root, "manuals", id, "knowledge", "module-map.json"),
      JSON.stringify({ tenants: tenants.map((t) => ({ id: t })) }),
    );
  };

  it("takes the deployments from a map already extracted for that source", () => {
    const root = repo();
    withManual(root, "uno", "alfa", ["mv", "med"]);
    expect(knownTenants(root, "alfa")).toEqual(["mv", "med"]);
  });

  it("is empty for an unmapped source — the tenant list is a finding, not a guess", () => {
    const root = repo();
    withManual(root, "uno", "alfa", ["mv"]);
    expect(knownTenants(root, "beta")).toEqual([]);
  });

  it("ignores a manual that has a config but no map yet", () => {
    const root = repo();
    mkdirSync(join(root, "manuals", "sinmapa"), { recursive: true });
    writeFileSync(join(root, "manuals", "sinmapa", "manual.config.yaml"), `manual:\n  source: alfa\n`);
    expect(knownTenants(root, "alfa")).toEqual([]);
  });
});

describe("assemblePrompt", () => {
  it("carries the three answers only the human could supply", () => {
    const text = assemblePrompt(answers());
    expect(text).toContain("../broadsecInternacional");
    expect(text).toContain("broadsec-internacional");
    expect(text).toContain("Spike de pipeline");
  });

  describe("for a product not in the registry", () => {
    const text = assemblePrompt(answers());

    it("starts at the survey and forbids writing the registry entry first", () => {
      expect(text).toContain("desde el paso 1");
      expect(text).toContain("NO escribas todavía la entrada del registry");
      // Asserted without the following word: the sentence wraps after "del".
      expect(text).toContain("La entrada es el RESULTADO del");
    });

    it("demands the two survey answers the flow cannot proceed without", () => {
      expect(text).toContain("cómo se resuelve la tenancy");
      // The three verdicts stay in English — they are the answer's vocabulary,
      // and the sentence wraps between "needs a" and "new extractor".
      expect(text).toContain('"fits partly"');
      expect(text).toContain('new extractor"');
    });

    it("requires that what could not be determined is stated", () => {
      expect(text).toContain("Qué NO pudiste determinar");
    });

    it("stops the agent after the report rather than letting it continue", () => {
      expect(text).toContain("Detenete después de ese reporte y esperá");
    });

    it("says the spike target is decided later, because the tenants are unknown", () => {
      expect(text).toContain("se decide después del paso 6");
    });
  });

  describe("for a product already in the registry", () => {
    const text = assemblePrompt(answers({ sourceId: "alfa", target: "mv" }));

    it("skips the survey and protects the existing entry", () => {
      // Asserted without the following word: the sentence wraps after "está".
      expect(text).toContain("el relevamiento está");
      expect(text).toContain("NO lo relevés de nuevo");
      expect(text).toContain("NO edites esa entrada");
      expect(text).not.toContain("NO escribas todavía la entrada del registry");
    });

    it("starts at step 4 and still requires the map to be reviewed", () => {
      expect(text).toContain("Arrancá en el paso 4");
      expect(text).toContain("El paso 6 no es opcional");
    });

    it("says the map is per manual, so a second manual extracts again", () => {
      expect(text).toContain("por MANUAL, no por producto");
    });

    it("names the chosen spike target", () => {
      expect(text).toContain("Target del spike   mv");
    });
  });

  it.each([
    ["spike", "UNA sección"],
    ["module", "dieciséis ítems"],
    ["full", "todas las secciones"],
  ] as const)("gives %s its own instruction", (scope, expected) => {
    expect(assemblePrompt(answers({ scope }))).toContain(expected);
  });

  it("warns about the two things the pipeline will not catch for you", () => {
    const text = assemblePrompt(answers());
    expect(text).toContain("cruza un borde de tenant");
    expect(text).toContain("Las imágenes van al final");
  });

  describe("reusing an existing theme", () => {
    const text = assemblePrompt(answers({ design: { kind: "existing", theme: "bridge" } }));

    it("declares the theme and forbids editing it", () => {
      expect(text).toContain("manual.theme: bridge");
      expect(text).toContain("no lo edites");
    });

    it("asks for no proposal", () => {
      expect(text).not.toContain("proponé el diseño");
    });
  });

  describe("a new design", () => {
    const text = assemblePrompt(answers({ design: { kind: "new" } }));

    it("puts the proposal before everything, including the survey", () => {
      expect(text).toContain("Antes que nada: proponé el diseño");
      // Positional, not textual: the section has to physically precede the
      // onboarding steps, which is the whole point of the instruction.
      expect(text.indexOf("proponé el diseño")).toBeLessThan(text.indexOf("Adding a source"));
    });

    it("says the proposal comes before the survey, and waits for a decision", () => {
      // Wraps after "ESPERÁ"; the object of the verb is on the next line.
      expect(text).toContain("Presentá una propuesta y ESPERÁ");
    });

    it("names the product path as where the design comes from", () => {
      expect(text).toContain("en ../broadsecInternacional");
    });

    it("forbids sampling a colour off a screenshot", () => {
      expect(text).toContain("se muestreó de una captura de pantalla");
      expect(text).toContain("con archivo y línea");
    });

    it("asks for the ten colour roles Brand actually declares", () => {
      for (const role of [
        "deep",
        "deepest",
        "accentLight",
        "accentDark",
        "bodyInk",
        "mutedInk",
        "headerInk",
        "surfaceAccent",
        "surfaceCool",
        "ruleLight",
      ]) {
        expect(text).toContain(role);
      }
    });

    it("surfaces the scale trade rather than letting it be discovered", () => {
      expect(text).toContain("se mergea POR PELDAÑO");
      expect(text).toContain("peldaño sobreescrito es un peldaño");
    });

    it("names the closed unions as the expensive case, up front", () => {
      expect(text).toContain("uniones CERRADAS");
      expect(text).toContain("puede descubrirse después");
    });

    it("blocks work until the proposal is accepted", () => {
      expect(text).toContain("No escribas un token, una config ni una sección");
    });
  });
});

describe("themeUsage", () => {
  const withManual = (root: string, id: string, theme?: string) => {
    mkdirSync(join(root, "manuals", id), { recursive: true });
    writeFileSync(
      join(root, "manuals", id, "manual.config.yaml"),
      theme === undefined ? `manual:\n  id: ${id}\n` : `manual:\n  id: ${id}\n  theme: ${theme}\n`,
    );
  };

  it("counts an omitted theme as broadsec, because that is what the build falls back to", () => {
    const root = repo();
    withManual(root, "sin-tema");
    expect(themeUsage(root, ["broadsec", "bridge"]).get("broadsec")).toEqual(["sin-tema"]);
  });

  it("groups manuals by the theme they declare", () => {
    const root = repo();
    withManual(root, "uno", "bridge");
    withManual(root, "dos", "bridge");
    // Sorted in the assertion: the order is whatever readdir gives, and nothing
    // downstream depends on it.
    expect(themeUsage(root, ["broadsec", "bridge"]).get("bridge")?.sort()).toEqual(["dos", "uno"]);
  });

  it("lists a theme nothing uses yet, rather than hiding it", () => {
    expect(themeUsage(repo(), ["broadsec", "nuevo"]).get("nuevo")).toEqual([]);
  });
});
