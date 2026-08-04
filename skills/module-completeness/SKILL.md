---
name: module-completeness
description: Defines when a manual module is finished — every submodule covered, each with what it does, how to reach it, its main functions, its step-by-step procedures and the control the operator must press. Also covers the image rule: content declares image slots, never file paths, and every declared slot always renders — the delivered image, or one temporary placeholder holding its place until an external team supplies it. Use when writing a new module, extending an existing one, reviewing a module before it ships, deciding whether a section is complete, naming images so they can be synchronised from an external folder, or working out which images an external team must produce.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "2.0"
---

# When a module is finished

A module is not finished when it reads well. It is finished when an operator
who has never opened the product can do their job with it.

That is the standard everything below serves.

## The coverage rule

**Every submodule the product offers must be covered. No exceptions, no
"the main ones".**

A module that names six sections and explains two is not a partial module — it
is a broken one. The reader cannot tell that four sections were skipped; they
conclude those sections do not matter, or that the manual is wrong.

Before writing, list the submodules from `knowledge/module-map.json` (or, until
the map exists, from the product's own navigation). That list is the checklist.
Cover it or state explicitly why an item is out of scope.

## What every submodule needs

Five things. Skip one and the operator is left guessing.

### 1. What it does

One or two sentences. Its purpose, not its contents. `field-list` item text, or
a `prose` paragraph under a subsection.

> *La sección Monitoreo muestra el estado de comunicación de cada panel
> desplegado en la vía.*

### 2. How to reach it

The path from where the operator is standing, in the product's own words.

> *Diríjase a **PMV › Programación** desde el panel lateral.*

If you cannot establish the route from source, **say nothing** rather than
guessing. A wrong route costs more than a missing one.

### 3. Main functions

What the operator can actually do there. A `field-list` when each function
needs a paragraph and a screenshot; a `term-list` when one line each is enough;
a `data-table` when the reader will scan rather than read.

### 4. Step by step

Every procedure the operator performs, as a `procedure` block. Each step names
**the control to press** and carries its image.

Never write the ordinal into a step title: numbering is assigned after
conditioning, so a deployment that skips a step sees the rest shift up.

### 5. What to expect

Where the operator lands and what changed. A procedure that ends without
telling the reader whether it worked is unfinished.

> *Al guardar, la plataforma lo redirige a **PMV › Gestión**, donde el mensaje
> queda listado.*

## The image rule

**A declared slot always renders. The delivered image, or the placeholder
holding its place. Never a blank gap.**

Images are produced and updated by a different area of the company and arrive
later, so a module is normally written before a single capture exists. That is
not a reason to leave the page empty: a gap reads as finished content and the
reader has no way to detect the lie.

| State | Renders as |
|---|---|
| Delivered | The image |
| Pending | `_pending.svg` — one temporary image, identical in every slot |

The placeholder is deliberately the same everywhere. It is a *shape held open*,
not a description of what is missing: every slot sits directly under the thing
it depicts — a field's label, a step's title, a figure's caption, a row's label
— so the page already says which image is coming.

Never write a slot id into content. The PDF is client-facing (invariant 4) and a
slot id is a trace of the pipeline.

### Two builds, because two people read this document

Whoever captures the screenshots works from the PDF in hand and has no other way
to know what to call the file. Whoever receives the manual must not see a path
from our repository in a document marked Confidential. Both are true, so there
are two builds of the same content:

| Build | Pending images render as | For |
|---|---|---|
| `build <manual>` | The placeholder, nothing else | The client |
| `build <manual> --draft` | The placeholder **plus the exact filename to deliver it under** | Whoever takes the captures |

The draft is marked at every level so it cannot be handed over by accident: its
filename gains `-BORRADOR`, its cover reads BORRADOR INTERNO, and its running
header says NO DISTRIBUIR. The client build is the default; you have to ask for
the draft.

Give the capture team the draft PDF **and** the request document. The PDF shows
them where each image goes and what to name it; the document is the full list
with what each one shows and which deployments need it.

### Where an image belongs

- **A control the operator must press** — always. If clicking a button opens a
  panel, the button's image goes beside the instruction. This is the single
  most useful thing the manual does, and it is what the source manual does
  throughout.
- **A screen the operator must recognise** — usually.
- **Decoration** — never. An image that carries no information costs a page and
  a delivery request.

### Which block carries the image

| Block | Image slot | Declared |
|---|---|---|
| `icon-table` | Icon column, one per row | Always — omit the prop |
| `field-list` | One per item | Always — omit the prop |
| `procedure` | One per step | Always — omit the prop |
| `figure` | The image itself, with a caption | Always — omit the prop |
| `prose`, `term-list` | Optional illustration | Opt-in — write `image: true` |

"Always" means the slot exists whether or not you write anything: leave the prop
out and it is derived. "Opt-in" means no declaration, no slot — a paragraph does
not inherently need an illustration, and filling the manual with placeholders
nobody asked for would drown the ones genuinely awaited.

## Content declares slots, never files

**Never write a filename or a path into content.** Not `home-overview.png`, not
`icons/search.png`. The build refuses it, and the refusal is the point.

A path cannot answer the two questions this pipeline exists to answer:

- The same screen does not look identical in every deployment, so one path
  cannot serve six tenants.
- The images arrive later, from somebody else, so there has to be a stable key
  to deliver and re-synchronise against. A path buried in a content file is not
  that key.

### The naming convention

**A slot's name is the id of the node that carries it.** Nothing to invent: node
ids already exist, are already unique, are already validated, and are never
positional — so a slot never shifts when a section moves.

Write an explicit slot name **only** to share one delivered image between two
places (`image: barra.busqueda`). Otherwise omit the prop.

A slot's dots become folders, so the delivered tree mirrors the manual:

```
barra.filtro.fig  ->  barra/filtro/fig.png
```

Resolution, per deployment, in order:

| Looked up | Meaning |
|---|---|
| `<tenant>/<slot path>.<ext>` | An image made for that one deployment |
| `_common/<slot path>.<ext>` | One image valid for every deployment — **prefer this** |
| `_pending.svg` | Not delivered yet |

Prefer `_common`: most controls look identical everywhere, and six copies of one
icon are six things to update when it changes. Use a tenant folder only when the
screen genuinely differs.

The extension is not part of the slot — `png`, `jpg`, `jpeg`, `svg`, `webp` and
`gif` all resolve. Two files claiming one slot is a build error, because nothing
can tell which delivery is current.

### The image request document

`broadsec-manual images <manual>` writes `image-requests.json` next to the
manual: every slot, what it shows, which block uses it, which deployments need
it, which ones are still missing, and **the exact path each file has to be
dropped at**. That document is the contract with the delivering area. If an image
is not in it, nobody will produce it.

It is grouped by slot, not by deployment. A control that looks identical
everywhere is one photograph, and `deliverTo.shared` is where one copy serves
every deployment; `deliverTo.override` is the template for the rare screen that
genuinely differs.

Note what it is *not*: it is not build output. `build` reports the counts but
writes no document — it leaves the repository for another team, so producing it
is an explicit act. That is also why it does not live in `output/`, which is
gitignored: a contract only whoever last ran a build can see is not a contract.

It also reports the reverse — images sitting on disk that no slot asked for.
That is the failure this whole scheme exists to catch: a delivery named
`barra/buscar.png` when the slot is `barra.busqueda` leaves the page showing a
placeholder while the build reports success. Read that list; a name that appears
there is a name nobody is using.

A slot delivered for one deployment and missing for another is still **pending**,
and says so in `pendingFor`. Never treat a slot as done because some deployment
has it.

## Use the catalogue, always

Content is written by instantiating the eight structures in
`packages/blocks/src/catalog/`. Never compose layout by hand.

If the content does not fit any of them, **request a new block type** — see the
`block-authoring` skill. One hand-rolled table is where maintainability starts
to rot: it cannot be restyled, cannot be conditioned reliably, and cannot be
validated.

## Conditioning still applies

Everything here composes with the `tenant-conditioning` skill. Tag at the
smallest unit that varies — a row, a step, a field-list item — and never at
section level just because it is easier. Ground every tag in source code, never
in the legacy manual.

## Definition of done

A module ships when all of these hold:

- [ ] Every submodule the product offers is covered, or its absence is justified
- [ ] Each one states what it does, how to reach it, and its main functions
- [ ] Every procedure is a `procedure` block, naming the control at each step
- [ ] Every procedure says where the operator lands
- [ ] Every control the reader must press has an image slot, delivered or pending
- [ ] No image slot renders as a blank gap
- [ ] No filename or path appears anywhere in the content
- [ ] Every claim traces to a file and line, or to the module map
- [ ] UI labels are taken from the i18n catalogue, not retyped
- [ ] No number, anchor or figure ordinal is written by hand
- [ ] Conditioning is tagged at the smallest unit that varies
- [ ] The build succeeds for every deployment
- [ ] `images` was re-exported, and reports no undeclared delivery

Anything unchecked is not a rough edge. It is the module not being done.
