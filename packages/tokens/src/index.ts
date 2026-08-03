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
    ink: "#000000",
    white: "#FFFFFF",
    headerInk: "#E8EDF2",
    surfaceTeal: "#F0F7F6",
    surfaceCool: "#F0F4F8",
    ruleLight: "#D0E0EC",
  },
  font: {
    sans: "Helvetica, Arial, sans-serif",
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
  note: {
    background: base.color.surfaceTeal,
    accent: base.color.teal600,
    color: base.color.slate700,
    size: base.size.md,
  },
  cover: {
    background: base.color.navy950,
    accent: base.color.teal400,
    titleColor: base.color.white,
    subtitleColor: base.color.teal400,
    metaColor: base.color.slate400,
  },
  space: base.space,
  font: base.font,
} as const;

export type Tokens = typeof tokens;
