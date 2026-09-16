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

- **`08-funcionalidades-especificas.yaml`'s map layers are tagged from the
  product, not from `07`.** The file described the AVL and the Paneles layers
  to every deployment while `07-interfaz-general.yaml` conditioned the same two
  layers — one screen, two sections, one of them wrong, and `med`'s document was
  the one carrying layers its deployment does not build. Both are now tagged
  from `components/LayersMap.tsx` re-read directly: AVL is `[mv, demo]`
  (`LayersMap.tsx:74-76`, `avlLayer !== undefined && setAvlLayer !== undefined
  && (config.name === "MV" || config.name === "DEMO")`) and Paneles is `[mv]`
  (`LayersMap.tsx:136-138`, the same guard with `config.name === "MV"`). The
  citations were re-derived from the source rather than copied from `07`, which
  is the only way a second document can confirm the first instead of inheriting
  its mistakes. Four nodes carry the tag: the two `icon-table` rows and the two
  standalone subsections. `mv` is unchanged at 82 pages and 236/247 images;
  `med` drops to 57 pages and 178/179, five image slots fewer — three figures
  plus the two icon-table rows, because **a row of an `icon-table` owns an image
  slot of its own**.

- **`09` declares coverage and is deliberately NOT stamped.** The two are
  separate acts and only one of them was earned. `documents:` now names four
  paths — `ReportsFilters.tsx`, `ReportsPage.tsx`, `ReportsCharts.tsx`,
  `GoogleMap/ControlHeatMap.tsx`, one per subject the section describes — and
  eleven flags. `verified` stays unstamped because it records the product
  commit a HUMAN checked a module against, and only the filters were read
  control by control; stamping would assert an audit of the Ventanas de Datos
  and the Mapa de Calor that nobody performed. That is the same reasoning that
  refused to stamp 07, applied to the module where it matters most.
- **A capability fact joins by flag, and paths alone do not catch it.**
  `coverage.ts` matches a `gate` fact by `file` against `documents.paths` and a
  `capability` fact by `flag` against `documents.flags`. Declaring the
  component that RENDERS a control therefore does not catch the flag that
  switches it on in a tenant config, which lives in a file no section would
  ever claim. 09 declared paths only at first and still reported its own three
  capability facts as undeclared. With the flags added it reads `covered` and
  claims them, and the manual-wide undeclared list drops from four facts to
  one.

- **There is ONE layer catalogue, and it lives in `07`.** The selector was
  described by a table in 07 AND a table in 08, both maintained by hand, and
  they had drifted: 08 listed four of the eight entries `LayersMap.tsx` builds
  and added two that are not entries of it at all. 08's table is removed; 07's
  is completed and is now the only one. Two tables cannot disagree if there is
  one. 07 gained the two entries neither had: **ARS** `[mv]`
  (`LayersMap.tsx:112`) and **Recorrido**, untagged because `viewRouteLayer`
  (`mapDataStore.ts:34`, default `false` at `:92`) is navigation state and not
  an axis value — every deployment has the layer and it appears when the view
  carries a route.
- **The traffic-light layer is headed "ARS", not "Semáforos".** `Semáforos` is
  the entry's internal `name` in `LayersMap.tsx:115`; the operator reads
  `t("layers.traffic_lights")`, which is `"ARS"`
  (`locales/translations/es.json:1335`). Written from the i18n catalogue, the
  way the emergency-type headings were.
- **"Satelital" and "360°" are real controls but were never layers.** Satellite
  is `components/TypeMap.tsx`, its own button at the lower right that toggles
  `hybrid`/`roadmap`, reading no deployment config, rendered by eight pages.
  The 360° view is Google Street View, available because `GlobalGoogleMap.tsx`
  passes no `streetViewControl` and so keeps Google's default — deliberate, as
  the maps that DO disable it show (`ModalSOS.tsx:66`,
  `Forms/Agents/AgentMap.tsx:123`). Both are written in 08 as what they are,
  each with the icon that used to sit in the removed table: the satellite
  button, and the pegman. The delivered capture for `func.capa.360` is,
  literally, Google's yellow pegman — the image proved the reading.
  `layers.satellite` ("Satélite", `es.json:1330`) exists in the i18n catalogue
  and nothing reads it: a dead key, not evidence of a satellite layer.
