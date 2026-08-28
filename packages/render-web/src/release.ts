import type { BlockNode, Inline, ManualNode, NodeId, ResolvedManual, SectionNode } from "@broadsec-manual/blocks";
import { tokens } from "@broadsec-manual/tokens";
import type { Tokens } from "@broadsec-manual/tokens";
import { releaseStylesheet } from "./css-release.ts";

/**
 * The release notes' renderer. Its OWN, and `html.ts` is untouched.
 *
 * The first attempt put this inside `renderHtml`: a `document` discriminator on
 * the options, a third branch in `renderCover`, a wrapper `<div>` around every
 * section so the opener could claim its own page. That worked, and measuring it
 * is what argued against it — the wrapper stopped margins collapsing at each
 * module boundary and shifted the first paragraph after every section header by
 * a fraction of a pixel. Across the three manuals no page count moved and no
 * line rewrapped, so it would have shipped. But one of those manuals is already
 * in a client's hands, and "measurably almost nothing" is a worse guarantee than
 * "the file did not change".
 *
 * So: two renderers. They duplicate a little — `esc` below, the shape of a table
 * of contents — and that is the same trade `css-bridge.ts` records for the
 * stylesheets, one level up. The manuals' renderer cannot be broken from here,
 * because nothing here is theirs.
 *
 * WHAT THIS DOES NOT DO, deliberately: figures, procedures, icon tables, data
 * tables, field lists, change logs. Release notes carry three block types. A
 * document that needs a fourth is a document that has outgrown this template,
 * and adding a case here quietly is how it would stop being noticed.
 */

/** The office a set of notes is issued by, printed on the cover. */
export interface ReleaseContact {
  readonly org: string;
  readonly lines: readonly string[];
  readonly email: string;
}

export interface ReleaseCoverData {
  /**
   * The product these notes are about.
   *
   * THE ONE THING THAT VARIES BETWEEN PRODUCTS, and it sits where the reference
   * document carried a partner's mark. A parameter rather than a stylesheet per
   * product: a new manual inherits this layout and contributes a name.
   */
  readonly project: string;
  /** The line under "Release" — what this delivery is. */
  readonly title: string;
  /** One sentence naming the platform the changes landed in. */
  readonly lede: string;
  /** "Agosto, 2026" — a month, not a full date, as the reference prints it. */
  readonly date: string;
  readonly contact?: ReleaseContact;
}

export interface ReleaseOptions {
  readonly cover: ReleaseCoverData;
  /**
   * The footer's first line, above the product and the page number.
   *
   * Names what the DOCUMENT is, not which product it is about — the product is
   * already in the band above and on the line below.
   */
  readonly footerTitle: string;
  /** Inlined at the end of <body>; used to load the pagination polyfill. */
  readonly polyfill?: string;
  /** Page geometry. Only `page.size` is read; the palette here is its own. */
  readonly theme?: Tokens;
  /**
   * `@font-face` rules for the bundled faces, already built by the caller.
   *
   * The renderer cannot read a disk, so the bytes arrive as CSS. Omitted, the
   * document falls through to Century Gothic — close, never broken.
   */
  readonly fontFaces?: string;
}

/**
 * DUPLICATED FROM `html.ts`, and that is the cost of the split.
 *
 * One line, escaping four characters, unchanged since the file was written. If
 * it ever grows a fifth, both copies need it — which is exactly the kind of
 * thing worth saying out loud rather than discovering.
 */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** `**bold**` is the only inline markup, applied after escaping. Same rule. */
const inlineMarkup = (s: string): string =>
  esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const plain = (inline: readonly Inline[]): string =>
  inline.map((i) => ("value" in i ? i.value : "")).join("");

/**
 * Inovisec's mark, DRAWN rather than loaded.
 *
 * The file the manuals use is teal, and on every band here the mark has to be
 * white; a raster cannot be recoloured, so the ring is geometry.
 */
const ring = (fill: string): string =>
  `<circle cx="20" cy="20" r="17" fill="none" stroke="${fill}" stroke-width="4.2"/>` +
  `<rect x="12.6" y="4.4" width="2.8" height="18.8" fill="${fill}"/>` +
  `<circle cx="14" cy="23" r="4.6" fill="${fill}"/>` +
  `<circle cx="25.6" cy="16" r="4.6" fill="${fill}"/>` +
  `<rect x="24.2" y="16" width="2.8" height="19.6" fill="${fill}"/>`;

