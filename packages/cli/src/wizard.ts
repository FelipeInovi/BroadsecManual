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
import { classifyDelivery, readChangeLogRows } from "./delivery-state.ts";

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
    // `values` is what a current map writes; `tenants` is what one written
    // before the map named its axis wrote. Reading only the new name would make
    // this return an empty list for every map not yet regenerated — and it
    // returns an empty list legitimately too, so the regression would look like
    // the honest answer and prompt the person for deployments the repo knows.
    const parsedMap = JSON.parse(readFileSync(map, "utf8")) as {
      values?: readonly { id?: string }[];
      tenants?: readonly { id?: string }[];
    };
    const ids = (parsedMap.values ?? parsedMap.tenants ?? [])
      .map((t) => t.id)
      .filter((id): id is string => Boolean(id));
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

/**
 * Where a manual records what was DECIDED — never what was done.
 *
 * Deliberately committed, and deliberately not `.broadsec-manual/`: that folder
 * is gitignored and its files are overwritten per run, so a fresh checkout would
 * have no memory at all. It also sits beside `AGENTS.md` rather than inside it —
 * that file is timeless product knowledge, and a status section changing every
 * session would churn the one file agents read for rules.
 */
export const STATE_FILE = "ESTADO.md";

/**
 * What the repository can work out about a manual on its own.
 *
 * Every field here is DERIVED, which is the point: progress is readable off
 * disk and therefore cannot be stale, whereas a written log of the same facts
 * drifts the moment a commit is reverted and is believed anyway.
 */
export interface ManualState {
  readonly id: string;
  readonly title: string;
  /** `manual.source`. Null blocks extraction entirely — see the prompt's gate. */
  readonly source: string | null;
  readonly hasMap: boolean;
  readonly sections: number;
  /** Pending image slots, or null when nothing has been exported yet. */
  readonly pending: number | null;
  readonly totalImages: number | null;
  readonly hasState: boolean;
}

/** Every manual on disk, with the state the repository can derive for it. */
export function readManualStates(repoRoot: string): ManualState[] {
  const manualsDir = join(repoRoot, "manuals");
  if (!existsSync(manualsDir)) return [];

  const out: ManualState[] = [];
  for (const id of readdirSync(manualsDir).sort()) {
    const dir = join(manualsDir, id);
    const configFile = join(dir, "manual.config.yaml");
    if (!existsSync(configFile)) continue;

    const config = parseYaml(readFileSync(configFile, "utf8")) as {
      manual?: { title?: string; source?: string };
    };
    const sectionsDir = join(dir, "sections");
    const sections = existsSync(sectionsDir)
      ? readdirSync(sectionsDir).filter((f) => f.endsWith(".yaml")).length
      : 0;

    // Read rather than recomputed: `images` is what writes this, and a count
    // invented here could disagree with the document handed to another team.
    let pending: number | null = null;
    let totalImages: number | null = null;
    const requests = join(dir, "image-requests.json");
    if (existsSync(requests)) {
      const counts = (JSON.parse(readFileSync(requests, "utf8")) as {
        counts?: { pending?: number; total?: number };
      }).counts;
      pending = counts?.pending ?? null;
      totalImages = counts?.total ?? null;
    }

    out.push({
      id,
      title: config.manual?.title ?? id,
      source: config.manual?.source ?? null,
      hasMap: existsSync(join(dir, "knowledge", "module-map.json")),
      sections,
      pending,
      totalImages,
      hasState: existsSync(join(dir, STATE_FILE)),
    });
  }
  return out;
}

/** One line of derived state, for the picker. Information, never a decision. */
export function describeState(s: ManualState): string {
  const parts = [
    `${s.sections} sección(es)`,
    s.source === null ? "SIN fuente declarada" : `fuente ${s.source}`,
    s.hasMap ? "con mapa" : "SIN mapa",
  ];
  if (s.pending !== null) {
    parts.push(s.pending === 0 ? "imágenes completas" : `${s.pending} imagen(es) pendiente(s)`);
  }
  parts.push(s.hasState ? `con ${STATE_FILE}` : `sin ${STATE_FILE}`);
  return parts.join(" · ");
}

