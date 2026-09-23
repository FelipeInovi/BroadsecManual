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

- **Two figures were shot on DEMO and are delivered for `mv`, on the owner's
  explicit instruction, as a one-off.** `fuerzas.perfil.liberar.abrir` and
  `fuerzas.perfil.liberar.confirmar` show the emergency-release control and its
  confirmation dialog. They could not come from mv: the control renders only
  while an agent's state is `emergency` (`AgentInformation.tsx:116`), and
  producing that on mv means putting a real officer on a real street into it.
  The owner arranged the state on demo instead and asked for these two by hand,
  outside the recipe pipeline.

  **Written here because nothing else records it.** The two recipes in
  `capture-recipes.yaml` did NOT produce these files — `capture` binds the
  deployment to the build target, so they still cannot run, and a future reader
  who assumes otherwise would "fix" a recipe that is already correct. Do not
  take this as licence to shoot mv's figures elsewhere; it is one instruction
  about two files.

  **A third figure joins them by the same instruction, and it is the harder
  case.** `fuerzas.turno-asignar.fig` shows the Asignar pane of a shift detail,
  which lists the cases available to dispatch — so unlike the two above it DOES
  carry deployment-specific content. That reservation was raised and the owner
  overruled it: demo's cases represent mv's well enough for a figure whose
  subject is where the control is, not which cases exist. His call, and recorded
  as his rather than as a rule.

  Not taken yet. Three preconditions, all of them the product's:
  a shift that is not `Finished` (`ShiftsDetailsTabs.tsx:96`), an agent not in
  `assigned`/`unavailable`/`emergency` — otherwise the pane is replaced by
  "Operación en Proceso" (`:196-215`) — and at least one case in `case_open`
  (`AssignAgentMobilityCase.tsx:47-50`). On 2026-09-16 the first two held on
  demo (agent Daniel Ospina, shift 8020) and the third did not: zero open cases.
  **What settles it:** an open incident existing in demo when the shot is taken.

  Dispatching was authorised for this and is deliberately NOT used. The figure
  is the pane, and opening the tab is all it takes; a write that a read already
  answers is a write not worth making.

  What makes the first two sound rather than merely permitted, and the test to
  apply to any repeat: **neither image contains a single pixel that varies by
  deployment.**
  `AgentInformation.tsx` carries no tenant branch on that control or its dialog,
  every string comes from the shared i18n catalogue, and the delivered images
  show an icon and a dialog that names no agent — no name, no plate, no force.
  A demo capture that DID show deployment-specific content would be a different
  question and a worse answer. Note in passing that the profile behind them was
  agent 229, one of the two ids `AgentAditionalInfo.tsx:65` gives a hand-written
  résumé on DEMO; the clips exclude it, which is why they were opened and
  checked rather than trusted.

- **A figure may carry real operational data, including an agent's name and
  plate.** Asked and answered by the owner on 2026-09-16, about
  `fuerzas.perfil.agente.fig`, which shows an agent's full name, callsign, force
  and assigned vehicle taken off the live mv deployment: *"esos datos son de
  ellos mismos"*. The manual is delivered to the organisation whose agents these
  are, so a capture returns their own records to them.

  Written down because it is a judgement about a client-facing document that no
  file in this repository can answer, and because every future capture run meets
  it again — the dashboard figures already carry live case data, and the next
  agent should not re-open the question or blur an image on its own initiative.
  What this does NOT license is data belonging to somebody else: a capture taken
  from one deployment and delivered to another would hand a client another
  client's records, which is the `_common` folder's one real hazard.
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

- **`10-fuerzas-en-campo.yaml` is conditioned to `[mv, demo]`, and that is the
  one place in this manual where section-level tagging is right.** It is not an
  exception to the "tag the smallest unit that varies" rule — it is that rule
  applied honestly. Nothing INSIDE the module varies: its single entry point is
  gated whole. `CaseFiltering.tsx:1432` renders the "Fuerzas en Campo" menu
  button only under `config.canSeeForcesInField`, and that button is the only
  navigation to `/home-agents` in the product; the four other call sites
  (`NavigationToogle.tsx:43,55`, `AgentsDetailsTabs.tsx:52`,
  `AgentReportCharts.tsx:506`) are inside the screen itself or inside the Agent
  Dashboard this manual already declined to document. Verified per deployment by
  reading the configs, not the map: `true` at `mv.config.ts:89`,
  `demo.config.ts:88`, `dev.config.ts:88`; `false` at `med.config.ts:819`,
  `lv.config.ts:88`, `ant.config.ts:86`, `amva.config.ts:53`. `dev` is enabled in
  the product and is not a value of this manual's axis, so it is absent from the
  tag rather than dropped from it.

  The port had recorded this as an observation and deliberately left it, and it
  was the costliest thing standing in the manual: `med` is a BUILD TARGET, so its
  document shipped an entire module for a screen its operators have no button to
  reach. `med` now builds at 45 pages and 138 image slots instead of 57 and 178 —
  twelve pages and forty slots that were describing somebody else's product.

