# Agent Information — Broadsec SIMM operator manual

Source product: `broadlineavida` (`Broadsec SIMM`), a React 18 + TypeScript +
Vite SPA for emergency and security incident management — dispatch, shifts,
incidents, CCTV, variable-message signs, patrols, reports and live maps.

Read `../AGENTS.md` first for the authoring rules. This file covers what is
specific to **this** product.

## How tenants actually differ here — read this before tagging anything

The product is multi-tenant, selected at build time via `VITE_NAME_PROJECT`,
with one config file per deployment in `src/render/config/`.

**Tenant divergence is mostly ELEMENT-level inside shared screens, not
module-level.** This is the single most important fact about documenting this
product, and getting it wrong is what produced the previous packed manual.

Evidence from the source repository:

- Exactly **one** route is gated by `allowedProjects` (`["DEMO","MV"]`) in
  `src/render/routes/AppRoutes.tsx`; enforcement lives in
  `src/render/routes/RouteAccess.tsx`, comparing against the active config name.
- Inline tenant comparisons are scattered through components — `CaseFiltering`,
  `LayersMap`, `ReportsCharts`, `Header` and others each hold several.

So: a map layer only MV sees, a filter only MED has, a report column specific to
AMVA — all inside screens every tenant opens.

**Consequence:** tagging at section level is almost always wrong here. Tag the
row, the step, the fragment.

## Sources of truth

| Fact | Where it comes from |
|---|---|
| Which tenants exist | `src/render/config/*.config.ts` |
| Route-level gating | `AppRoutes.tsx` → `allowedProjects` |
| Element-level gating | Inline tenant comparisons in components |
| Exact UI wording | i18n catalogue (`locales/translations/es.json`) |

All of it reaches content through `knowledge/module-map.json`. Never read the
product's source to write a sentence — read the map, and fix the extractor if
the map is missing something.

## Which images the product ships — read this before requesting captures

What the product repository holds is recorded in `sources/registry.yaml` under
this source's `assets:`. What follows is the other half: **which of this manual's
slots turned out deliverable.** Method and reasoning live in the `source-assets`
skill; these are the verdicts, so the next agent inherits them instead of
re-deriving them.

| Table | Deliverable | Why |
|---|---|---|
| six map layers (`mapa.capa.*`) | **6 of 6** | The product's own `.webp`/`.png`, joined through `LayersMap.tsx` |
| six BoT sections (`bot.seccion.*`) | **6 of 6** | Tabler outline SVGs via `BOTSidebar.tsx`, recoloured |
| six map controls (`mapa.ctrl.*`) | **0 of 6** | One MUI icon, one framework-white product SVG, four Google Maps native controls |
| everything else in BoT (`bot.*`, 47 slots) | **0 of 47** | All figure-convention — screens, panels and procedure steps |

**The first and third sit on the same page.** Judge per row, never per section.

Sorting by convention settled BoT in one query: of its 47 slots, 12 are `figure`,
28 are `procedure` steps and 7 are `field-list` items — not one `icon-table` row,
so nothing an asset file can answer. Confirmed the slow way too: across every page
under `BroadsecOfThings/`, `CCTV/` and `PMV/` the product imports exactly TWO
asset files, both product-drawn SVGs, and neither answers a pending slot.
`CCTVPTZControl` is a grid of buttons and `CCTVStatusBadge` is a coloured pill
driven by a status map — composed at runtime, not shipped as files.

**The trap in this manual** is `bot.cctv.fn.ptz` — "Control PTZ" reads like an
icon and is not. Its convention is `figure`, so the caption promises the whole
control. Delivering the arrow glyph the component happens to use would fill the
slot, pass every count, and show the operator something that is not the control
being described.

**Recolouring**: this manual's icon column is dark navy, so a library glyph's
`currentColor` stroke must be replaced with `tokens.color.headerInk` (`#E8EDF2`)
on copy, and the file must record both the licence and the recolouring.

### Content gaps found while taking assets

Two asset families are ready and have nowhere to go. Both are authoring
decisions, not extraction problems:

1. **No incident-typification table exists.** `CustomTag.tsx` is the strongest
   join in the product — 338 incident names onto 68 of 85 label images — and not
   one can be delivered, because nothing asks. Someone should decide whether that
   subsection belongs in the manual.
2. **`bot.mapa` has no icon-table of map element types.** The product ships
   `layer_panels.png`, `layer_trafficlight.webp`, `layer_camera.webp`,
   `vehiculo.png`, `alarm.svg` and their `pin_`/`cluster_` variants — exactly the
   element types `bot.mapa` describes in prose. But it holds a `term-list`, which
   carries no images, plus one screen figure. If it gets an icon-table, those
   assets are ready.

## The legacy manual

`broadlineavida/docs/manual-usuario.md` is the **seed**, not the target. It is a
single Spanish file, ~1000 lines, written for SharePoint, with every tenant
packed into one document.

It is **no longer maintained**. Nothing here syncs back to it.

Importing it is a real migration, not a copy:

- Its numbering (`5.2`, `Figura 7.1.3`) and SharePoint anchor slugs are all
  **hardcoded** and must be replaced with stable ids.
- Its tenant metadata is mostly `_(por definir)_` or `Todos` — **do not trust
  it.** Rebuild tenant tagging from the module map.
- Its prose must be classified into block types, which cannot start before the
  catalogue exists.
- Its `[LV]`/`[MV]`/… badges disappear entirely. Output is client-facing.

Its editing skill (`docs/broadsec-manual-editing/SKILL.md`, v1.9) is worth
reading for conventions that survive — section shape, figure naming, SemVer,
register. Its SharePoint anchor-slug rules are obsolete here.

## Register

Neutral, formal Spanish: "Diríjase a…", "Haga clic en…". Matches the source
manual `Manual_Broadsec_v5.pdf`. No regionalisms, no voseo.
