#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { catalog } from "@broadsec-manual/blocks";
import type { BuildTarget, ManualDocument, ManualNode } from "@broadsec-manual/blocks";
import {
  assemble,
  collectSlots,
  loadSection,
  ContentError,
  type ContentWarning,
  type ImageSlotUse,
} from "@broadsec-manual/core";
import { renderHtml, pagedRuntime } from "@broadsec-manual/render-web";
import { printToPdf } from "./chrome.ts";
import { extract } from "./extract.ts";
import { pendingTable } from "./pending-table.ts";
import { parseRecipes, planCaptures } from "./capture.ts";
import { runCaptures } from "./capture-run.ts";
import {
  COMMON_SET,
  buildImageIndex,
  type ImageIndex,
  type ManifestImage,
} from "./images.ts";

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

/** One deployment's resolved slots, as the export consumes them. */
export interface TargetImages {
  readonly tenant: string;
  readonly entries: readonly ManifestSlot[];
  /** Every slot this deployment saw on disk, asked for or not. */
  readonly indexed: readonly string[];
}

/** One image in the export, with every deployment that needs it. */
interface RequestedImage {
  readonly slot: string;
  /** Deployment ids that need this image. */
  readonly neededBy: string[];
  /** What it shows and which block uses it, deduplicated across deployments. */
  readonly uses: SlotUsePlace[];
  /**
   * Deployments still rendering the placeholder. Absent once every deployment
   * that needs the image has one — that absence is what "delivered" means here.
   */
  readonly pendingFor?: string[];
  /** Files it currently resolves from, across deployments. */
  readonly files?: string[];
  /**
   * Present while pending: where the file has to be dropped.
   *
   * `override` is a template, not a list of six paths. Spelling out every
   * deployment's path for an image that is the same everywhere reads as an
   * instruction to deliver six copies, which is exactly what `shared` exists to
   * avoid. `neededBy` already says who needs it.
   */
  readonly deliverTo?: { readonly shared: string; readonly override: string };
}

/**
 * Build the image request document — the contract with the area that produces
 * the screenshots.
 *
 * Grouped by SLOT rather than by deployment on purpose. A control that looks
 * identical everywhere is one photograph, and a per-deployment dump would list
 * it six times and invite six copies of the same file. `neededBy` says who
 * needs it; `deliverTo.shared` says where one copy serves all of them.
 *
 * Deliberately without a timestamp: it is regenerated on demand and a clock
 * would make it churn in git on an export that changed nothing.
 */
export function imageRequests(
  config: ManualConfig,
  perTarget: readonly TargetImages[],
): Record<string, unknown> {
  const bySlot = new Map<
    string,
    {
      neededBy: string[];
      pendingFor: string[];
      files: Set<string>;
      uses: SlotUsePlace[];
      deliverTo?: string;
    }
  >();
  const orphans = new Set<string>();

  // What every deployment SAW, minus what any deployment ASKED FOR. Computed
  // across all of them because an image used by one deployment is legitimately
  // unused by the others: judging it per deployment reported every
  // tenant-specific image as an orphan, which is noise that trains people to
  // ignore the one report that matters.
  const seen = new Set<string>();
  const asked = new Set<string>();

  for (const { tenant, entries, indexed } of perTarget) {
    for (const slot of indexed) seen.add(slot);
    for (const entry of entries) {
      asked.add(entry.slot);
      let acc = bySlot.get(entry.slot);
      if (!acc) {
        acc = { neededBy: [], pendingFor: [], files: new Set(), uses: [] };
        bySlot.set(entry.slot, acc);
      }
      acc.neededBy.push(tenant);
      // Resolution is PER DEPLOYMENT, so one slot can be delivered for one and
      // missing for another the moment anybody adds a tenant-specific image.
      // Collapsing that to a single state would report the slot as done while a
      // deployment still renders the placeholder.
      if (entry.state === "pending") {
        acc.pendingFor.push(tenant);
        if (acc.deliverTo === undefined && entry.deliverTo !== undefined) {
          acc.deliverTo = entry.deliverTo;
        }
      }
      else if (entry.file) acc.files.add(entry.file);
      for (const use of entry.uses) {
        if (!acc.uses.some((u) => u.nodeId === use.nodeId)) acc.uses.push(use);
      }
    }
  }

  for (const slot of seen) if (!asked.has(slot)) orphans.add(slot);

  const all: RequestedImage[] = [...bySlot.entries()].map(([slot, acc]) => ({
    slot,
    neededBy: acc.neededBy,
    uses: acc.uses,
    ...(acc.pendingFor.length > 0
      ? {
          pendingFor: acc.pendingFor,
          deliverTo: {
            // From the resolver, never rebuilt here — see ManifestSlot.deliverTo.
            shared: acc.deliverTo ?? `${COMMON_SET}/${slot}.png`,
            override: `<tenant>/${slot}.png`,
          },
        }
      : {}),
    ...(acc.files.size > 0 ? { files: [...acc.files].sort() } : {}),
  }));

  const pending = all.filter((i) => i.pendingFor !== undefined);
  return {
    manual: config.manual.id,
    contentVersion: config.manual.contentVersion,
    // Spelled out in the file itself: whoever opens it may never have read the
    // repository's documentation.
    convention: {
      resolution: [
        "<tenant>/<slot path>.<ext> — an image made for that one deployment",
        `${COMMON_SET}/<slot path>.<ext> — one image valid for every deployment (preferred)`,
        "otherwise the pending placeholder renders in its place",
      ],
      slotPath: "a slot's dots are folders: `barra.filtro.fig` -> `barra/filtro/fig`",
      extensions: "png, jpg, jpeg, svg, webp or gif — the slot never names one",
      root: "manuals/<manual>/assets/figures/",
      preferShared:
        `deliver to ${COMMON_SET}/ unless the screen genuinely differs by ` +
        `deployment — six copies of one icon are six things to update`,
    },
    deploymentsCovered: perTarget.map((t) => t.tenant),
    deploymentsConfigured: config.targets.length,
    counts: { total: all.length, delivered: all.length - pending.length, pending: pending.length },
    pending,
    delivered: all.filter((i) => i.pendingFor === undefined),
    ...(orphans.size > 0 ? { undeclared: [...orphans].sort() } : {}),
  };
}

