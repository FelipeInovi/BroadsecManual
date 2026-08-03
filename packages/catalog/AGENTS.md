# Agent Information — `@broadsec-manual/catalog`

A live gallery rendering every block type, in every variant, across build
targets.

## Why it exists

It is the **acceptance surface with the design team**. They sign off here — on
one page showing every structure — not on a 120-page PDF where a broken block
hides on page 74.

It is also how an author or an agent answers "which block do I use?" by looking
at them rather than reading schemas.

## What it must show

For every block type in the catalogue:

- Its `type`, `version` and `description`
- Its props schema, rendered readably
- A minimal example and a maximal one (every optional prop populated)
- Edge cases that break layout: very long labels, empty optional slots, a table
  reduced to one row by conditioning
- The same block under different build targets, side by side

## Rules

- **Fully generated from the catalogue.** Never hand-list block types. A block
  added to `blocks` appears here with no edit to this package — otherwise the
  gallery silently goes stale and stops being an acceptance surface.
- Examples are **fixtures**, shared with the renderer tests. The gallery and the
  visual regression suite must show the same thing.
- Not a design playground. It reflects the catalogue; it does not extend it.

## Status

Empty until the block catalogue opens.
