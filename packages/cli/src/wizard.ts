/**
 * The interactive entry point: collect what only a human knows, then hand off.
 *
 * This wizard does NOT create a manual. It assembles the prompt that starts one,
 * and the distinction is the whole point. `sources/AGENTS.md` is explicit that a
 * registry entry is the OUTPUT of surveying the product, never its starting
 * point — a wizard that filled in `tenantConfigs` because that is what the last
 * product used would produce a map that is confidently wrong, and every sentence
 * written against it would inherit the error. The failure is silent: the map
 * parses, the build succeeds.
 *
 * So the three things collected here are exactly the three the repository cannot
 * work out for itself — which product, what to call its manual, and how much of
 * it to attempt. Everything else is a finding, and findings are the agent's job.
 *
 * `assemblePrompt` is pure so the assembled text can be tested without a TTY.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { delimiter, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { parse as parseYaml } from "yaml";
import { themes } from "@broadsec-manual/tokens";

/**
 * Agent CLIs this wizard can hand the prompt to.
 *
 * Detected, never assumed: an entry that is not on PATH is shown greyed out
 * rather than offered and then failing. Adding one is a row here — the launch
 * itself is shape-independent because it only ever passes a filename.
 */
const AGENTS: readonly { readonly command: string; readonly label: string }[] = [
  { command: "claude", label: "Claude Code" },
];

/** How much of the manual this run attempts. */
export type Scope = "spike" | "module" | "full";

/**
 * Which visual identity the manual is delivered in.
 *
 * `existing` names a theme already in `packages/tokens` — the manual declares it
 * as `manual.theme` and nothing else changes. `new` is a different kind of job:
 * a palette and type scale have to be derived from the product itself before any
 * content exists, so the prompt puts a proposal ahead of everything else.
 */
export type Design =
  | { readonly kind: "existing"; readonly theme: string }
  | { readonly kind: "new" };

export interface WizardAnswers {
  /** Path to the product repository, as it will appear in the registry. */
  readonly sourcePath: string;
  /** The registry id, when the product is already a known source. */
  readonly sourceId: string | null;
  /** Folder name under `manuals/`. */
  readonly manualId: string;
  readonly scope: Scope;
  /**
   * Which deployment a spike builds against. Null when it cannot be known yet:
   * for an unmapped product the tenant list is a finding, not an input.
   */
  readonly target: string | null;
  readonly design: Design;
}