const SCOPE_INSTRUCTIONS: Readonly<Record<Scope, string>> = {
  spike:
    "Escribí UNA sección, de punta a punta, y detenete. Elegí la que ejercite la " +
    "mayor cantidad de tipos de bloque y al menos una fila condicionada por tenant " +
    "— un spike sin ningún `when` no probó el conditioning. Decí cuál elegiste y " +
    "por qué antes de escribirla.",
  module:
    "Escribí UN módulo hasta la definition of done de module-completeness, y " +
    "verificá sus ítems explícitamente. Reportá los que todavía no se pueden " +
    "verificar y por qué.",
  full:
    "Escribí todas las secciones, módulo por módulo, reportando después de cada uno " +
    "en lugar de entregar el manual entero como un solo resultado.",
};

/**
 * The prompt that starts the work.
 *
 * It POINTS; it does not instruct. How to onboard a product, author content, tag
 * a deployment or derive a palette is already written in the nested `AGENTS.md`
 * files and the skills they name — `manuals/AGENTS.md` puts it plainly: "a rule
 * stated twice is a rule that drifts". Restating any of it here would be a
 * second copy that goes stale the moment the real one is edited, and a SPANISH
 * copy of an English rule at that, so the divergence would not even be
 * greppable.
 *
 * What stays is only what the documentation cannot know: the four answers the
 * operator just gave, and which end of the process they land at.
 *
 * Pure: no I/O, so the assembled text can be tested without a TTY.
 */
export function assemblePrompt(a: WizardAnswers): string {
  const mapped = a.sourceId !== null;
  const lines: string[] = [
    mapped
      ? `Crear un manual nuevo a partir de un producto que este repositorio ya conoce.`
      : `Onboardear un producto que este repositorio todavía no conoce, como manual nuevo.`,
    "",
    `  Ruta del producto  ${a.sourcePath}`,
    `  Id en el registry  ${mapped ? a.sourceId : "(ninguno todavía)"}`,
    `  Id del manual      ${a.manualId}`,
    `  Alcance            ${SCOPES.find((s) => s.value === a.scope)?.label ?? a.scope}`,
    `  Target del spike   ${a.scope === "spike" ? (a.target ?? "se decide después del paso 6") : "n/a"}`,
    `  Diseño             ${a.design.kind === "existing" ? `tema existente \`${a.design.theme}\`` : "NUEVO — proponelo primero"}`,
    "",
    // The root file first, and only ever as a pointer. It is where the four
    // invariants live and where the rule that nested `AGENTS.md` files exist —
    // and which of them wins — is stated. Naming the leaves by hand, as the
    // lines below do, works only for the leaves somebody remembered to name;
    // reading the root is what lets the agent find the ones nobody did.
    `Empezá por AGENTS.md en la raíz: fija los invariantes del sistema y dónde`,
    `está el resto de la documentación.`,
    "",
  ];

  if (a.design.kind === "new") {
    lines.push(
      `Este manual necesita identidad visual propia. Proponela ANTES de relevar y`,
      `antes de escribir ningún archivo, derivada del producto en ${a.sourcePath}, y`,
      `esperá una decisión. Las reglas de dónde puede salir un color están en`,
      `packages/tokens/AGENTS.md.`,
      "",
    );
  } else {
    lines.push(
      `Declará \`manual.theme: ${a.design.theme}\` en la config del manual. Ese tema ya`,
      `existe: no lo edites y no agregues una marca.`,
      "",
    );
  }

  lines.push(
    ...(mapped
      ? [
          `El producto ya está relevado. Su entrada en \`sources/registry.yaml\` describe`,
          `al producto y no a este manual, así que no la edites ni lo relevés de nuevo:`,
          `arrancá en el paso 4 de "Adding a source" en sources/AGENTS.md. El mapa es`,
          `por MANUAL, así que este necesita el suyo.`,
        ]
      : [
          `Seguí "Adding a source" en sources/AGENTS.md desde el paso 1, entero. Ese`,
          `paso termina en un reporte: detenete ahí y esperá, porque lo que sigue`,
          `depende de sus respuestas.`,
        ]),
    "",
    `Para el contenido: ${SCOPE_INSTRUCTIONS[a.scope]}`,
    "",
    `Las reglas de autoría están en manuals/AGENTS.md y en las skills que nombra.`,
    "",
    // The one thing no AGENTS.md can anticipate, because this prompt creates the
    // risk: a Spanish request invites an agent to mirror Spanish into comments
    // and commit messages, which the machinery layer does not accept.
    `Este pedido está en español; el repositorio no lo es uniformemente. Seguí al`,
    `pie lo que dice manuals/AGENTS.md sobre qué va en cada idioma, y no espejes el`,
    `idioma de este texto en el código.`,
    "",
    `Cuando pares, dejá \`manuals/${a.manualId}/${STATE_FILE}\` al día. Su contrato —`,
    `decisiones sí, progreso derivable no— está en manuals/AGENTS.md.`,
  );

  return lines.join("\n");
}

