import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import type { BlockNode, ManualNode, ResolvedManual, SectionNode } from "@broadsec-manual/blocks";
import { A4 } from "./style.ts";
import { halfPoints, twips } from "./measure.ts";
import type { DocxAsset } from "./image.ts";

/**
 * The release notes as a Word file. Its OWN renderer, and `document.ts` is
 * untouched — the same split, and the same reason, as `render-web/release.ts`:
 * one of the manuals that goes through the other renderer is already in a
 * client's hands.
 *
 * THE WORD FILE IS THE DELIVERABLE. The PDF is never handed over; it exists so
 * the pages can be paginated and photographed. Everything here is therefore
 * about what the client opens, not about matching a PDF nobody sees.
 *
 * Colours are literals, measured off the reference, exactly as in the
 * stylesheet. No brand token is read: one template serves every product and only
 * the project's name changes.
 */

/** Sampled from the reference, and the same values the stylesheet carries. */
const INK = "002060";
const INK_BODY = "1A1A1A";
const TEAL = "2B8C84";
const RULE_GREY = "A6A6A6";
const CELL_FILL = "B4C6E7";
const CALLOUT_FILL = "EDF6F5";

/**
 * ONE NAME, because Word has no fallback chain — a document names a face and the
 * reading machine either has it or substitutes something arbitrary.
 *
 * Poppins, and it TRAVELS INSIDE THE FILE — see `fonts` in the options. Naming
 * it before the file was bundled would have handed the client a document set in
 * whatever their Word picked, which is why this said Century Gothic until the
 * faces were in the repository. If `fonts` ever arrives empty the name still
 * resolves on a machine that happens to have Poppins, and falls back to Word's
 * own substitution on one that does not.
 */
const FACE = "Poppins";

const MARGIN_X_PT = 83;
const MARGIN_BOTTOM_PT = 72;

export interface ReleaseDocxOptions {
  /** The whole cover, photographed off the paginated page. */
  readonly coverImage: DocxAsset;
  /**
   * The two chrome bands, photographed the same way.
   *
   * Word's header takes a solid fill and nothing else, so a gradient can only
   * arrive as a picture. Shot off the paginated pages rather than composed here,
   * so the lockup, the project name and the section title come already drawn.
   */
  readonly bands: { readonly ordinary: DocxAsset; readonly opener: DocxAsset };
  /** Above the product and the page number, the same on every product's notes. */
  readonly footerTitle: string;
  readonly project: string;
  readonly title: string;
  readonly vendor: string;
  /**
   * The faces to embed, so the document carries its own type.
   *
   * THIS IS WHAT MAKES NAMING POPPINS HONEST. Word has no fallback chain: a
   * document names a face and the reading machine either has it or substitutes
   * something arbitrary. Embedded, the client opens the document we approved
   * rather than an approximation of it. Absent, `FACE` still resolves — Century
   * Gothic ships with Office — and the document is close rather than exact.
   */
  readonly fonts?: readonly { readonly name: string; readonly data: Buffer }[];
}

const face = (size: string, bold = false, color = INK_BODY) => ({
  font: FACE,
  size: halfPoints(size),
  bold,
  color,
});

/** `**bold**` is the only inline markup, and it is the same rule everywhere. */
function runs(text: string, size: string, color = INK_BODY): TextRun[] {
  return text.split(/\*\*(.+?)\*\*/g).map(
    (part, i) => new TextRun({ text: part, ...face(size, i % 2 === 1, color) }),
  );
}

/** A band, sized to the full page width so it bleeds like it does in print. */
function bandImage(asset: DocxAsset): Paragraph {
  const widthPt = A4.widthPt;
  const heightPt = (asset.heightPx / asset.widthPx) * widthPt;
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    alignment: AlignmentType.LEFT,
    indent: { left: -twips(`${MARGIN_X_PT}pt`), right: -twips(`${MARGIN_X_PT}pt`) },
    children: [
      new ImageRun({
        data: asset.data,
        type: "png",
        transformation: { width: widthPt * (96 / 72), height: heightPt * (96 / 72) },
      }),
    ],
  });
}

/**
 * The footer: a rule, then three lines.
 *
 * The middle line carries the product on the left and the page number on the
 * right, which is why it is a borderless two-cell table rather than a tab stop:
 * a tab stop measured against the page width drifts when the margins do.
 */