/** One source as the registry declares it. */
interface RegistrySource {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

const SCOPES: readonly { readonly value: Scope; readonly label: string; readonly detail: string }[] = [
  {
    value: "spike",
    label: "Spike de pipeline — una sección, de punta a punta",
    detail:
      "Valida la cadena completa (bloques, conditioning, numeración, imágenes, " +
      "build) antes de comprometerse con un manual entero. Así arrancó " +
      "broadlineavida: `sections/07-interfaz-general.yaml` todavía abre con " +
      "`# pipeline spike`.",
  },
  {
    value: "module",
    label: "Un módulo, completo",
    detail:
      "Un solo módulo llevado hasta la definition of done de module-completeness " +
      "— cada submódulo, cada procedimiento, cada slot de imagen declarado.",
  },
  {
    value: "full",
    label: "El manual entero",
    detail: "Todas las secciones. Vale la pena solo después de que un spike probó la cadena.",
  },
];

/**
 * Turn whatever the operator typed into the path the registry wants.
 *
 * Two things are being reconciled. A person pastes an absolute path, because
 * that is what a file manager and a shell hand them. `sources/registry.yaml`
 * stores paths **relative to this repository's root** — an absolute one would
 * be true on one machine and wrong on the next checkout.
 *
 * So an absolute answer is accepted and converted, and separators are
 * normalised to forward slashes so a Windows answer produces the same entry a
 * POSIX one would.
 */
export function normaliseSourcePath(
  input: string,
  repoRoot: string,
): { readonly path: string } | { readonly problem: string } {
  if (input.trim() === "") return { problem: "hace falta una ruta" };
  const typed = input.trim().replace(/^["']|["']$/g, "");
  const absolute = isAbsolute(typed) ? resolve(typed) : resolve(repoRoot, typed);

  if (!existsSync(absolute)) return { problem: `no hay nada en ${absolute}` };
  if (!statSync(absolute).isDirectory()) return { problem: "eso es un archivo, no un repositorio" };
  if (absolute === resolve(repoRoot)) {
    return { problem: "eso es este repositorio, no un producto fuente" };
  }

  const rel = relative(repoRoot, absolute);
  // A different drive letter has no relative form. Keep the absolute path and let
  // the survey record why, rather than emitting a path that resolves nowhere.
  const chosen = rel === "" || isAbsolute(rel) ? absolute : rel;
  return { path: chosen.split(sep).join("/") };
}

/** `manuals/<id>/` is a folder name, so the id is constrained like one. */
export function validateManualId(id: string, repoRoot: string): string | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    return "solo minúsculas, dígitos y guiones simples — se convierte en el nombre de una carpeta";
  }
  if (existsSync(join(repoRoot, "manuals", id))) {
    return `manuals/${id}/ ya existe`;
  }
  return null;
}

/** Sources the registry already knows, so a mapped product is picked, not retyped. */
export function readRegistrySources(repoRoot: string): RegistrySource[] {
  const file = join(repoRoot, "sources", "registry.yaml");
  if (!existsSync(file)) return [];
  const parsed = parseYaml(readFileSync(file, "utf8")) as {
    sources?: Record<string, { name?: string; path?: string }>;
  };
  return Object.entries(parsed.sources ?? {}).map(([id, entry]) => ({
    id,
    name: entry.name ?? id,
    path: entry.path ?? "",
  }));
}

/**
 * Deployments this source is already known to have.
 *
 * Read from any manual already built on it — its `module-map.json` carries the
 * tenant registry as `extract` derived it, which is more trustworthy than a
 * config file somebody may have edited by hand. Empty for an unmapped product,
 * and that is the honest answer rather than a guess.
 */
export function knownTenants(repoRoot: string, sourceId: string): string[] {
  const manualsDir = join(repoRoot, "manuals");
  if (!existsSync(manualsDir)) return [];
  for (const entry of readdirSync(manualsDir)) {
    const config = join(manualsDir, entry, "manual.config.yaml");
    const map = join(manualsDir, entry, "knowledge", "module-map.json");
    if (!existsSync(config) || !existsSync(map)) continue;
    const parsed = parseYaml(readFileSync(config, "utf8")) as { manual?: { source?: string } };
    if (parsed.manual?.source !== sourceId) continue;
    const parsedMap = JSON.parse(readFileSync(map, "utf8")) as {
      tenants?: readonly { id?: string }[];
    };
    const ids = (parsedMap.tenants ?? []).map((t) => t.id).filter((id): id is string => Boolean(id));
    if (ids.length > 0) return ids;
  }
  return [];
}

/**
 * Which manuals already ship in each theme.
 *
 * Read off disk rather than described in a table here: a theme added to
 * `packages/tokens` shows up in the menu on its own, and the manuals using it
 * stay accurate without anyone maintaining a list. A theme nothing uses yet is
 * still offered — it exists, it is just unused.
 */
export function themeUsage(repoRoot: string, themeNames: readonly string[]): Map<string, string[]> {
  const usage = new Map<string, string[]>(themeNames.map((t) => [t, []]));
  const manualsDir = join(repoRoot, "manuals");
  if (!existsSync(manualsDir)) return usage;

  for (const entry of readdirSync(manualsDir)) {
    const config = join(manualsDir, entry, "manual.config.yaml");
    if (!existsSync(config)) continue;
    const parsed = parseYaml(readFileSync(config, "utf8")) as { manual?: { theme?: string } };
    // An omitted theme is not "no theme" — the build falls back to broadsec, so
    // that is what the manual actually ships in.
    const declared = parsed.manual?.theme ?? "broadsec";
    usage.get(declared)?.push(entry);
  }
  return usage;
}

const SCOPE_INSTRUCTIONS: Readonly<Record<Scope, string>> = {
  spike:
    "Escribí UNA sección, de punta a punta, y detenete. Elegí la sección que " +
    "ejercite la mayor cantidad de tipos de bloque y al menos una fila condicionada " +
    "por tenant — un spike sin ningún `when` no probó el conditioning. Decí qué " +
    "sección elegiste y por qué antes de escribirla.",
  module:
    "Escribí UN módulo hasta la definition of done de module-completeness, y verificá " +
    "sus dieciséis ítems uno por uno explícitamente. Reportá los que todavía no se " +
    "pueden verificar y por qué — el build y el pase de imágenes deciden dos de " +
    "ellos, no vos.",
  full:
    "Escribí todas las secciones. Trabajá módulo por módulo y reportá después de " +
    "cada uno, en lugar de entregar el manual completo como un solo resultado.",
};

/** The prompt that starts the work. Pure: no I/O, so it can be tested. */
export function assemblePrompt(a: WizardAnswers): string {
  const mapped = a.sourceId !== null;
  const lines: string[] = [];

  lines.push(
    mapped
      ? `Crear un manual nuevo en este repositorio, a partir de un producto que ya conoce.`
      : `Onboardear un producto que este repositorio todavía no conoce, como manual nuevo.`,
    "",
    `  Ruta del producto  ${a.sourcePath}`,
    `  Id en el registry  ${mapped ? a.sourceId : "(ninguno — no está en sources/registry.yaml)"}`,
    `  Id del manual      ${a.manualId}`,
    `  Alcance            ${SCOPES.find((s) => s.value === a.scope)?.label ?? a.scope}`,
    `  Target del spike   ${a.scope === "spike" ? (a.target ?? "se decide después del paso 6 — la lista de tenants es un hallazgo") : "n/a"}`,
    `  Diseño             ${a.design.kind === "existing" ? `tema existente \`${a.design.theme}\`` : "NUEVO — proponelo primero"}`,
    "",
  );

  if (a.design.kind === "new") {
    lines.push(
      `## Antes que nada: proponé el diseño`,
      "",
      `Este manual necesita identidad visual propia, así que eso va primero — antes`,
      `del relevamiento, antes de cualquier archivo. Presentá una propuesta y ESPERÁ`,
      `una decisión sobre ella.`,
      "",
      `Derivala del producto mismo, en ${a.sourcePath}. Su propia hoja de estilos o`,
      `declaración de tema es la fuente: la paleta de Bridge360 salió del bloque`,
      `\`@theme\` de su \`src/app/App.css\`, y la de Broadsec del vector content stream`,
      `de su PDF entregado. Ninguna se muestreó de una captura de pantalla, y esa`,
      `regla es absoluta — ver packages/tokens/AGENTS.md. Un color inventado para`,
      `desbloquear el trabajo es peor que uno faltante.`,
      "",
      `La propuesta tiene que decir, concretamente:`,
      "",
      `  - De dónde salió cada valor, con archivo y línea. Un color que no podés`,
      `    señalar no entra.`,
      `  - Los diez roles de color que pide \`Brand\`, mapeados a lo que usa el`,
      `    producto: deep, deepest, accentLight, accentDark, bodyInk, mutedInk,`,
      `    headerInk, surfaceAccent, surfaceCool, ruleLight.`,
      `  - Las tres tipografías: sans, display, mono. Decí si la display difiere de`,
      `    la del cuerpo — en las dos marcas existentes esa sola decisión es la mayor`,
      `    parte de lo que distingue sus manuales.`,
      `  - Si necesita su propia escala tipográfica y rampa de espaciado.`,
      `    \`Brand.scale\` es opcional y se mergea POR PELDAÑO, así que sobreescribí`,
      `    solo los peldaños que el diseño realmente necesita, y decí por qué. Cada`,
      `    peldaño sobreescrito es un peldaño que deja de arreglarse una sola vez`,
      `    para todos los manuales.`,
      `  - Si necesita una composición de portada o una hoja de estilos que todavía`,
      `    no existen. \`coverStyle\` y \`sheet\` son uniones CERRADAS ("band" | "mark",`,
      `    "broadsec" | "bridge"). Un tercer valor de cualquiera de las dos es un`,
      `    cambio de tipos más un archivo de estilos nuevo — la composición vive en`,
      `    el markup y el CSS, y los tokens no pueden expresarla. Si el diseño`,
      `    necesita eso, decilo en la propuesta: es lo más caro de esta lista y no`,
      `    puede descubrirse después.`,
      "",
      `Mostrala como comparación contra los temas existentes, no en aislamiento. Lo`,
      `que importa es si este manual se va a leer como documento propio al lado de`,
      `ellos.`,
      "",
      `No escribas un token, una config ni una sección hasta que la propuesta esté`,
      `aceptada.`,
      "",
    );
  } else {
    lines.push(
      `Declará \`manual.theme: ${a.design.theme}\` en la config del manual. Ese tema ya`,
      `existe en packages/tokens — no lo edites, y no agregues una marca. Un manual`,
      `que reusa un tema es exactamente el caso para el que existe la capa semántica`,
      `compartida.`,
      "",
    );
  }

  if (mapped) {
    lines.push(
      `El producto ya está en \`sources/registry.yaml\`, así que el relevamiento está`,
      `hecho y sus puntos de extracción quedaron registrados. NO lo relevés de nuevo`,
      `y NO edites esa entrada: describe al producto, y el producto no cambió porque`,
      `se esté escribiendo un segundo manual contra él.`,
      "",
      `Arrancá en el paso 4 de "Adding a source" en sources/AGENTS.md:`,
      "",
      `  4. Creá manuals/${a.manualId}/ con su manual.config.yaml. Declará solo los`,
      `     ejes que este manual realmente necesita, y solo los targets que va a`,
      `     construir.`,
      `  5. Corré: node packages/cli/src/main.ts extract ${a.manualId}`,
      `     El mapa es por MANUAL, no por producto — este manual necesita el suyo.`,
      `  6. Revisá el knowledge/module-map.json generado antes de escribir una palabra`,
      `     de contenido. El paso 6 no es opcional.`,
      "",
    );
  } else {
    lines.push(
      `Seguí "Adding a source" en sources/AGENTS.md desde el paso 1. Los pasos 1, 2 y`,
      `6 NO son opcionales.`,
      "",
      `NO escribas todavía la entrada del registry. La entrada es el RESULTADO del`,
      `relevamiento, no su punto de partida — copiar la forma de una entrada existente`,
      `sobre un producto nuevo produce un mapa confiadamente equivocado, y la falla es`,
      `silenciosa: el mapa parsea y el build pasa.`,
      "",
      `Reportá todo esto antes de tocar sources/:`,
      "",
      `  - Framework y estructura.`,
      `  - Si es multi-tenant, y en ese caso cómo se resuelve la tenancy, con archivo`,
      `    y línea.`,
      `  - Dónde viven las etiquetas de UI, y si hay un catálogo i18n.`,
      `  - Si hay rutas declaradas en alguna parte.`,
      `  - Qué NO pudiste determinar. Decilo en lugar de asumirlo.`,
      `  - Si packages/extract sirve para esta forma: "fits", "fits partly" o "needs a`,
      `    new extractor". Leé packages/extract/AGENTS.md antes de contestar — está`,
      `    escrito para la forma de un solo producto, y un segundo producto no entra`,
      `    por configuración.`,
      "",
      `Detenete después de ese reporte y esperá. Los pasos que siguen dependen de sus`,
      `respuestas.`,
      "",
    );
  }

  lines.push(
    `Después, para el contenido en sí:`,
    "",
    `  ${SCOPE_INSTRUCTIONS[a.scope]}`,
    "",
    `Las reglas de autoría están en manuals/AGENTS.md y en las skills que nombra. Leé`,
    `el catálogo de bloques en packages/blocks/src/catalog/ antes de elegir un tipo:`,
    `el \`description\` de cada definición dice cuándo usarla EN LUGAR DE otra parecida.`,
    "",
    // Stated because this prompt is in Spanish and the repository is not, uniformly.
    // Without it an agent reasonably mirrors the prompt's language into comments and
    // commit messages, which the machinery layer does not accept.
    `Sobre el idioma de lo que produzcas — esto está pedido en español, pero el`,
    `repositorio no lo es uniformemente, así que seguí manuals/AGENTS.md al pie:`,
    "",
    `  - En español: el contenido del manual, y los ids y nombres de archivo de las`,
    `    secciones. Nombran el asunto del manual.`,
    `  - En inglés: las claves de config y props de bloque, los nombres de tipo de`,
    `    bloque, los comentarios de código, los mensajes de commit y los nombres de`,
    `    archivo de infraestructura. Pertenecen al pipeline, que comparten todos los`,
    `    manuales.`,
    "",
    `Dos cosas de las que este repositorio no te va a avisar:`,
    "",
    `  - Nada valida una referencia que cruza un borde de tenant. Leer la salida`,
    `    construida de cada target es la única verificación que existe.`,
    `  - Las imágenes van al final. El contenido declara los slots; \`images\` exporta`,
    `    el documento de pedidos; recién entonces se entrega algo. Un manual recién`,
    `    escrito está 100% pendiente, y ese es el estado correcto.`,
  );

  return lines.join("\n");
}

