# ESTADO — broadlineavida

Decisions and open questions for the Broadsec operator manual. Progress is not
recorded here; `sections/`, `image-requests.json` and `git log` already are the
state.

## Decided

- **The version numbering restarts from zero.** `1.4.7` became `1.0.0` and
  `1.5.0` became `1.1.0`. Broadsec team's decision: the old numbers belonged to
  the legacy SharePoint manual, written before this pipeline existed, so
  carrying them forward would have claimed a lineage this content does not have.
  The reason is also written where the numbers are, in `manual.config.yaml`.
- **`product` is the brand the document prints, not a catalogue entry.**
  `Broadsec`, not `Broadsec SIMM`. The owner saw "BROADSEC SIMM" on a cover and
  ruled on it (`7e3afe4`). The source repository is still `broadlineavida` and
  the product is still Broadsec SIMM internally — only the printed brand
  changed.
- **The two deployments are `mv` and `med`, and both are build targets.** Their
  delivery histories are independent by design: the change log gives `mv` a row
  at 1.1.0 that `med` never receives.
- **Which slots the product's own asset files could answer is settled**, per
  table, and the verdicts are in `AGENTS.md` under "Which images the product
  ships". They are not re-derived: the reasoning cost a full pass over the
  source and the answer does not change until the product does.
- **A control whose on-screen label differs per deployment is written as two
  tagged subsections, not one.** `SectionNode` (`packages/blocks/src/ast.ts`)
  carries a single `title` and a single `when` for the whole node, so a title
  cannot vary along the axis. The emergency-type filter renders for both
  deployments but is headed "Código Policial" on `mv`
  (`reportsEmergencyTypeLabel`, `mv.config.ts:25`) and "Tipo de Reporte" on
  `med` (the default `reportsPage.emergencyType`), so it is written as
  `dashboard.variables.emergencia.mv` and `.med`, each tagged and each with its
  own figure. Duplicating the prose is the cost; the alternative was printing a
  heading the operator cannot find on their own screen.

## Ruled out

- **Trusting the legacy manual's tenant badges.** Its `[LV]`/`[MV]` marks and
  its `_(por definir)_` metadata were rebuilt from the module map instead. See
  `AGENTS.md`, "The legacy manual".
- **Tagging conditioning at section level.** Divergence in this product is
  element-level inside shared screens; section-level tagging is what produced
  the packed document this manual replaces.
- **Documenting the "Tipo de Finalización" filter.** Its content and figure were
  removed from `09-security-dashboard.yaml` on the owner's explicit instruction,
  2026-09-15. The control is gated by `config.canViewFilterCompletionType`
  (`ReportsFilters.tsx:1484`), `false` in all seven tenant configs, so no
  deployment renders it — the manual was sending the operator to look for a
  filter that is not on their screen. It did exist once: a real capture of it
  was delivered, and both that image and the removed content remain in git
  history, so the section is recoverable if the flag is ever switched back on.
  The reason is also written where the content was, so it is not re-imported
  from the legacy document by the next author.
- **Stamping `sections/07-interfaz-general.yaml` as verified on the strength of
  a `clean` drift report.** The module does read `clean`, but its `documents:`
  names one shared component — `components/LayersMap.tsx`, imported by eight
  screens — for a module that describes the Mapa, the Barra Superior AND the
  Incidentes list. So `clean` is evidence about one of its three subjects, and
  about a component that is not even specific to the Home screen. A baseline
  records that a human looked; this one would record an audit of two subjects
  nobody examined. The declaration is widened first, then the module is stamped.
- **Documenting the Agent Dashboard (`src/render/pages/AgentsReports/`).** It
  was substantially rebuilt in the product — live status strip, historical
  metrics widgets, agents drawn on the map, an agent-states map control, shift
  route drawing, a mobile-usability CSV export — and no button in the shipped
  interface reaches it. The entry points in `CaseFilteringAgents.tsx` and
  `CaseFilteringShifts.tsx` are commented-out JSX, and the product's own history
  shows them switched off, restored, and switched off again, so they are
  deliberate rather than an oversight. No `navigate()` call anywhere targets
  `/agents-reports` or `/agent-dashboard`. A manual documents what an operator
  can reach. Revisit when those buttons are wired, not before.

## Unresolved

1. **No incident-typification subsection exists, and nobody has decided whether
   one belongs.** `CustomTag.tsx` is the strongest join in the product — 338
   incident names onto 68 of 85 label images — and not one image can be
   delivered because no slot asks for them. **What settles it:** an authoring
   decision on whether the manual documents incident typification at all.
2. **`bot.mapa` holds a `term-list`, so it carries no icon column.** The product
   ships the element-type images the section describes in prose. **What settles
   it:** deciding whether that section gets an `icon-table`; the assets are
   ready either way.
3. **A delivery has been proposed and not authorised.** Every image slot is now
   filled and nothing has ever been handed over — `deliveries/broadlineavida/`
   is empty and no row carries a proof — so both existing rows are still
   stampable, which makes this the simplest kind of delivery: no summary to
   write and no agent to run. But a version marks a delivery and only the owner
   moves it. **What settles it:** the owner saying so, in the conversation,
   naming the target and the number.
4. **What `07-interfaz-general` actually claims to document.** Its `documents:`
   declares `components/LayersMap.tsx` and nothing else, so drift in the Barra
   Superior and in the Incidentes list can never join to it — the module will
   keep reporting `clean` through changes to two thirds of its own subject
   matter. Note that `components/Header.tsx` is NOT the Barra Superior: it is
   imported only by `pages/EventHistory/EventHistoryPage.tsx`. **What settles
   it:** naming the components that render the Home top bar and the incident
   list, and adding them to the section's `documents:` paths alongside the map.
5. **The module that describes the Security Dashboard cannot be checked against
   the product.** `09-security-dashboard.yaml` declares no `documents:`, as do
   04, 05, 06, 08, 10, 11 and 13 — the ports of the legacy document. The
   product's real movement lands squarely in `src/render/pages/Reports/`, which
   is exactly what 09 describes, so the one module that needed to surface this
   drift is the one instrumented to miss it. **What settles it:** an authoring
   decision, per module, on whether a legacy-port section declares coverage
   before or after it is re-grounded against the source.
6. **`08-funcionalidades-especificas.yaml` documents map layers `med` cannot
   see, and the owner deliberately deferred fixing it.** The file carries zero
   `when:` tags in 1095 lines, so its Capa AVL and Capa de Paneles subsections
   render for every deployment — while `07-interfaz-general.yaml` holds the real
   conditions for the same layers, cited to the product: AVL is
   `[mv, demo]` (`LayersMap.tsx:76`) and Paneles is `[mv]` (`LayersMap.tsx:138`).
   Two sections describe one screen; one of them is true. `med`'s document
   therefore explains two map layers its deployment does not have, which is what
   invariant 4 exists to prevent. Surfaced on 2026-09-15 and consciously left
   for later in favour of documenting the new reports filters in 09. **What
   settles it:** tagging 08's layer subsections from 07's conditions — the
   evidence is already gathered and cited, so this is authoring work, not
   investigation.
