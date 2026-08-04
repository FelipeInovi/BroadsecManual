/**
 * Design tokens.
 *
 * PROVISIONAL. Extracted from the vector content stream of
 * `Manual_Broadsec_v5.pdf` (exact source values, not sampled pixels) so the
 * pipeline spike renders in the real Broadsec visual language.
 *
 * These are replaced wholesale by the design team's delivery. Nothing outside
 * this file may hardcode a colour or a size.
 */

/** Raw values. Only the semantic layer below may reference these. */
const base = {
  color: {
    navy900: "#1A2332",
    navy950: "#192231",
    teal400: "#2DD4BF",
    teal600: "#0D9488",
    slate700: "#2D3748",
    slate400: "#8FA3B8",
    amber500: "#F59E0B",
    amberSurface: "#FFF8E8",
    ink: "#000000",
    white: "#FFFFFF",
    headerInk: "#E8EDF2",
    surfaceTeal: "#F0F7F6",
    surfaceCool: "#F0F4F8",
    ruleLight: "#D0E0EC",
  },
  font: {
    sans: "Helvetica, Arial, sans-serif",
    /**
     * For text that is transcribed rather than read — a filename someone has to
     * reproduce exactly. In a proportional face `l`, `1` and `I` are the same
     * shape, and a mistyped image name is a delivery nobody can match to a slot.
     */
    mono: "Consolas, 'DejaVu Sans Mono', Menlo, monospace",
  },
  size: {
    xs: "7pt",
    sm: "8pt",
    base: "8.5pt",
    md: "9pt",
    body: "9.5pt",
    lg: "10pt",
    xl: "10.5pt",
    xxl: "13pt",
  },
  space: {
    xs: "3pt",
    sm: "6pt",
    md: "10pt",
    lg: "16pt",
    xl: "24pt",
  },
} as const;

/** Named roles. Blocks and renderers reference only these. */
export const tokens = {
  page: {
    size: "A4",
    marginTop: "62pt",
    marginBottom: "52pt",
    marginX: "62pt",
    background: base.color.white,
    /**
     * Breathing room between the running header bar and the first thing on the
     * page.
     *
     * Its own token rather than a `space` value: this is page geometry, not
     * block rhythm, and it cannot be expressed as a margin. The header bar's
     * height IS `marginTop` — the paginator paints the bar on the page's margin
     * row — so enlarging the margin makes the bar taller and the gap stays zero.
     */
    contentTop: "16pt",
  },
  runningHeader: {
    background: base.color.navy900,
    accent: base.color.teal400,
    brandColor: base.color.teal400,
    brandSize: base.size.sm,
    textColor: base.color.headerInk,
    textSize: base.size.sm,
    height: "37pt",
  },
  runningFooter: {
    rule: base.color.teal400,
    textColor: base.color.slate400,
    textSize: base.size.xs,
    pageNumberColor: base.color.navy900,
    pageNumberSize: base.size.sm,
  },
  sectionHeader: {
    background: base.color.navy900,
    accent: base.color.teal400,
    titleColor: base.color.white,
    titleSize: base.size.xxl,
    subtitleColor: base.color.teal400,
    subtitleSize: base.size.md,
  },
  subsectionHeader: {
    background: base.color.surfaceTeal,
    accent: base.color.teal400,
    titleColor: base.color.navy900,
    titleSize: base.size.xl,
  },
  detailHeader: {
    color: base.color.teal600,
    size: base.size.lg,
  },
  prose: {
    color: base.color.slate700,
    size: base.size.body,
    lineHeight: "1.55",
    align: "justify",
  },
  table: {
    headBackground: base.color.navy900,
    headColor: base.color.white,
    headSize: base.size.base,
    rowBackground: base.color.white,
    rowAltBackground: base.color.surfaceCool,
    labelColor: base.color.teal600,
    cellColor: base.color.ink,
    cellSize: base.size.base,
    rule: base.color.ruleLight,
  },
  figure: {
    captionColor: base.color.slate400,
    captionSize: base.size.sm,
    captionStyle: "italic",
  },
  callout: {
    info: {
      background: base.color.surfaceTeal,
      accent: base.color.teal600,
    },
    important: {
      background: base.color.amberSurface,
      accent: base.color.amber500,
    },
    color: base.color.navy900,
    size: base.size.base,
    labelSize: base.size.base,
  },
  fieldList: {
    labelColor: base.color.teal600,
    labelSize: base.size.lg,
  },
  procedure: {
    stepTitleColor: base.color.navy900,
    stepTitleSize: base.size.xl,
    markerColor: base.color.teal600,
  },
  termList: {
    termColor: base.color.slate700,
    size: base.size.body,
  },
  dataTable: {
    headBackground: base.color.teal600,
    headColor: base.color.white,
    labelColor: base.color.teal600,
    cellColor: base.color.ink,
    rowAltBackground: base.color.surfaceTeal,
  },
  cover: {
    background: base.color.navy950,
    accent: base.color.teal400,
    titleColor: base.color.white,
    subtitleColor: base.color.teal400,
    metaColor: base.color.slate400,
  },
  /**
   * The draft build only. Amber rather than the brand palette, and deliberately
   * loud: a draft carries the filenames the capture team must reproduce, and it
   * must be impossible to mistake for the document a client receives.
   */
  draft: {
    accent: base.color.amber500,
    background: base.color.amberSurface,
    slotColor: base.color.slate700,
    slotSize: base.size.xs,
  },
  space: base.space,
  font: base.font,
} as const;

export type Tokens = typeof tokens;
