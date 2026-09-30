# ESTADO — bridge-manual

Decisions and open questions for the Bridge360 operator manual. Progress is not
recorded here; `sections/`, `image-requests.json` and `git log` already are the
state.

## Decided

- **Authored from the `bridge` source repository directly.** Nothing is
  inherited from `manuals/bridge-primera-entrega`, whose content describes
  Broadsec SIMM — not content, not its module list, not its six-deployment
  tenant axis. The only thing shared with it is the visual theme. Confirmed by
  the owner.
- **Theme: `bridge`, reused unchanged.** No new brand, no token edits.
- **The conditioning axis is `permission`.** Owner's decision, and the only axis
  with evidence in the product.
- **Axis values are `agencia-propia` / `todas-las-agencias`, from
  `canViewAllAgencies` alone.** `canManageSitemapLayout` is deliberately not
  folded in — see open question 1.
- **Both values are build targets.** Conditioning is only proven if one output
  contains the conditioned content and the other genuinely lacks it.
- **`packages/extract` does not fit: Bridge needs a new extractor.** The step 2
  verdict of "Adding a source". `extract bridge-manual` refuses with the
  documented message and writes nothing, so there is no `knowledge/` map.
- **Content is authored against facts cited from the source by file and line**
  until an extractor exists. This is the path the refusal message itself names,
  not a workaround. Consequence: every claim carries its own provenance comment,
  and there is no drift report to catch it going stale.
- **Seatmap was written first** because it is the only screen in the product
  whose element-level divergence traces to code, so it is the only place a `when`
  is a documented fact rather than a guess — and it exercises every block type
  in the catalogue, which is what the pipeline spike needed.
- **The manual is scoped to the RECEPTION agency type.** Owner's decision,
  taken when `home-view.tsx` turned out to key its whole layout off
  `agencyType`. RECEPTION is also the backend's own default
  (`domain/types/agency.types.ts:9`). Consequence, accepted knowingly: the
  manual is silent for a DISPATCH, SUPERVISOR or OTHER agency, so Home states
  its scope in content (`home.alcance`) rather than leaving a reader of another
  agency hunting for panels their platform never mounts. This keeps `permission`
  as the single axis and needs no pipeline change.
- **In 0.x a new module bumps the MINOR, not the major.** The major slot is held
  at 0 deliberately while this is a spike, so Home took the manual to 0.1.0
  under the `manuals/AGENTS.md` rule that a new module is a major change.

- **Section order follows the product's own sidebar rail.** `navItems`
  (`components/layout/icon-sidebar.tsx:51-84`) lists `home`, `call`, `sitemap`,
  `dashboard`, `bridge-of-things`, `forces-in-field`, `create-incident` — the
  order the operator reads in the icon rail. Filenames follow it, so Llamada took
  `02-` and Seatmap moved to `03-`. This is derived from the product, not
  invented, and it means a new section renumbers the ones after it. That is
  cheap: cross-references are stable ids, so a rename touches no content.

- **Labels are quotations, not references — and the quotation is now CHECKED.**
  The product has no i18n catalogue, so `uiLabel` blocks cannot be used against
  this source and each label is a copy. A copy does not follow what it copied, so
  each one is cited in its section's `labels` list and
  `broadsec-manual labels bridge-manual` holds it against its line.

  **Only quotations get cited.** A `label:` or `labelHeader:` holding the
  MANUAL's own naming — "Encabezado de la agencia", "Tarjeta", "Qué indica" — has
  nothing to check against, and citing it would report the manual's own words as
  drifted from a screen that never said them. Nine of Seatmap's twenty-eight
  label-bearing props are the manual's own; twenty are cited.

  **All five sections are backfilled: 187 citations, 187 exact.** Roughly a
  third of the label-bearing props are deliberately NOT cited, and each section's
  own header says which and why. Three recurring reasons, worth knowing before
  adding a sixth section:

  - **The manual naming a REGION, not quoting a rótulo.** Home's review card
    lists `Antigüedad`, `Dirección`, `Duración`; the card prints a relative time
    and an address, not those words. Only `Prioridad` is on screen.
  - **A control with no rótulo at all.** Every map tool in
    `home.herramientas` is an icon button with neither `title` nor `aria-label`
    (`map-tools-panel.tsx:228-275`), so those six names are the manual describing
    a function. `Acercar` and `Alejar` DO appear elsewhere in the product —
    citing those hits would be citing a different control that shares a word.
  - **One item covering several controls.** `Anterior y Siguiente`, and CCTV's
    four diagonal PTZ buttons in one row. No single line says either.

  Column headings are never cited: `Dato`, `Qué indica`, `Ficha`, `Paso`,
  `Columna`, `Contenido` and the rest are the manual's own furniture.

