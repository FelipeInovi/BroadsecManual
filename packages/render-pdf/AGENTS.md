# Agent Information — `@broadsec-manual/render-pdf`

`ResolvedManual` → PDF. This is the deliverable.

## The engine is NOT chosen yet — do not choose it

This decision waits for the design team's fixed visual structures, and that is
deliberate sequencing, not an open task.

Two candidates, and the material decides:

| Candidate | Wins when design delivers |
|---|---|
| **Typst** | Print-native structures: typography, grid, boxes, hierarchy. Single binary, deterministic, fast across N tenant builds, native cross-references and pagination. Each block type becomes a Typst function. |
| **HTML + CSS Paged Media** | Web-native structures: cards, shadows, gradients, overlap. Shares a code path with `render-web`. Costs a headless browser in the pipeline and a fight with paginated layout. |

Committing before seeing the material is exactly the rushed decision this
architecture is built to avoid. If you are asked to "just start on the
renderer", say no and explain why.

## A working path exists, and it is not a decision

`render-web` + headless Chrome currently produces the PDF (see `cli`). It was
built to prove the pipeline end to end with zero installs, and it works.

That is evidence, not a verdict. It says the HTML route is viable; it does not
say it is the right one for a 100-page manual with the design team's structures.
Treat the engine as open until that material exists.

## What can be built now

The renderer **interface** — `(manual: ResolvedManual, tokens: Tokens) => Buffer` —
and the fixtures a renderer must satisfy. Those are engine-independent.

## Rules once the engine lands

- **One function per block type.** A block's visual structure lives in exactly
  one place. No conditionals on tenant, no per-manual special cases.
- **Read the AST, do not reinterpret it.** Numbering, references and
  conditioning are already resolved. A renderer that recomputes them will drift
  from the other targets.
- **Every value comes from `tokens`.** A hex code or a magic pixel value in this
  package is a bug.
- **The output is client-facing.** No tenant badges, no internal annotations, no
  "not applicable to your deployment". Excluded content is gone, not marked.
- **Visual regression tests per block**, run across every target so
  `render-pdf` and `render-web` cannot diverge silently.
