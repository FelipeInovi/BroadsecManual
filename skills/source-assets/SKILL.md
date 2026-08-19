---
name: source-assets
description: Fills a manual's pending image slots from the product's own asset files instead of waiting for someone to photograph the screen — by following the import in the component that renders the control, never by matching filenames. Covers which images can be taken this way and which genuinely cannot, how to join a manual row to a product asset, and how to verify a delivery landed on the slot that asked for it. Use when pending images could already exist in the source repository, when onboarding a product's assets, or when deciding whether an image must be captured by hand.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "2.0"
---

# Taking images from the product

Some of the images a manual is waiting for already exist. They are files in the
product repository, shipped with the app, pixel-identical to what the operator
sees. Requesting a photograph of them is asking someone to re-make something we
already have.

Others do not exist as files and never will. Telling the two apart is most of
this skill.

This file is the method. **Which assets a given product actually ships, and which
of its slots turned out deliverable, are findings — they live with that product
and that manual, not here.** See "Where a product's findings live" at the end.

## The rule that matters

**Follow the import in the component that renders the control. Never match a
filename to a slot.**

Filename matching feels obviously right and is wrong at a rate you cannot
tolerate. On the first product measured, of the nine top-bar icons the manual
needed, **one** had an asset of the same name. Worse, that folder held names
differing by a single character that belonged to an entirely different feature.

Name similarity picks one of several at random and the build cannot tell it chose
wrong: the image renders, the caption fits, and the manual shows the operator a
control that is not there.

A wrong image is worse than a pending one. A pending slot announces itself; a
confidently wrong screenshot teaches the operator something false.

## The join

Four hops, every one of them checkable, ending in a file and a line:

```
manual row label  ->  UI string  ->  the component's own pairing  ->  imported asset
```

The label hop is sound because manual labels are the product's own UI strings,
never retyped off a screenshot — see `block-authoring`. That is what lets you
search the component for the string and land on the control that displays it.

Record the component path and line for every asset you take. An asset with no
recorded provenance is indistinguishable from a guess six months from now.

If any hop cannot be made, **stop and leave the slot pending.** A missing image
is a known state the pipeline is built around. Do not close the gap by reasoning
about what the file probably is.

### Where the join lives, in order of strength

1. **A literal dictionary** — the product states the mapping itself, e.g. an
   object mapping incident names onto label assets. Nothing is inferred.
2. **An object literal pairing asset and UI string** — the asset and the key or
   label sit in ONE object. That co-location is the evidence.
3. **A hardcoded label beside the asset** — one hop shorter than going through
   the catalogue, and just as sound.

Anything weaker than these three is a guess. Leave the slot pending.

The mix matters more than the total. A product can ship hundreds of image files
and still answer none of your slots, so "does the repo have images" is the wrong
question. The right one is **"does the control I need render from a file"**.

## No slot, no delivery

**Extraction cannot create demand.** An asset is only worth taking if a slot in
the manual is already asking for it. Check the request document first.

This is not bureaucracy. A product can ship a rich, perfectly joined family of
label images that cannot be delivered at all, because the manual has no table
that asks for them. Copying them in would produce orphans, and `undeclared` would
report every one.

When a rich asset family has no slot, **the gap is in the CONTENT, not in the
extraction.** Say so, record it with the manual, and let someone decide whether
that subsection should exist. Writing it is authoring work with its own decisions
— which of the labels a given deployment actually shows, for one — and it is not
this skill's job.

## What can be taken, and what cannot

Classify by the question "is there a file on disk, and does it survive being
loaded as an image?"

| Kind | Can it be taken? | Why |
|---|---|---|
| Static asset the app ships | **Yes** | A real file, reachable through the join |
| SVG drawn as the product's own component | Usually **no** | The geometry is here, the colour is not: these carry framework classes because they sit on a coloured control. Extracted standalone the glyph turns black, or a white stroke renders invisible. Deliverable only with a deliberate recolouring, which is a design decision |
| Icon from a library that ships SVG files | **Yes, via the base package** | A React wrapper usually holds no files while its dependency ships the real SVGs. Copy the file, do not parse the wrapper. Check the licence, and recolour — see below |
| Icon from a library that ships only JS | Not as a file | Extractable solely by parsing path data out of a module |
| Icon resolved from a remote API at runtime | **No** | Nothing on disk to take |
| Native control of an embedded third party (maps, street view, 3D, zoom) | **No** | Drawn by their SDK at runtime. Nothing exists in the repository to take |
| A screen, a panel, a populated list | **No** | Needs the app running against real data. This is what the capture team is for |