// --- handing the prompt to an agent ---------------------------------------

/** Everything `findExecutable` needs from the environment, so it can be tested. */
export interface ExecutableProbe {
  readonly path: string | undefined;
  /** Windows only: the extensions that make a name executable. */
  readonly pathext: string | undefined;
  readonly delimiter: string;
  readonly exists: (candidate: string) => boolean;
}

/**
 * Locate a command on PATH without spawning anything to ask.
 *
 * Probing by running the tool would mean starting an agent CLI just to find out
 * it exists. Walking PATH costs nothing and, on Windows, is the only way to see
 * that `claude` is really `claude.cmd` — which decides whether the launch needs
 * a shell.
 */
export function findExecutable(name: string, probe: ExecutableProbe): string | null {
  const dirs = (probe.path ?? "").split(probe.delimiter).filter((d) => d !== "");
  const listed = (probe.pathext ?? "").split(";").filter((e) => e !== "");

  // PATHEXT first, bare name last, which is how Windows itself resolves — and it
  // matters more than it looks. An npm global install puts BOTH `claude` (a shell
  // script for a POSIX-y shell) and `claude.cmd` on PATH. Preferring the bare name
  // picks the script, which Windows cannot execute: the launch would die with
  // ENOEXEC after the wizard had already reported success. Where PATHEXT is unset
  // the bare name is the only candidate, which is correct for POSIX.
  const extensions = listed.length > 0 ? [...listed, ""] : [""];

  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = join(dir, name + ext.toLowerCase());
      if (probe.exists(candidate)) return candidate;
    }
  }
  return null;
}

