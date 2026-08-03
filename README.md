# BroadsecManual

Assembles operator manuals for Broadsec products and renders them to styled,
client-facing PDFs — one per tenant, from a single source of content.

```
source repo  ──▶  knowledge  ──▶  content  ──▶  render
(read-only)       module-map     block AST      PDF / HTML
                  (extracted)    (authored)     (per tenant)
```

## Why

A Broadsec product is multi-tenant, and tenants differ *inside* shared screens —
a map layer only MV sees, a filter only MED has, a report column specific to
AMVA. A single packed document cannot serve them. Here, content is authored once
as tenant-tagged typed blocks, and each tenant's manual is assembled from it.

## Layout

| Path | Purpose |
|---|---|
| `sources/` | Registry of source product repositories (read-only) |
| `manuals/` | One folder per manual: extracted knowledge, content, assets |
| `packages/blocks` | Block type definitions and AST types — the contract |
| `packages/core` | Parser, assembler, conditioning, numbering, validation |
| `packages/tokens` | Design tokens |
| `packages/render-pdf` | AST → PDF |
| `packages/render-web` | AST → HTML preview |
| `packages/catalog` | Live gallery of every block, variant and tenant |
| `packages/cli` | `broadsec-manual` command line |
| `skills/` | Agent Skills used to operate the pipeline |

## Getting started

```bash
pnpm install
pnpm type-check
pnpm test
```

Skills live in `skills/` and are agent-agnostic. To let your coding agent
discover them, link that folder into its skills directory — see
`skills/AGENTS.md`. The link is local and gitignored.

## Status

Scaffolded. The block catalog and the PDF render engine are intentionally
deferred until the design team delivers the fixed visual structures.

Agent instructions live in `AGENTS.md` files throughout the repo — the closest
one to a file takes precedence.
