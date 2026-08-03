# Agent Information — `@broadsec-manual/tokens`

The single source of visual truth: colours, typography, spacing, borders, and
the named roles that map them to meaning.

## Why this is its own package

Swapping this package changes how every manual looks, in every target, without
touching a line of content or a block definition. That is the whole point. A
second product with different branding is a new token set, not a fork.

## Rules

- **Tokens are data, not code.** Plain values, no logic, no conditionals.
- **No token names a block.** `color.accent`, not `color.warningBlockBorder`.
  Blocks *consume* tokens; tokens must not know who consumes them.
- **No renderer-specific values.** A token holds `#1B4D8F`, not a CSS custom
  property and not a Typst colour literal. Renderers translate.
- **Nothing is authored here by guesswork.** Values come from the design team.
  A placeholder must be visibly named as one and tracked, never quietly shipped.

## Structure

```
src/
  base/      Raw values — the palette, the type scale, the spacing ramp
  semantic/  Named roles that map base values to meaning
  index.ts
```

Content and blocks reference **semantic** tokens only. Base tokens are an
implementation detail of the semantic layer.

## Status

Awaiting the design team's delivery. Do not invent a palette to unblock a demo —
a placeholder that ships is a placeholder that stays.
