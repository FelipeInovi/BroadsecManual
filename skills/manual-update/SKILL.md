---
name: manual-update
description: Procedure for updating a manual that already exists against product drift — extract a fresh module map, surface which modules a change touches through their `documents:` declarations, decide per module, then stamp only that module's baseline. Use when a product has changed since a manual was last verified, when asked to "update module N" or "check a manual for drift", when running `extract`/`documents`/`verified` on an existing manual, or when the wizard's update flow hands off a scoped prompt.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
---

# Updating a manual against product drift

This is the procedure for a manual that already has content, when the product
it documents has moved on. It does not cover getting facts out of the product
(`source-extraction`) or what a finished module looks like
(`module-completeness`) — it owns the ordering between them, and nothing else.

## The one rule everything below follows

**extract → surface drift → decide per module → stamp that module.**

There is no shortcut past "decide". Nothing in this pipeline can stamp a
module's baseline without a preceding read of its current drift, and no
command stamps more than one module per run. Skipping the decision is not
possible by construction — see `packages/cli/AGENTS.md`'s `verified` row.

## Vocabulary

- **A module** is one `sections/<name>.yaml` file.
- **`documents:`** is a section's own claim about which product paths and
  capability flags it covers. Optional. Absent means the module's coverage is
  **unknown**, never "unaffected" — a module with no `documents:` is not
  incomplete for it (`module-completeness`'s definition of done is unchanged).
- **A baseline** (`manuals/<manual>/baselines.json`) records which product
  commit ONE module was last verified against. Absent key = never verified.

## The procedure

### 1. Extract

```
node packages/cli/src/main.ts extract <manual>
```

Regenerates `knowledge/module-map.json` and reports what changed since the
last map. Writes no baseline — see `source-extraction` for what this step
actually does and its hard rules (read-only, provenance, never infer gating).

### 2. Surface drift, per module

```
node packages/cli/src/main.ts documents <manual>
```

Reports, for every module: `covered` (declares `documents:` and at least one
drift fact matched), `clean` (declares `documents:`, nothing matched), or
`unknown` (declares no `documents:` — the full current drift list prints
under it, never a bare count). Also reports declared-but-gone paths and flags,
and drift nobody declared ("undeclared coverage").

**Read the unjoinable-entry annotation before trusting a `clean` module.** The
extractor scans only two roots (components, pages). A module whose declared
paths lie partly or wholly outside them — routes, i18n labels — will read
`clean` while some of its declarations could never be checked. The report
says so explicitly when it applies; do not treat `clean` as "nothing to
review" without reading that line.

A directory or glob entry with a high `matched` count relative to the
module's total facts is a coarse declaration, not necessarily real coverage —
the report sorts entries by match count for exactly this judgement.

### 3. Decide, per module

This is a human judgement, not a command. For each module `documents` flagged
(covered, or undeclared coverage that should belong to it), read the actual
drift and decide: does this change the manual's content?

- If yes — author the change, following `module-completeness` for what
  "finished" means and `block-authoring` for how to write it.
- If no (the drift is cosmetic, or already reflected) — no content change is
  needed, but the module can still be stamped once reviewed.
- If the module has no `documents:` yet and you want it evaluated by drift
  going forward, declare one. Classify each entry per the schema in
  `packages/core/src/documents.ts` (`file` / `directory` / `glob` under
  `paths:`, or an identifier under `flags:`) — resolve a bare filename through
  `knowledge/module-map.json`'s `references[].file` or
  `sources/registry.yaml`'s `extract` paths, never by reading the product
  directly for this step.

### 4. Stamp, only the module just decided

```
node packages/cli/src/main.ts verified <manual> --module sections/NN-....yaml
```

One module per run, no `--all`. Refuses on a dirty or unreadable product
checkout, writing nothing either way — see `packages/cli/AGENTS.md`. Stamp
only after the drift for that specific module has actually been read and
acted on; stamping is a record that a human looked, not a formality to clear
after any edit.

## Using the wizard

`pnpm manuales` → the update flow offers a scope step: the whole manual, or
one `sections/*.yaml` file, each option showing that module's baseline and
`documents:` coverage state (read from disk, no extraction run). The
assembled prompt still tells the receiving agent to run steps 1–2 itself
before editing anything — the wizard points, it does not run `extract`.

## What this skill does not cover

- How extraction works, or what a low-confidence fact means — `source-extraction`.
- What "finished" means for a module, and the image rule — `module-completeness`.
- Choosing and filling a block type — `block-authoring`.
- The exact `documents:` YAML shape and validation errors — read
  `packages/core/src/documents.ts` and `packages/core/src/load.ts` directly;
  this skill does not duplicate that schema.
