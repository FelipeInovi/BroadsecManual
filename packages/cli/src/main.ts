#!/usr/bin/env node
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { catalog } from "@broadsec-manual/blocks";
import type { BuildTarget, ManualDocument, ManualNode } from "@broadsec-manual/blocks";
import { assemble, loadSection, ContentError, type ContentWarning } from "@broadsec-manual/core";
import { renderHtml, pagedRuntime } from "@broadsec-manual/render-web";
import { printToPdf } from "./chrome.ts";

const axisValueSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .passthrough();

const axisSchema = z
  .object({
    values: z.array(axisValueSchema).min(1),
  })
  .passthrough();

/**
 * Validated shape of `manual.config.yaml`.
 *
 * Every target must declare a value for every axis the manual declares —
 * enforced below with `superRefine`, because a target silently missing an
 * axis leaves that axis unconstrained during conditioning (`matches()`
 * treats an axis absent from the target as unconstrained), which merges
 * every value of that axis into one manual instead of raising an error.
 */
export const manualConfigSchema = z
  .object({
    manual: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
        product: z.string().min(1),
        contentVersion: z.string().min(1),
      })
      .passthrough(),
    axes: z.record(z.string().min(1), axisSchema),
    targets: z.array(z.record(z.string().min(1), z.string().min(1))).min(1),
    output: z
      .object({
        dir: z.string().min(1),
        filename: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((config, ctx) => {
    const axisNames = Object.keys(config.axes);
    config.targets.forEach((target, i) => {
      for (const axis of axisNames) {
        if (!(axis in target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["targets", i, axis],
            message:
              `target ${i} is missing a value for axis "${axis}", declared in ` +
              `\`axes\`. Every target must declare a value for every axis — ` +
              `never a permissive default.`,
          });
        }
      }
    });
  });

export type ManualConfig = z.infer<typeof manualConfigSchema>;

function loadDocument(
  manualDir: string,
  config: ManualConfig,
): { doc: ManualDocument; warnings: ContentWarning[] } {
  const dir = join(manualDir, "sections");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const warnings: ContentWarning[] = [];
  const children: ManualNode[] = files.map((f) => {
    const loaded = loadSection(readFileSync(join(dir, f), "utf8"), `sections/${f}`, catalog);
    warnings.push(...loaded.warnings);
    return loaded.node;
  });
  return {
    doc: {
      manualId: config.manual.id,
      version: config.manual.contentVersion,
      children,
    },
    warnings,
  };
}

/**
 * Print collected literal-number/reference/anchor warnings, grouped by file
 * and counted. Non-blocking — see `ContentWarning` — the build has already
 * succeeded by the time this runs; the author decides what to do with them.
 */
function printWarnings(warnings: readonly ContentWarning[]): void {
  if (warnings.length === 0) return;
  const byFile = new Map<string, ContentWarning[]>();
  for (const warning of warnings) {
    const forFile = byFile.get(warning.file) ?? [];
    forFile.push(warning);
    byFile.set(warning.file, forFile);
  }
  const noun = warnings.length === 1 ? "reference" : "references";
  console.log(`\n${warnings.length} possible numeric ${noun} (build not blocked):`);
  for (const [file, forFile] of byFile) {
    console.log(`  ${file} (${forFile.length}):`);
    for (const warning of forFile) {
      console.log(`    [${warning.nodeId}] ${warning.message}`);
    }
  }
}

/**
 * Resolve an axis value's display name for client-facing text (e.g. the
 * cover page).
 *
 * An axis value that is not declared in `manual.config.yaml` is a build
 * error, never a stringified fallback — printing a literal id (or worse,
 * `"undefined"`) on a client-facing cover page is exactly the kind of trace
 * of the pipeline's internals invariant 4 forbids.
 */
export function axisValueName(config: ManualConfig, axis: string, valueId: string): string {
  const found = config.axes[axis]?.values.find((v) => v.id === valueId);
  if (!found) {
    throw new Error(
      `axis "${axis}" has no declared value "${valueId}" in manual.config.yaml — ` +
        `add it to \`axes.${axis}.values\` before building.`,
    );
  }
  return found.name;
}

/** Read a required axis value off a target, after config validation has guaranteed it is present. */
function requireAxisValue(target: BuildTarget, axis: string): string {
  const value = target[axis];
  if (value === undefined) {
    throw new Error(`internal error: build target is missing axis "${axis}"`);
  }
  return value;
}

/**
 * Parse `--tenant <id>` and the general `--axis <name>=<value>` form into a
 * map of axis id -> value to filter build targets by.
 *
 * `--tenant` is shorthand for `--axis tenant=<id>` — kept so a second axis
 * never needs a new CLI surface (see `packages/cli/AGENTS.md`).
 */
export function parseAxisFilters(args: readonly string[]): Map<string, string> {
  const filters = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--tenant") {
      const value = args[i + 1];
      if (!value) throw new Error("--tenant requires a value");
      filters.set("tenant", value);
      i += 1;
    } else if (arg === "--axis") {
      const pair = args[i + 1];
      if (!pair) throw new Error("--axis requires a value in the form <name>=<value>");
      const eq = pair.indexOf("=");
      if (eq <= 0) {
        throw new Error(`--axis value "${pair}" must be in the form <name>=<value>`);
      }
      filters.set(pair.slice(0, eq), pair.slice(eq + 1));
      i += 1;
    }
  }
  return filters;
}

