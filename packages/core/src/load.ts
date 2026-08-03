import { parse as parseYaml } from "yaml";
import { selectorSchema } from "@broadsec-manual/blocks";
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

/**
 * An outline-numbering prefix or a whole-string outline number, e.g. the
 * start of "7.2 Barra Superior" or the entirety of "5.2".
 *
 * Three shapes are targeted, deliberately narrower than "a number followed
 * by a space", because authored prose legitimately opens with a quantity —
 * "24 Horas de Soporte", "2 Factores de Autenticación" — and those must not
 * be flagged, while a version string ("1.4.7") or an IP address
 * ("192.168.1.1") must not be flagged either:
 *
 *  - A MULTI-SEGMENT number (at least one dot, e.g. "7.2", "7.1.3") at the
 *    very start of the string, followed by a heading-style separator
 *    (`)`, `:`) or by whitespace then more text — e.g. "5.2 Barra Superior",
 *    "5.2 sistema de alertas". Whatever follows the number, a heading field
 *    starting with a dotted number is outline numbering; there is no
 *    legitimate counter-example (see `tenant-conditioning` Rule 2).
 *  - A dotted number that IS the whole string, restricted to exactly one dot
 *    (two segments) — e.g. the entirety of "5.2". Three or more segments
 *    ("1.4.7", "1.0.0") or four ("192.168.1.1") are left alone: those are
 *    the shape of a version string or an IP address, not a lone section
 *    number, and requiring the keyword-based `OUTLINE_REFERENCE` below is
 *    how a longer dotted reference (e.g. "Figura 7.1.3") still gets caught.
 *  - A SINGLE-SEGMENT number at the very start followed immediately by an
 *    explicit separator (`)`, `:` or `.`) and then more text — e.g. "5) Barra
 *    Superior", "7. Interfaz General", "1. Ingrese sus credenciales". A
 *    single-segment number followed by plain whitespace is NOT enough on
 *    its own: that shape is indistinguishable from a quantity opening a
 *    sentence, so it is intentionally left alone.
 */
const OUTLINE_NUMBER =
  /^\s*\d+(\.\d+)+(?:[):]|\s+\S)|^\s*\d+\.\d+\s*$|^\s*\d+[).:]\s+\S/;

/**
 * An explicit reference to a section, figure, chapter or page number,
 * anywhere in the text — e.g. "consulte la Figura 7.1.3", "ver sección 4".
 * Requiring the keyword keeps this from tripping over quantities such as
 * "Se muestran 3 columnas".
 */
const OUTLINE_REFERENCE = /\b(secci[oó]n|figura|cap[ií]tulo|p[aá]gina|apartado)\s+\d+(\.\d+)*\b/i;

/**
 * A hand-written Markdown-style anchor/slug reference, e.g.
 * `#52-semaforos-y-ars`. A bare `#<digits>` such as `#12` is excluded — that
 * is an ordinary number-sign ("Camara #12"), not a slug. A slug either
 * carries a letter in its first segment, or — when that first segment is
 * purely numeric — is followed by a hyphenated segment of its own.
 */
const ANCHOR_REFERENCE = /#(?:[a-z0-9]*[a-z][a-z0-9]*(?:-[a-z0-9]+)*|\d+-[a-z0-9]+(?:-[a-z0-9]+)*)/i;

/**
 * The message for a literal number, section/figure reference or
 * hand-written anchor found in authored content — or `undefined` if `value`
 * contains none. All three are assigned per build target — see the
 * `tenant-conditioning` skill and this package's `AGENTS.md`.
 */
function literalReferenceMessage(value: string): string | undefined {
  if (OUTLINE_NUMBER.test(value) || OUTLINE_REFERENCE.test(value)) {
    return (
      `"${value}" contains a literal number or a reference to one (a section, ` +
      `figure, chapter or page number). Numbering is assigned per build ` +
      `target — reference the target by its stable id instead and remove ` +
      `the number.`
    );
  }
  if (ANCHOR_REFERENCE.test(value)) {
    return (
      `"${value}" contains a hand-written anchor or slug. Anchors are ` +
      `assigned per build target — reference the target by its stable id ` +
      `instead.`
    );
  }
  return undefined;
}