/**
 * The whole lockup as ONE SVG — ring and word together.
 *
 * NOT two elements in a flex row, and that is the point. Once the paginator
 * copies a running element into a margin box it restyles it as a block, so the
 * flex lost and the word wrapped under the ring: it read as a stray copy of the
 * mark rather than as one lockup broken in two. Raising specificity did not win
 * either. A single SVG has no layout for the paginator to change — its two
 * pieces are placed by coordinates, and coordinates survive anything.
 */
const inovisecLockup = (): string =>
  `<svg class="rh__lockup" viewBox="0 0 190 40" aria-label="Inovisec">` +
  `<g>${ring("#FFFFFF")}</g>` +
  `<text x="56" y="27.5" fill="#FFFFFF" font-size="19" letter-spacing="1.6"` +
  ` font-weight="300">INOVISEC</text></svg>`;

/**
 * The project name as a wordmark: its trailing digits in a heavier weight.
 *
 * "BRIDGE360" reads as a lockup rather than a word once the number carries a
 * different weight. A name that does not end in digits prints whole, which is
 * the case this has to get right rather than the one it is written for.
 */
export function projectMark(project: string): string {
  const found = /^(.*[^\d])(\d+)$/.exec(project);
  if (found === null) return `<span>${esc(project)}</span>`;
  return `<span>${esc(found[1] ?? "")}</span><b>${esc(found[2] ?? "")}</b>`;
}

/**
 * The cover's two waves.
 *
 * SVG paths, because a curve is a path and a gradient is not; the gradients are
 * declared here rather than reused from the stylesheet because an SVG `fill`
 * cannot reference a CSS `linear-gradient()`.
 *
 * Free to be this elaborate for one reason: the Word file takes its cover as a
 * SCREENSHOT of this page, so anything a browser can paint arrives intact.
 *
 * Measured off the reference — the band ends at 314 on the left and 604 on the
 * right, curving between 52% and 72% of the width; the footer is that curve
 * mirrored. No third-party mark and none of its discs.
 */
const coverWaves = (): string =>
  `<svg class="cover__wave cover__wave--top" viewBox="0 0 2100 610"` +
  ` preserveAspectRatio="none" aria-hidden="true">` +
  `<defs><linearGradient id="rnTop" x1="0" y1="0" x2="1" y2="0">` +
  `<stop offset="0" stop-color="#273262"/><stop offset=".28" stop-color="#285272"/>` +
  `<stop offset=".54" stop-color="#27667B"/><stop offset=".78" stop-color="#278787"/>` +
  `<stop offset="1" stop-color="#339A8C"/></linearGradient></defs>` +
  `<path d="M0,0 L2100,0 L2100,604 L1512,604 C1385,604 1235,314 1092,314 L0,314 Z"` +
  ` fill="url(#rnTop)"/></svg>` +
  `<svg class="cover__wave cover__wave--bottom" viewBox="0 0 2100 480"` +
  ` preserveAspectRatio="none" aria-hidden="true">` +
  `<defs><linearGradient id="rnBot" x1="0" y1="0" x2="1" y2="0">` +
  `<stop offset="0" stop-color="#31968A"/><stop offset=".30" stop-color="#2A7B80"/>` +
  `<stop offset=".60" stop-color="#276074"/><stop offset="1" stop-color="#26315B"/>` +
  `</linearGradient></defs>` +
  `<path d="M880,196 C990,196 1035,166 1155,166 L2100,166 L2100,200 L880,200 Z"` +
  ` fill="#3DBABA"/>` +
  `<path d="M0,48 L294,48 C455,48 570,192 735,192 L2100,192 L2100,480 L0,480 Z"` +
  ` fill="url(#rnBot)"/>` +
  `<g opacity=".07" transform="translate(30,150) scale(8.6)">${ring("#FFFFFF")}</g></svg>`;

/** The three ways to reach the office, as the reference prints them. */
const REACH: readonly { readonly icon: string; readonly text: string }[] = [
  {
    icon:
      `<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 3 2.6 15.5 0 19` +
      `M12 2.5c-2.6 3-2.6 15.5 0 19"/>`,
    text: "www.inovisec.com",
  },
  {
    icon:
      `<path d="M6.6 3.3a1.7 1.7 0 0 1 2.4.5l1.5 2.4a1.7 1.7 0 0 1-.3 2.2l-1 .8a10 10 0 0 0 ` +
      `3.9 3.9l.8-1a1.7 1.7 0 0 1 2.2-.3l2.4 1.5a1.7 1.7 0 0 1 .5 2.4l-1 1.4c-.8 1.1-2.3 ` +
      `1.5-3.5.9A20 20 0 0 1 4.3 8.4c-.6-1.2-.2-2.7.9-3.5z" fill="#4ED8CB" stroke="none"/>`,
    text: "+57 (601) 640 77 72",
  },
  {
    icon: `<rect x="2.5" y="5" width="19" height="14" rx="1.6"/><path d="M3 6.5l9 6 9-6"/>`,
    text: "contact@inovisec.com",
  },
];

