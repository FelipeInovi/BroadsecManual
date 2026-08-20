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
2. **No extractor for Bridge.** The `framework` dispatch in
   `packages/extract` is still inert, so there is no map and no drift report. Do
   not hand-write `knowledge/`. **What settles it:** building the
   `react-tauri-ts` extractor, whose first job is not tenants but permission
   gates.
3. **Observed and deliberately not taken:** `image-requests.json` prints its
   per-value override template as `<tenant>/<slot>.png`
   (`packages/cli/src/main.ts:253`), which names the wrong folder for a manual
   whose axis is not `tenant`. It bites nobody today — all fourteen slots here
   are shared `_common` deliveries — and it is a change to the manifest contract
   another team consumes, so it was left alone rather than fixed in passing.

## Next section

None chosen. Pick from the proposed inventory above once question 1 is settled:
the answer changes how any screen with a permission-gated control is tagged, and
every remaining view has at least one.
