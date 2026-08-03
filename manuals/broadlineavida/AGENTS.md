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
