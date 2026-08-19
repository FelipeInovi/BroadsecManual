import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assembleContinuationPrompt,
  assemblePrompt,
  describeState,
  findExecutable,
  isShellSafePath,
  knownTenants,
  readManualStates,
  themeUsage,
  launchPlan,
  normaliseSourcePath,
  readRegistrySources,
  validateManualId,
  type ManualState,
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

describe("readManualStates", () => {
  /** A manual on disk, in whatever half-finished state the test needs. */
  function withManual(
    root: string,
    id: string,
    opts: {
      source?: string;
      title?: string;
      sections?: string[];
      map?: boolean;
      images?: { pending: number; total: number };
      state?: boolean;
    } = {},
  ): void {
    const dir = join(root, "manuals", id);
    mkdirSync(dir, { recursive: true });
    const source = opts.source === undefined ? "" : `  source: ${opts.source}\n`;
    writeFileSync(
      join(dir, "manual.config.yaml"),
      `manual:\n  id: ${id}\n  title: ${opts.title ?? id}\n${source}`,
    );
    if (opts.sections) {
      mkdirSync(join(dir, "sections"), { recursive: true });
      for (const s of opts.sections) writeFileSync(join(dir, "sections", s), "id: x\n");
    }
    if (opts.map) {
      mkdirSync(join(dir, "knowledge"), { recursive: true });
      writeFileSync(join(dir, "knowledge", "module-map.json"), JSON.stringify({ tenants: [] }));
    }
    if (opts.images) {
      writeFileSync(
        join(dir, "image-requests.json"),
        JSON.stringify({ counts: { ...opts.images, delivered: opts.images.total - opts.images.pending } }),
      );
    }
    if (opts.state) writeFileSync(join(dir, "ESTADO.md"), "# Estado\n");
  }

  it("is empty when nothing has been started, instead of throwing", () => {
    expect(readManualStates(mkdtempSync(join(tmpdir(), "wizard-")))).toEqual([]);
  });

  it("ignores a directory that carries no manual.config.yaml", () => {
    const root = repo();
    mkdirSync(join(root, "manuals", "no-es-un-manual"), { recursive: true });
    expect(readManualStates(root)).toEqual([]);
  });

  it("derives every signal from disk rather than from a written log", () => {
    const root = repo();
    withManual(root, "maduro", {
      source: "alfa",
      title: "Manual maduro",
      sections: ["04-a.yaml", "05-b.yaml"],
      map: true,
      images: { pending: 3, total: 10 },
      state: true,
    });
    expect(readManualStates(root)).toEqual<ManualState[]>([
      {
        id: "maduro",
        title: "Manual maduro",
        source: "alfa",
        hasMap: true,
        sections: 2,
        pending: 3,
        totalImages: 10,
        hasState: true,
      },
    ]);
  });

  it("reports a missing source as null — it is what blocks extraction", () => {
    const root = repo();
    withManual(root, "huerfano", { sections: ["04-a.yaml"] });
    const [s] = readManualStates(root);
    expect(s?.source).toBeNull();
    expect(s?.hasMap).toBe(false);
  });

  it("reports pending as null when no requests have been exported yet", () => {
    const root = repo();
    withManual(root, "recien", { source: "alfa" });
    // Null, not zero: nothing exported is NOT the same as nothing pending, and
    // conflating them would report a manual with no images as finished.
    expect(readManualStates(root)[0]?.pending).toBeNull();
  });

  it("counts only .yaml sections, so a stray file is not progress", () => {
    const root = repo();
    withManual(root, "m", { source: "alfa", sections: ["04-a.yaml", "notas.md", "05-b.yaml"] });
    expect(readManualStates(root)[0]?.sections).toBe(2);
  });

  it("lists manuals in a stable order, so the picker does not shuffle", () => {
    const root = repo();
    withManual(root, "zeta", { source: "a" });
    withManual(root, "alfa", { source: "a" });
    expect(readManualStates(root).map((s) => s.id)).toEqual(["alfa", "zeta"]);
  });
});

describe("describeState", () => {
  const state = (over: Partial<ManualState> = {}): ManualState => ({
    id: "m",
    title: "M",
    source: "alfa",
    hasMap: true,
    sections: 4,
    pending: 2,
    totalImages: 10,
    hasState: true,
    ...over,
  });

  it("shouts about the two states that block the work", () => {
    expect(describeState(state({ source: null }))).toContain("SIN fuente declarada");
    expect(describeState(state({ hasMap: false }))).toContain("SIN mapa");
  });

  it("says images are complete rather than printing a zero", () => {
    expect(describeState(state({ pending: 0 }))).toContain("imágenes completas");
  });

  it("omits the image count entirely when nothing was exported", () => {
    expect(describeState(state({ pending: null }))).not.toContain("imagen");
  });

  it("reports whether decisions were ever written down", () => {
    expect(describeState(state({ hasState: false }))).toContain("sin ESTADO.md");
    expect(describeState(state({ hasState: true }))).toContain("con ESTADO.md");
  });
});