/**
 * Report images sitting on disk that no slot asked for.
 *
 * This is the one failure this whole scheme exists to catch: a delivery named
 * `barra/buscar.png` when the slot is `barra.busqueda` leaves the page showing
 * a placeholder while the build reports success. Silence there would mean
 * finding out from the client.
 */
function printUndeclaredImages(undeclared: ReadonlySet<string>): void {
  if (undeclared.size === 0) return;
  const noun = undeclared.size === 1 ? "image" : "images";
  console.log(
    `\n${undeclared.size} delivered ${noun} that no content asked for — a slot ` +
      `renamed, or a delivery misnamed:`,
  );
  for (const slot of [...undeclared].sort()) console.log(`    ${slot}`);
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

/** Where one slot is used: enough for the producer to know what to capture. */
interface SlotUsePlace {
  readonly nodeId: string;
  readonly blockType: string;
  readonly shows: string;
}

/** One slot in the image manifest, with every place that uses it. */
interface ManifestSlot {
  readonly slot: string;
  readonly state: ManifestImage["state"];
  readonly file?: string;
  /**
   * Where a pending image must be delivered, exactly as the resolver produced it.
   *
   * Carried through rather than recomputed here. It was recomputed once, and the
   * two copies immediately disagreed: the draft printed a flat name while this
   * document still asked for a folder tree, so the same image had two answers
   * depending on which artefact somebody happened to be holding.
   */
  readonly deliverTo?: string;
  readonly uses: SlotUsePlace[];
}

/**
 * Group a target's slot uses into manifest entries, in first-appearance order.
 *
 * Two places may share one slot on purpose — an icon used in a table and again
 * in a procedure step — so the manifest lists the image once and every place it
 * appears, rather than asking for it twice.
 */
function manifestSlots(
  uses: readonly ImageSlotUse[],
  resolve: (slot: string) => ManifestImage,
): ManifestSlot[] {
  const bySlot = new Map<string, ManifestSlot>();
  for (const use of uses) {
    const place: SlotUsePlace = {
      nodeId: use.nodeId,
      blockType: use.blockType,
      shows: use.shows,
    };
    const entry = bySlot.get(use.slot);
    if (entry) {
      entry.uses.push(place);
      continue;
    }
    const resolved = resolve(use.slot);
    bySlot.set(use.slot, {
      slot: use.slot,
      state: resolved.state,
      ...(resolved.file ? { file: resolved.file } : {}),
      ...(resolved.deliverTo ? { deliverTo: resolved.deliverTo } : {}),
      uses: [place],
    });
  }
  return [...bySlot.values()];
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

/** Everything both commands need before they diverge. */
interface LoadedManual {
  readonly config: ManualConfig;
  readonly doc: ManualDocument;
  readonly warnings: readonly ContentWarning[];
  readonly targets: readonly BuildTarget[];
  readonly figuresDir: string;
}

/**
 * Read the config, parse the content and select the targets to work on.
 *
 * Shared so `build` and `images` can never disagree about which deployments
 * exist or which content they are looking at — an export that described a
 * different set of slots than the PDFs is worse than no export.
 */
function loadManual(manualDir: string, filters: ReadonlyMap<string, string>): LoadedManual {
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

  const targets = config.targets.filter((t) =>
    [...filters.entries()].every(([axis, value]) => t[axis] === value),
  );
  if (targets.length === 0) {
    const desc = [...filters.entries()].map(([axis, value]) => `${axis}=${value}`).join(", ");
    throw new Error(`No target matches ${desc || "(no filter)"}`);
  }

  return { config, doc, warnings, targets, figuresDir: join(manualDir, "assets", "figures") };
}

/**
 * Resolve one target's image slots.
 *
 * Slots are collected from the CONDITIONED manual, so a deployment is never
 * asked for an image of a control it does not have. `undeclared` can only be
 * read after every slot has been resolved, which is why the index is returned
 * alongside rather than queried here.
 */
function resolveTargetImages(
  manual: ReturnType<typeof assemble>,
  figuresDir: string,
  tenant: string,
): {
  entries: ManifestSlot[];
  slots: Map<string, string>;
  images: ImageIndex;
  uses: readonly ImageSlotUse[];
} {
  const uses = collectSlots(manual, catalog);
  const images = buildImageIndex(figuresDir, tenant);
  const entries = manifestSlots(uses, (slot) => images.resolve(slot));
  return { entries, slots: new Map(uses.map((u) => [u.nodeId, u.slot])), images, uses };
}

/**
 * Shoot the pending figures off the running product.
 *
 * Deliberately its own command rather than a flag on `build`: it needs the
 * product up, a login, and a network, none of which a build may ever depend on.
 */
async function capture(
  manualDir: string,
  filters: ReadonlyMap<string, string>,
  only: readonly string[],
): Promise<void> {
  const { doc, targets, figuresDir } = loadManual(manualDir, filters);
  const target = targets[0];
  if (!target) throw new Error("no deployment selected — pass --tenant");
  const tenant = requireAxisValue(target, "tenant");
  const manual = assemble(doc, target, catalog);
  const { entries } = resolveTargetImages(manual, figuresDir, tenant);
  const pending = new Set(entries.filter((e) => e.state === "pending").map((e) => e.slot));

  const recipePath = join(manualDir, "capture-recipes.yaml");
  if (!existsSync(recipePath)) {
    throw new Error(`no capture recipes at ${recipePath}. Nothing to shoot.`);
  }
  const recipes = parseRecipes(parseYaml(readFileSync(recipePath, "utf8")));
  const chosen =
    only.length === 0 ? recipes.recipes : recipes.recipes.filter((r) => only.includes(r.slot));
  if (only.length > 0 && chosen.length !== only.length) {
    const missing = only.filter((s) => !chosen.some((r) => r.slot === s));
    throw new Error(`--only names slots with no recipe: ${missing.join(", ")}`);
  }

  const plan = planCaptures(chosen, pending);
  console.log(`  ${plan.ready.length} recipe(s) to shoot, ${plan.uncovered.length} pending slot(s) with no recipe yet`);
  if (plan.ready.length === 0) return;

  const results = await runCaptures(recipes, plan.ready, figuresDir, (line) => console.log(line));
  const ok = results.filter((r) => r.ok).length;
  console.log(`\n  ${ok} of ${results.length} captured`);
  // Same discipline the manifest check enforces: a capture is only real once the
  // slot it was aimed at stops being pending. Re-export and look.
  if (ok > 0) console.log(`  now re-run \`images ${basename(manualDir)}\` — pending must drop by exactly ${ok}`);
}

/** Export the image request document. Needs no renderer, so no browser. */
function exportImages(
  manualDir: string,
  filters: ReadonlyMap<string, string>,
  outPath: string,
): void {
  const { config, doc, targets, figuresDir } = loadManual(manualDir, filters);

  const perTarget = targets.map((target) => {
    const tenant = requireAxisValue(target, "tenant");
    const manual = assemble(doc, target, catalog);
    const { entries, images } = resolveTargetImages(manual, figuresDir, tenant);
    return { tenant, entries, indexed: images.indexed() };
  });

  const report = imageRequests(config, perTarget);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const counts = report["counts"] as { total: number; delivered: number; pending: number };
  console.log(
    `  ${counts.total} image slot(s): ${counts.delivered} delivered, ${counts.pending} pending`,
  );
  console.log(`  -> ${outPath}`);
  printUndeclaredImages(new Set((report["undeclared"] as string[] | undefined) ?? []));
}

/**
 * Where the image request document is written: `--out <path>`, or next to the
 * manual by default.
 *
 * The default deliberately sits OUTSIDE `output/`, which `.gitignore` excludes.
 * This file is a request handed to another team, not a build artefact — if it
 * only existed for whoever last ran a build, the team producing the images
 * could not read it at all.
 */
export function parseOutPath(args: readonly string[], manualId: string): string {
  const flag = args.indexOf("--out");
  if (flag === -1) return `manuals/${manualId}/image-requests.json`;
  const value = args[flag + 1];
  if (!value || value.startsWith("--")) {
    throw new Error("--out requires a path, e.g. `--out requests/broadlineavida.json`");
  }
  return value;
}

/**
 * Mark a draft's filename so it can never be mistaken for the deliverable.
 *
 * `manual-operador-mv-v0.1.0.pdf` -> `manual-operador-mv-v0.1.0-BORRADOR.pdf`.
 * A draft carries slot names — pipeline internals invariant 4 keeps out of
 * client-facing output — so the two files must not be distinguishable only by
 * their contents.
 */
export function draftFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? `${name}-BORRADOR` : `${name.slice(0, dot)}-BORRADOR${name.slice(dot)}`;
}

async function build(
  manualDir: string,
  filters: ReadonlyMap<string, string>,
  draft: boolean,
  wantPendingTable: boolean,
): Promise<void> {
  const { config, doc, warnings, targets, figuresDir } = loadManual(manualDir, filters);
  const outDir = join(manualDir, config.output.dir);
  mkdirSync(outDir, { recursive: true });

  const polyfill = pagedRuntime();
  // Undeclared images can only be judged once EVERY target has been resolved —
  // an image one deployment uses is legitimately unused by another.
  const seenOnDisk = new Set<string>();
  const askedFor = new Set<string>();

  for (const target of targets) {
    const manual = assemble(doc, target, catalog);
    const tenant = requireAxisValue(target, "tenant");
    const rendered = config.output.filename
      .replace("{tenant}", tenant)
      .replace("{contentVersion}", config.manual.contentVersion);
    const name = draft ? draftFilename(rendered) : rendered;

    const { entries, slots, images, uses } = resolveTargetImages(manual, figuresDir, tenant);

    const html = renderHtml(manual, {
      header: draft
        ? `BORRADOR INTERNO  |  ${config.manual.title}  |  v${config.manual.contentVersion}  |  NO DISTRIBUIR`
        : `BROADSEC  |  ${config.manual.title}  |  v${config.manual.contentVersion}`,
      slots,
      images: (slot) => images.resolve(slot),
      figures: manual.figures,
      draft,
      polyfill,
      cover: {
        brand: draft ? "BORRADOR INTERNO" : "BROADSEC",
        title: config.manual.title,
        version: config.manual.contentVersion,
        lede: draft
          ? "Borrador para la toma de capturas. Cada imagen pendiente lleva debajo la ruta y el nombre exactos con los que debe entregarse el archivo. Guárdela tal cual, sin cambiar mayúsculas ni extensión. No distribuir."
          : `Plataforma de Gestión de Incidentes y Seguridad para Operaciones Críticas — ${axisValueName(config, "tenant", requireAxisValue(target, "tenant"))}.`,
        meta: draft
          ? "© 2026 Inovisec  |  Documento de trabajo interno  |  No es la versión para el cliente"
          : "© 2026 Inovisec  |  Todos los Derechos Reservados  |  Documento Confidencial",
      },
    });

    const htmlPath = join(outDir, name.replace(/\.pdf$/, ".html"));
    const pdfPath = join(outDir, name);
    writeFileSync(htmlPath, html, "utf8");
    const { pages, placements } = await printToPdf(htmlPath, pdfPath);

    for (const slot of images.indexed()) seenOnDisk.add(slot);
    for (const entry of entries) askedFor.add(entry.slot);
    const delivered = entries.filter((e) => e.state !== "pending").length;

    // Written only when asked for — the same rule the image manifest follows.
    // It does NOT go in `output/`: that directory is generated and ignored, and
    // this is a document someone spends hours writing into. It sits with the
    // manual's own sources so the answers are tracked, diffable, and safe from
    // the next build.
    if (wantPendingTable) {
      const tablePath = join(manualDir, `imagenes-pendientes-${tenant}.md`);
      const table = pendingTable(
        uses,
        new Set(entries.filter((e) => e.state === "pending").map((e) => e.slot)),
        placements,
        existsSync(tablePath) ? readFileSync(tablePath, "utf8") : "",
      );
      writeFileSync(tablePath, table.markdown, "utf8");
      const kept = table.carriedOver > 0 ? `, ${table.carriedOver} instruction(s) kept` : "";
      console.log(
        `  ${" ".repeat(16)} ${table.rows.length} pending image(s)${kept} -> ${basename(tablePath)}`,
      );
    }

    const sections = manual.children.length;
    const label = Object.entries(target)
      .map(([axis, value]) => `${axis}=${value}`)
      .join(" ");
    console.log(
      `  ${label.padEnd(16)} ${sections} section(s), ${manual.numbers.size} numbered node(s), ` +
        `${pages} page(s), ${delivered}/${entries.length} image(s) -> ${name}`,
    );
  }

  // The build reports the image state but does not write the request document:
  // that is an explicit export (`images`), because it leaves the repository for
  // another team and should not be a side effect nobody asked for.
  // Only every deployment together can answer this. An image one deployment uses
  // is legitimately unused by the others, so a filtered build sees a tenant-specific
  // file as an orphan — `build --tenant med` reported MV's map-layer icons as
  // deliveries nobody asked for. Judge it only when the whole set was built.
  if (targets.length === config.targets.length) {
    printUndeclaredImages(new Set([...seenOnDisk].filter((s) => !askedFor.has(s))));
  } else {
    console.log(
      `
  (undeclared-image check skipped: it needs every deployment, and this ` +
        `build covered ${targets.length} of ${config.targets.length})`,
    );
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
  const axisFlags = "[--tenant <id>] [--axis <name>=<value> ...]";
  if (
    (command !== "build" &&
      command !== "images" &&
      command !== "extract" &&
      command !== "capture") ||
    !manualId
  ) {
    console.error(
      `usage: broadsec-manual build <manual> ${axisFlags} [--draft] [--pending-table]\n` +
        `       broadsec-manual images <manual> ${axisFlags} [--out <path>]\n` +
        `       broadsec-manual capture <manual> --tenant <id> [--only <slot,...>]\n` +
        `       broadsec-manual extract <manual>\n\n` +
        `  capture  shoot pending figures off the running product, per\n` +
        `           manuals/<manual>/capture-recipes.yaml. Needs the login in the\n` +
        `           environment variables that file NAMES — never in the file.\n` +
        `  --draft  internal build: prints the filename every pending image must\n` +
        `           be delivered under. Never distribute a draft to a client.\n` +
        `  --pending-table\n` +
        `           also write imagenes-pendientes-<tenant>.md: every pending image\n` +
        `           in reading order with the page it landed on, and a blank column\n` +
        `           to fill in. Page numbers are only true of that render.\n` +
        `  extract  read the source product and write knowledge/module-map.json,\n` +
        `           reporting what changed since the last map.`,
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

    if (command === "extract") {
      const { map, drift, outPath } = extract(process.cwd(), manualId);
      const lowConfidence = map.tenantReferences.filter((r) => r.confidence === "low").length;
      console.log(
        `  ${map.tenants.length} deployment(s), ${map.capabilities.length} capability flag(s), ` +
          `${map.tenantReferences.length} deployment reference(s) in code` +
          (lowConfidence > 0 ? `, ${lowConfidence} needing review` : ""),
      );
      const contested = map.capabilities.filter((c) => c.absentFrom !== undefined).length;
      if (contested > 0) {
        console.log(
          `  ${contested} flag(s) are declared by some deployments and not others — ` +
            `absent is NOT false, see \`absentFrom\``,
        );
      }
      for (const line of map.registryMismatch ?? []) console.log(`  ! ${line}`);
      console.log(`  -> ${outPath}`);
      if (drift.length > 0) {
        console.log(`
${drift.length} change(s) since the previous map:`);
        for (const line of drift) console.log(`    ${line}`);
      }
      return 0;
    }

    if (command === "capture") {
      const at = rest.indexOf("--only");
      const only = at === -1 ? [] : (rest[at + 1] ?? "").split(",").filter(Boolean);
      console.log(`capturing ${manualId}${label ? ` (${label})` : ""}`);
      await capture(manualDir, filters, only);
      return 0;
    }

    if (command === "images") {
      console.log(`exporting image requests for ${manualId}${label ? ` (${label})` : ""}`);
      exportImages(manualDir, filters, resolve(process.cwd(), parseOutPath(rest, manualId)));
      return 0;
    }

    const draft = rest.includes("--draft");
    console.log(
      `building ${draft ? "DRAFT " : ""}${manualId}${label ? ` (${label})` : ""}` +
        `${draft ? " — internal, shows pending image names" : ""}`,
    );
    await build(manualDir, filters, draft, rest.includes("--pending-table"));
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