- **`10` declares coverage and is deliberately NOT stamped**, for the same reason
  `09` is not. Seventeen paths and two flags, one per subject the section
  describes. The flags matter more than usual here: `canSeeForcesInField` is the
  fact the whole file is conditioned on, and a capability joins by flag rather
  than by the file that reads it, so without declaring it a flip in a tenant
  config could never reach this module. `verified` waits for a human to look at
  the drift.

- **A delivered image can prove the PROSE wrong, not only the other way round.**
  `10` filed three figures under "Call AI" captioned as a Call AI summary *of a
  task*. There is no such thing — `TasksIncidentsItem.tsx:402-414` sends a task
  to `ShiftDetailTaskIncident`, which imports no Call AI at all. Opening the
  three PNGs settled it before anything was deleted: `fig-resumen-tarea` is
  literally the task dialog (Estado / Horario Programado / Hora de Inicio / Hora
  de Fin / Categoría / Acción), field for field as the component renders it. The
  images were never wrong; they were filed wrong. They moved to a subsection that
  describes what they depict, **keeping their ids** — a node id IS its image
  slot, so renaming would have orphaned three delivered files to tidy a string no
  reader sees. The same reasoning kept `fuerzas.estado.con-caso` when its label
  became "Asignado".

- **Two rows share one delivered image when the PRODUCT renders them
  identically.** The new `Emergencia` row declares
  `icon: fuerzas.estado.no-disponible` rather than a slot of its own.
  `getStatusColorAgent` (`utils/auth/functions.ts:198-203`) returns the same
  `#F44336` for `unavailable` and for `emergency`, and `CustomTagAgent.tsx:20-23`
  adds the pulse and the second overlay only for `assigned` — so in the list the
  two states are pixel for pixel alike. A capture of its own would have been a
  second file showing an identical image, and taking it would have required
  putting a real agent into emergency. The sharing agrees with the row's own
  description, which tells the reader the two look the same and to use the
  filter to separate them. Verified in the rendered output, not in a count: the
  fourth row's `src` resolves to `_common/fuerzas.estado.no-disponible.png`.

- **The owner's product declaration for the range delivered as 1.2.0**
  (`cb6f0eb..` the 1.2.0 row), stated on 2026-09-22. None of these commits
  carries a `Producto:` trailer: they predate the convention, which landed in
  `af1ee68`. Absent trailers read as `sin-cambio`, so without this entry the
  range would owe the client no release notes. In the owner's words:

  > - Fuerzas en Campo — el perfil del agente, la liberación de emergencia y la
  >   pestaña Asignar del turno son capacidades que el operador de mv NO tenía
  >   antes. Producto: nuevo.
  >   (Registered on 2026-09-23 as its own commit, `feat(broadlineavida): Fuerzas
  >   en Campo gains the agent profile, emergency release and Asignar tab`, which
  >   carries the trailer. That commit, not this quote, is what the pipeline reads.)
  > - canViewFilterTrafficDetails y los seis filtros del Security Dashboard que
  >   habilita son una capacidad AGREGADA al producto, tal como reportó el diff
  >   del extractor en b61438d. Producto: nuevo.
  >   (Registered on 2026-09-23 as its own commit, `feat(broadlineavida): the
  >   Security Dashboard gains the filters canViewFilterTrafficDetails enables`,
  >   which carries the trailer. That commit, not this quote, is what the pipeline
  >   reads.)

  The second settles a contradiction between two commits: `b61438d` reports
  "capability added" from the extractor's diff, while `39d51c3` says "nothing
  here changed, it was never right". The extractor was right; the section had
  been silent about a capability the product had just gained.

  The first `release-notes/v1.2.0.yaml` was this declaration written out by
  hand (first committed as `v1.1.1.yaml`, `65491df`). It was removed with the
  1.2.0 row in `2ce59fa` so the delivery flow would regenerate both from
  trailers alone — which is why each declaration above now also lives in a
  commit of its own.

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
3. **A delivery has been proposed and not authorised.** Nothing has ever been
   handed over — `deliveries/broadlineavida/` is empty and no row carries a
   proof — so both existing rows are still stampable. Whether a delivery today
   would ship placeholders is not written here, because `image-requests.json`
   answers it and cannot be stale. What IS worth carrying: every time a module
   is audited against the product it declares captures that do not exist yet, so
   "no placeholders left" is a state this manual keeps leaving rather than a
   milestone it reaches. A version marks a delivery and only the owner moves it.
   **What settles it:** the outstanding captures arriving, and then the owner
   saying so in the conversation, naming the target and the number.