- **A screen the PRODUCT has not finished: the manual shows what works, names
  none of what does not, and waits.** Owner's decision, taken after two views in
  a row hit it. In full: document everything around the unfinished part in full;
  describe nothing it displays, with no warning and no promise of a later
  version, because either is a leak into a client-facing document; declare it
  internally so it is queued rather than forgotten; and fill it in as the product
  fixes it, through the manual-update flow the owner intends to build later.

  The declaration mechanism is `pending` on a section, exported by
  `broadsec-manual awaiting` to `awaiting-product.json`. It never reaches the
  AST, so no renderer can print it. The rule now lives in the
  `module-completeness` skill; this entry records only that the decision was
  taken and by whom.

  Consequence, accepted: a reader who sees such a control on screen finds nothing
  about it here and cannot tell whether it was omitted or they misread the
  screen. That is the least-bad of three bad options, and it is what makes the
  internal queue load-bearing rather than bookkeeping — it is the only thing
  separating a deliberate omission from a forgotten one.

  Still open, and NOT settled by this: nothing detects that the product fixed
  one. That needs a check against the source for whether a fixture became a
  query, which for a product with no extractor does not exist. Until it does, an
  entry is closed by a person.

- **Qué datos reales puede llevar una figura: SIN restricción de contenido.**
  Decisión del dueño, tomada en dos tiempos y registrada así porque el recorrido
  importa más que el resultado.

  La pregunta apareció sola cuando las capturas empezaron a traer datos de
  personas: `dashboard.historial.detalle.abrir` abrió un evento cuyo panel de
  transcripción traía la llamada entera de un robo de documentos, y la auditoría
  nombraba a dos personas con teléfono. El dueño delegó el criterio
  ("establécelos tú"), y se fijó uno que prohibía el contenido de la comunicación
  de un ciudadano — transcripción, chat o grabación — dejando pasar los
  metadatos operativos.

  **El dueño revocó esa regla de forma explícita: el contenido de una
  comunicación SÍ puede mostrarse.** Es su producto, su cliente y su marco legal,
  y la decisión es suya. No queda ninguna restricción de contenido sobre lo que
  una figura puede mostrar.

  Lo que sigue siendo cierto, y por eso queda anotado como consecuencia y no como
  prohibición: un manual es un PDF. Viaja por correo, se imprime, queda en
  carpetas compartidas, y no lleva el control de acceso que sí tiene la consola.
  Todo lo legible en una figura queda divulgado a quien reciba el archivo. Si
  alguna vez hace falta acotar eso, lo que se necesita es una capacidad de
  tachado en el arnés de captura — decisión y trabajo del dueño del pipeline, no
  de esta cancha.

  **Lo que la regla dejó como método útil, y sobrevive a su revocación:** elegir
  la FILA de la que se fotografía. Mientras la regla rigió, la receta buscaba la
  fila que escondiera menos; sin la regla, busca la que muestre más — que es lo
  que la caption pedía desde el principio ("todo lo registrado de ese evento").
  Las seis primeras filas del historial se abrieron una por una para ver qué
  traía cada cuadro: 566 tiene transcripción y no atributos, 562 al revés, y 564
  — Accidente de Tránsito, con dirección — llena los dos. La receta elige esa.
  El mismo movimiento que hace el mosaico de CCTV al nombrar sus tres cámaras:
  cuando los datos del producto deciden si una toma sirve, la receta elige los
  datos.

  Consecuencia para lo que viene: `llamada.transcripcion.fig` y
  `llamada.chat.fig` no tienen impedimento de contenido. Siguen pendientes por lo
  único que las bloquea de verdad, que es necesitar una llamada en curso.

## Ruled out

- **Pointing `extract.tenantConfigs` at a directory to make `extract` run.**
  Forbidden by `sources/registry.yaml`'s own header; it would invent a tenant
  registry the product does not declare.
- **Reusing `bridge-primera-entrega`'s tenant axis.** Would fabricate
  deployments.
- **Renaming the `permission` axis to `tenant`.** This was the tempting fix while
  the CLI still demanded an axis by that name, and it stays ruled out now that it
  does not: it would label a permission profile as a deployment on the cover, in
  the output filename and in the figure folders. Invariant 3 exists to stop
  exactly that, and it would have reached the client.
- **Bundling both permission predicates into `operador` / `supervisor`
  profiles.** No code backs the combination.
- **Conditioning the "Editar distribución" control on this axis.** It is gated by
  `canManageSitemapLayout`, which is independent of `canViewAllAgencies`. It is
  documented for every target, with prose saying the control depends on the
  assigned permission.

## Resolved since these decisions were written

- **The CLI no longer hardcodes a `tenant` axis.** `build`, `images` and
  `capture` resolve the axis through `primaryAxis(config)`
  (`packages/cli/src/main.ts:476`, `:587`, `:642`, `:775`), and the manifest's
  per-value override template now prints the axis's own name (`:264`). Both
  targets build: `output/` holds a PDF, an HTML and a .docx for
  `agencia-propia` and for `todas-las-agencias` at v0.0.1. `manual.config.yaml`
  carried a KNOWN BLOCKER block asserting the opposite, plus two dependent
  comments claiming `{permission}` is never substituted and that the lede must
  be set to dodge a `tenant` assumption; all three were removed, because a
  comment that lies about the pipeline is worse beside the very files that
  disprove it.