const NOTICE =
  `This document is confidential and proprietary to INOVISEC. It is intended solely ` +
  `for the use of the intended recipient and may not be reproduced, distributed, ` +
  `transmitted, or disclosed to any third party without prior written consent. Any ` +
  `reproduction or distribution requires explicit written permission from the ` +
  `copyright owner.`;

/** The cover: its own page, bleeding to the paper's edge, with no chrome. */
function renderCover(c: ReleaseCoverData): string {
  const contact = c.contact;
  return [
    `<section class="cover">`,
    coverWaves(),
    `<span class="cover__project">${projectMark(c.project)}</span>`,
    `<div class="cover__lockup">`,
    `<svg class="cover__mark" viewBox="0 0 40 40" aria-hidden="true">${ring("#FFFFFF")}</svg>`,
    `<span class="cover__wordmark">INOVISEC</span>`,
    `</div>`,
    `<p class="cover__eyebrow">Release</p>`,
    `<p class="cover__title">${esc(c.title)}</p>`,
    `<div class="cover__rule"></div>`,
    `<p class="cover__lede">${esc(c.lede)}</p>`,
    `<p class="cover__date">${esc(c.date)}</p>`,
    contact === undefined
      ? ""
      : `<div class="cover__contact"><b>Contacto:</b><b>${esc(contact.org)}</b>` +
        contact.lines.map((l) => `${esc(l)}<br>`).join("") +
        `Correo: <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></div>`,
    `<div class="cover__notice"><b>CONFIDENTIALITY AND COPYRIGHT NOTICE</b>${NOTICE}</div>`,
    `<div class="cover__tag">INNOVATING <i>WHERE IT COUNTS</i></div>`,
    `<div class="cover__hair"></div>`,
    `<div class="cover__reach">`,
    ...REACH.map(
      (r) =>
        `<span><svg viewBox="0 0 24 24" fill="none" stroke="#4ED8CB" stroke-width="1.8"` +
        ` aria-hidden="true">${r.icon}</svg>${esc(r.text)}</span>`,
    ),
    `</div>`,
    `</section>`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

/**
 * The running elements the interior pages draw their chrome from.
 *
 * Both wrapped in zero-height hosts: `position: running()` is meant to pull an
 * element out of flow and `element()` does find it, but this paginator leaves
 * the ORIGINAL in the text flow as well, which gives the document a blank first
 * page carrying nothing but its own header.
 *
 * The footer is three lines, so it cannot be a margin box: those are one row.
 * Its page number resolves through `counter(page)` inside the running element —
 * verified rendering, not assumed.
 */
function renderRunning(c: ReleaseCoverData, footerTitle: string): string {
  return (
    // The lockup rides in a running element and the project name in its own
    // margin box, and that is not a preference: a margin box SHRINKS TO ITS
    // CONTENT. Putting both in one row gave it 245px to work with, the two did
    // not fit on a line, and the project name wrapped underneath — which looked
    // exactly like a stray copy leaking out of the host. Two boxes, each sized
    // by what it holds, and the page's own small margin is what lets them reach
    // the paper's edge.
    `<div class="rh-host"><div class="rh">${inovisecLockup()}</div></div>` +
    `<div class="rf-host"><div class="rf">` +
    `<div class="rf__title">${esc(footerTitle)}</div>` +
    `<div class="rf__row"><span>Inovisec &ndash; ${esc(c.project)}</span>` +
    `<span>P&aacute;gina <span class="rf__page"></span></span></div>` +
    `<div class="rf__seal">Confidencial</div>` +
    `</div></div>`
  );
}

/**
 * The table of contents. Generated, never authored.
 *
 * TWO LEVELS, matching the document. The reference numbers three, and flattening
 * to two was a decision: its middle level named the product, which is already on
 * the cover and in every band.
 *
 * Titled "Contenido", as the reference has it — the manuals print "Tabla de
 * Contenido", and this renderer is why the two can differ without a flag.
 *
 * The page number comes from `target-counter`, which the paginator resolves once
 * the layout is final; that is why every heading carries its id as an anchor.
 */
function renderToc(manual: ResolvedManual): string {
  const entry = (node: SectionNode, level: 1 | 2): string => {
    const n = manual.numbers.get(node.id);
    const label = n ? `${n}. ${plain(node.title)}` : plain(node.title);
    return (
      `<a class="toc__entry toc__entry--l${level}" href="#${esc(node.id)}">` +
      `<span class="toc__text">${esc(label)}</span></a>`
    );
  };
  const rows = manual.children
    .filter((c): c is SectionNode => c.kind === "section")
    .map(
      (section) =>
        entry(section, 1) +
        section.children
          .filter((c): c is SectionNode => c.kind === "section")
          .map((sub) => entry(sub, 2))
          .join(""),
    )
    .join("");
  return `<nav class="toc"><h1 class="toc__title">Contenido</h1>${rows}</nav>`;
}

/**
 * The three block types these notes are made of, and no others.
 *
 * An unknown type renders as nothing rather than throwing: the content is
 * validated against the catalogue before it reaches here, so a type arriving
 * that this does not draw means the document outgrew the template, and a silent
 * gap in a proof is easier to see than a stack trace in a build log.
 */
function renderBlock(node: BlockNode): string {
  switch (node.type) {
    case "prose":
      return `<p class="prose">${inlineMarkup(String(node.props["text"]))}</p>`;

    case "callout": {
      const variant = String(node.props["variant"] ?? "info");
      const label = variant === "important" ? `<strong>IMPORTANTE:</strong> ` : "";
      return (
        `<div class="callout callout--${esc(variant)}">${label}` +
        `${inlineMarkup(String(node.props["text"]))}</div>`
      );
    }

    // The validity row. Reuses `term-list` rather than a block of its own: a
    // block added to the catalogue is an option every manual author can then
    // pick, in a manual where it does not belong. The stylesheet is what makes
    // its one entry print as the reference's bordered row.
    case "term-list": {
      const entries = node.props["entries"] as ReadonlyArray<Record<string, unknown>>;
      return `<dl class="term-list">${entries
        .map(
          (e) =>
            `<div class="term"><dt>${esc(String(e["term"]))}</dt>` +
            `<dd>${inlineMarkup(String(e["definition"]))}</dd></div>`,
        )
        .join("")}</dl>`;
    }

    default:
      return "";
  }
}

/**
 * A section, at one of exactly two depths.
 *
 * DEPTH 0 IS THE OPENER, and the whole module is wrapped so the named page
 * covers the heading AND everything under it. Wrapping only the heading gave the
 * opener a page of its own and pushed the content onto the next one.
 *
 * That wrapper is why this renderer exists rather than a flag in `html.ts`: the
 * same `<div>` added there stopped margins collapsing between modules and moved
 * the manuals' text by a fraction of a pixel. Here it costs nothing, because
 * nothing else is laid out by this file.
 */
function renderSection(node: SectionNode, depth: number, manual: ResolvedManual): string {
  const n = manual.numbers.get(node.id) ?? "";
  const title = plain(node.title);
  const children = node.children.map((c) => renderNode(c, depth + 1, manual)).join("\n");

  if (depth === 0) {
    return [
      `<div class="module">`,
      `<h1 class="opener" id="${esc(node.id)}">`,
      `<b>${esc(n)}.</b><span>${esc(title)}</span>`,
      `</h1>`,
      children,
      `</div>`,
    ].join("\n");
  }
  return (
    `<h2 class="subsection" id="${esc(node.id)}">` +
    `<b>${esc(n)}.</b> ${esc(title)}</h2>\n${children}`
  );
}

function renderNode(node: ManualNode, depth: number, manual: ResolvedManual): string {
  return node.kind === "section"
    ? renderSection(node, depth, manual)
    : renderBlock(node as BlockNode);
}

/** Render a resolved set of release notes to a self-contained HTML document. */
export function renderReleaseNotes(manual: ResolvedManual, o: ReleaseOptions): string {
  const theme = o.theme ?? tokens;
  const body = manual.children.map((c) => renderNode(c, 0, manual)).join("\n");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Release ${esc(o.cover.project)} — ${esc(o.cover.title)}</title>
<style>${releaseStylesheet(theme, o.cover.project, o.fontFaces ?? "")}</style>
</head><body>
${renderCover(o.cover)}
${renderRunning(o.cover, o.footerTitle)}
${renderToc(manual)}
<main class="content">
${body}
</main>
${o.polyfill ? `<script>${o.polyfill}</script>` : ""}
</body></html>`;
}
