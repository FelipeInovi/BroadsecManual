---
name: source-extraction
description: Extracts a module map from a Broadsec product repository — modules, screens, routes, tenant registry, per-element tenant gating, and UI labels from the i18n catalogue — into knowledge/module-map.json with file-and-line provenance for every fact. Use when onboarding a new source product, regenerating a module map, investigating how tenants differ in the product, or checking a manual for drift against the code it documents.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.1"
---

# Extracting a module map from a source product

The module map is the **only** bridge between product code and manual content.
Content is written against the map, never against source code read ad hoc. If a
fact is not in the map, it does not go in the manual — you add it to the map
first.

## Hard rules

1. **Read-only.** Never write anything inside the source repository. No fixes,
   no formatting, no installs.
2. **Provenance or it does not exist.** Every fact carries the file and line it
   came from. A fact you cannot point at is a guess.
3. **Never infer gating from a screen name.** `ReportsPage` tells you nothing
   about who sees it. Only code decides.
4. **Never retype a UI label.** Pull it from the i18n catalogue by key, so the
   manual quotes what the screen actually renders. If a product has no
   catalogue and renders literals, say so in the map and record the file and
   line of each literal — the label is then a quotation, not a reference, and
   the manual will not follow the product when it changes.
5. **Uncertainty is recorded, not resolved.** Emit `confidence: "low"` with a
   note. A confident wrong fact is far worse than a flagged unknown.
6. **Every shape below is one product's shape.** The examples in this skill are
   drawn from `broadlineavida`. They are here because a concrete shape is
   teachable and an abstract one is not — never because the next product will
   match them. Establish this product's shape first (step 1); each step then
   tells you what to look for once you know what you are looking at.

## Procedure

### 1. Establish the product's shape, then read the registry

`sources/registry.yaml` gives the path and the extraction points for this
product. Paths differ per product — do not carry assumptions between them. For a
product not yet in the registry, see `sources/AGENTS.md`: the entry is written
after this survey, not before it.

Answer these before running any step below. Each one decides whether the step
that assumes it applies at all:

| Question                                         | If the answer is not the expected shape                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Is it multi-tenant, and how is tenancy resolved? | Steps 2 and 4 change target, or drop entirely for a single-tenant product                                 |
| Is there an i18n catalogue?                      | Step 5 changes: labels become quoted literals with provenance (hard rule 4)                               |
| Are there declared routes?                       | Step 3 changes: without a router, map screens by entry point instead                                      |
| Does `packages/extract` handle this shape?       | See `packages/extract/AGENTS.md`. If not, extraction is manual for this product until an extractor exists |

Record the answers. They are findings, and the reviewer of the map needs them to
judge what the map does not say.

### 2. Build the tenant registry

Find the authoritative list of deployments: whatever the product treats as the
complete set, the map treats as the complete set — exactly those, no more.

_In `broadlineavida` that is one config file per tenant, under
`src/render/config/`, and the id comes from the filename._ Another product may
resolve tenancy by subdomain, by an environment variable, by a table. Find where
the product itself enumerates them; if nothing does, that is a
`confidence: "low"` finding, not a gap to fill by guessing.

### 3. Map routes and screens

Collect route path, component, lazy entry, and any route-level gating.

_This assumes declared routes, as in `broadlineavida`'s `AppRoutes.tsx`._ A
product without a router still has screens — map them by whatever does decide
what the user sees, and record which mechanism that was.

### 4. Find element-level tenant gating — the part that matters

**The general rule: find where divergence actually lives in THIS product, and do
not stop at the first mechanism you find.** Products rarely gate in one place,
and the visible mechanism is rarely the one carrying most of the difference.

_In `broadlineavida`, route gating is the visible tip — exactly one route uses
it. The real differences are inline comparisons against the active tenant config
scattered through components: a map layer, a filter option, a report column, a
header action._ Elsewhere the weight may sit in route gating alone, in
server-driven feature flags, in per-tenant themes or config payloads, or in
roles rather than deployments.

So: identify every mechanism the product uses to show one user something another
does not see, then search each. For `broadlineavida` that means direct config
name comparisons, membership checks and tenant-keyed lookups. Record, for each
finding:

- the screen and the element affected
- the tenants for which it is present
- file and line
- which mechanism it came from

**An extraction that reports only the mechanism it noticed first will claim every
tenant sees everything.** That is the failure this whole system exists to
prevent, and it is silent: the map parses, the build succeeds, and the manual
tells four deployments about a screen one of them has.

### 5. Collect UI labels

Index the i18n keys used by each screen so content can reference labels by key.

_This assumes a catalogue, as in `broadlineavida`'s
`locales/translations/es.json`._ Without one, follow hard rule 4: record each
label as a literal with its file and line, and flag in the map that labels here
are quotations. That distinction matters downstream — a keyed label follows the
product when it changes, a quoted one does not.

### 6. Emit and diff

Write `manuals/<manual>/knowledge/module-map.json`. If a previous map exists,
diff it and report:

- **added** — new modules or elements, likely undocumented
- **removed** — content documenting something gone
- **gating changed** — tenant tagging in content may now be wrong

The diff is the drift report. It is the point of regenerating the map.

## Output shape

The keys are the contract; the values below are `broadlineavida`'s. `kind`,
`i18nKey` and the tenant ids are that product's vocabulary — a product with no
map layers has no `"kind": "map-layer"`, and one with no catalogue carries a
literal label plus its source instead of an `i18nKey`.

```jsonc
{
  "source": "broadlineavida",
  "extractedAt": "<iso-8601>",
  "tenants": [{ "id": "mv", "code": "MV", "source": "src/…/mv.config.ts:2" }],
  "modules": [
    {
      "id": "mapa",
      "screen": "…",
      "route": "/…",
      "tenants": ["all"],
      "source": "src/…/AppRoutes.tsx:120",
      "elements": [
        {
          "id": "mapa.capas.semaforos",
          "kind": "map-layer",
          "label": { "i18nKey": "map.layers.traffic_lights" },
          "tenants": ["mv"],
          "source": "src/…/LayersMap.tsx:98",
          "confidence": "high",
        },
      ],
    },
  ],
}
```

## Verify before handing off

- Every tenant in the map traces to wherever this product enumerates
  deployments — a config file in `broadlineavida`, whatever step 1 established
  elsewhere.
- No element claims `["all"]` while its source line shows a comparison.
- Every `i18nKey` resolves in the catalogue; every quoted literal has a file and
  line.
- Every fact has a `source`.
- **Every mechanism found in step 1 was actually searched in step 4.** Finding a
  second gating mechanism and searching only the first is how a map ends up
  confidently wrong.
- The step 1 answers are recorded, including what could not be determined.

A map nobody reviewed is a set of confident claims nobody verified.