function footer(o: ReleaseDocxOptions): Footer {
  const width = twips(`${A4.widthPt - MARGIN_X_PT * 2}pt`);
  const none = { style: BorderStyle.NONE, size: 0, color: "auto" };
  return new Footer({
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE_GREY, space: 6 } },
        children: [new TextRun({ text: o.footerTitle, ...face("8pt", true, INK) })],
      }),
      new Table({
        width: { size: width, type: WidthType.DXA },
        borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: Math.round(width / 2), type: WidthType.DXA },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [new TextRun({ text: `Inovisec – ${o.project}`, ...face("8pt", false, INK) })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: Math.round(width / 2), type: WidthType.DXA },
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: "Página ", ...face("8pt", false, INK) }),
                      new TextRun({ children: [PageNumber.CURRENT], ...face("8pt", false, INK) }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 0 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Confidencial", ...face("8pt", true, INK) })],
      }),
    ],
  });
}

/** The validity row: a two-column table, its left cell filled. */
function validityTable(node: BlockNode): Table {
  const entries = node.props["entries"] as ReadonlyArray<Record<string, unknown>>;
  const width = twips(`${A4.widthPt - MARGIN_X_PT * 2}pt`);
  const line = { style: BorderStyle.SINGLE, size: 4, color: INK_BODY };
  return new Table({
    width: { size: width, type: WidthType.DXA },
    borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
    rows: entries.map(
      (e) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: Math.round(width * 0.144), type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: CELL_FILL, color: "auto" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.BOTH,
                  children: [new TextRun({ text: String(e["term"]), ...face("8.5pt") })],
                }),
              ],
            }),
            new TableCell({
              width: { size: Math.round(width * 0.856), type: WidthType.DXA },
              children: [
                new Paragraph({ children: runs(String(e["definition"]), "8.5pt") }),
              ],
            }),
          ],
        }),
    ),
  });
}

/**
 * A paragraph, with the reference's inverted hanging indent: the first line at
 * the margin and every following one 35pt further in.
 */
const prose = (text: string): Paragraph =>
  new Paragraph({
    spacing: { before: 0, after: twips("7.6pt"), line: twips("15.5pt"), lineRule: "exact" },
    alignment: AlignmentType.BOTH,
    indent: { left: twips("35pt"), hanging: twips("35pt") },
    children: runs(text, "8.5pt"),
  });

/** A callout: a filled box with a left rule and a coloured label. */
function callout(node: BlockNode): Paragraph {
  const important = String(node.props["variant"] ?? "info") === "important";
  return new Paragraph({
    spacing: { before: twips("9pt"), after: twips("8pt"), line: twips("11.5pt"), lineRule: "exact" },
    shading: { type: ShadingType.CLEAR, fill: CALLOUT_FILL, color: "auto" },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: TEAL, space: 8 } },
    indent: { left: twips("8pt"), right: twips("8pt") },
    children: [
      ...(important ? [new TextRun({ text: "IMPORTANTE: ", ...face("8.2pt", true, TEAL) })] : []),
      ...runs(String(node.props["text"]), "8.2pt"),
    ],
  });
}

/** The three block types these notes are made of, and no others. */
function renderBlock(node: BlockNode): readonly (Paragraph | Table)[] {
  switch (node.type) {
    case "prose":
      return [prose(String(node.props["text"]))];
    case "callout":
      return [callout(node)];
    case "term-list":
      return [validityTable(node), new Paragraph({ spacing: { after: 0 }, children: [] })];
    default:
      // A fourth type means the document outgrew this template. See the web
      // renderer for why that draws nothing rather than throwing.
      return [];
  }
}

function renderNode(node: ManualNode, depth: number, manual: ResolvedManual): readonly (Paragraph | Table)[] {
  if (node.kind !== "section") return renderBlock(node as BlockNode);
  const section = node as SectionNode;
  const n = manual.numbers.get(section.id) ?? "";
  const title = section.title.map((i) => ("value" in i ? i.value : "")).join("");
  const children = section.children.flatMap((c) => renderNode(c, depth + 1, manual));

  // Depth 0 is the opener, and its title is already IN the band image — shot off
  // the paginated page. Repeating it here would print it twice.
  if (depth === 0) return children;

  return [
    new Paragraph({
      spacing: { before: twips("19pt"), after: twips("11pt") },
      indent: { left: twips("36pt") },
      keepNext: true,
      children: [new TextRun({ text: `${n}. ${title}`, ...face("12.7pt", true) })],
    }),
    ...children,
  ];
}