**Read `package.json` before assuming.** An icon library added later changes these
answers, and a product that draws its own icons as files changes them entirely.

Expect a mixed verdict inside ONE table of the manual, and **judge per row, never
per section.** Two rows on the same page routinely land on opposite sides.

### Sort by CONVENTION first — it answers most of the question in one query

The `icon` convention means a glyph in a table cell, which is the shape an asset
file comes in. The `figure` convention means a captioned picture of a screen,
which is the shape it does not.

So before opening a single component, ask what conventions are actually pending.
A module whose pending slots are all `figure`, `procedure` steps and `field-list`
items has nothing an asset file can answer, and one query settles it.

The trap is a `field-list` row that reads like an icon and is not — "Control PTZ",
"Selector de vista". Its convention is `figure`, so the caption promises the whole
control. Delivering the arrow glyph the component happens to use would fill the
slot, pass every count, and show the operator something that is not the control
being described.

## A monochrome outline must be recoloured, and that is not optional

An icon library's SVG is drawn with `stroke="currentColor"` so the app can colour
it from CSS. **That does not survive being loaded as an image.** Inside
`<img src="…svg">` the file is an independent document: `currentColor` cannot
inherit from the page, so it resolves to black.

If the manual's icon column is dark, a black outline is not invisible — it is
worse than invisible, it is *almost* legible, so nobody notices it is wrong. It
looks fine in a 400 dpi crop and reads as a smudge at its real size.

So on copy, replace `currentColor` with the icon column's own foreground token and
record two things IN the file:

```svg
<!-- <library> (<licence>), stroke recoloured to <colour> for the manual's icon column -->
```

- **the licence**, because a third-party glyph is now shipped in a client document
- **the recolouring**, because it couples this asset to how the icon column is
  styled today. If that column ever changes tone, these icons disappear and the
  comment is the only thing that will explain why.

Verify by looking at the rendered page at real size, not zoomed. This is the one
failure mode a manifest cannot catch: the slot is filled, the count is right, and
the reader still cannot see the control.

A photographic asset (`.webp`, `.png` screenshots of controls) needs none of
this — it carries its own pixels.

## Formats

Take the file as it ships. The slot never names an extension and the resolver
accepts `png`, `jpg`, `jpeg`, `svg`, `webp` and `gif`, so a `.webp` asset is
delivered as `.webp` and nothing needs converting. Converting loses fidelity and
gains nothing.

Deliver to `_common/<slot path>.<ext>` unless the asset genuinely differs per
deployment. A product asset is usually the same binary for every tenant — that is
the definition of a shared image.

## Verify, do not assume

A copy that lands on the wrong slot renders happily. After taking any assets:

1. Re-export the request document. The slots you filled must move from `pending`
   to `delivered`, and the pending count must drop by exactly the number of files
   you added. A smaller drop means a file landed on a slot nobody asked for.
2. `undeclared` must stay empty. A name appearing there IS the misnamed delivery
   this check exists to catch.
3. Look at the rendered page. The caption already says what the image should
   show; if the picture and the caption disagree, the join was wrong somewhere.

Never write into the source repository. It is a read-only input — see
`sources/AGENTS.md`.

## When the answer is "capture it by hand"

Say so plainly and leave the slot pending. The request document is the channel
for that, and it already carries what the image shows and where it goes. A slot
that stays pending has cost nothing; a slot filled with the wrong file has cost
the reader their trust in every other image in the manual.

## Where a product's findings live

Two different kinds of finding come out of this work, and they expire at
different times, so they are recorded in different places:

| Finding | Where it goes | Expires when |
|---|---|---|
| What the product repository ships — asset folders, icon libraries, where each join lives, the filename hazards | `sources/registry.yaml`, under that source's `assets:` | the **product** changes |
| Which of this manual's slots turned out deliverable, and the traps in them | that manual's `AGENTS.md` | the **manual** changes |

Read both before starting. Write to both when you finish: the next agent should
inherit your verdicts instead of re-deriving them, and neither belongs in this
file, which every product shares.
