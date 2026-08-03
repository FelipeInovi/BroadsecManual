# Agent Information — `@broadsec-manual/render-web`

`ResolvedManual` → HTML. The fast feedback loop.

## Purpose

The PDF is the deliverable; this is not a second deliverable. It exists so the
design team and authors can see a block, a section or a whole tenant build in
seconds instead of a full PDF cycle. It is also what `catalog` renders.

Do not let it grow into a published web manual. That is a different product with
different requirements, and deciding to build it is not a decision this package
gets to make on its own.

## Rules

- Same contract as every renderer: `(manual: ResolvedManual, tokens: Tokens)`.
- **Read the AST, do not reinterpret it.** Numbering, references and
  conditioning are resolved upstream.
- **Every value comes from `tokens`.** No hardcoded colours or spacing.
- **One function per block type**, matching `render-pdf` one to one. A block
  that renders here and not there is an incomplete block.
- Self-contained output: inline the CSS, embed the assets. Previews get opened
  from odd places and must not break.

## Divergence is the risk

Two renderers over one AST is only safe if they stay in step. The shared block
fixtures are run against both targets, and a block type is not done until both
pass. When they disagree, the AST is the referee — not whichever output looks
nicer.