/**
 * Hard error for a `title`/`subtitle` field. A number at the very start of a
 * heading is always outline numbering — unlike a string inside block props,
 * there is no legitimate counter-example, so this stays a blocking error.
 */
function checkLiteralReference(value: string, file: string, id: string): void {
  const message = literalReferenceMessage(value);
  if (message) throw new ContentError(file, id, message);
}

/**
 * A non-blocking warning describing a literal number, reference or anchor
 * found somewhere else in authored content (block props). A number in prose
 * cannot reliably be told apart from an outline reference by pattern alone
 * — "Se muestran 3 columnas" and "ver sección 3" are the same shape with
 * different meaning — so this is collected for the author to review instead
 * of blocking the build.
 */
export interface ContentWarning {
  readonly file: string;
  readonly nodeId: string;
  readonly text: string;
  readonly message: string;
}

function collectLiteralReferenceWarning(
  value: string,
  file: string,
  id: string,
  warnings: ContentWarning[],
): void {
  const message = literalReferenceMessage(value);
  if (message) warnings.push({ file, nodeId: id, text: value, message });
}

/** Recursively check every string value reachable inside a node's props. */
function checkPropsForLiteralReferences(
  value: unknown,
  file: string,
  id: string,
  warnings: ContentWarning[],
): void {
  if (typeof value === "string") {
    collectLiteralReferenceWarning(value, file, id, warnings);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) checkPropsForLiteralReferences(item, file, id, warnings);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) checkPropsForLiteralReferences(v, file, id, warnings);
  }
}

/** Validate a node's `when` selector, if present. */
function parseWhen(
  node: Record<string, unknown>,
  file: string,
  id: string,
): Selector | undefined {
  if (node["when"] === undefined) return undefined;
  const parsed = selectorSchema.safeParse(node["when"]);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new ContentError(
      file,
      id,
      `invalid \`when\` selector — ${detail}. A selector is a record of axis ` +
        `id to a non-empty array of non-empty values, e.g. ` +
        `\`{ tenant: [mv] }\` — never a bare scalar like \`{ tenant: mv }\`.`,
    );
  }
  return parsed.data;
}

function loadNode(
  raw: unknown,
  file: string,
  catalog: BlockCatalog,
  warnings: ContentWarning[],
): ManualNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ContentError(file, "?", "node must be a mapping");
  }
  const node = raw as Record<string, unknown>;
  const id = typeof node["id"] === "string" ? node["id"] : "";
  if (!id) throw new ContentError(file, "?", "every node needs a stable `id`");

  const when = parseWhen(node, file, id);

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
    checkPropsForLiteralReferences(parsed.data, file, id, warnings);
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
  checkLiteralReference(title, file, id);

  const children = Array.isArray(node["children"]) ? node["children"] : [];
  const subtitle = node["subtitle"];
  if (typeof subtitle === "string") checkLiteralReference(subtitle, file, id);

  return {
    kind: "section",
    id,
    title: text(title),
    ...(typeof subtitle === "string" ? { subtitle: text(subtitle) } : {}),
    children: children.map((c) => loadNode(c, file, catalog, warnings)),
    ...(when ? { when } : {}),
  };
}

/** The result of parsing one YAML content file. */
export interface LoadedSection {
  readonly node: ManualNode;
  /**
   * Non-blocking literal-number/reference/anchor findings from inside block
   * props. See `ContentWarning` — the build succeeds regardless; the CLI is
   * responsible for surfacing these to the author.
   */
  readonly warnings: readonly ContentWarning[];
}

/** Parse one YAML content file into AST nodes. */
export function loadSection(
  source: string,
  file: string,
  catalog: BlockCatalog,
): LoadedSection {
  const warnings: ContentWarning[] = [];
  const node = loadNode(parseYaml(source), file, catalog, warnings);
  return { node, warnings };
}