export interface LaunchPlan {
  readonly command: string;
  readonly args: readonly string[];
  /** True only where the interpreter demands it — a Windows `.cmd` shim. */
  readonly shell: boolean;
}

/**
 * A path safe to put on a command line unquoted.
 *
 * The prompt file is named by this tool, so this is a self-check rather than
 * input validation: if it ever fails, the naming changed and the launch must be
 * refused instead of building a command that a shell will re-split.
 */
export function isShellSafePath(p: string): boolean {
  return /^[A-Za-z0-9._\-/]+$/.test(p);
}

/**
 * How to start an agent on the assembled prompt.
 *
 * The long prompt NEVER reaches the command line. It contains quotes, backticks
 * and newlines, and any of them would be re-interpreted by a Windows shell. So
 * it is written to a file and the command carries one fixed sentence naming that
 * file — ASCII, one line, and entirely authored here rather than typed by anyone.
 *
 * That single decision is what makes the Windows case tractable: a `.cmd` shim
 * must go through a shell, and a shell is only dangerous when it is handed text
 * somebody else wrote.
 *
 * The sentence is Spanish like the rest of the CLI, but deliberately unaccented:
 * a `.cmd` shim is launched through `cmd.exe`, whose console codepage is not
 * UTF-8 by default, so an accented character can reach the agent mojibaked. This
 * is the one string in the CLI that crosses a shell boundary, and ASCII is the
 * only spelling that survives it intact on every machine.
 */
