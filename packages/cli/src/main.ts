#!/usr/bin/env node
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { catalog } from "@broadsec-manual/blocks";
import type { BuildTarget, ManualDocument, ManualNode } from "@broadsec-manual/blocks";
import { assemble, loadSection, ContentError } from "@broadsec-manual/core";
import { renderHtml, pagedPolyfill } from "@broadsec-manual/render-web";
import { printToPdf } from "./chrome.ts";

interface ManualConfig {
  manual: { id: string; title: string; product: string; contentVersion: string };
  axes: Record<string, { values: Array<{ id: string; name: string }> }>;
  targets: Array<Record<string, string>>;
  output: { dir: string; filename: string };
}

function loadDocument(manualDir: string, config: ManualConfig): ManualDocument {
  const dir = join(manualDir, "sections");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort();
  const children: ManualNode[] = files.map((f) =>
    loadSection(readFileSync(join(dir, f), "utf8"), `sections/${f}`, catalog),
  );
  return {
    manualId: config.manual.id,
    version: config.manual.contentVersion,
    children,
  };
}

function tenantName(config: ManualConfig, target: BuildTarget): string {
  const id = target["tenant"];
  const found = config.axes["tenant"]?.values.find((v) => v.id === id);
  return found?.name ?? String(id);
}

function build(manualDir: string, only: string | undefined): void {
  const config = parseYaml(
    readFileSync(join(manualDir, "manual.config.yaml"), "utf8"),
  ) as ManualConfig;

  const doc = loadDocument(manualDir, config);
  const outDir = join(manualDir, config.output.dir);
  mkdirSync(outDir, { recursive: true });

  const polyfill = pagedPolyfill();
  const assetBase = pathToFileURL(join(manualDir, "assets", "figures")).href;

  const targets = config.targets.filter((t) => !only || t["tenant"] === only);
  if (targets.length === 0) {
    throw new Error(`No target matches --tenant ${only}`);
  }

  for (const target of targets) {
    const manual = assemble(doc, target, catalog);
    const name = config.output.filename
      .replace("{tenant}", String(target["tenant"]))
      .replace("{contentVersion}", config.manual.contentVersion);

    const html = renderHtml(manual, {
      header: `BROADSEC  |  ${config.manual.title}  |  v${config.manual.contentVersion}`,
      assetBase,
      polyfill,
      cover: {
        brand: "BROADSEC",
        title: config.manual.title,
        version: config.manual.contentVersion,
        lede: `Plataforma de Gestión de Incidentes y Seguridad para Operaciones Críticas — ${tenantName(config, target)}.`,
        meta: "© 2026 Inovisec  |  Todos los Derechos Reservados  |  Documento Confidencial",
      },
    });

    const htmlPath = join(outDir, name.replace(/\.pdf$/, ".html"));
    const pdfPath = join(outDir, name);
    writeFileSync(htmlPath, html, "utf8");
    printToPdf(htmlPath, pdfPath);

    const sections = manual.children.length;
    console.log(`  ${String(target["tenant"]).padEnd(6)} ${sections} section(s), ${manual.numbers.size} numbered node(s) -> ${name}`);
  }
}

function main(): void {
  const [command, manualId, ...rest] = process.argv.slice(2);
  if (command !== "build" || !manualId) {
    console.error("usage: broadsec-manual build <manual> [--tenant <id>]");
    process.exit(2);
  }
  const tenantFlag = rest.indexOf("--tenant");
  const only = tenantFlag >= 0 ? rest[tenantFlag + 1] : undefined;
  const manualDir = resolve(process.cwd(), "manuals", manualId);

  console.log(`building ${manualId}${only ? ` (tenant ${only})` : ""}`);
  try {
    build(manualDir, only);
  } catch (error) {
    if (error instanceof ContentError) {
      console.error(`\ncontent error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main();