async function build(manualDir: string, filters: ReadonlyMap<string, string>): Promise<void> {
  const configFile = join(manualDir, "manual.config.yaml");
  const parsed = manualConfigSchema.safeParse(parseYaml(readFileSync(configFile, "utf8")));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ContentError(configFile, "manual.config", `invalid manual configuration — ${detail}`);
  }
  const config = parsed.data;

  const { doc, warnings } = loadDocument(manualDir, config);
  const outDir = join(manualDir, config.output.dir);
  mkdirSync(outDir, { recursive: true });

  const polyfill = pagedRuntime();
  const assetBase = pathToFileURL(join(manualDir, "assets", "figures")).href;

  const targets = config.targets.filter((t) =>
    [...filters.entries()].every(([axis, value]) => t[axis] === value),
  );
  if (targets.length === 0) {
    const desc = [...filters.entries()].map(([axis, value]) => `${axis}=${value}`).join(", ");
    throw new Error(`No target matches ${desc || "(no filter)"}`);
  }

  for (const target of targets) {
    const manual = assemble(doc, target, catalog);
    const name = config.output.filename
      .replace("{tenant}", requireAxisValue(target, "tenant"))
      .replace("{contentVersion}", config.manual.contentVersion);

    const html = renderHtml(manual, {
      header: `BROADSEC  |  ${config.manual.title}  |  v${config.manual.contentVersion}`,
      assetBase,
      polyfill,
      cover: {
        brand: "BROADSEC",
        title: config.manual.title,
        version: config.manual.contentVersion,
        lede: `Plataforma de Gestión de Incidentes y Seguridad para Operaciones Críticas — ${axisValueName(config, "tenant", requireAxisValue(target, "tenant"))}.`,
        meta: "© 2026 Inovisec  |  Todos los Derechos Reservados  |  Documento Confidencial",
      },
    });

    const htmlPath = join(outDir, name.replace(/\.pdf$/, ".html"));
    const pdfPath = join(outDir, name);
    writeFileSync(htmlPath, html, "utf8");
    const { pages } = await printToPdf(htmlPath, pdfPath);

    const sections = manual.children.length;
    const label = Object.entries(target)
      .map(([axis, value]) => `${axis}=${value}`)
      .join(" ");
    console.log(`  ${label.padEnd(16)} ${sections} section(s), ${manual.numbers.size} numbered node(s), ${pages} page(s) -> ${name}`);
  }

  printWarnings(warnings);
}

/**
 * Format any thrown value into an actionable, single-line message.
 *
 * `ContentError` already carries file/node-id/what-to-do detail, so it is
 * printed as-is. Anything else (a plain `Error` from, e.g., an undeclared
 * axis value or a malformed CLI flag) still gets a message instead of a raw
 * stack trace — see `packages/cli/AGENTS.md`: "Errors are actionable: file,
 * node id, what to do. A stack trace is not an error message."
 */
export function formatCliError(error: unknown): string {
  if (error instanceof ContentError) return `content error: ${error.message}`;
  const message = error instanceof Error ? error.message : String(error);
  return `error: ${message}`;
}

/**
 * Run the CLI for a given argv (excluding `node`/script) and return an exit
 * code, without ever letting an uncaught error escape as a raw stack trace.
 * Kept separate from `main()` so it is testable without exiting the process.
 */
export async function run(argv: readonly string[]): Promise<number> {
  const [command, manualId, ...rest] = argv;
  if (command !== "build" || !manualId) {
    console.error(
      "usage: broadsec-manual build <manual> [--tenant <id>] [--axis <name>=<value> ...]",
    );
    return 2;
  }

  try {
    // Parsing the flags is part of the guarded region: a plain CLI typo like
    // `--tenant` with no following value must be reported the same way as
    // any other build failure, not escape uncaught.
    const filters = parseAxisFilters(rest);
    const manualDir = resolve(process.cwd(), "manuals", manualId);

    const label = [...filters.entries()].map(([axis, value]) => `${axis}=${value}`).join(" ");
    console.log(`building ${manualId}${label ? ` (${label})` : ""}`);

    await build(manualDir, filters);
    return 0;
  } catch (error) {
    console.error(`\n${formatCliError(error)}`);
    if (process.env["DEBUG"] && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return 1;
  }
}

async function main(): Promise<void> {
  process.exit(await run(process.argv.slice(2)));
}

// Run only when this module is the process entry point — importing it (e.g.
// from tests) must not trigger a CLI invocation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
