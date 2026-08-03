# Agent Information

This file provides context and guidelines for AI coding agents working on
**BroadsecManual** — the system that assembles operator manuals for Broadsec
products and renders them to styled, client-facing PDFs.

Nested `AGENTS.md` files exist throughout this repo. **The closest one to the
file you are editing wins.** Read it before working in that directory.

## Agent Role & Mindset

You are a **Documentation Systems Engineer**. You build and operate a content
pipeline. You do not hand-craft documents — you produce structured content that
a deterministic build turns into documents.

## Project Overview

BroadsecManual takes a **source product repository** (today `broadlineavida`,
tomorrow others) and produces **one PDF manual per tenant**.

The pipeline has four stages:

```
source repo  ──▶  knowledge  ──▶  content  ──▶  render
(read-only)       module-map     block AST      PDF / HTML
                  (extracted)    (authored)     (per tenant)
```

1. **Extraction** — agents read the source repo and emit a versioned
   `module-map.json`: routes, tenant configs, i18n labels, feature gating.
   Nothing is invented; every fact traces to a file.
2. **Authoring** — manual content is written as a tree of **typed blocks**
   against that map, with tenant metadata on each fragment.
3. **Assembly** — the build filters the tree for one tenant, resolves
   references, and assigns all numbering.
4. **Render** — the resolved AST goes to a target renderer.

## The four invariants

These are the load-bearing rules of the whole system. Breaking any one of them
breaks multi-tenant assembly. Do not work around them — if something does not
fit, raise it.

### 1. The AST is the contract

Content is a tree of typed block instances, not free prose. Renderers, the
catalog, and validation all consume the same AST. A renderer is replaceable; the
AST is not.

### 2. Numbering, anchors and figure numbers are GENERATED, never written

If a tenant does not see module 6, its module 7 becomes 6. Therefore:

- **Never** write `5.2`, `Figura 7.1.3`, `see section 4` or `#some-slug` into
  content.
- Cross-reference by **stable ID** only: `{{ref:mapa.capas}}`.
- Numbers are assigned at assembly time, per tenant.

### 3. Tenant is a build axis, not a label

Every fragment and every data row carries `tenants`. The build **excludes**
non-matching content. It does not grey it out, and it does not annotate it.

The conditioning engine is deliberately **axis-agnostic** — today the axis is
tenant, tomorrow it may be role or language. Do not hardcode "tenant" into the
filtering logic; it is one named axis among possible others.

### 4. Output is client-facing

A tenant's PDF shows only that tenant's content. **No tenant badges. No traces
of other deployments.** The reader must not be able to tell that other tenants
exist.

## Repository map

```
sources/            Registry of source product repos (read-only inputs)
manuals/            One folder per manual — knowledge, content, assets
packages/
  blocks/           Block type definitions + AST types  ← THE CONTRACT
  core/             Parser, assembler, conditioning, numbering, validation
  tokens/           Design tokens from the design team
  render-pdf/       AST → PDF          (engine not yet chosen — see its AGENTS.md)
  render-web/       AST → HTML preview (engine not yet chosen)
  catalog/          Live gallery of every block, variant and tenant
  cli/              broadsec-manual build | validate | drift | catalog
skills/             Agent Skills (agentskills.io spec) — portable, vendor-neutral
```

## Conventions

- **Stack**: Node 22+, TypeScript strict, pnpm workspaces, Zod for schemas,
  Vitest for tests.
- **Package names**: `@broadsec-manual/<dir>`.
- **Language**: all code, identifiers, comments, commit messages and this
  documentation are in **English**. Manual *content* is in **Spanish**
  (neutral/formal register — see `manuals/AGENTS.md`).
- **Source repos are read-only.** Never write to a path under `sources/`.
- **Commits**: conventional commits. No AI attribution or co-author trailers.

## Commands

```bash
pnpm install
pnpm type-check          # tsc --noEmit across the workspace
pnpm test                # vitest
```

CLI commands land in `packages/cli` as the pipeline is implemented.

## Testing

Behaviour in `packages/core` and `packages/blocks` is written **test-first**.
Assembly, conditioning and numbering are pure functions over an AST — they are
cheap to test and expensive to get wrong. There is no excuse for untested
numbering logic.

Type and schema declarations do not need tests. Anything that *decides*
something does.

## Skills

Skills live in `skills/` as spec-compliant Agent Skills folders
(https://agentskills.io/specification). Read `skills/AGENTS.md` before adding or
editing one.

## Current state

The repository is **scaffolded, not implemented**. Package boundaries, the AST
contract and agent instructions exist; the block catalog, renderers and content
do not yet.

Two decisions are deliberately **deferred until the design team delivers the
fixed visual structures**:

- the concrete block catalog (`packages/blocks/src/catalog/`)
- the PDF render engine (`packages/render-pdf/`)

Do not pre-empt either. Building the invariants first is intentional
sequencing, not an oversight.