export function launchPlan(executable: string, promptFile: string): LaunchPlan {
  const sentence = `Lee el archivo ${promptFile} y aplica sus instrucciones.`;
  const needsShell = /\.(cmd|bat)$/i.test(executable);
  return {
    command: executable,
    // Pre-quoted for the shell case, bare where argv is passed through untouched.
    args: [needsShell ? `"${sentence}"` : sentence],
    shell: needsShell,
  };
}

// --- interaction ----------------------------------------------------------

/**
 * Chrome goes to stderr, the assembled prompt to stdout.
 *
 * That split is what lets the prompt be redirected or piped — `new > prompt.md`,
 * or `new | clip` — while the menus stay on the terminal where they are being
 * answered. Mixing them meant the only way to get the prompt out was to select
 * it with a mouse.
 */
const ui = (line = ""): void => void process.stderr.write(`${line}\n`);

const colour = !process.env["NO_COLOR"] && process.stderr.isTTY;
const c = (code: string, s: string) => (colour ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s: string) => c("2", s);
const bold = (s: string) => c("1", s);
const accent = (s: string) => c("38;2;20;184;166", s);

function splash(repoRoot: string): void {
  const manuals = existsSync(join(repoRoot, "manuals"))
    ? readdirSync(join(repoRoot, "manuals")).filter((d) =>
        existsSync(join(repoRoot, "manuals", d, "manual.config.yaml")),
      ).length
    : 0;
  const catalogDir = join(repoRoot, "packages", "blocks", "src", "catalog");
  const blocks = existsSync(catalogDir)
    ? readdirSync(catalogDir).filter((f) => f.endsWith(".ts") && f !== "index.ts").length
    : 0;

  ui("");
  ui(`   ${accent("▄▄▄")}  ${bold("M A N U A L E S")}  ${dim("·")}  ${bold("I N O V I S E C")}`);
  ui(`   ${accent("▀▀▀")}  ${dim("pipeline de documentación condicionada por despliegue")}`);
  ui("");
  ui(dim(`   ${manuals} manual(es) · ${blocks} tipos de bloque · un solo AST`));
  ui("");
}

