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
- **Labels are quotations, not references.** The product has no i18n catalogue,
  so each label in content records the component and line it was copied from.
  `uiLabel` blocks cannot be used against this source.

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
  `src/modules/dashboard/presentation/ui/views/sitemap-view.tsx:36-37`.
- **Screens are not routes.** `wouter` declares five routes and one is the whole
  application (`src/app/App.tsx:126-138`). The operator moves between seven
  views in `src/modules/dashboard/presentation/ui/views/`. Screen mapping follows
  the view switch, not the router.

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
3. **Which agency type Home describes.** Home cannot be written honestly
   without this. The `module-completeness` rule is that every submodule the
   product offers is covered or its absence is justified, and everything Home
   does once a case is selected varies by `agencyType` — a section covering only
   the invariant core (map, docked panel grid, "Revisión de Llamadas",
   "Teclado", map tools, new-case notice) would leave the reader concluding the
   case workflow does not matter, which is the broken-module case that rule
   names. Three ways out, none of them an authoring detail:
   scope the manual to one agency type; add `agency-type` as a second axis;
   or document the union and accept that every reader sees panels they do not
   have. **What settles it:** the owner. A second axis also needs a pipeline
   decision — `primaryAxis` refuses more than one and says so
   (`packages/cli/src/main.ts:463-469`): "one filename and one figure set need a
   single value … raise it rather than working around it."

2. **No extractor for Bridge — and this does not block authoring.** The
   `framework` dispatch in `packages/extract` is still inert, so there is no map
   and no drift report. `extract bridge-manual` refusing is the CORRECT state,
   not a wait: the `react-tauri-ts` extractor is a pipeline piece and is not
   scheduled. Do not hand-write `knowledge/`, and do not hold a section for it —
   author against the source read directly, citing file and line, as Seatmap
   does. **What settles it:** building that extractor, whose first job is not
   tenants but permission gates.

## Next section

**`home`, as the first section** — the operator's entry view, owner's
decision. `01-` is reserved for it and Seatmap was renamed to `02-seatmap.yaml`
(rename only; ids are stable, so no content changed and both targets still
build). **Not written yet: blocked on question 3 below**, which was found while
reading the view and is not a detail an author can decide.

**Question 1 does not block the other six views.** An earlier note
here claimed every remaining view has at least one permission-gated control;
that is false. `grep` for the two predicates across the whole source finds
exactly two call sites, both in
`src/modules/dashboard/presentation/ui/views/sitemap-view.tsx:36-37`. The other
six views — `home`, `call`, `dashboard`, `bridge-of-things`, `forces-in-field`,
`create-incident` — read no permission at all, so their content is
unconditioned: identical in both targets, with no `when` to guess at.

Two things a next section needs decided first, neither of them question 1:

- **Which view**, from the still-unagreed inventory above.
- **Where it sits in the document.** Sections are ordered by filename
  (`packages/cli/src/main.ts:132-135`), and Seatmap holds `01-`. A view that
  belongs before it needs either a lower prefix or a renumber — a renumber
  touches an existing section, so it is a decision, not a detail.