## Findings that constrain authoring

- **Tenancy is server-side.** The tenant arrives as the JWT claim `tid`
  (`src/modules/auth/infrastructure/mappers/user.mapper.ts:21`); the API routes
  on the token (`src/shared/config/api.ts:23`); the Tauri side only persists the
  id it was handed (`src-tauri/src/lib.rs:226-247`). No client-side deployment
  registry exists.
- **What varies the UI is `permissions[]`**, through two independent predicates
  in `src/modules/dashboard/domain/` — `can-view-all-agencies.ts` and
  `can-manage-sitemap-layout.ts` — consumed in exactly one view,
  `src/modules/dashboard/presentation/ui/views/sitemap-view.tsx:38-39` (it was `:36-37` at `58e2cc4d`).
- **Screens are not routes.** `wouter` declares five routes and one is the whole
  application (`src/app/App.tsx:126-138`). The operator moves between seven
  views in `src/modules/dashboard/presentation/ui/views/`. Screen mapping follows
  the view switch, not the router.

- **An image slot that cannot be filled is often the CONTENT being wrong.** Three
  Bridge of Things slots were carried for a while as capture blockers, as though
  the harness were short a feature. Two were a procedure written as three steps
  where one would do — the third being "Suéltela", a numbered step whose whole
  content is releasing the mouse — so both of their images could only ever have
  photographed a gesture. The third was one icon row whose label named four
  controls at once, which no glyph and no clip can answer.

  The row had been announcing itself: it was the single exception in that
  section's `labels` list, excluded because "no single line says it". **An
  uncitable label is not a citation problem. It is the row telling you it
  describes more than one thing.** Splitting it into its four controls removed
  the exception rather than documenting it, and gave four citable labels and four
  deliverable glyphs.

  Both were fixed at v0.6.7 and Bridge of Things now has no pending image. The
  habit worth keeping: before asking what the harness lacks, ask what the caption
  promised. A gesture, a transient state, a label naming several controls — none
  of those is answerable by any image, ever.

- **Reading the hook is not reading the data path, and Bridge of Things is where
  it cost.** The first pass on that view asked which panels had queries, found
  `usePmvPanels`, `useCCTVCameras`, `useProgrammingList` and
  `useResourceManagement`, and wrote all three up as live. The owner corrected
  it: **only CCTV is integrated.** What the hooks hid, one layer down:

  | Panel | What the adapter actually does | Class of gap |
  |---|---|---|
  | CCTV | reads live cameras | none — documented in full |
  | PMV | `USE_MOCK = import.meta.env.VITE_PMV_USE_MOCK === "true"` (`pmv-api.adapter.ts:27`) branches EVERY read — :32, :57, :62, :94, :197, :247 — against six dev-only fixtures in `pmv.mock.ts` (:9, running to :180) | a fixture, same class as the DASHBOARD panel |
  | PRT | four real endpoints, no fixture path anywhere: `prt-api.adapter.ts:46`, `resources-api.adapter.ts:15`, :29, :50 | wired client, backend not live |
  | DASHBOARD | no query at all, a literal array (`home-panel.tsx:20-84`) | invented data |

  So a hook proves a query EXISTS, not that it runs against real data. The
  adapter is the layer that answers that — and for PRT not even the adapter can,
  because whether an endpoint responds is a server fact, invisible from this
  repository at any depth.

  Cost of getting it wrong: two submodules written to workflow depth — the PMV
  message form, pages, pictogram catalogue, schedule and save procedure; PRT's two
  tabs, nineteen columns, filters and dispatch procedure — about 400 lines, all
  removed at v0.6.6 and now queued as `bot.pmv-fixture-data-layer` and
  `bot.prt-backend-not-live`. Recoverable from git history, which is why both
  `settles` entries say so rather than asking anyone to re-derive it.

  **This sharpens the open point under the pending policy above.** That entry
  blames the missing extractor for nothing detecting when the product fixes a
  gap. PRT is the harder case: no extractor over this repository could ever
  detect it. That entry closes when a person asks the deployment, and there is no
  mechanism that will ever replace them.

- **A partial `image-requests.json` is a filtered run, not a pipeline defect.**
  The first committed manifest listed only `todas-las-agencias` under
  `deploymentsCovered` while `deploymentsConfigured` said 2, so all fourteen
  slots claimed one value — telling the delivering team `agencia-propia` needed
  no images. Those two fields exist precisely so a filtered run is visible
  (`packages/cli/src/main.ts:295-296`, fixed by `main.test.ts:232-233`).
  Regenerate with no `--axis`/`--tenant` filter before committing a manifest.