4. **What `07-interfaz-general` actually claims to document.** Its `documents:`
   now declares `components/LayersMap.tsx` and
   `components/GoogleMap/store/mapDataStore.ts` — both about the map. Drift in
   the Barra Superior and in the Incidentes list still cannot join to it, so
   the module will keep reporting on one of its three subjects. Note that `components/Header.tsx` is NOT the Barra Superior: it is
   imported only by `pages/EventHistory/EventHistoryPage.tsx`. **What settles
   it:** naming the components that render the Home top bar and the incident
   list, and adding them to the section's `documents:` paths alongside the map.
5. **The remaining legacy ports still declare no coverage.** 09 and 10 now do —
   see Decided — but 04, 05, 06, 08, 11 and 13 report `unknown coverage`,
   so drift can never reach them. **What settles it:** the same decision 09
   and 10 received, taken per module: declare what the section describes once
   somebody has read the product for it, and leave `verified` for whoever
   actually audits it.
6. **`07`'s `mapa.controles` is AUDITED: three of its six rows are wrong, and
   two real controls are missing.** Every row was opened and checked against
   the controls the Home map actually renders, enumerated from the live DOM:
   `Map camera controls` (which contains *rotate clockwise*, *rotate
   counterclockwise* and **`tilt map`**), `Drag Pegman onto the map to open
   Street View`, `Atenuar Mapa` with its `Opacidad del Mapa` slider, and
   `Config`.

   | Row | Delivered image | Verdict |
   |---|---|---|
   | `visualizacion` | the layer panel, opened | **wrong, twice over** |
   | `agrupar` | a toggle switch | correct — `GroupinMarketsSwitch` |
   | `street-view` | an aerial view | **wrong** — that is `TypeMap.tsx` |
   | `salir-street-view` | Google's "View on Google Maps" bar | correct |
   | `navegacion-3d` | the Street View pegman | **wrong** |
   | `controles` | four arrows in a circle | correct — `Map camera controls` |

   - **`visualizacion`** fails twice. Its image is the whole layer panel rather
     than the icon its column asks for, and that panel is captioned
     "Semáforos" — the label the product carried BEFORE the i18n moved to
     "ARS" (`es.json:1335`; `LayersMap.tsx:285` renders `layer.tittle`, not
     `layer.name`). It also shows six layers, missing Incidentes and Recorrido.
     And what it depicts is the layer selector, which already has its own table
     in `mapa.capas` — a third description of one control.
   - **`street-view`** is the `TypeMap.tsx` button, which 08 now describes as
     the satellite toggle. `hybrid`→`roadmap` is literally "modo calle", so the
     row's own description gives it away.
   - **`navegacion-3d`** shows the pegman, which OPENS Street View. The actual
     3D control is `tilt map`, and it lives INSIDE `Map camera controls` — the
     row `controles` already describes it. So these two rows are one control,
     and this one's image belongs to Street View.
   - **Not documented at all**: `Atenuar Mapa` with `Opacidad del Mapa`, both
     the product's own, and `Config`.

   Three of the six rows and one pending question therefore all concern Street
   View, the satellite toggle and the 3D camera — three controls shared across
   four names. **What settles it:** deciding which of them belong to 07's
   catalogue and which to 08's prose, writing each once, and then reshooting
   the images those rows keep. Nothing here is a tagging pass; every wrong row
   has a delivered image that must be replaced, which makes it authoring plus
   capture, not a correction.
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

9. **The "Inicio" control of Fuerzas en Campo does not work for every reader,
   and the manual says it does.** `CaseFilteringAgents.tsx:150-175` (and
   `CaseFilteringShifts.tsx:177-202`, the same function) navigates home only
   when `isAdmin` — `validatePermissions(["admin"])`, reading the stored role at
   `utils/auth/functions.ts:934-937`. Any other role gets an `InfoModal` reading
   `dashboardPage.noPermission` (es.json:36) — "No tiene permiso para acceder a
   esta sección." — and stays where it is. It looks like the reports-window
   permission check reused verbatim on a button that has nothing to do with
   reports, but "looks like a bug" is not a finding this manual may act on.

   Left unwritten ON PURPOSE. Role is not an axis of this manual — `axes` in
   `manual.config.yaml` declares `tenant` and nothing else — so a sentence like
   "si usted es administrador" would introduce a second conditioning axis in
   prose, exactly where the pipeline cannot filter it. **What settles it:**
   either the product fixing the gate, or a decision that this manual addresses
   roles at all, which is a decision about every module and not about this one.

10. **`knowledge/module-map.json` is behind the product checkout.** It places
    `canSeeForcesInField` at `med.config.ts:816`; the file has it at `:819`.
    Small and harmless in itself — the VALUES still match, which is why the tag
    above could be grounded — but it dates the map, and a line number is what a
    future reader will check a citation against. Not refreshed here on purpose:
    `extract` rewrites the map for every module at once, so running it during a
    single-module update discards the drift of every module nobody has reviewed
    yet. **What settles it:** a deliberate whole-manual `extract`, run on its
    own, when somebody is ready to re-read every module's drift afterwards.