describe("assembleContinuationPrompt", () => {
  const state = (over: Partial<ManualState> = {}): ManualState => ({
    id: "broadlineavida",
    title: "Manual de operador",
    source: "broadlineavida",
    hasMap: true,
    sections: 9,
    pending: 16,
    totalImages: 240,
    hasState: true,
    ...over,
  });

  describe("a manual that is ready to continue", () => {
    const text = assembleContinuationPrompt(state());

    it("carries the derived state, so the agent is not guessing at it", () => {
      expect(text).toContain("Secciones escritas 9");
      expect(text).toContain("16 pendiente(s) de 240");
    });

    it("does not open a blocking gate when nothing is blocking", () => {
      expect(text).not.toContain("Antes de escribir una palabra");
    });

    it("ranks the two sources of truth, and the disk wins", () => {
      expect(text).toContain("El disco manda sobre el PROGRESO");
      expect(text).toContain("gana el disco");
    });

    it("names the four places progress is actually readable from", () => {
      for (const place of ["sections/*.yaml", "module-map.json", "image-requests.json", "git log"]) {
        expect(text).toContain(place);
      }
    });

    it("forbids rewriting work that already exists", () => {
      expect(text).toContain("No reescribas una sección que ya existe");
    });

    // The map emits tenants, capabilities and references — never a module list.
    // Nothing else declares one either, so "finish the manual" has no denominator.
    it("forbids inventing the total scope, because nothing declares one", () => {
      expect(text).toContain("No inventes el inventario total de módulos");
      expect(text).toContain("PEDÍ APROBACIÓN");
    });

    it("proposes and waits rather than starting to write", () => {
      expect(text).toContain("ESPERÁ una");
    });

    it("closes by asking for the decisions to be recorded", () => {
      expect(text).toContain("manuals/broadlineavida/ESTADO.md");
      expect(text).toContain("Registrá SOLO decisiones");
      expect(text).toContain("NO registres nada que se pueda derivar del disco");
    });
  });

  describe("a manual with no declared source", () => {
    const text = assembleContinuationPrompt(state({ source: null, hasMap: false }));

    it("gates the work before any content, and says extraction cannot run", () => {
      expect(text).toContain("Antes de escribir una palabra");
      expect(text).toContain("no declara `manual.source`");
      expect(text).toContain("`extract` no puede ni correr");
    });

    it("puts the gate ahead of everything else, which is the point of a gate", () => {
      expect(text.indexOf("Antes de escribir una palabra")).toBeLessThan(
        text.indexOf("Dónde quedó esto"),
      );
    });

    it("refuses to let content paper over the problem", () => {
      expect(text).toContain("No escribas secciones para tapar esto");
    });

    it("still forbids writing the registry entry from memory", () => {
      expect(text).toContain("es el RESULTADO de relevarlo");
    });
  });

  describe("a manual with a source but no map", () => {
    const text = assembleContinuationPrompt(state({ hasMap: false }));

    it("asks for extract by name and holds step 6 as mandatory", () => {
      expect(text).toContain("extract broadlineavida");
      expect(text).toContain("El paso 6 no es opcional");
    });

    it("does not complain about a source that is declared", () => {
      expect(text).not.toContain("no declara `manual.source`");
    });
  });

  describe("a manual that never recorded its decisions", () => {
    const text = assembleContinuationPrompt(state({ hasState: false }));

    it("says the file is missing rather than pointing at nothing", () => {
      expect(text).toContain("Estado registrado  NO existe todavía");
      expect(text).toContain("todavía no existe");
    });

    it("still asks for it to be created on the way out", () => {
      expect(text).toContain("manuals/broadlineavida/ESTADO.md");
    });
  });

  it("reports images honestly when none have been exported", () => {
    const text = assembleContinuationPrompt(state({ pending: null, totalImages: null }));
    expect(text).toContain("todavía no se exportaron pedidos");
  });
});

describe("the creation prompt hands off to the continuation prompt", () => {
  // The two flows meet at one file. If the creation prompt stops asking for it,
  // every later session starts blind — so this is asserted from both ends.
  it("asks the creation run to record its decisions in the same file", () => {
    const text = assemblePrompt(answers());
    expect(text).toContain("manuals/broadsec-internacional/ESTADO.md");
    expect(text).toContain("Cuando pares, dejá el estado escrito");
  });

  it("tells it not to log what the disk already knows", () => {
    expect(assemblePrompt(answers())).toContain("NO registres nada que se pueda derivar del disco");
  });
});
