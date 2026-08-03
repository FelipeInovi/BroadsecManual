---
name: source-extraction
description: Extracts a module map from a Broadsec product repository — modules, screens, routes, tenant registry, per-element tenant gating, and UI labels from the i18n catalogue — into knowledge/module-map.json with file-and-line provenance for every fact. Use when onboarding a new source product, regenerating a module map, investigating how tenants differ in the product, or checking a manual for drift against the code it documents.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
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
   manual quotes what the screen actually renders.
5. **Uncertainty is recorded, not resolved.** Emit `confidence: "low"` with a
   note. A confident wrong fact is far worse than a flagged unknown.

## Procedure

### 1. Read the registry

`sources/registry.yaml` gives the path and the extraction points for this
product. Paths differ per product — do not carry assumptions between them.

### 2. Build the tenant registry

One config file per tenant (for `broadlineavida`,
`src/render/config/*.config.ts`). This is authoritative: the tenants are exactly
these, no more.

### 3. Map routes and screens

Collect route path, component, lazy entry, and any route-level gating.

### 4. Find element-level tenant gating — the part that matters

This is where most divergence lives and where extraction usually fails.

Route gating is the visible tip. The real differences are inline comparisons
against the active tenant config scattered through components: a map layer, a
filter option, a report column, a header action.

Search for every comparison against the active tenant — direct config name
comparisons, membership checks, tenant-keyed lookups — and record, for each:

- the screen and the element affected
- the tenants for which it is present
- file and line

**An extraction that only reports route gating will claim every tenant sees
everything.** That is the failure this whole system exists to prevent.

### 5. Collect UI labels

Index the i18n keys used by each screen so content can reference labels by key.

### 6. Emit and diff

Write `manuals/<manual>/knowledge/module-map.json`. If a previous map exists,
diff it and report:

- **added** — new modules or elements, likely undocumented
- **removed** — content documenting something gone
- **gating changed** — tenant tagging in content may now be wrong

The diff is the drift report. It is the point of regenerating the map.

## Output shape

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
          "confidence": "high"
        }
      ]
    }
  ]
}
```

## Verify before handing off

- Every tenant in the map has a config file behind it.
- No element claims `["all"]` while its source line shows a comparison.
- Every `i18nKey` resolves in the catalogue.
- Every fact has a `source`.

A map nobody reviewed is a set of confident claims nobody verified.