/** A numbered menu. Deliberately not arrow-key driven: no raw mode, no TTY edge cases. */
async function select<T>(
  rl: ReturnType<typeof createInterface>,
  title: string,
  options: readonly { readonly label: string; readonly detail?: string; readonly value: T }[],
): Promise<T> {
  ui(bold(title));
  ui("");
  options.forEach((o, i) => {
    ui(`   ${accent(String(i + 1))}  ${o.label}`);
    if (o.detail) ui(dim(`      ${o.detail.replace(/\s+/g, " ")}`));
  });
  ui("");
  for (;;) {
    const answer = (await rl.question(`   opción [1-${options.length}]: `)).trim();
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) {
      ui("");
      return options[n - 1]!.value;
    }
    ui(dim(`   no es una opción entre 1 y ${options.length}.`));
  }
}

/**
 * Ask until the answer parses. `parse` returns the accepted VALUE rather than a
 * boolean, so a question that normalises its answer — a path becoming a
 * repo-relative one — cannot hand back the raw text by accident.
 */
async function ask<T>(
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  parse: (v: string) => { readonly value: T } | { readonly problem: string },
): Promise<T> {
  for (;;) {
    const result = parse((await rl.question(`   ${prompt}: `)).trim());
    if ("value" in result) {
      ui("");
      return result.value;
    }
    ui(dim(`   ${result.problem}`));
  }
}

