---
name: module-completeness
description: Defines when a manual module is finished — every submodule covered, each with what it does, how to reach it, its main functions, its step-by-step procedures and the control the operator must press. Also covers the image rule: this repository holds no real screenshots, so every image slot renders either the image or the reference it will be delivered under, never a blank gap. Use when writing a new module, extending an existing one, reviewing a module before it ships, deciding whether a section is complete, or working out which images an external team must produce.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
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

**Either the image, or the reference it will arrive under. Never a blank gap.**

This repository holds no real screenshots. Images are produced and updated by a
different area of the company, and delivered against the names the manual
declares. So every image slot is in one of two states, and both are visible:

| State | Renders as |
|---|---|
| Delivered | The image |
| Pending | Its reference — the item number in a table, a named placeholder elsewhere |

A slot that renders neither reads as "there is nothing here", which is a lie the
reader has no way to detect.

### Where an image belongs

- **A control the operator must press** — always. If clicking a button opens a
  panel, the button's image goes beside the instruction. This is the single
  most useful thing the manual does, and it is what the source manual does
  throughout.
- **A screen the operator must recognise** — usually.
- **Decoration** — never. An image that carries no information costs a page and
  a delivery request.

### Which block carries the image

| Block | Image slot | Numbered |
|---|---|---|
| `icon-table` | Icon column, one per row | Item number, doubles as the pending reference |
| `field-list` | One per item | No |
| `procedure` | One per step | No |
| `prose`, `term-list` | Optional illustration | No |
| `figure` | The image itself, with a caption | Yes — use when the text refers back to it |

## Images are declared, not supplied

The manual's job is to declare **which** images it needs and **what** each one
shows. Producing them is someone else's job.

Consequences you must respect:

- Never leave an image slot undeclared because the file does not exist. Declare
  it; the pending state exists precisely for this.
- Never invent a filename mid-writing. Follow the naming convention so the
  delivering team receives one coherent list.
- The build emits the **image manifest** — every expected image, its reference,
  what it shows and which deployments need it. That manifest is the contract
  with the other area. If an image is not in the manifest, nobody will produce
  it.
- The same slot may need a different image per deployment, because the same
  screen does not look identical everywhere. The manifest is therefore per
  deployment, not global.

> **Naming convention:** provisional. Agreed to be settled with the delivering
> area. Until then, keep references derived from the node id so they stay
> stable and unique, and do not improvise a second scheme in parallel.

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
- [ ] Every control the reader must press has an image or a visible reference
- [ ] No image slot renders as a blank gap
- [ ] Every claim traces to a file and line, or to the module map
- [ ] UI labels are taken from the i18n catalogue, not retyped
- [ ] No number, anchor or figure ordinal is written by hand
- [ ] Conditioning is tagged at the smallest unit that varies
- [ ] The build succeeds for every deployment and the manifest lists what is missing

Anything unchecked is not a rough edge. It is the module not being done.