/** The table of contents, two levels, titled as the reference titles it. */
function toc(manual: ResolvedManual): readonly Paragraph[] {
  const line = (node: SectionNode, level: 1 | 2): Paragraph => {
    const n = manual.numbers.get(node.id) ?? "";
    const title = node.title.map((i) => ("value" in i ? i.value : "")).join("");
    return new Paragraph({
      spacing: { before: 0, after: twips("6pt") },
      indent: { left: twips(level === 1 ? "0pt" : "10.5pt") },
      children: [new TextRun({ text: `${n}. ${title}`, ...face("8.5pt") })],
    });
  };
  const sections = manual.children.filter((c): c is SectionNode => c.kind === "section");
  return [
    new Paragraph({
      spacing: { before: 0, after: twips("19pt") },
      children: [new TextRun({ text: "Contenido", ...face("14pt", false, "3478B7") })],
    }),
    ...sections.flatMap((s) => [
      line(s, 1),
      ...s.children.filter((c): c is SectionNode => c.kind === "section").map((sub) => line(sub, 2)),
    ]),
  ];
}

/** Render a resolved set of release notes to a Word file. */
export async function renderReleaseDocx(
  manual: ResolvedManual,
  o: ReleaseDocxOptions,
): Promise<Uint8Array> {
  const body = manual.children.flatMap((c) => renderNode(c, 0, manual));
  const page = {
    size: { width: twips(`${A4.widthPt}pt`), height: twips(`${A4.heightPt}pt`) },
  };

  const doc = new Document({
    title: `Release ${o.project} — ${o.title}`,
    creator: o.vendor,
    description: o.title,
    // Embedded, so the client opens the document that was approved rather than
    // an approximation of it. The four weights are the ones the layout declares.
    ...(o.fonts === undefined || o.fonts.length === 0 ? {} : { fonts: [...o.fonts] }),
    sections: [
      // The cover: no margin and no furniture, exactly like the stylesheet's
      // `@page cover`. It arrives as one picture of the whole sheet.
      {
        properties: { page: { ...page, margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 } } },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
              new ImageRun({
                data: o.coverImage.data,
                type: "png",
                transformation: {
                  width: A4.widthPt * (96 / 72),
                  height: A4.heightPt * (96 / 72),
                },
                // ANCHORED TO THE PAGE, NOT INLINE. Inline, the picture is the
                // content of a line, and a line is always the picture plus the
                // font's leading — so a picture exactly as tall as the sheet
                // never fits, and Word pushes the whole cover onto page two,
                // leaving the first page blank. Anchored, it takes no line
                // height at all and lands at the sheet's own origin.
                floating: {
                  horizontalPosition: {
                    relative: HorizontalPositionRelativeFrom.PAGE,
                    offset: 0,
                  },
                  verticalPosition: {
                    relative: VerticalPositionRelativeFrom.PAGE,
                    offset: 0,
                  },
                  behindDocument: true,
                  allowOverlap: true,
                },
              }),
            ],
          }),
        ],
      },
      // Contents, then the notes. `titlePage` gives the FIRST page of this
      // section its own header, which is how the opener band — taller, and
      // carrying the section title — lands on the page that opens the content
      // without a margin that would have to differ mid-section.
      {
        properties: {
          page: {
            ...page,
            margin: {
              top: twips("69pt"),
              right: twips(`${MARGIN_X_PT}pt`),
              bottom: twips(`${MARGIN_BOTTOM_PT}pt`),
              left: twips(`${MARGIN_X_PT}pt`),
              header: 0,
              footer: twips("20pt"),
            },
          },
        },
        headers: { default: new Header({ children: [bandImage(o.bands.ordinary)] }) },
        footers: { default: footer(o) },
        children: [...toc(manual)],
      },
      {
        properties: {
          titlePage: true,
          page: {
            ...page,
            margin: {
              top: twips("69pt"),
              right: twips(`${MARGIN_X_PT}pt`),
              bottom: twips(`${MARGIN_BOTTOM_PT}pt`),
              left: twips(`${MARGIN_X_PT}pt`),
              header: 0,
              footer: twips("20pt"),
            },
          },
        },
        headers: {
          first: new Header({ children: [bandImage(o.bands.opener)] }),
          default: new Header({ children: [bandImage(o.bands.ordinary)] }),
        },
        footers: { first: footer(o), default: footer(o) },
        children: [...body],
      },
    ],
  });

  return new Uint8Array(await Packer.toBuffer(doc));
}
