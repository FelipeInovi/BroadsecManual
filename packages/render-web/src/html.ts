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
  /**
   * Figure ordinals, keyed by the node or item carrying the image — one counter
   * per top-level section, shared by every block that produces a figure.
   *
   * Separate from `numbers` because a procedure step needs both its step ordinal
   * and its figure number.
   */
  readonly figures: ReadonlyMap<NodeId, string>;
  /**
   * Draft build: print the filename every pending image must be delivered
   * under, beside the placeholder that stands in for it.
   *
   * OFF for anything a client receives. A slot name is a trace of the pipeline's
   * internals and invariant 4 keeps those out of client-facing output — but the
   * person walking through the product with this document in hand has no other
   * way to know what to call the file they just captured. Two builds of the same
   * content, not one compromise.
   */
  readonly draft?: boolean;
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
  /**
   * The filename label for a pending image — present only in a draft build.
   *
   * Empty in a client build even when the image is pending: the placeholder
   * says an image is coming, and that is all a client needs to know.
   */
  readonly name: string;
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
    name: o.draft && pending && resolved.deliverTo ? pendingName(resolved.deliverTo) : "",
  };
}

/**
 * Every image outside a table, as a captioned and numbered figure.
 *
 * The manual has exactly two image conventions — this one and an icon in an
 * icon table — so a step's control, an element's screenshot and a standalone
 * illustration all arrive here. A bare centred screenshot with nothing under it
 * is not a third convention, it is the absence of one: nothing can refer to it.
 *
 * The number comes from `figures`, one counter per top-level section shared by
 * every block that produces a figure. The caption is what the block declared the
 * image shows.
 */
function figureFor(
  id: NodeId,
  caption: string,
  o: RenderOptions,
  attrs = "",
): string {
  const image = shot(id, o, attrs);
  if (!image) return "";
  const n = o.figures.get(id);
  const label = n ? `Figura ${esc(n)}. ` : "";
  // A `figure` block declares its own width; an item's image has none to declare,
  // so it is capped in CSS instead. Without the distinction a control screenshot
  // would render at the full column width, which is how a button ends up bigger
  // than the paragraph explaining it.
  const cls = attrs ? "figure" : "figure figure--item";
  return [
    `<figure class="${cls}">`,
    image.img,
    `<figcaption>${label}${esc(caption)}</figcaption>`,
    image.name,
    `</figure>`,
  ].join("");
}

/**
 * The filename a pending image must be delivered under.
 *
 * Draft builds only. Printed as the path itself rather than prose around it: it
 * is text to be transcribed exactly, and every extra word is a chance to
 * transcribe the wrong part of the line.
 */
const pendingName = (deliverTo: string): string =>
  `<span class="shot__name">${esc(deliverTo)}</span>`;

/**
 * Text and its figure, arranged as the item asked for.
 *
 * `beside` puts the explanation and the image in two columns. The heading above
 * them — a step's "Paso N", a field's label — deliberately stays full width, so
 * the markers still line up down the page and a procedure remains scannable.
 */
function pair(text: string, figure: string, layout: unknown): string {
  if (layout !== "beside" || !figure) return `${text}${figure}`;
  return (
    `<div class="pair">` +
    `<div class="pair__text">${text}</div>` +
    `<div class="pair__figure">${figure}</div>` +
    `</div>`
  );
}

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
  const iconCell = (image: Shot | undefined): string => {
    if (!withIcons) return "";
    if (!image) return `<td class="tbl__icon"></td>`;
    const cls = image.pending ? "tbl__icon tbl__icon--pending" : "tbl__icon";
    return `<td class="${cls}">${image.img}</td>`;
  };

  const body = rows
    .map((r) => {
      const image = withIcons ? shot(String(r["id"]), o) : undefined;
      // A draft's filename goes in the DESCRIPTION cell, not under the icon:
      // the icon column is 34pt wide and a path would either wrap to shreds or
      // stretch the column and wreck the table.
      const description = inlineMarkup(String(r["description"])) + (image?.name ?? "");
      return [
        `<tr>`,
        iconCell(image),
        `<td class="tbl__label">${esc(String(r["label"]))}</td>`,
        `<td>${description}</td>`,
        `</tr>`,
      ].join("");
    })
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
    // Carries no image: an illustrated paragraph is a paragraph followed by a
    // `figure`, because every image outside a table is a numbered figure.
    case "prose":
      return `<p class="prose">${inlineMarkup(String(node.props["text"]))}</p>`;

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
          return [
            `<div class="field">`,
            `<p class="field__label">${esc(label)}</p>`,
            pair(
              `<p class="prose">${inlineMarkup(String(f["text"]))}</p>`,
              figureFor(String(f["id"]), label, o),
              f["layout"],
            ),
            `</div>`,
          ].join("");
        })
        .join("")}</div>`;
    }

    case "term-list": {
      const entries = node.props["entries"] as ReadonlyArray<Record<string, unknown>>;
      return `<dl class="term-list">${entries
        .map((e) => {
          const term = String(e["term"]);
          return (
            `<div class="term"><dt>${esc(term)}:</dt>` +
            `<dd>${inlineMarkup(String(e["definition"]))}</dd>` +
            figureFor(String(e["id"]), term, o) +
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
          const figure = figureFor(String(s["id"]), title, o);
          return [
            `<div class="step">`,
            `<p class="step__title"><span class="step__marker">Paso ${esc(n)}:</span> ${esc(
              title,
            )}</p>`,
            pair(
              `<p class="prose">${inlineMarkup(String(s["text"]))}</p>${actions}`,
              figure,
              s["layout"],
            ),
            `</div>`,
          ].join("");
        })
        .join("");
      return `<div class="procedure">${lead}${body}</div>`;
    }

    case "figure": {
      const width = Number(node.props["widthPercent"] ?? 100);
      return figureFor(node.id, String(node.props["caption"]), o, ` style="width:${width}%"`);
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