/**
 * The prompt that resumes a manual somebody already started.
 *
 * The mirror image of `assemblePrompt`, and the asymmetry is the design.
 * Creating asks three questions because the repository knows nothing; resuming
 * asks none, because it knows almost everything and the answers are on disk. So
 * this carries no decisions — only the derived state, which of the two sources
 * wins when they disagree, and a gate for the states that block work outright.
 */
export function assembleContinuationPrompt(s: ManualState): string {
  const lines: string[] = [
    `Continuar un manual que este repositorio ya empezó.`,
    "",
    `  Id del manual      ${s.id}`,
    `  Fuente             ${s.source ?? "(ninguna declarada)"}`,
    `  Mapa del producto  ${s.hasMap ? "presente" : "NO existe"}`,
    `  Secciones escritas ${s.sections}`,
    `  Imágenes           ${
      s.pending === null
        ? "todavía no se exportaron pedidos"
        : `${s.pending} pendiente(s) de ${s.totalImages ?? "?"}`
    }`,
    `  Estado registrado  ${s.hasState ? `manuals/${s.id}/${STATE_FILE}` : "NO existe todavía"}`,
    "",
    // Same pointer as the creation prompt, for the same reason: this prompt also
    // names only the leaves it knows about.
    `Empezá por AGENTS.md en la raíz: fija los invariantes del sistema y dónde`,
    `está el resto de la documentación.`,
    "",
  ];

  // Derived state, not a rule, so it cannot live in AGENTS.md: this manual is
  // blocked right now. Both cases are real in this repository today, and
  // neither is fixed by writing more content on top.
  if (s.source === null || !s.hasMap) {
    lines.push(`## Antes de escribir una palabra`, "");
    if (s.source === null) {
      lines.push(
        `  - \`manual.config.yaml\` no declara \`manual.source\`, así que nada sabe qué`,
        `    producto documenta y \`extract\` no puede ni correr.`,
      );
    }
    if (!s.hasMap) {
      lines.push(
        `  - No hay \`knowledge/module-map.json\`. Corré \`extract ${s.id}\` y revisalo`,
        `    antes de seguir. Si el comando se niega porque el producto no declara`,
        `    registro de tenants, eso ES una respuesta: reportala y esperá. No hay`,
        `    mapa que esperar hasta que alguien escriba un extractor para él.`,
      );
    }
    lines.push(
      "",
      `Resolvelo, reportá y ESPERÁ. No escribas secciones para tapar esto: un manual`,
      `escrito sin mapa parsea y buildea igual, y por eso el defecto no se descubre`,
      `hasta que lo lee un cliente.`,
      "",
    );
  }

  lines.push(
    `## Dónde quedó`,
    "",
    `Derivá el PROGRESO del disco — \`sections/\`, \`knowledge/module-map.json\`,`,
    `\`image-requests.json\`, \`git log -- manuals/${s.id}/\`. No lo preguntes ni lo`,
    `asumas.`,
    "",
    s.hasState
      ? `Leé \`manuals/${s.id}/${STATE_FILE}\` para las DECISIONES: qué se decidió y por`
      : `No hay \`${STATE_FILE}\` todavía, así que no hay registro de por qué las cosas`,
    s.hasState
      ? `qué, que es lo único que el disco no puede decirte. Si se contradicen, gana el`
      : `están como están. Derivá lo que puedas del disco y crealo cuando pares. El`,
    s.hasState ? `disco.` : `contrato está en manuals/AGENTS.md.`,
    "",
    `No reescribas una sección que ya existe: está hecha hasta que alguien diga lo`,
    `contrario. Y no inventes el inventario total de módulos — nada en este`,
    `repositorio lo declara, así que si necesitás un total, derivalo, decí de dónde`,
    `y pedí aprobación antes de trabajar contra él.`,
    "",
    `Proponé el próximo paso —cuál, por qué ese, y qué vas a tocar— y ESPERÁ una`,
    `decisión. Las reglas de autoría están en manuals/AGENTS.md, en`,
    `manuals/${s.id}/AGENTS.md si existe, y en las skills que nombran.`,
    "",
    `Cuando pares, dejá \`manuals/${s.id}/${STATE_FILE}\` al día.`,
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
    // Continuing is offered only when there is something to continue, so the
    // menu never leads to an empty list.
    const started = readManualStates(repoRoot);
    const action =
      started.length === 0
        ? ("new" as const)
        : await select(rl, "¿Qué vamos a hacer?", [
            { label: "Crear un manual nuevo", value: "new" as const },
            {
              label: "Continuar un manual que ya empezó",
              detail:
                `${started.length} en el repositorio. No pregunta nada: el prompt lee el ` +
                `estado del disco y propone el próximo paso.`,
              value: "continue" as const,
            },
            {
              label: "Versionar un manual para entrega oficial",
              detail:
                `Archiva el PDF y el Word en deliveries/, sella la prueba de qué recibió ` +
                `el cliente, y si hace falta pide a un agente el resumen de la fila.`,
              value: "deliver" as const,
            },
          ]);

    if (action === "deliver") {
      return await deliveryFlow(rl, repoRoot, started);
    }

    if (action === "continue") {
      // Every manual is offered, including the ones missing a source or a map.
      // Hiding them would hide exactly the manuals that need attention most —
      // the state is shown so the choice is informed, not made for you.
      const picked = await select(
        rl,
        "¿Cuál manual?",
        started.map((s) => ({
          label: `${s.id}  ${dim(s.title)}`,
          detail: describeState(s),
          value: s,
        })),
      );
      return await handOff(
        rl,
        repoRoot,
        `.broadsec-manual/continue-${picked.id}.md`,
        assembleContinuationPrompt(picked),
      );
    }

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
    return await handOff(rl, repoRoot, `.broadsec-manual/new-${manualId}.md`, prompt);
  } finally {
    rl.close();
  }
}

