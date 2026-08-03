import type {
  BlockNode,
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
  /** Prefix for asset paths, e.g. a `file://` URL of the assets folder. */
  readonly assetBase: string;
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

const asset = (base: string, src: string): string =>
  `${base.replace(/\/$/, "")}/${src.replace(/^\//, "")}`;

function renderBlock(node: BlockNode, numbers: ReadonlyMap<NodeId, string>, o: RenderOptions): string {
  switch (node.type) {
    case "prose":
      return `<p class="prose">${inlineMarkup(String(node.props["text"]))}</p>`;

    case "note":
      return `<div class="note">${inlineMarkup(String(node.props["text"]))}</div>`;

    case "detail-header":
      return `<h3 class="detail-header">${esc(String(node.props["text"]))}</h3>`;

    case "figure": {
      const n = numbers.get(node.id);
      const label = n ? `Figura ${n}. ` : "";
      const width = Number(node.props["widthPercent"] ?? 100);
      return [
        `<figure>`,
        `<img src="${esc(asset(o.assetBase, String(node.props["src"])))}" style="width:${width}%">`,
        `<figcaption>${label}${esc(String(node.props["caption"]))}</figcaption>`,
        `</figure>`,
      ].join("");
    }

    case "icon-table": {
      const rows = node.props["rows"] as ReadonlyArray<Record<string, unknown>>;
      // Conditioning can remove every row that had an icon. Keeping the column
      // then leaves a strip of empty dark cells, so it is decided per build.
      const hasIcons = rows.some((r) => Boolean(r["icon"]));
      const body = rows
        .map((r) => {
          const ref = numbers.get(String(r["id"])) ?? "";
          const icon = hasIcons
            ? `<td class="icon-table__icon">${
                r["icon"] ? `<img src="${esc(asset(o.assetBase, String(r["icon"])))}">` : ""
              }</td>`
            : "";
          return [
            `<tr>`,
            icon,
            `<td class="icon-table__ref">${esc(ref)}</td>`,
            `<td class="icon-table__label">${esc(String(r["label"]))}</td>`,
            `<td>${inlineMarkup(String(r["description"]))}</td>`,
            `</tr>`,
          ].join("");
        })
        .join("");
      return [
        `<table class="icon-table"><thead><tr>`,
        hasIcons ? `<th></th>` : "",
        `<th>Ítem</th>`,
        `<th>${esc(String(node.props["labelHeader"]))}</th>`,
        `<th>${esc(String(node.props["descriptionHeader"]))}</th>`,
        `</tr></thead><tbody>${body}</tbody></table>`,
      ].join("");
    }

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
