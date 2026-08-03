import { parse as parseYaml } from "yaml";
import type {
  BlockCatalog,
  Inline,
  ManualNode,
  Selector,
} from "@broadsec-manual/blocks";

/**
 * Authoring format for the pipeline spike: YAML mirroring the AST.
 *
 * A node with a `type` is a block; anything else is a section. That shorthand
 * is the only sugar — everything else is the AST verbatim.
 *
 * The friendlier surface (Markdown with container directives) parses into the
 * same AST and is deliberately out of scope here: the spike validates the
 * pipeline, not the authoring ergonomics.
 */

export class ContentError extends Error {
  readonly file: string;
  readonly nodeId: string;

  constructor(file: string, nodeId: string, message: string) {
    super(`${file} [${nodeId}]: ${message}`);
    this.name = "ContentError";
    this.file = file;
    this.nodeId = nodeId;
  }
}

const text = (value: string): Inline[] => [{ kind: "text", value }];

/** Digits-and-dots at the start of a title, e.g. "7.2 Barra Superior". */
const LITERAL_NUMBER = /^\s*\d+(\.\d+)*[.\s]/;

function loadNode(raw: unknown, file: string, catalog: BlockCatalog): ManualNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ContentError(file, "?", "node must be a mapping");
  }
  const node = raw as Record<string, unknown>;
  const id = typeof node["id"] === "string" ? node["id"] : "";
  if (!id) throw new ContentError(file, "?", "every node needs a stable `id`");

  const when = node["when"] as Selector | undefined;

  if (typeof node["type"] === "string") {
    const type = node["type"];
    const def = catalog.get(type);
    if (!def) {
      throw new ContentError(
        file,
        id,
        `unknown block type "${type}". Use a type from the catalogue, or ` +
          `request a new one — do not improvise a layout.`,
      );
    }
    const parsed = def.schema.safeParse(node["props"] ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new ContentError(file, id, `invalid props for "${type}" — ${detail}`);
    }
    return {
      kind: "block",
      id,
      type,
      props: parsed.data as Record<string, unknown>,
      ...(when ? { when } : {}),
    };
  }

  const title = node["title"];
  if (typeof title !== "string" || !title.trim()) {
    throw new ContentError(file, id, "a section needs a `title`");
  }
  if (LITERAL_NUMBER.test(title)) {
    throw new ContentError(
      file,
      id,
      `title "${title}" starts with a literal number. Numbering is assigned ` +
        `per build target — remove it.`,
    );
  }

  const children = Array.isArray(node["children"]) ? node["children"] : [];
  const subtitle = node["subtitle"];

  return {
    kind: "section",
    id,
    title: text(title),
    ...(typeof subtitle === "string" ? { subtitle: text(subtitle) } : {}),
    children: children.map((c) => loadNode(c, file, catalog)),
    ...(when ? { when } : {}),
  };
}

/** Parse one YAML content file into AST nodes. */
export function loadSection(
  source: string,
  file: string,
  catalog: BlockCatalog,
): ManualNode {
  return loadNode(parseYaml(source), file, catalog);
}