- **`agencyType` is a SECOND divergence axis, and Home is where it bites.**
  `HomeView` keys its whole panel layout off `props.agencyType`
  (`home-view.tsx:320`), fed from the backend agent-context
  (`dashboard.tsx:205`, `:669` — it reaches no other view). The four values are
  enumerated in the client itself: `RECEPTION | DISPATCH | SUPERVISOR | OTHER`
  (`domain/types/agency.types.ts:6`, default `RECEPTION` at `:9`). It decides
  which panels EXIST, not merely which are visible: `home-view.tsx:356-364`
  drops `field-forces` and `cctv` from the manifest for every non-DISPATCH
  agency, and the code says why — "absent everywhere (dock, layout, saved
  positions), not merely invisible". `HOME_LAYOUT_RULES` (`:57-80`) then gives
  RECEPTION a three-column case view and the `agencies` panel, DISPATCH a tabbed
  one plus field forces and CCTV, and SUPERVISOR/OTHER neither.

  This is better evidence than the axis this manual is built on: `permission`
  values had to be derived from one predicate, while these four are enumerated
  in the product. It is also NOT the same axis — nothing gates on both — and
  `permission` does not reach Home at all.

  `sources/registry.yaml`'s notes list `role`, `agencyId` and the `VITE_*`
  flags as mechanisms checked and ruled out. `agencyType` is not in that list;
  the survey missed it. Those notes are incomplete, not wrong.

- **`{{ref:…}}` cross-references do NOT exist in the pipeline.** The root
  `AGENTS.md` states the invariant as "Cross-reference by **stable ID** only:
  `{{ref:mapa.capas}}`", but nothing in `packages/core` substitutes that token —
  no `{{` handling in `load.ts` or `assemble.ts` — and no manual in this
  repository uses it, `broadlineavida` included. Writing one would put the raw
  token in a client-facing PDF. Reported, not worked around: Llamada refers to
  Home by its TITLE in prose ("la sección **Home**"), which breaks no invariant
  — a title is a stable name, not a number or an anchor.

- **One panel, two names on screen: "Call AI" and "FLOW AI".** The panel header
  reads `Call AI` (`components/panels/call-ai-panel.tsx:104`); the dock toggle
  for the same panel reads `FLOW AI` (`CALL_MANIFEST`, `call-view.tsx:176`). Both
  are visible to the operator, so the manual names both rather than picking one
  and leaving the reader unable to find the control. Worth watching: this is the
  shape a rename-in-progress leaves behind.

- **`call-view.tsx` carries NO divergence signal.** Checked before authoring, as
  this file's own next-section note demands: no `agencyType`, `permissions`,
  `role` or `agencyId` anywhere in it. The view is uniform for every agency type,
  so the RECEPTION scope costs Llamada nothing. What varies it is call STATE
  (link sent, units available, call ended) — runtime, not a build axis, and
  documented as states in prose.

- **This product ships screens that are on display and fabricated, and the
  manual has hit two.** The evidence for each — every file and line — lives in
  the `pending` declaration that withholds it, and is exported to
  `awaiting-product.json`. Not restated here: two copies of one finding is the
  copy that goes stale when the product is fixed. Two facts about them that are
  NOT in those declarations, because they constrain authoring rather than
  describe a gap:
  - Every column filter in "Historial de Eventos" runs client-side
    (`getFilteredRowModel`, `events-history-panel.tsx:171`) over a
    server-paginated table (`manualPagination: true`, `:169`), so a filter only
    ever filters the page currently loaded. This is true of the columns that DO
    work, so it shapes how they are described.
  - `previewColumns` (`events-history-columns.tsx:122`) is exported and used
    nowhere. Dead code — do not document it, and do not mistake it for the
    column set on screen.