/** Steps 1 to 3, then the assembled prompt. Returns an exit code. */
export async function runWizard(repoRoot: string): Promise<number> {
  if (!existsSync(join(repoRoot, "sources", "registry.yaml"))) {
    console.error(
      `error: no se encontró sources/registry.yaml en ${repoRoot}.\n` +
        `Corré esto desde la raíz del repositorio.`,
    );
    return 1;
  }

  // Refused rather than attempted without a terminal. `readline` over a piped
  // stream emits every line at once, so answers land before their questions are
  // asked, the last `question` never resolves, and the process exits 0 — a
  // success code for a wizard that collected nothing. Failing loudly is the only
  // honest option, and a wizard has no non-interactive meaning anyway.
  if (!process.stdin.isTTY) {
    console.error(
      `error: este comando es interactivo y stdin no es una terminal.\n` +
        `Correlo directo, sin pipe ni redirección.`,
    );
    return 1;
  }

  splash(repoRoot);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const action = await select(rl, "¿Qué vamos a hacer?", [
      { label: "Crear un manual nuevo", value: "new" as const },
    ]);
    if (action !== "new") return 0;

    // --- step 1: the product -------------------------------------------------
    const registry = readRegistrySources(repoRoot);
    const useMapped =
      registry.length > 0 &&
      (await select(rl, "Paso 1 — ¿qué producto?", [
        {
          label: "Un producto que ya está en el registry",
          detail: `${registry.length} mapeado(s): ${registry.map((r) => r.id).join(", ")}`,
          value: true,
        },
        {
          label: "Un producto que este repositorio todavía no conoce",
          detail: "Su entrada en el registry se escribe después del relevamiento, no antes.",
          value: false,
        },
      ]));

    let sourceId: string | null = null;
    let sourcePath: string;
    if (useMapped) {
      const picked = await select(
        rl,
        "¿Cuál?",
        registry.map((r) => ({ label: `${r.id}  ${dim(r.name)}`, detail: r.path, value: r })),
      );
      sourceId = picked.id;
      sourcePath = picked.path;
    } else {
      ui(dim("   Absoluta o relativa a este repositorio — las dos sirven.\n"));
      sourcePath = await ask(rl, "ruta del repositorio del producto", (v) => {
        const result = normaliseSourcePath(v, repoRoot);
        return "problem" in result ? result : { value: result.path };
      });
    }

    // --- step 2: the manual id -----------------------------------------------
    const manualId = await ask(rl, "Paso 2 — id para este manual", (v) => {
      if (v === "") return { problem: "hace falta un id" };
      const problem = validateManualId(v, repoRoot);
      return problem === null ? { value: v } : { problem };
    });

    // --- step 3: scope -------------------------------------------------------
    const scope = await select(
      rl,
      "Paso 3 — ¿cuánto abarcamos?",
      SCOPES.map((s) => ({ label: s.label, detail: s.detail, value: s.value })),
    );

    let target: string | null = null;
    if (scope === "spike" && sourceId !== null) {
      const tenants = knownTenants(repoRoot, sourceId);
      if (tenants.length > 0) {
        target = await select(
          rl,
          "¿Contra qué despliegue construye el spike?",
          tenants.map((t) => ({ label: t, value: t })),
        );
      }
    }

    // --- step 4: the design --------------------------------------------------
    const themeNames = Object.keys(themes);
    const usage = themeUsage(repoRoot, themeNames);
    const design = await select<Design>(rl, "Paso 4 — ¿qué aspecto tiene?", [
      ...themeNames.map((theme) => {
        const used = usage.get(theme) ?? [];
        return {
          label: `Reusar el tema \`${theme}\``,
          detail:
            used.length > 0
              ? `Ya lo usan: ${used.join(", ")}. No cambia nada en packages/tokens.`
              : "Definido en packages/tokens, todavía no lo usa ningún manual.",
          value: { kind: "existing", theme } as const,
        };
      }),
      {
        label: "Un diseño nuevo, derivado de este producto",
        detail:
          "El agente propone una paleta y una tipografía tomadas del tema o la hoja " +
          "de estilos del producto, y espera una decisión antes de escribir nada.",
        value: { kind: "new" } as const,
      },
    ]);

    const prompt = assemblePrompt({ sourcePath, sourceId, manualId, scope, target, design });

    // The prompt is written before the destination is chosen, so "just print"
    // and "launch an agent" hand over the same bytes and the file is a record of
    // what was asked either way.
    const promptFile = `.broadsec-manual/new-${manualId}.md`;
    mkdirSync(join(repoRoot, ".broadsec-manual"), { recursive: true });
    writeFileSync(join(repoRoot, promptFile), `${prompt}\n`, "utf8");

    // --- step 5: where it goes ----------------------------------------------
    const agents = AGENTS.map((a) => ({
      ...a,
      executable: findExecutable(a.command, {
        path: process.env["PATH"],
        pathext: process.env["PATHEXT"],
        delimiter: delimiter,
        exists: existsSync,
      }),
    }));

    // The value carries the resolved executable, so an entry that was not found
    // cannot be selected into a launch: it falls back to printing by type, not by
    // a check somebody has to remember to write.
    const destination = await select<{ readonly label: string; readonly executable: string } | "print">(
      rl,
      "Paso 5 — ¿a dónde va?",
      [
        ...agents.map((a) =>
          a.executable === null
            ? {
                label: dim(`${a.label}  (no encontrado)`),
                detail: `\`${a.command}\` no está en el PATH — en su lugar se imprime`,
                value: "print" as const,
              }
            : {
                label: a.label,
                detail: a.executable,
                value: { label: a.label, executable: a.executable },
              },
        ),
        {
          label: "Solo imprimirlo",
          detail: "Se escribe al archivo igual, y sale por stdout para poder pipearlo.",
          value: "print" as const,
        },
      ],
    );

    ui(dim(`   Prompt escrito en ${promptFile}`));
    ui("");

    if (destination === "print") {
      ui(bold("   El prompt para pasarle al agente"));
      ui(dim("   ──────────────────────────────────────────────────────────"));
      ui("");
      // The one thing on stdout: redirect or pipe gets exactly this.
      process.stdout.write(`${prompt}\n`);
      ui("");
      ui(
        dim(
          "   No se creó nada más. Este asistente junta lo que solo vos sabés;\n" +
            "   el relevamiento y todos los archivos son trabajo del agente.",
        ),
      );
      ui("");
      return 0;
    }

    if (!isShellSafePath(promptFile)) {
      console.error(
        `error: no se lanza — "${promptFile}" no es seguro para poner en una línea de comandos.\n` +
          `El prompt ya está escrito; abrilo con tu agente a mano.`,
      );
      return 1;
    }

    const plan = launchPlan(destination.executable, promptFile);
    ui(dim(`   Iniciando ${destination.label}…`));
    ui("");
    rl.close();
    return await new Promise<number>((done) => {
      const child = spawn(plan.command, [...plan.args], {
        cwd: repoRoot,
        stdio: "inherit",
        shell: plan.shell,
      });
      child.on("error", (error) => {
        console.error(`error: no se pudo iniciar ${plan.command}: ${error.message}`);
        done(1);
      });
      child.on("exit", (code) => done(code ?? 0));
    });
  } finally {
    rl.close();
  }
}
