# Agent Information — `manuals/`

One folder per manual. Everything here is **content and data**, never code.

## Anatomy

```
<manual-id>/
  manual.config.yaml   Axes, targets, versioning, catalogue pin
  knowledge/           Extracted facts (GENERATED — never hand-edit)
  sections/            Authored content, a tree of fragments
  assets/figures/      Delivered images + the pending placeholder
    _pending.svg       Stands in for every slot not delivered yet
    _common/           One image valid for every deployment
    <tenant>/          Images made for one deployment only
  output/              Build output (gitignored)
```

Images are addressed by **slot**, never by path — content names which image a
place needs, the build decides where the file lives. See the
`module-completeness` skill for the rule and the naming convention.

## Content language

Manual content is **Spanish**, neutral and formal ("Diríjase a…", "Haga clic
en…"). No regionalisms, no voseo, no second-person familiar.

**Ids and section filenames are Spanish too**, because they name this manual's own
subject matter: `mapa.capa.trafico`, `bot.alarmas.como-llegar`,
`10-fuerzas-en-campo.yaml`. Product acronyms and words the interface itself
borrows are written the way the product writes them — `cctv`, `ptz`, `avl`,
`barra.dashboard`. Whoever debugs a build reads an id beside the content it points
at, and a translated id makes that harder for no gain.

**The machinery is English**: config keys and block props (`when`, `rows`,
`widthPercent`), block type names, code comments, commit messages, and
infrastructure filenames (`manual.config.yaml`, `image-requests.json`). Those
belong to the pipeline, which is shared by every manual and every product, so
they cannot follow one manual's language.

## Skills that govern work here

Read these before writing content. They own their rules; this file does not
restate them, because a rule stated twice is a rule that drifts.

| Skill | Owns |
|---|---|
| `module-completeness` | When a module is finished, and the image rule |
| `block-authoring` | Choosing and filling a block type |
| `tenant-conditioning` | Tagging content per deployment |
| `source-extraction` | Getting facts out of the product |
| `source-assets` | Taking images from the product's own asset files |
| `manual-import` | Migrating the legacy document |

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
