import type { Tokens } from "@broadsec-manual/tokens";

/**
 * The release notes' stylesheet. Its OWN file, for the reason `css-bridge.ts`
 * already states about the two before it: a single configurable sheet let one
 * document silently inherit every decision nobody thought to override, and made
 * a delivered document something an unrelated change could break. A third
 * document gets a third file, and the duplicated rules are the price.
 *
 * ONE TEMPLATE FOR EVERY PRODUCT, and that is a decision rather than a
 * shortcut. These notes carry Inovisec's identity, not the product's, so nothing
 * here reads the brand: the only thing that varies between products is the
 * project name in the top band, which arrives as an argument. That closes the
 * door on a template per product before it opens — future manuals inherit this
 * one and contribute a name.
 *
 * Colours are LITERALS, measured off the reference document page by page, not
 * tokens. `t` is read for page geometry alone. A token would imply the palette
 * follows a brand, and it does not.
 *
 * NO THIRD-PARTY MARK ANYWHERE. The reference carries a partner's logo in the
 * band and its discs behind it; both are gone, and the ghost ring that remains
 * is Inovisec's own. Do not restore them because the reference has them.
 *
 * NOTE: this file is ONE template literal. A backtick anywhere in it —
 * including inside a CSS comment — is a TypeScript syntax error.
 */

/* --- geometry, in points on A4 (595 x 842pt) -----------------------------
 * Derived from the reference at 2100 x 2718 px: 1px = 0.28333pt across,
 * 0.30979pt down. Every value below was measured, not chosen.
 */
/** The interior header band. Its height IS the page's top margin: 224px. */
const BAND = "69pt";
/** The opener band, which is the same band grown to hold a section title: 502px. */
const OPENER_BAND = "155pt";
/**
 * TWO MARGINS, and separating them is what lets the chrome reach the edge.
 *
 * A margin box cannot cross the page margin, so with one margin of 83pt the
 * lockup and the project name sat 84pt and 98pt in — measured on the reference,
 * they belong at 22pt and 11pt. Trying to drag them out with negative margins
 * and a fixed width made the row overflow its box: the project name printed
 * twice, once clipped at the band's foot and once cut off at the paper's edge.
 *
 * So the PAGE margin is small — the chrome's margin — and the text column
 * indents itself back to where it was measured. Nothing in the body moves.
 */
const MARGIN_CHROME = "22pt";
/** Text starts at 13.9% of the width and ends at 86.05%. Symmetrical. */
const MARGIN_X = "83pt";
/** What the text adds back on top of the page's own small margin. */
const TEXT_INDENT = "61pt";
/** Room for the footer's rule and its three lines. */
const MARGIN_BOTTOM = "72pt";
/** Between the band and the first thing on an ordinary page. */
const CONTENT_TOP = "16pt";

/* --- palette, sampled from the reference -------------------------------- */
const INK = "#002060";
const INK_BODY = "#1A1A1A";
const TEAL = "#2B8C84";
const TEAL_BRIGHT = "#4ED8CB";
const TOC_BLUE = "#3478B7";
const LINK = "#1155CC";
const RULE_GREY = "#A6A6A6";
const CELL_FILL = "#B4C6E7";
const NOTICE_INK = "#262626";

/**
 * The ghost ring the reference sets behind the lockup, as a background image.
 *
 * A BACKGROUND, not an element: the band itself is painted by a pseudo-element
 * on the page box, and only a pseudo-element can sit under the margin boxes that
 * carry the type. Layering it into that same paint keeps it there without a node
 * anything else could reflow.
 *
 * Measured on the reference: the lightening runs from roughly 1 to 6.5 per cent
 * of the width and is cut by the band top and bottom, so the circle is larger
 * than the band is tall and rides half outside it.
 *
 * Encoded by hand rather than base64: the angle brackets and the hash are the
 * only characters a data URI cannot take raw, and a readable SVG is worth more
 * here than a shorter line.
 */