/**
 * Write the assembled prompt, ask where it goes, and hand it over.
 *
 * Shared by both flows rather than duplicated: creating and continuing differ
 * entirely in what they ask and what they assemble, and not at all in how the
 * result reaches an agent. Duplicating this is how the two would drift into
 * launching differently on Windows.
 */
async function handOff(
  rl: ReturnType<typeof createInterface>,
  repoRoot: string,
  promptFile: string,
  prompt: string,
): Promise<number> {
  {
    // The prompt is written before the destination is chosen, so "just print"
    // and "launch an agent" hand over the same bytes and the file is a record of
    // what was asked either way.
    mkdirSync(join(repoRoot, ".broadsec-manual"), { recursive: true });
    writeFileSync(join(repoRoot, promptFile), `${prompt}\n`, "utf8");

    // --- where it goes ------------------------------------------------------
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
      "¿A dónde va?",
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
            "   leer el estado y escribir cada archivo es trabajo del agente.",
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
  }
}

/**
 * What `output/` holds for one manual, as filenames the wizard can show.
 *
 * DRAFTS AND SUPERSEDED BUILDS ARE EXCLUDED. Only a final build can become an
 * official delivery — a draft carries internal slot paths, and a
 * `-NO-ENTREGADO` build is by definition not the delivered document. Offering
 * either in a list of things to hand a client is offering a mistake.
 */
export function builtDeliverables(manualDir: string): readonly string[] {
  const out = join(manualDir, "output");
  if (!existsSync(out)) return [];
  return readdirSync(out)
    .filter((f) => /\.(pdf|docx)$/.test(f))
    .filter((f) => !/-BORRADOR|-NO-ENTREGADO/.test(f))
    .sort();
}

/** Every version those filenames carry, newest first. */
export function versionsInOutput(names: readonly string[]): readonly string[] {
  const found = new Set<string>();
  for (const n of names) {
    const m = /-v(\d+\.\d+\.\d+)\./.exec(n);
    if (m?.[1]) found.add(m[1]);
  }
  return [...found].sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (pb[i] ?? 0) - (pa[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });
}

/**
 * What to ask an agent for, once the deterministic half has run.
 *
 * The two modes differ in their INPUT and their framing, never in their
 * standards — which is why they name one skill rather than two. A first
 * delivery has nothing to diff against and describes what the manual covers; a
 * later one is read from the previous delivery's own commit forward.
 */
