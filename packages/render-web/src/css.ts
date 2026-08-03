import type { Tokens } from "@broadsec-manual/tokens";

/**
 * Escape a value for use inside a CSS string literal (e.g. a `content`
 * value), and neutralise a literal `</style>` sequence.
 *
 * This stylesheet is embedded verbatim inside a literal `<style>` element in
 * `html.ts`. `<style>` is a "raw text" element: the HTML parser closes it at
 * the first `</style` sequence it sees, character-for-character, regardless
 * of CSS quoting. A backslash between `<` and `/` breaks that sequence
 * without changing what a CSS parser renders — `\/` inside a CSS string is
 * an escaped `/`.
 */
function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/<\/(style)/gi, "<\\/$1");
}

/**
 * Stylesheet for the paginated target.
 *
 * Every value comes from `tokens`. A literal colour or size in here is a bug —
 * the design system must be swappable without touching this file.
 */
export function stylesheet(t: Tokens, header: string): string {
  const gutter = `calc(${t.page.marginX} - 12pt)`;
  const safeHeader = escapeCssString(header);
  return `
@page {
  size: ${t.page.size};
  margin: ${t.page.marginTop} ${t.page.marginX} ${t.page.marginBottom};

  @top-left-corner { content: ""; background: ${t.runningHeader.accent}; }
  @top-left {
    content: "${safeHeader}";
    color: ${t.runningHeader.textColor};
    font: ${t.runningHeader.textSize} ${t.font.sans};
    vertical-align: middle;
    padding-left: 10pt;
    white-space: pre;
  }
  @top-right {
    content: "INOVISEC";
    color: ${t.runningHeader.textColor};
    font: ${t.runningHeader.textSize} ${t.font.sans};
    letter-spacing: 1.4pt;
    vertical-align: middle;
    text-align: right;
    white-space: pre;
    padding-right: 10pt;
  }
  @top-right-corner { content: ""; }

  @bottom-left {
    content: "© 2026 Inovisec — Confidencial — Uso Interno";
    color: ${t.runningFooter.textColor};
    font: ${t.runningFooter.textSize} ${t.font.sans};
    border-top: 0.6pt solid ${t.runningFooter.rule};
    padding-top: 5pt;
    vertical-align: top;
  }
  @bottom-right {
    content: "Página " counter(page);
    color: ${t.runningFooter.pageNumberColor};
    font: bold ${t.runningFooter.pageNumberSize} ${t.font.sans};
    border-top: 0.6pt solid ${t.runningFooter.rule};
    padding-top: 5pt;
    vertical-align: top;
    text-align: right;
  }
}

/* The cover is full-bleed and carries no running furniture. */
@page cover {
  margin: 0;
  @top-left-corner { content: none; }
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @top-right-corner { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}

/*
 * Running header bar.
 *
 * The bar is painted on the polyfill's margin ROW, not on the individual
 * margin boxes. A margin box with no content is never generated, so
 * backgrounding each box leaves gaps wherever a box happens to be empty.
 * These class names are the polyfill's contract — the one place this
 * stylesheet knows which pagination engine is in use.
 */
.pagedjs_margin-top,
.pagedjs_margin-top-right-corner-holder { background: ${t.runningHeader.background}; }
.pagedjs_margin-top-left-corner-holder { background: ${t.runningHeader.accent}; }
.pagedjs_cover_page .pagedjs_margin-top,
.pagedjs_cover_page .pagedjs_margin-top-right-corner-holder,
.pagedjs_cover_page .pagedjs_margin-top-left-corner-holder { background: none; }

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: ${t.font.sans};
  color: ${t.prose.color};
  background: ${t.page.background};
}

/* ---- cover ---------------------------------------------------------- */

.cover {
  page: cover;
  break-after: page;
  background: ${t.cover.background};
  color: ${t.cover.titleColor};
  height: 100%;
  padding: 120pt 56pt 40pt;
  border-left: 10pt solid ${t.cover.accent};
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.cover__brand {
  font-size: 46pt;
  font-weight: bold;
  letter-spacing: 2pt;
  margin: 0;
}
.cover__rule {
  height: 3pt;
  width: 300pt;
  background: ${t.cover.accent};
  margin: 10pt 0 14pt;
}
.cover__title {
  font-size: 17pt;
  color: ${t.cover.subtitleColor};
  margin: 0 0 16pt;
}
.cover__version {
  align-self: flex-start;
  background: ${t.cover.accent};
  color: ${t.cover.background};
  font-size: ${t.runningHeader.textSize};
  font-weight: bold;
  padding: 4pt 10pt;
  border-radius: 3pt;
}
.cover__lede {
  border-top: 0.6pt solid ${t.cover.metaColor};
  margin-top: 22pt;
  padding-top: 14pt;
  font-size: 12pt;
  max-width: 330pt;
  line-height: 1.5;
}
.cover__meta {
  margin-top: auto;
  padding-top: 60pt;
  color: ${t.cover.metaColor};
  font-size: ${t.runningFooter.textSize};
}

/* ---- headings ------------------------------------------------------- */

.section-header {
  background: ${t.sectionHeader.background};
  border-left: 5pt solid ${t.sectionHeader.accent};
  padding: 10pt 14pt;
  margin: 0 0 ${t.space.lg};
  break-after: avoid;
  break-inside: avoid;
}
.section-header__title {
  color: ${t.sectionHeader.titleColor};
  font-size: ${t.sectionHeader.titleSize};
  font-weight: bold;
  text-transform: uppercase;
  margin: 0;
}
.section-header__subtitle {
  color: ${t.sectionHeader.subtitleColor};
  font-size: ${t.sectionHeader.subtitleSize};
  margin: 3pt 0 0;
}

.subsection-header {
  background: ${t.subsectionHeader.background};
  border-left: 4pt solid ${t.subsectionHeader.accent};
  padding: 6pt 12pt;
  margin: ${t.space.lg} 0 ${t.space.md};
  color: ${t.subsectionHeader.titleColor};
  font-size: ${t.subsectionHeader.titleSize};
  font-weight: bold;
  break-after: avoid;
  break-inside: avoid;
}

.detail-header {
  color: ${t.detailHeader.color};
  font-size: ${t.detailHeader.size};
  font-weight: bold;
  margin: ${t.space.md} 0 ${t.space.sm};
  break-after: avoid;
}

/* ---- blocks --------------------------------------------------------- */

p.prose {
  font-size: ${t.prose.size};
  line-height: ${t.prose.lineHeight};
  text-align: ${t.prose.align};
  margin: 0 0 ${t.space.md};
  orphans: 2;
  widows: 2;
}

figure {
  margin: ${t.space.lg} 0;
  text-align: center;
  break-inside: avoid;
}
figure img {
  max-width: 100%;
  border: 0.6pt solid ${t.table.rule};
}
figcaption {
  margin-top: ${t.space.sm};
  color: ${t.figure.captionColor};
  font-size: ${t.figure.captionSize};
  font-style: ${t.figure.captionStyle};
}

table.icon-table {
  width: 100%;
  border-collapse: collapse;
  margin: ${t.space.md} 0 ${t.space.lg};
  font-size: ${t.table.cellSize};
}
table.icon-table thead th {
  background: ${t.table.headBackground};
  color: ${t.table.headColor};
  font-size: ${t.table.headSize};
  text-align: left;
  padding: 6pt 8pt;
}
table.icon-table tbody tr { break-inside: avoid; }
table.icon-table tbody tr:nth-child(even) { background: ${t.table.rowAltBackground}; }
table.icon-table td {
  padding: 5pt 8pt;
  border-bottom: 0.5pt solid ${t.table.rule};
  color: ${t.table.cellColor};
  vertical-align: middle;
}
td.icon-table__icon {
  width: 34pt;
  text-align: center;
  background: ${t.sectionHeader.background};
}
td.icon-table__icon img { max-width: 20pt; max-height: 20pt; }
td.icon-table__ref {
  width: 34pt;
  color: ${t.figure.captionColor};
  font-size: ${t.runningFooter.textSize};
  text-align: center;
}
td.icon-table__label {
  width: 130pt;
  color: ${t.table.labelColor};
  font-weight: bold;
}

.note {
  background: ${t.note.background};
  border-left: 3pt solid ${t.note.accent};
  padding: 8pt 12pt;
  margin: ${t.space.md} 0;
  font-size: ${t.note.size};
  color: ${t.note.color};
  break-inside: avoid;
}

.content { padding-right: ${gutter}; }
`;
}