const GHOST_RING =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E" +
  "%3Cg fill='none' stroke='%23FFFFFF' stroke-width='4.2' opacity='0.11'%3E" +
  "%3Ccircle cx='20' cy='20' r='17'/%3E%3C/g%3E" +
  "%3Cg fill='%23FFFFFF' opacity='0.11'%3E" +
  "%3Crect x='12.6' y='4.4' width='2.8' height='18.8'/%3E" +
  "%3Ccircle cx='14' cy='23' r='4.6'/%3E" +
  "%3Ccircle cx='25.6' cy='16' r='4.6'/%3E" +
  "%3Crect x='24.2' y='16' width='2.8' height='19.6'/%3E%3C/g%3E%3C/svg%3E\")";

/** The cover band: navy on the left, teal on the right. */
const COVER_BAND = "linear-gradient(90deg, #273262 0%, #285272 28%, #27667B 54%, #278787 78%, #339A8C 100%)";
/** The interior band: the cover's, reversed — teal on the left, navy on the right. */
const HEAD_BAND = "linear-gradient(90deg, #3CB8A0 0%, #137598 33%, #05548F 50%, #084683 67%, #133C74 81%, #1D3573 100%)";
/** The opener band runs further, to a deeper blue. */
const OPEN_BAND = "linear-gradient(90deg, #37A28E 0%, #288386 14%, #125477 33%, #0C2A6A 50%, #0D1665 67%, #0C1972 100%)";
/** The rule under the cover's standfirst: teal to navy, switching at the middle. */
const COVER_RULE = "linear-gradient(90deg, #3AAFA0 0%, #2C8A85 43%, #2A4E7A 57%, #262E5E 100%)";

/**
 * Poppins first, then the faces frozen in the tokens.
 *
 * Poppins now TRAVELS WITH THE DOCUMENT — see `fontFaces` below and `POPPINS` in
 * the tokens. Naming a face without shipping it was the bug this fixes: the PDF
 * fell through to Century Gothic without a word, and the reader never knew the
 * document was not the one that had been approved. The rest of the chain stays
 * as the honest fallback if a face ever fails to load.
 */
const FACE = "Poppins, 'Century Gothic', 'Avenir Next', Arial, sans-serif";
/** Arial for the legal notice, which the reference sets apart the same way. */
const FACE_NOTICE = "Arial, Helvetica, sans-serif";

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/<\/(style)/gi, "<\\/$1");
}

/**
 * @font-face declarations for the bundled faces, or nothing.
 *
 * PASSED IN, never read here: only the CLI may touch a disk. Absent, the chain
 * falls through to Century Gothic — the document is then close rather than
 * exact, and never broken.
 */