export function assembleDeliveryPrompt(
  manualId: string,
  kind: "summarise-first" | "summarise-since",
  version: string,
  since: string | null,
): string {
  const head =
    kind === "summarise-since"
      ? [
          `Escribí la fila ${version} del Historial de cambios de \`${manualId}\`.`,
          ``,
          `Lo entregado por última vez salió del commit \`${since}\`. Lo que cambió`,
          `desde entonces está en \`git log ${since}..HEAD\`.`,
        ]
      : [
          `Escribí la PRIMERA fila del Historial de cambios de \`${manualId}\`,`,
          `versión ${version}.`,
          ``,
          `No hay entrega anterior, así que no hay diff que tomar: la fila describe`,
          `lo que este manual CUBRE, no lo que cambió.`,
        ];

  return [
    ...head,
    ``,
    `Cargá la skill \`delivery-summary\` y seguila. Es la que dice qué le importa`,
    `a un cliente y qué es ruido nuestro.`,
    ``,
    `Los archivos ya están archivados en \`deliveries/${manualId}/\` y la prueba`,
    `quedó sellada. Falta la descripción, y sólo eso.`,
  ].join("\n");
}

/**
 * Promote a built manual to an official delivery.
 *
 * The deterministic half runs as the CLI's own `deliver` command, spawned
 * rather than imported: `main.ts` imports this file, so calling back into it
 * would be a cycle. Spawning also means the wizard and a plain terminal run
 * exactly the same code, which is the only way the two can be trusted to agree.
 */
async function deliveryFlow(
  rl: ReturnType<typeof createInterface>,
  repoRoot: string,
  manuals: readonly ManualState[],
): Promise<number> {
  const picked = await select(
    rl,
    "¿Cuál manual?",
    manuals.map((m) => ({ label: `${m.id}  ${dim(m.title)}`, value: m })),
  );
  const manualDir = join(repoRoot, "manuals", picked.id);

  const built = builtDeliverables(manualDir);
  if (built.length === 0) {
    ui(dim(`   No hay nada final en output/ de ${picked.id}.`));
    ui(dim(`   Construilo primero:  broadsec-manual build ${picked.id} --docx`));
    ui("");
    return 1;
  }

  ui(bold("Lo que hay construido y listo para entregar"));
  ui("");
  for (const f of built) ui(`   ${dim("·")} ${f}`);
  ui("");

  const versions = versionsInOutput(built);
  const version =
    versions.length === 1
      ? (versions[0] as string)
      : await select(
          rl,
          "¿Qué versión se entrega?",
          versions.map((v) => ({
            label: v,
            detail: built.filter((f) => f.includes(`-v${v}.`)).join("  "),
            value: v,
          })),
        );

  const state = classifyDelivery(readChangeLogRows(manualDir), version);
  if (state.kind === "already-delivered") {
    ui(dim(`   ${version} ya fue entregada. Una entrega es un hecho: publicar cambios`));
    ui(dim(`   necesita una versión nueva, no reescribir ésta.`));
    ui("");
    return 1;
  }
  if (state.kind === "not-the-newest") {
    ui(dim(`   ${version} está por debajo de ${state.newest}, la fila más alta de la tabla.`));
    ui(dim(`   Lo que hay en output/ se construyó del contenido actual, así que NO es`));
    ui(dim(`   esa versión: archivarlo con ese nombre guardaría el documento equivocado.`));
    ui("");
    return 1;
  }

  // --- the deterministic half, as the CLI's own command --------------------
  const code = await new Promise<number>((done) => {
    const child = spawn(
      process.execPath,
      [join(repoRoot, "packages", "cli", "src", "main.ts"), "deliver", picked.id, "--version", version],
      { cwd: repoRoot, stdio: "inherit" },
    );
    child.on("close", (c) => done(c ?? 1));
  });
  if (code !== 0) return code;

  if (state.kind === "stamp") {
    ui("");
    ui(dim(`   La fila ${version} ya estaba escrita, así que no hace falta ningún agente.`));
    ui("");
    return 0;
  }

  ui("");
  ui(dim(`   Falta la descripción de la fila, y eso es criterio: qué cambió PARA EL LECTOR.`));
  ui("");
  return await handOff(
    rl,
    repoRoot,
    `.broadsec-manual/entrega-${picked.id}-v${version}.md`,
    assembleDeliveryPrompt(
      picked.id,
      state.kind,
      version,
      state.kind === "summarise-since" ? state.since : null,
    ),
  );
}
