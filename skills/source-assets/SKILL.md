---
name: source-assets
description: Fills a manual's pending image slots from the product's own asset files instead of waiting for someone to photograph the screen — by following the import in the component that renders the control, never by matching filenames. Covers which images can be taken this way and which genuinely cannot, how to join a manual row to a product asset through the i18n key, and how to verify a delivery landed on the slot that asked for it. Use when pending images could already exist in the source repository, when onboarding a product's assets, or when deciding whether an image must be captured by hand.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
---

# Taking images from the product

Some of the images a manual is waiting for already exist. They are files in the
product repository, shipped with the app, pixel-identical to what the operator
sees. Requesting a photograph of them is asking someone to re-make something we
already have.

Others do not exist as files and never will. Telling the two apart is most of
this skill.

## The rule that matters

**Follow the import in the component that renders the control. Never match a
filename to a slot.**

Filename matching feels obviously right and is wrong at a rate you cannot
tolerate. Measured on this product:

- Of the nine top-bar icons the manual needs, **one** has an asset of the same
  name. The other eight would silently resolve to nothing, or to the wrong file.
- The map layer control uses `layer_camera.webp`. Sitting beside it in the same
  folder are `cluster_camera.webp` and `cluster_cameras.webp`, which belong to
  map marker clustering — a different feature. Name similarity picks one of three
  at random and the build cannot tell it chose wrong: the image renders, the
  caption fits, and the manual shows the operator a control that is not there.

A wrong image is worse than a pending one. A pending slot announces itself; a
confidently wrong screenshot teaches the operator something false.

## The join

Four hops, every one of them checkable, ending in a file and a line:

```
manual row label  ->  i18n key  ->  the component's own object literal  ->  imported asset
```

Worked example, end to end:

1. The manual's row `mapa.capa.camaras` carries `label: Cámaras`. Labels are
   taken from the i18n catalogue, never retyped — that is what makes this hop
   sound.
2. `layers.cameras` is `"Cámaras"` in `src/render/locales/translations/es.json`.
3. `src/render/components/LayersMap.tsx` contains
   `{ img: layer_camera, tittle: t("layers.cameras") }` — the asset and the key
   in ONE object literal. That co-location is the evidence.
4. Line 2 of the same file: `import layer_camera from "@/render/assets/images/layer_camera.webp"`.

Record the component path and line for every asset you take. An asset with no
recorded provenance is indistinguishable from a guess six months from now.

If any hop cannot be made, **stop and leave the slot pending.** A missing image
is a known state the pipeline is built around. Do not close the gap by
reasoning about what the file probably is.

## No slot, no delivery

**Extraction cannot create demand.** An asset is only worth taking if a slot in
the manual is already asking for it. Check the request document first.

This is not bureaucracy. The product ships 85 incident-type label images and a
dictionary in `CustomTag.tsx` mapping 338 incident names onto 68 of them — the
strongest join in the repository. And not one of them can be delivered, because
the manual has no incident-typification table: nothing asks. Copying them in
would produce 85 orphans, and `undeclared` would report every one.

When a rich asset family has no slot, the gap is in the CONTENT, not in the
extraction. Say so, and let someone decide whether that subsection should exist.
Writing it is authoring work with its own decisions — which of 68 labels a given
deployment actually shows, for one — and it is not this skill's job.

## What can be taken, and what cannot

| Kind | Can it be taken? | Why |
|---|---|---|
| Static asset the app ships (`assets/images/**`) | **Yes** | A real file, reachable through the join |
| SVG drawn as the product's own component (`assets/icons/*.tsx`) | Usually **no** | The geometry is here, but the colour is not: these carry Tailwind classes like `fill-white` because they sit on a dark control. Extracted standalone there is no Tailwind, so the glyph turns black — or `stroke="white"` renders invisible on the page. Deliverable only with a deliberate recolouring, which is a design decision |
| Icon from `@mui/icons-material`, `@tabler/icons-react` | Not as a file | Ships as a JS component with inline SVG path data. Extractable only by parsing it, and it arrives unstyled — not what the operator sees |
| Icon from `@iconify/react` | **No** | Resolved from a remote API at runtime. Without `@iconify/json` installed there is nothing on disk |
| Native control of an embedded third party (Google Maps street view, 3D, zoom) | **No** | Drawn by their SDK at runtime. Nothing exists in this repository to take |
| A screen, a panel, a populated list | **No** | Needs the app running against real data. This is what the capture team is for |

Expect a mixed verdict inside ONE table of the manual. The six map controls
documented under `mapa.ctrl.*` resolve to: one MUI icon, one product-drawn SVG
that is white-on-dark, and four Google Maps native controls — so zero of six are
deliverable, while the six map LAYERS beside them were all files. Judge per row,
never per section.

### Where the join lives, in order of strength

1. **A literal dictionary** — `"Accidente de Tránsito": LabelAccidenteTransito`.
   The product itself states the mapping; nothing is inferred.
2. **An object literal pairing asset and i18n key** —
   `{ img: layer_camera, tittle: t("layers.cameras") }`.
3. **A hardcoded label beside the asset** — `{ img: layer_avl, tittle: "AVL" }`.
   One hop shorter than the i18n route and just as sound.

Anything weaker than these three is a guess. Leave the slot pending.

Check `package.json` before assuming: an icon library added later changes these
answers, and a product that draws its own icons as files changes them entirely.

The mix matters more than the total. This product ships 389 image files AND
three icon libraries, so "does the repo have images" is the wrong question. The
right one is "does the control I need render from a file".

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