export function releaseStylesheet(t: Tokens, project: string, fontFaces = ""): string {
  const safeProject = escapeCssString(project);
  return `
${fontFaces}
@page {
  size: ${t.page.size};
  margin: ${BAND} ${MARGIN_CHROME} ${MARGIN_BOTTOM};

  /* The band is painted on the page box, not here — see the note below. These
     boxes only carry type, so they stay transparent. */
  @top-left { content: element(rh); vertical-align: middle; }
  @top-center { content: ""; }
  @top-right {
    content: "${safeProject}";
    color: #FFFFFF;
    font: 10pt ${FACE};
    text-transform: uppercase;
    letter-spacing: 1.9pt;
    vertical-align: middle;
    text-align: right;
    white-space: pre;
    padding-right: 12pt;
  }

  /* Three lines, so it cannot be a margin box: those are one row. Real DOM,
     running, like the header. */
  @bottom-center { content: element(rf); }
}

/* The cover has no chrome at all and bleeds to the paper's edge. */
@page cover {
  margin: 0;
  @top-left { content: none; }
  @top-center { content: none; }
  @top-right { content: none; }
  @bottom-center { content: none; }
}

/* The opener page: the same band, grown to hold the section title. Paged.js
   gives the page its own margin, so the title sits inside the band rather than
   under it — no negative margins, and nothing to keep in sync with the band's
   height. */
@page opener {
  margin-top: ${OPENER_BAND};
  /* Both marks sit at the TOP of the taller band, clear of the section title
     that occupies its lower half. Centred — right for the ordinary 69pt band —
     they would land 77pt down, exactly on the title. */
  @top-left { vertical-align: top; padding-top: 16pt; }
  @top-right { vertical-align: top; padding-top: 20pt; }
}

/* ---- the band: ONE rectangle, not three --------------------------------
   The top margin is three sibling boxes, a centre row between two corner
   holders. A horizontal gradient across three boxes is three gradients, each
   restarting at its own left edge — the seams would be plain. Painted once on
   the page box, at exactly the top margin's height, it has none. The same
   reasoning css-bridge.ts records for its 1.5pt rule. No backticks in here. */
.pagedjs_pagebox { position: relative; }
.pagedjs_pagebox::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: ${BAND};
  /* The ring first, so it paints ON the gradient rather than under it. Sized to
     the band's height and hung half outside it, as the reference has it. */
  background: ${GHOST_RING} no-repeat -1pt 1.5pt / 66pt 66pt, ${HEAD_BAND};
  z-index: 0;
  pointer-events: none;
}
.pagedjs_opener_page .pagedjs_pagebox::before {
  height: ${OPENER_BAND};
  background: ${GHOST_RING} no-repeat -1pt -7pt / 66pt 66pt, ${OPEN_BAND};
}
.pagedjs_cover_page .pagedjs_pagebox::before { content: none; }

/* The type in the margin boxes has to sit above the band. */
.pagedjs_margin-top,
.pagedjs_margin-top-left-corner-holder,
.pagedjs_margin-top-right-corner-holder { position: relative; z-index: 1; background: none; }

/* The text column indents itself back to the margin it was measured at. */
.pagedjs_page_content { padding: ${CONTENT_TOP} ${TEXT_INDENT} 0; }
.pagedjs_cover_page .pagedjs_page_content { padding: 0; }
.pagedjs_opener_page .pagedjs_page_content { padding: ${CONTENT_TOP} ${TEXT_INDENT} 0; }

/* ---- running header: Inovisec's lockup -------------------------------- */
/* KNOWN DEFECT, and this is the state of the diagnosis.
   The footer's third line — the word Confidencial — also prints faintly inside
   the opener band, centred, near the top of the first content page. Tried and
   ruled out: margin collapse escaping the zero-height host (changed the seal's
   margin to padding, no effect), and taking the host out of the flow entirely
   with position:absolute off the sheet (no effect either). So it is not the
   original element leaking through its host. Next suspect is the paginator
   placing the running element into more than one margin box on a page whose top
   margin it has been told to grow. Left at the repo's own pattern rather than
   at a workaround that did not work. Cosmetic: faint, on the band, and the
   footer itself is correct on every page. */
.rh-host, .rf-host { height: 0; overflow: hidden; }
/* ONE PICTURE, so there is no layout for the paginator to restyle.

   The lockup was a flex row of a ring and a word, and the paginator restyles a
   running element as a BLOCK when it copies it into the margin box: the flex
   lost its arrangement and the word wrapped under the ring, reading as a stray
   copy of the mark rather than as one lockup split in two. Raising specificity
   did not win either. An svg places its pieces by coordinates, and coordinates
   survive being restyled.

   The project name keeps its own margin box: a margin box shrinks to what it
   holds, so two boxes each sized by their own content is what lets both reach
   the paper's edge — which the small page margin above makes possible. */
.rh { position: running(rh); }
.rh__lockup { width: 109pt; height: 23pt; display: block; }

/* ---- running footer: rule, then three lines -------------------------- */
.rf {
  position: running(rf);
  border-top: 0.5pt solid ${RULE_GREY};
  padding-top: 7pt;
  /* The margin subtracts from the width; without this the block keeps the full
     measure AND gets pushed right, so the rule ran off the sheet and the seal
     centred itself 40pt too far right. */
  width: calc(100% - ${TEXT_INDENT} - ${TEXT_INDENT});
  color: ${INK};
  font-family: ${FACE};
  font-size: 8pt;
  line-height: 11.5pt;
  text-align: left;
  /* The footer belongs to the text column, not to the chrome: on the reference
     its rule runs from 13.67% to 86.29%, the same measure as the body. */
  margin: 0 ${TEXT_INDENT};
}
.rf__title { font-weight: 600; }
.rf__row { display: flex; justify-content: space-between; }
.rf__seal {
  text-align: center;
  font-weight: 600;
  /* PADDING, NOT MARGIN. A margin here collapses out through the zero-height
     host that keeps the running element out of the flow, and carried the word
     "Confidencial" onto the top of the first content page. */
  padding-top: 3.5pt;
}
/* The page number belongs on the footer's SECOND line, so it cannot be its own
   margin box: those are a single row and would sit beside all three lines
   instead of inside one. The counter is therefore resolved inside the running
   element, and the paginator does resolve it there — verified in a real render.
   It read as missing for a while, but that was the width defect above pushing
   it off the sheet, not the counter failing. */
.rf__page::after { content: counter(page); }

/* ---- body ------------------------------------------------------------- */
body {
  margin: 0;
  font-family: ${FACE};
  color: ${INK_BODY};
  background: #FFFFFF;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ---- cover ------------------------------------------------------------
   VERTICAL OFFSETS ARE IN POINTS, horizontal ones in per cent, and mixing the
   two was the second thing that broke this page.

   The reference was measured in cqw — hundredths of its 2100px WIDTH — because
   that is what makes a layout scale with the sheet. Written back as top: %
   those numbers silently changed meaning: a percentage on top resolves against
   the container's HEIGHT. The legal notice sat at 104.5, which is a legitimate
   place on a page taller than it is wide and is off the bottom of one measured
   the other way. Converted once, at 595pt of width: cqw x 5.95 = pt.

   ANCHORED TO THE PAGE, not sized in viewport units.

   The first version said height: 100vh, and the whole cover came out blank: in
   this paginator a vh is a fraction of the BROWSER viewport, not of the sheet,
   so the cover measured whatever window the render happened to use and every
   percentage below resolved against that. The text was laid out far past the
   bottom of the page and clipped away. Nothing failed — the markup was correct
   and the classes were all present, which is exactly why the tests passed while
   the page was empty.

   Positioning it against the paginator's own page area makes every percentage
   below a fraction of the SHEET, which is what they were measured as. */
.pagedjs_cover_page .pagedjs_area { position: relative; }
.cover {
  page: cover;
  break-after: page;
  position: absolute;
  inset: 0;
  overflow: hidden;
  color: ${INK};
}
/* The two waves are SVG, because a curve is a path and a gradient is not. They
   are absolutely positioned so the text block below can be measured from the
   page rather than from them. */
.cover__wave { position: absolute; left: 0; width: 100%; display: block; }
.cover__wave--top { top: 0; }
.cover__wave--bottom { bottom: 0; }

.cover__project {
  position: absolute;
  left: 7.14%;
  top: 30.3pt;
  font-size: 17pt;
  line-height: 1;
  color: #FFFFFF;
  white-space: nowrap;
  text-transform: uppercase;
}
.cover__project b { font-weight: 600; letter-spacing: 1.1pt; }
.cover__project span { font-weight: 300; letter-spacing: 2.4pt; }

.cover__lockup {
  position: absolute;
  left: 71.14%;
  width: 22%;
  top: 38.7pt;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cover__mark { width: 44pt; height: 44pt; display: block; }
.cover__wordmark {
  font-size: 23pt;
  font-weight: 300;
  letter-spacing: 1.9pt;
  color: #FFFFFF;
  line-height: 1;
  margin-top: 9pt;
}

.cover__eyebrow {
  position: absolute;
  left: 13.9%;
  top: 125.5pt;
  font-size: 25pt;
  font-weight: 700;
  line-height: 1;
  margin: 0;
}
.cover__title {
  position: absolute;
  left: 13.9%;
  top: 158.5pt;
  font-size: 12.2pt;
  font-weight: 400;
  line-height: 1.2;
  margin: 0;
  color: ${TEAL};
}
.cover__rule {
  position: absolute;
  left: 13.9%;
  top: 180.8pt;
  width: 51.8%;
  height: 1.7pt;
  background: ${COVER_RULE};
}
.cover__lede {
  position: absolute;
  left: 13.9%;
  top: 187.4pt;
  font-size: 9pt;
  line-height: 12pt;
  margin: 0;
}
.cover__date {
  position: absolute;
  left: 13.9%;
  top: 255.3pt;
  font-size: 9pt;
  line-height: 1;
  margin: 0;
}
.cover__contact {
  position: absolute;
  left: 13.9%;
  top: 421.3pt;
  font-size: 9pt;
  line-height: 12.7pt;
}
.cover__contact b { font-weight: 600; display: block; }
.cover__contact a { color: ${LINK}; text-decoration: underline; }
.cover__notice {
  position: absolute;
  left: 26.5%;
  right: 26.5%;
  top: 681pt;
  font-family: ${FACE_NOTICE};
  font-size: 5.7pt;
  line-height: 8pt;
  color: ${NOTICE_INK};
  text-align: center;
}
.cover__notice b { display: block; font-weight: 400; letter-spacing: 0.1pt; }

.cover__tag {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 45.2pt;
  text-align: center;
  font-size: 10.2pt;
  font-weight: 600;
  letter-spacing: 1pt;
  color: #FFFFFF;
}
.cover__tag i { font-style: normal; font-weight: 500; color: ${TEAL_BRIGHT}; }
.cover__hair {
  position: absolute;
  left: 14.5%;
  right: 8.5%;
  bottom: 37.5pt;
  height: 0.5pt;
  background: rgba(255, 255, 255, 0.4);
}
.cover__reach {
  position: absolute;
  left: 7.5%;
  right: 7.5%;
  bottom: 13.1pt;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8.5pt;
  color: #FFFFFF;
}
.cover__reach span { display: flex; align-items: center; gap: 5.5pt; white-space: nowrap; }
.cover__reach svg { width: 11pt; height: 11pt; flex: none; }

/* ---- table of contents ------------------------------------------------ */
.toc { break-after: page; }
.toc__title {
  font-size: 14pt;
  font-weight: 400;
  line-height: 1.15;
  color: ${TOC_BLUE};
  margin: 0 0 19pt;
}
/* Dotted leaders, and the number resolved by the paginator. The reference uses
   dots rather than the manual's hairline. */
.toc__entry {
  display: flex;
  align-items: baseline;
  gap: 3pt;
  text-decoration: none;
  color: ${INK_BODY};
  font-size: 8.5pt;
  padding: 6pt 0;
  break-inside: avoid;
}
.toc__entry--l1 { font-weight: 400; }
.toc__entry--l2 { padding-left: 10.5pt; }
.toc__text { flex: 0 0 auto; }
.toc__entry::before {
  content: "";
  order: 1;
  flex: 1 1 auto;
  margin: 0 3pt 2.5pt;
  border-bottom: 0.8pt dotted ${INK_BODY};
}
.toc__entry::after {
  content: target-counter(attr(href), page);
  order: 2;
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

/* ---- section opener ---------------------------------------------------
   THE WHOLE MODULE claims the named page, not just its heading. Wrapping only
   the heading gave the opener a page of its own and pushed the content onto the
   next one. That wrapper is the reason these notes have their own renderer: the
   same div added to the manuals' renderSection stopped margins collapsing
   between modules and shifted their text by a fraction of a pixel.

   The band IS the page's top margin, so the title rises into it with a negative
   margin. Measured: the title sits 77pt from the top of the sheet, the margin is
   155pt, and the content box starts CONTENT_TOP below that. */
.module { page: opener; break-before: page; }
.opener {
  margin: -61pt 0 46pt;
  padding-left: 0;
  font-size: 17pt;
  font-weight: 600;
  line-height: 1;
  color: #FFFFFF;
  display: flex;
  gap: 7pt;
  align-items: baseline;
  white-space: nowrap;
  break-after: avoid;
}
.opener b { color: ${TEAL_BRIGHT}; font-weight: 600; }

/* ---- subsections and prose ------------------------------------------- */
.subsection {
  font-size: 12.7pt;
  font-weight: 600;
  line-height: 1.2;
  color: ${INK_BODY};
  padding-left: 36pt;
  margin: 19pt 0 11pt;
  break-after: avoid;
}
/* Measured: the FIRST subsection after the validity table gets a wider gap than
   the ones between subsections. Using one value for both pushed the page down. */
.term-list + .subsection { margin-top: 33pt; }

/* The hanging indent, and it is inverted: the first line starts at the margin,
   every following line 5.96% of the width further in. Measured off the
   reference; it is what carries the page's rhythm. */
.prose {
  font-size: 8.5pt;
  line-height: 15.5pt;
  color: ${INK_BODY};
  text-align: justify;
  hyphens: none;
  margin: 0 0 7.6pt;
  padding-left: 35pt;
  text-indent: -35pt;
}
.prose:last-child { margin-bottom: 0; }
strong { font-weight: 600; color: ${INK_BODY}; }
em { font-style: italic; }

/* ---- the validity row, which is a term-list ---------------------------
   Reused rather than given a block of its own: a block added to the catalogue
   is an option every manual author can then pick, in a manual where it does not
   belong. Here its one entry prints as the reference's bordered row. The colon
   the renderer appends to the term stays — it is a character, and not worth a
   change to a shared renderer. */
.term-list {
  display: table;
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 0;
  font-size: 8.5pt;
  line-height: 12.1pt;
}
.term-list .term { display: table-row; }
.term-list dt,
.term-list dd {
  display: table-cell;
  border: 0.5pt solid ${INK_BODY};
  padding: 4.5pt 5.5pt;
  vertical-align: top;
  margin: 0;
}
.term-list dt {
  width: 14.4%;
  background: ${CELL_FILL};
  font-weight: 400;
  text-align: justify;
  text-align-last: justify;
}
.term-list dd { background: #FFFFFF; }

/* ---- callout ----------------------------------------------------------
   Matched to what the renderer actually emits, which is
     <div class="callout callout--important"><strong>IMPORTANTE:</strong> text</div>
   — the text sits DIRECTLY in the div and the label is a strong, not a class of
   its own. An earlier draft of this sheet styled a .callout__label and a
   .callout p; neither is ever produced, so both were dead rules that would have
   looked correct in review and done nothing on the page. */
.callout {
  border: 0.5pt solid #D7E3EA;
  border-left: 3pt solid ${TEAL};
  background: #F1F5F8;
  padding: 7pt 8pt;
  margin: 9pt 0 8pt;
  font-size: 8.2pt;
  line-height: 11.5pt;
  color: ${INK_BODY};
  break-inside: avoid;
  /* Callouts sit outside the paragraph rhythm, so they keep the full measure
     rather than inheriting prose's hanging indent. */
  text-indent: 0;
  padding-left: 8pt;
}
.callout--important { border-left-color: ${TEAL_BRIGHT}; background: #EDF6F5; }
.callout strong { color: ${TEAL}; font-weight: 600; letter-spacing: 0.3pt; }

/* Nothing in these notes carries a figure: the reference describes the interface
   in prose instead of showing it, which is why the capture pipeline is not
   involved. A figure appearing here is a content error, and showing it as one
   beats laying it out. */
figure { display: none; }
`;
}
