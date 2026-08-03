# Agent Information — `manuals/`

One folder per manual. Everything here is **content and data**, never code.

## Anatomy

```
<manual-id>/
  manual.config.yaml   Axes, targets, versioning, catalogue pin
  knowledge/           Extracted facts (GENERATED — never hand-edit)
  sections/            Authored content, a tree of fragments
  assets/figures/      Figures, named by stable id
  output/              Build output (gitignored)
```

## Content language

Manual content is **Spanish**, neutral and formal ("Diríjase a…", "Haga clic
en…"). No regionalisms, no voseo, no second-person familiar.

Everything else — ids, filenames, config keys, comments, commit messages — is
English. An id is a symbol, not prose.

## Authoring rules

These follow directly from the architecture. Breaking one does not produce a
warning; it produces a wrong manual for some tenant.

1. **Never write a number.** Not `5.2`, not `Figura 7.1.3`, not "see section 4".
   Numbering is assigned per build target. Reference by stable id.
2. **Never write an anchor or slug.** Same reason.
3. **Tag conditioning at the smallest unit that varies** — a fragment, a table
   row, a step. Tagging a whole section when one row differs is what produced
   the single packed document this system replaces.
4. **Quote UI labels from i18n, never by hand.** If the screen says it, the
   manual sources it from the product's translation catalogue.
5. **Use a block from the catalogue.** If the content does not fit one, request
   a new block type. Do not improvise a layout — one hand-rolled table and the
   scalability is gone.
6. **Never hand-edit `knowledge/`.** It is generated. Fix the extractor.
7. **Assert nothing untraceable.** If a claim cannot be traced to the module map
   or to a reviewed screenshot, it does not go in.

## Figures

Named by the id of the block that owns them, never by number. A figure whose
filename is `7-1-3.png` breaks the moment a tenant does not see module 7.

## Versioning

The manual carries its own SemVer in `manual.config.yaml`:

- **major** — a new module, or a restructure
- **minor** — new functionality documented inside an existing module
- **patch** — a step tweak, a wording or typo fix

A content change bumps the version. The changelog is generated from git history
plus that version, not maintained by hand — hand-maintained changelogs drift,
and this one used to.