- **A comment naming a deployment is not a gate, and Crear Incidente is the
  case that proves it.** Two comments there name one — `create-incident.ts:187`
  ("only the LV deployment demanded them") and
  `create-incident.schema.ts:50-52` ("which id comes back depends on the
  deployment") — and NEITHER branches. The first makes two fields optional for
  everyone; the second accepts all three ids at once. That is the UNION of
  deployment behaviours, which is the opposite of a gate.

  Conditioning on either would have asserted a divergence the product does not
  have, and it would have put the word "LV" inside a Bridge360 manual. Read what
  the code DOES, never what a comment remembers.

- **Reading the product's LIST beside the manual's catches skipped options, and
  citing labels is when it happens.** Llamada was missing two, both found this
  way and both since written: the force filter declares seven options and the
  manual documented six, and the case log declares four event origins and the
  manual documented three. Neither was a product defect and neither showed up in
  any check — a manual that documents six of seven options builds clean, and the
  reader cannot tell one was skipped.

  Worth repeating deliberately per section: when the source declares a LIST —
  `FORCE_FILTERS`, `SOURCE_BADGE`, `TABS`, `MOSAIC_LAYOUTS`, a column array —
  count it against the manual's rows. The citation check verifies the rows that
  exist; it cannot know about a row nobody wrote. Note also that a citation
  comment naming a RANGE (":28-34") reads as complete while skipping a line
  inside it, which is exactly how this one survived.

- **A hidden tab is the CLEAN case, and it is worth contrasting.** Analytics
  declares four sub-tabs and marks `Análisis de Colas` as `enabled: false`
  (`analytics-panel.tsx:26`), and `VISIBLE_TABS` filters it out (`:30-32`). It is
  not on screen, so there is nothing to document and nothing to explain. That is
  what a deliberately unfinished feature looks like when it is handled properly —
  the contrast with the finding above is the point.

- **The other three BoT panels are genuinely real.** PMV (`usePmvPanels`,
  `pmv-panel.tsx:31`), CCTV (`useCCTVCameras`, `cctv-context.tsx:72`) and PRT
  (`useProgrammingList`, `prt-list-content.tsx:53`; `useResourceManagement`,
  `prt-panel.tsx:32-33`) all query the backend. They are documented in full.

- **Every panel is reachable from the panel bar, and that is verified, not
  assumed.** `ToolKitPanel` sits at the foot of the icon rail
  (`components/layout/icon-sidebar.tsx:158`) and lists the current view's
  manifest entries with their active state
  (`components/panels/tool-kit-panel.tsx:186`). It filters only on
  `requiresCase`/`requiresNoCase`, which no BoT entry sets. This matters because
  the BoT dashboard panel is one way to open the other three, and it is the way
  this manual does NOT document.

## Module inventory — PROPOSED, not agreed

Nothing in this repository declares a manual's module list, and no scope has been
agreed beyond the spike. The product's own view switch offers seven, which is the
natural candidate list:

`home`, `call`, `sitemap` (Seatmap), `dashboard`, `bridge-of-things`,
`forces-in-field`, `create-incident`
— `src/modules/dashboard/presentation/ui/views/`, reachable from
`icon-sidebar.tsx:51-84`.

Treat this as a proposal to confirm, not as an agreed scope.

## Unresolved

1. **How the layout-editing permission is modelled.** `canManageSitemapLayout`
   is a second, independent capability. Modelling it needs either a second axis
   or a product statement about which permission profiles actually ship.
   **What settles it:** the owner, or a backend source that enumerates profiles.
   Until then the control is documented unconditionally.
2. **No extractor for Bridge — and this does not block authoring.** The
   `framework` dispatch in `packages/extract` is still inert, so there is no map.
   `extract bridge-manual` refusing is the CORRECT state, not a wait. Do not
   hand-write `knowledge/`, and do not hold a section for it — author against the
   source read directly, citing file and line, as Seatmap does.

   **This note used to say the extractor's "first job is not tenants but
   permission gates". That was wrong, and here is why.** The product enumerates
   permission STRINGS — `view.sitemap.all`, `*`
   (`can-view-all-agencies.ts:1-4`), `manage.sitemap.layout`. It does not
   enumerate `agencia-propia` or `todas-las-agencias` anywhere: grep the whole of
   `../bridge/src` and there are zero hits. Those two are a human abstraction
   over "holds the permission" / "does not", recorded in `manual.config.yaml`.

   So the map's `values` key is **not extractable for this product at all**,
   which is structurally unlike `broadlineavida` where `mv.config.ts` IS the
   value. An honest extractor here could emit `references` — the two gate lines
   at `sitemap-view.tsx:38-39` — and nothing else. Two lines verifiable by eye
   in one file do not pay for an extractor.

   The extraction work that DOES pay for Bridge is not gating. It is (a) labels,
   which is now built and not an extractor at all — see the `labels` command; and
   (b) a check for whether a fixture became a query, which is the trigger the
   manual-update flow needs and does not exist. **What settles this question:**
   it is largely answered — the gating extractor is not worth building for
   Bridge, and what was worth building is being built without it.
3. **Whether the other three agency types ever get documented.** Settled for
   now by scoping the manual to RECEPTION (see Decided), which is what let Home
   be written. What is NOT settled is what happens when a DISPATCH, SUPERVISOR
   or OTHER agency needs a manual: a second manual, or `agency-type` as a second
   axis. The second axis is not free — `primaryAxis` refuses more than one and
   says why (`packages/cli/src/main.ts:463-469`): "one filename and one figure
   set need a single value … raise it rather than working around it."
   **What settles it:** the owner, when a non-RECEPTION agency is actually in
   scope.

4. **`sections/01-home.yaml` no longer describes the product, and updating it
   means rewriting it.** Audited 2026-09-29 against `bridge` develop `465f5eb9`,
   from `58e2cc4d` (develop when Home was written; no `baselines.json` exists,
   and `documents bridge-manual` refuses for the same reason `extract` does).
   246 first-parent commits in between. What moved the ground:
   - Home became a dockview dock with a floating Toolkit (`80cbc85e` #195), and
     RECEPTION's Home was redesigned around calls (`a7cc0686` #191). The layout
     rules now live in `views/home-right-slot.ts:67-79`.
   - The **Agencias** submodule is gone from Home. So are the case's AGENCIAS
     block, its Acciones (Archivar, Libro de caso), the case tabs, the keypad
     toggle, the review card's Prioridad and Estado, and the two later book
     steps. New in their place: Validar / Ver más tarde, the Post-Llamada lock,
     the 180 s countdown, the keypad as its own panel with five tabs, and the
     efficiency gauge in Mi turno.
   - The claim "RECEPTION never gets Fuerzas en Campo / CCTV" is now false.
     `showFieldForcesOnCase` and `showCctvOnCase` are `true` again (`a1436ca3`
     #371, right after `085c1f0d` #306 hid them "permanently"). The unmerged
     `origin/feat/dashboard/role-based-views` takes them away again for intake
     roles.
   - `dispatch.forces` and `case.view.all` now gate parts of Home. The manual's
     own axis (`canViewAllAgencies`) still does not reach it.
   - The product has i18n (`9dfc429c` #198): es/en/pt catalogues in
     `src/i18n/locales/`. That is why `labels` reports 210 of 224 citations
     GONE: most citations must be repointed to the catalogue, and a good part
     of the text really changed. The es catalogue drops accents in some strings
     ("Sin ubicacion", "Mas recientes primero").

   The full per-submodule audit is in engram,
   `bridge-manual/home-drift-audit-2026-09-29`.

   **Decided by the owner (2026-09-29):**
   - Home stays ONE module, reorganized by STATE: without a case / with a case
     open / cross-cutting (panel bar, map tools). It is not split per panel,
     because the product shows it as one rail view, and several of its panels
     exist only while a case is open.
   - A complete rewrite of `01-home.yaml` is authorized.
   - The baseline is develop as it is today; `role-based-views` is not
     documented until it merges.
   - Post-Llamada happens inside Home, so it is documented there.
     `02-llamada.yaml` did not cover it.
   - Quoted labels are copied exactly as the es catalogue writes them, unaccented
     strings included. They are cited from `src/i18n/locales/es/*.json`, which
     `labels` resolves.

   **The rewrite's product news, declared by the owner (2026-09-29).** The
   rewrite itself is committed as `cambio`. This line is here so its `nuevo`
   and `retirado` parts reach a trailer too.
   - Nuevo: Validar / Ver más tarde, Post-Llamada, the panel bar, the keypad's
     tabs, the efficiency gauge, CCTV and Fuerzas en Campo on the case, map
     layers and marker grouping.
   - Retirado: the Agencias panel, Archivar and Transferir agencia, and the
     Prioridad and Estado on the review card. "Llamadas transferidas" is gone
     from Mi turno.

   **Still open after the rewrite** (the owner decides each):
   - Statements about Home that are now false in other sections (the two in
     `02-llamada` went with its rewrite, see #5):
     - `05-bridge-of-things` `bot.herramientas`: "centrado deshabilitado" in
       Home.
     - `06-forces-in-field` `fuerzas-campo.asignacion.proposito`: "Revisión de
       Llamadas".
   - Sections 03-05 carry the same i18n citation drift: 137 labels to review.
   - The quote "Estás editando este caso. Guardá o cancelá los cambios…"
     (`es/calls.json:475`) is voseo in the client PDF. It is kept as an exact
     quote until the owner says whether to paraphrase it.

   **Settled since** (2026-09-29): the orphaned Home images were deleted and the
   dead recipes replaced, at the owner's request. Two kinds of Home figure cannot
   come from `capture` and were shot by a watcher script while the owner drove
   the app: Post-Llamada needs a call that really ended, and the CCTV camera
   window sits on a map that keeps re-centring itself. Retaking either needs a
   person at the controls again.

5. **`sections/02-llamada.yaml` was rewritten against develop `465f5eb9`
   (2026-09-29) and verified there on 2026-09-30.** From `58e2cc4d`, the same
   range as Home. The owner asked for a full update and authorized a complete
   rewrite. The per-submodule audit is in engram,
   `bridge-manual/llamada-drift-audit-2026-09-29`.

   What decided the new shape, all from the code:
   - Ending a call always goes to Home (`pages/dashboard.tsx` `onCallEnded`,
     #192). The call view's own wrap-up, the Información del Incidente panel
     and "Enviar a la agencia" are dead code, so none of it is documented.
     This is consistent with Post-Llamada being documented in Home (#4).
   - `call-view.tsx:591` DOES read `agencyType` now, through
     `HOME_LAYOUT_RULES`, to drop Cámaras and Fuerzas de Respuesta. RECEPTION
     gets both, so under this manual's RECEPTION scope nothing is conditioned.
     The old finding "`call-view.tsx` carries NO divergence signal" (above) is
     no longer true.
   - Four `pending` entries, by the standing policy: Libro del Caso step 2
     demo cards, step 3 demo resources, Flow AI identity edits that are not
     saved, and the log drawer's comments, which live only in a client-side
     store.

   **The rewrite's product news, declared by the owner (2026-09-29)**, split as
   for Home: the rewrite is committed as `cambio`, and the lines below reach a
   `nuevo` and a `retirado` trailer.
   - Nuevo: the call controls in the map window with the video-link send and
     resend, the five-step Flujo de la llamada, caller-language translation,
     the agent directory and external agent link, the recommendation markers,
     chat and state advance on the route card, and the case log drawer.
   - Retirado: closing the case inside the call view (it now happens in
     Home), the Resumen IA strip, the case log on the map, Copiar dirección,
     Flow AI's Resumen / Resolución tabs, and the Agencia field on the route
     card.

   **Settled since** (2026-09-30): the Log and Flow AI figures were cropped
   above the comment composer and the identity block, which the text
   withholds. The 22 orphaned Llamada deliveries were deleted at the owner's
   request. The owner saw the drift addressed, and `verified` stamped the
   module at `465f5eb9`.

   **Still open (the owner decides each):**
   - Confirmed on the 2026-09-29 test call: the Cámaras panel header reads
     `Camaras`, not `CCTV`. The app reflows the whole dock on its own when
     panels open, so every capture is measured and shot in one atomic step.
     The camera window closes when the map is zoomed and falls off screen by
     default, so it needs the owner at the controls, as in Home.
   - Llamada's images were shot over three test calls (2026-09-29/30), and
     every Llamada slot is now delivered. The Resumen AI button and the
     recommended-force ring were cropped from those captures, because no
     product file could answer them. What the harder slots needed, for any
     retake:
     nearby units are matched by force type, so the forces figures needed a
     traffic incident with a traffic unit active on Bridge Mobile nearby.
     Text-to-speech stays "En cola" while autoplay is on, so the replay
     control needs autoplay turned off first. The caller language only sticks
     once the video session exists.
   - Claims still to confirm on a live call: the translated text being read aloud
     in the call; Aparcar llamada returning to Home without Post-Llamada; the
     video panel growing to half the dock.
   - Four catalogue strings in voseo or `tú` (`calls.json:338`, `:379`,
     `:522`, `agents.json:136`) are described rather than quoted.

6. **`sections/03-seatmap.yaml` was rewritten against develop `465f5eb9`
   (2026-09-30) and verified there the same day.** From `58e2cc4d`, the same range as Home
   and Llamada. The owner asked for a meticulous full update and authorized
   a complete rewrite. The audit is in engram,
   `bridge-manual/seatmap-drift-audit-2026-09-30`.

   What decided the new shape, all from the code:
   - The axis stands as it was: `canViewAllAgencies` (`view.sitemap.all`),
     now on the shared `has-permission.ts`. The conditioning grew from 7
     `when`s to 10. The category ring is disabled without the permission
     (`useCategoryStats(canViewAll)`, #275), so its text and the Agencias
     card table and pager are per-target. The "agency could not load" notice
     was dropped because it is unreachable: without the permission,
     `agencyId` IS `user.agencyId` (`sitemap-view.tsx:53-55`, :111-118).
   - `canManageSitemapLayout` and the new sidebar gate `view.sitemap` (#217)
     stay prose, as before.
   - Seatmap has no zones. The plan is a free grid of workstation cards, and
     "zonas" is gone from the manual.
   - Two claims were dropped because the client cannot prove them: that a
     layout change applies to every user of the agency, and that the category
     ring is scoped to the selected agency. The category request carries no
     agency id. The marquee colour is described only "según el tipo", because
     it is derived from a regex over the type label.
   - Figures shot with the permission cannot be shared. The indicator and
     monitor figures now live under `todas-las-agencias/`, and
     `agencia-propia` needs its own capture of the plan, the indicators and
     the monitor, from an account without `view.sitemap.all`.

   **The rewrite's product news, declared by the owner (2026-09-30)**, split
   as for Home and Llamada: the rewrite is committed as `cambio`, and the line
   below reaches a `nuevo` trailer. Nothing was retired.
   - Nuevo: the "Nuevos incidentes" band at the top of Seatmap, and the
     "En espera" state in the indicators, the operator monitor and the
     workstation card.

   **Settled since** (2026-09-30): the orphaned zones image and its recipe
   were deleted. Every `todas-las-agencias` figure was captured, and that
   target is complete. Tried on the console, at the owner's request: a swap
   happens outside edit mode too, and saves. It is now documented in the
   callout `seatmap.distribucion.reubicar.fuera-edicion`. A move to a free
   cell needs edit mode.

   What the captures taught, for any retake:
   - The grid caps chairs by container height (`gridCapacity`,
     `sitemap-zone-grid.tsx:182-193`). At 1920x1009, 23 chairs already hit
     the cap, so "Agregar silla" could only be shot with the viewport
     enlarged (CDP `Emulation.setDeviceMetricsOverride`). The same trick
     fits the whole indicators column, which is 980 px tall.
   - Delete and add were shot by deleting one empty desk, adding it back and
     dragging it to its cell. Always compare the plan with a shot taken
     before.

   The four `agencia-propia` figures were shot from a `ROL_INTEGRAL` account
   without `view.sitemap.all`, so every image slot in the manual is now
   delivered. How to recognise the right account is in this folder's
   `AGENTS.md`.

   - **Accepted by the owner (2026-09-30):** the `agencia-propia` overview
     `seatmap.fig` shows the untranslated role key `userRoles.ROL_INTEGRAL`
     in the top bar, because the es catalogue lacks that role. It stays as
     is. The product is still changing, so the figure is expected to be
     retaken anyway.

   The owner saw the drift addressed, and `verified` stamped the module at
   `465f5eb9`. Nothing about Seatmap is open.

*(An earlier pair of questions numbered 4 and 5, not the ones above, were the two per-section forms of one question. It has been
answered — see the last entry under Decided — and the two gaps they described are
now declared, not narrated. They live in `awaiting-product.json`, which is
derivable and therefore not restated here.)*

## Next section

**None — the seven the product's rail offers are written.** What comes next is a
scope decision, not an authoring one. Three candidates, in the order I would
raise them:

1. **The two declared gaps close** — Dashboard's Historial de Eventos and Bridge
   of Things' DASHBOARD panel, both waiting on the product. Run
   `awaiting bridge-manual`. Nothing else can finish those two modules.
2. **PMV and CCTV split out of Bridge of Things.** `05-` documents both at
   workflow depth, which satisfies `module-completeness`, but PMV alone has
   eighteen components and CCTV's mosaic, PTZ and preset machinery runs to some
   two thousand lines. A scope decision, not a defect.
3. **The images: 30 of 181 delivered, and extraction is EXHAUSTED.** Every icon
   the product renders from a file or from module geometry has been taken — see
   `AGENTS.md` in this folder for what was delivered, what could not be, and why.
   The 151 still pending are all `figure` convention: screens, panels and
   populated lists that need the app running against real data. **That is the
   capture team's work and nothing in the source repository can shorten it.**

   The manual still reads as finished text over placeholders on most pages, and
   that remains the largest single thing between it and a document a client can
   use. What changed is that the part a machine could do is done.

The three checks, all of which have now caught something real:

- **Divergence signals.** `grep` for `agencyType`, `permissions`, `can[A-Z]`,
  `role`, `agencyId`. Four views have come back clean; Home did not.
- **Whether the data is real.** `grep` for `MOCK`, and read the mapping between
  the query and what is rendered — Dashboard's defects were in the mapping, and
  BoT's whole landing panel had no query at all. Also look for English
  placeholder copy: `"This is the … panel."` is what gave BoT away.
- **Labels before names.** Never invent a name for a control without checking
  the source for one first.

And verify every line citation by printing the cited line back. This section had
four wrong on first write, including one — `Preset home` — where checking the
citation also corrected the DESCRIPTION: it goes to the camera's first saved
preset and is unavailable with none saved (`cctv-mosaic.tsx:298-301`), not to
some factory position. Verifying citations is not clerical; it catches content
errors.

Also worth flagging for scope: **PMV and CCTV are each large enough to justify
their own section** if field-level depth is ever wanted. `05-` documents both at
workflow depth — what they do, how to reach them, their main controls and their
procedures — which satisfies `module-completeness`, but PMV alone has eighteen
components and CCTV's mosaic, PTZ and preset machinery runs to some two thousand
lines. Splitting them is a scope decision, not an authoring one.

Unchanged: `create-incident` will need care. Two comments there name deployments
(`create-incident.ts:183`, `create-incident.schema.ts:51`) and neither is a gate.

**The module inventory above is no longer a proposal: all seven are written.**
Home, Llamada, Seatmap, Dashboard, Bridge of Things, Fuerzas en Campo and Crear
Incidente. Dashboard and Bridge of Things each carry a declared gap, so neither
is complete by the `module-completeness` standard — run `awaiting bridge-manual`.
No scope beyond those seven has been agreed, and the product's rail offers no
eighth.

Two findings from Fuerzas en Campo worth carrying forward:

- **A `procedure` step title is an INSTRUCTION, not a label.** This manual's
  convention throughout is "Haga clic en Editar", "Guarde el informe" — the
  control's name embedded in the instruction. Writing the bare control name as
  the title breaks that convention, and `LabelPolicy` declares no label prop for
  `procedure` precisely because of it. A control worth citing goes in a
  `field-list` beside the procedure, which is what Asignación de Incidentes does.
- **Read the block's schema before using a prop value.** `callout.variant` is
  `info | important` and nothing else — a closed set, by design. Two invented
  values (`note`, `warning`) failed the build twice before this was checked.
