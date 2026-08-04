import type {
  BlockNode,
  ImageResolver,
  Inline,
  ManualNode,
  NodeId,
  ResolvedManual,
  SectionNode,
} from "@broadsec-manual/blocks";
import { tokens } from "@broadsec-manual/tokens";
import { stylesheet } from "./css.ts";

export interface CoverData {
  readonly brand: string;
  readonly title: string;
  readonly version: string;
  readonly lede: string;
  readonly meta: string;
}

export interface RenderOptions {
  readonly header: string;
  readonly cover: CoverData;
  /**
   * Which image slot each node declares, keyed by node or item id — exactly
   * what `collectSlots` produced for this target.
   *
   * The renderer holds NO opinion about which blocks carry images or when a
   * slot is implied: a node in this map has an image, a node absent from it
   * does not. That policy lives in the block catalogue and is applied once, in
   * core. Two places deciding it is two places to disagree.
   */
  readonly slots: ReadonlyMap<NodeId, string>;
  /** Turns a slot into a URL and tells whether it is still pending. */
  readonly images: ImageResolver;
  /** Inlined at the end of <body>; used to load the pagination polyfill. */
  readonly polyfill?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `**bold**` is the only inline markup, applied after escaping. */
const inlineMarkup = (s: string): string =>
  esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const plain = (inline: readonly Inline[]): string =>
  inline.map((i) => ("value" in i ? i.value : "")).join("");

/** A node's image, ready to place, or `undefined` if it declares none. */
interface Shot {
  readonly img: string;
  readonly pending: boolean;
}

/**
 * Render the image a node declares.
 *
 * Every image slot always renders something — the delivered image, or the one
 * placeholder standing in its place. Never an empty gap: a gap reads as
 * finished content, and the reader has no way to tell it is not.
 */
function shot(id: NodeId, o: RenderOptions, attrs = ""): Shot | undefined {
  const slot = o.slots.get(id);
  if (slot === undefined) return undefined;
  const resolved = o.images(slot);
  const pending = resolved.state === "pending";
  const cls = pending ? "shot shot--pending" : "shot";
  return {
    img: `<img class="${cls}" src="${esc(resolved.url)}"${attrs}>`,
    pending,
  };
}

/*
 * There is deliberately NO caption naming a pending image.
 *
 * The placeholder already says an image is coming, and every slot sits directly
 * under the thing it depicts — a field's label, a step's title, a figure's
 * caption, a row's label. A note would repeat the line above it in every single
 * case. The slot id, which is the one thing not otherwise visible, must not
 * appear either: the PDF is client-facing (invariant 4) and a slot id is a
 * trace of the pipeline's internals. It lives in the image manifest, which only
 * we read.
 */

/**
 * `icon-table` and `data-table` render through one function.
 *
 * What actually differs is three switches — an icon column, an item-number
 * column, and the header colour — so duplicating the markup for a second block
 * type would be two copies drifting apart over a boolean.
 */
function renderTable(node: BlockNode, o: RenderOptions): string {
  const rows = node.props["rows"] as ReadonlyArray<Record<string, unknown>>;
  const withIcons = node.type === "icon-table";
  const variant = withIcons ? "icon-table" : "data-table";

  // One column, always occupied: the control's icon once delivered, the
  // placeholder until then. An empty cell reads as "no control here".
  // No pending note — the column is 34pt wide, there is nowhere to put it.
  const iconCell = (r: Record<string, unknown>): string => {
    if (!withIcons) return "";
    const image = shot(String(r["id"]), o);
    if (!image) return `<td class="tbl__icon"></td>`;
    const cls = image.pending ? "tbl__icon tbl__icon--pending" : "tbl__icon";
    return `<td class="${cls}">${image.img}</td>`;
  };

  const body = rows
    .map((r) =>
      [
        `<tr>`,
        iconCell(r),
        `<td class="tbl__label">${esc(String(r["label"]))}</td>`,
        `<td>${inlineMarkup(String(r["description"]))}</td>`,
        `</tr>`,
      ].join(""),
    )
    .join("");

  return [
    `<table class="tbl tbl--${variant}"><thead><tr>`,
    withIcons ? `<th></th>` : "",
    `<th>${esc(String(node.props["labelHeader"]))}</th>`,
    `<th>${esc(String(node.props["descriptionHeader"]))}</th>`,
    `</tr></thead><tbody>${body}</tbody></table>`,
  ].join("");
}

function renderBlock(node: BlockNode, numbers: ReadonlyMap<NodeId, string>, o: RenderOptions): string {
  switch (node.type) {
    case "prose": {
      const body = `<p class="prose">${inlineMarkup(String(node.props["text"]))}</p>`;
      // An illustration, not a figure: no caption, no number. No pending note
      // either — a paragraph has no short label to name, and the placeholder
      // already says an image is coming.
      const image = shot(node.id, o);
      return image ? `${body}<p class="prose__shot">${image.img}</p>` : body;
    }

    case "callout": {
      const variant = String(node.props["variant"] ?? "info");
      const label = variant === "important" ? `<strong>IMPORTANTE:</strong> ` : "";
      return `<div class="callout callout--${esc(variant)}">${label}${inlineMarkup(
        String(node.props["text"]),
      )}</div>`;
    }

    case "detail-header":
      return `<h3 class="detail-header">${esc(String(node.props["text"]))}</h3>`;

    case "field-list": {
      const items = node.props["items"] as ReadonlyArray<Record<string, unknown>>;
      return `<div class="field-list">${items
        .map((f) => {
          const label = String(f["label"]);
          const image = shot(String(f["id"]), o);
          const figure = image ? `<p class="field__shot">${image.img}</p>` : "";
          return [
            `<div class="field">`,
            `<p class="field__label">${esc(label)}</p>`,
            `<p class="prose">${inlineMarkup(String(f["text"]))}</p>`,
            figure,
            `</div>`,
          ].join("");
        })
        .join("")}</div>`;
    }

    case "term-list": {
      const entries = node.props["entries"] as ReadonlyArray<Record<string, unknown>>;
      return `<dl class="term-list">${entries
        .map((e) => {
          const image = shot(String(e["id"]), o);
          return (
            `<div class="term"><dt>${esc(String(e["term"]))}:</dt>` +
            `<dd>${inlineMarkup(String(e["definition"]))}</dd>` +
            (image ? `<p class="term__shot">${image.img}</p>` : "") +
            `</div>`
          );
        })
        .join("")}</dl>`;
    }

    case "procedure": {
      const steps = node.props["steps"] as ReadonlyArray<Record<string, unknown>>;
      const lead = node.props["lead"]
        ? `<p class="prose">${inlineMarkup(String(node.props["lead"]))}</p>`
        : "";
      const body = steps
        .map((s) => {
          // The ordinal comes from the numbers map, assigned after
          // conditioning — never from the step's position in the source.
          const n = numbers.get(String(s["id"])) ?? "";
          const actions = Array.isArray(s["actions"])
            ? `<ol class="step__actions">${(s["actions"] as string[])
                .map((a) => `<li>${inlineMarkup(a)}</li>`)
                .join("")}</ol>`
            : "";
          const title = String(s["title"]);
          const image = shot(String(s["id"]), o);
          const figure = image ? `<p class="step__shot">${image.img}</p>` : "";
          return [
            `<div class="step">`,
            `<p class="step__title"><span class="step__marker">Paso ${esc(n)}:</span> ${esc(
              title,
            )}</p>`,
            `<p class="prose">${inlineMarkup(String(s["text"]))}</p>`,
            actions,
            figure,
            `</div>`,
          ].join("");
        })
        .join("");
      return `<div class="procedure">${lead}${body}</div>`;
    }

    case "figure": {
      const n = numbers.get(node.id);
      const label = n ? `Figura ${n}. ` : "";
      const caption = String(node.props["caption"]);
      const width = Number(node.props["widthPercent"] ?? 100);
      const image = shot(node.id, o, ` style="width:${width}%"`);
      return [
        `<figure>`,
        image?.img ?? "",
        `<figcaption>${label}${esc(caption)}</figcaption>`,
        `</figure>`,
      ].join("");
    }

    // Both table types share this renderer. They stayed separate block types
    // because numbering is declared per TYPE, not per instance: icon-table
    // numbers its rows, data-table does not, and one type cannot do both.
    case "icon-table":
    case "data-table":
      return renderTable(node, o);

    default:
      // A block type with no renderer is a broken block, not a silent skip.
      throw new Error(
        `render-web has no renderer for block type "${node.type}" (node ${node.id})`,
      );
  }
}

function renderSection(
  node: SectionNode,
  depth: number,
  numbers: ReadonlyMap<NodeId, string>,
  o: RenderOptions,
): string {
  const n = numbers.get(node.id) ?? "";
  const title = `${n}. ${plain(node.title)}`;
  const children = node.children
    .map((c) => renderNode(c, depth + 1, numbers, o))
    .join("\n");

  if (depth === 0) {
    const subtitle = node.subtitle
      ? `<p class="section-header__subtitle">${esc(plain(node.subtitle))}</p>`
      : "";
    return [
      `<header class="section-header">`,
      `<h1 class="section-header__title">${esc(title)}</h1>`,
      subtitle,
      `</header>`,
      children,
    ].join("\n");
  }
  if (depth === 1) {
    return `<h2 class="subsection-header">${esc(title)}</h2>\n${children}`;
  }
  // Deeper divisions are detail blocks: subordinate, unnumbered in the design.
  return `<h3 class="detail-header">${esc(plain(node.title))}</h3>\n${children}`;
}

function renderNode(
  node: ManualNode,
  depth: number,
  numbers: ReadonlyMap<NodeId, string>,
  o: RenderOptions,
): string {
  return node.kind === "section"
    ? renderSection(node, depth, numbers, o)
    : renderBlock(node, numbers, o);
}

function renderCover(c: CoverData): string {
  return [
    `<section class="cover">`,
    `<h1 class="cover__brand">${esc(c.brand)}</h1>`,
    `<div class="cover__rule"></div>`,
    `<p class="cover__title">${esc(c.title)}</p>`,
    `<span class="cover__version">Versión ${esc(c.version)}</span>`,
    `<p class="cover__lede">${esc(c.lede)}</p>`,
    `<p class="cover__meta">${esc(c.meta)}</p>`,
    `</section>`,
  ].join("\n");
}

/** Render a resolved manual to a self-contained HTML document. */
export function renderHtml(manual: ResolvedManual, o: RenderOptions): string {
  const body = manual.children.map((c) => renderNode(c, 0, manual.numbers, o)).join("\n");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>${esc(o.cover.brand)} — ${esc(o.cover.title)}</title>
<style>${stylesheet(tokens, o.header)}</style>
</head><body>
${renderCover(o.cover)}
<main class="content">
${body}
</main>
${o.polyfill ? `<script>${o.polyfill}</script>` : ""}
</body></html>`;
}