- **The Incidentes row no longer claims pins are grouped by proximity.**
  `agrupatedPins: config.name !== "MV"` (`mapDataStore.ts:70`) reaches
  `ClusterProvider groupingEnabled` (`GlobalGoogleMap.tsx:375, 470`), so mv is
  the one deployment that does NOT group them — and mv is a build target, so
  the sentence shipped false. Dropped rather than split in two: the grouping is
  behaviour of the map, not of that layer, and a second row would mint a second
  icon slot to say it. The CONTROL is not lost: 07 already documents it as
  `mapa.ctrl.agrupar`, and `GroupinMarketsSwitch`
  (`GlobalGoogleMap.tsx:468-472`) renders for every deployment. What
  `agrupatedPins` decides is only the state the map OPENS in; see Unresolved.
- **`07` declares `mapDataStore.ts` because it describes what that file
  decides.** It was the last fact under undeclared coverage in `documents
  broadlineavida`; with the declaration the report reaches zero.

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
3. **A delivery has been proposed and not authorised, and it is no longer the
   simple case it was.** Nothing has ever been handed over —
   `deliveries/broadlineavida/` is empty and no row carries a proof — so both
   existing rows are still stampable. But the entry that used to say every slot
   was filled is out of date: re-grounding 09 declared twelve captures that do
   not exist yet (`image-requests.json`, 250 slots, 238 delivered), so a
   delivery today would ship twelve placeholders. A version marks a delivery
   and only the owner moves it. **What settles it:** the captures arriving, and
   then the owner saying so in the conversation, naming the target and the
   number.
4. **What `07-interfaz-general` actually claims to document.** Its `documents:`
   now declares `components/LayersMap.tsx` and
   `components/GoogleMap/store/mapDataStore.ts` — both about the map. Drift in
   the Barra Superior and in the Incidentes list still cannot join to it, so
   the module will keep reporting on one of its three subjects. Note that `components/Header.tsx` is NOT the Barra Superior: it is
   imported only by `pages/EventHistory/EventHistoryPage.tsx`. **What settles
   it:** naming the components that render the Home top bar and the incident
   list, and adding them to the section's `documents:` paths alongside the map.
5. **The other seven legacy ports still declare no coverage.** 09 now does —
   see Decided — but 04, 05, 06, 08, 10, 11 and 13 report `unknown coverage`,
   so drift can never reach them. **What settles it:** the same decision 09
   just received, taken per module: declare what the section describes once
   somebody has read the product for it, and leave `verified` for whoever
   actually audits it.
6. **`07`'s `mapa.controles` is a THIRD table for this screen, and its rows do
   not match the images delivered for them.** It was not audited here — only
   two of its six rows were opened, and both were wrong.
   `mapa.ctrl.street-view` is captioned "Modo Street View", described as
   "Cambia la vista del mapa a modo calle", and its delivered image is an
   AERIAL view: that row is the `TypeMap.tsx` button (`hybrid`→`roadmap` is
   precisely "modo calle"), not Street View, and 08 now describes the same
   button as the satellite toggle. `mapa.ctrl.salir-street-view` does show
   Street View — Google's "View on Google Maps" bar — so the pair splits one
   control across two names, one of which belongs to a different control
   entirely. The remaining four rows (`visualizacion`, `agrupar`,
   `navegacion-3d`, `controles`) were NOT checked. **What settles it:** the
   same treatment the layer table just had — read `GlobalGoogleMap.tsx` and
   `TypeMap.tsx` row by row, then decide which of these controls belong to 07's
   catalogue and which to 08's prose, so one control is not described twice
   under two names.
7. **The INITIAL grouping state differs by deployment and is not written
   anywhere.** `agrupatedPins: config.name !== "MV"` (`mapDataStore.ts:70`) is
   a starting value, not a capability: `GroupinMarketsSwitch`
   (`GlobalGoogleMap.tsx:468-472`) lets any operator toggle it, and 07 already
   documents the control as `mapa.ctrl.agrupar`. So mv simply opens with pins
   ungrouped and every other deployment opens grouped. Minor, and deliberately
   not written as a tagged sentence until somebody decides a manual should
   describe default states at all. **What settles it:** that decision.
8. **08 still declares no `documents:`.** It describes the Mapa, the Incidentes
   actions and the Filtros, and reports `unknown coverage`. Removing its layer
   table narrowed what it claims, which makes the declaration easier to write
   than it was. **What settles it:** the same per-module decision 09 and 07
   have now had.
