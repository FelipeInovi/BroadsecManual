# Exploration — `manual-update-flow`

Driving the wizard's "Actualizar un manual" step from product drift instead of a
free-text guess.

- **Phase**: `explore`
- **Artifact store**: hybrid (this file + engram `sdd/manual-update-flow/explore`)
- **Product under study**: `broadlineavida` @ `develop` `25b7ce94`
- **Status**: ready for proposal, with one required caveat (see *Scope boundary*)

## Current state

### Drift today (`packages/cli/src/extract.ts`)

`extract(repoRoot, manualId)` (extract.ts:321) reads the source product, builds a
fresh `ModuleMap`, and — if `manuals/<manual>/knowledge/module-map.json` already
exists — diffs the fresh map against whatever is on disk
(extract.ts:405-408, `existsSync(outPath) ? diffMaps(...) : []`).

"The previous map" is literally the file at that path at the moment `extract`
runs. There is no baseline pointer, no commit reference, nothing but "whatever is
currently checked out at that path".

`diffMaps` (extract.ts:192-256) compares three things, each keyed by a stable
identifier and **never by line number**:

| What | Keyed by | Where |
| --- | --- | --- |
| Axis values | `id` | extract.ts:210-212 |
| Capability flags | `flag` name (a symbol, e.g. `canViewFilterTrafficDetails`) | extract.ts:214-232 |
| Gates | `gateKey = file\|codes.join(",")\|kind` | extract.ts:151 |

The comment at extract.ts:143-150 states the reason: "never its line, never its
text… Keying on position would report every gate below an added import." Drift is
therefore already robust to the +1 line-shift hazard measured on this manual.

**But gate identity is coarse.** Two distinct inline gates in the same file, same
codes, same kind collapse into one bucket, distinguished only by a polarity count
(`gates()` extract.ts:166-175, `summarise` extract.ts:159-164) — e.g. "positive
x2, now positive x3". Drift can say a file's gate count for a tenant changed; it
cannot say which line, nor point at a specific manual passage.

**What drift cannot detect at all**: modules, elements, routes, screens, UI
labels. None are emitted. `ModuleMap` carries only `source, axis, values,
capabilities, references, registryMismatch` (extract.ts:77-91).
`skills/source-extraction/SKILL.md:182` confirms: "Modules and elements are not
compared, because they are not emitted." Steps 3 (routes/screens) and 5 (UI
labels) are "specified here and not implemented" (SKILL.md:41-49).

### "Module" has no mechanical definition anywhere in this codebase

`packages/blocks/src/ast.ts:52-69` defines exactly two node kinds: `SectionNode`
and `BlockNode`. There is no `kind: "module"`. Nothing distinguishes a top-level
`sections/07-interfaz-general.yaml` from a nested `id: mapa` three levels in —
both are `SectionNode`s.

`manuals/AGENTS.md:49-52` says it outright: "Nothing in this repository declares a
manual's full module list — the map emits tenants, capabilities and deployment
references, never a list of modules — so an agreed scope exists only if it was
written down [in ESTADO.md]."

`module-completeness/SKILL.md:26` confirms the fallback: "list the submodules from
`knowledge/module-map.json` (or, until the map exists, from the product's own
navigation)" — i.e. today, always the second branch, by hand.

Mechanically, the closest unit the wizard could name is **one `sections/*.yaml`
file** (10 today), itself a human-chosen chapter grouping containing several
`SectionNode`s a person would call modules (`mapa`, `barra-superior`, `incidentes`
inside `07-interfaz-general.yaml`). `manual.config.yaml` declares axes and
targets, never a section or module list.

### The drift→module join cannot be computed today

The only structured, validated citation mechanism is `labels:` — a section-level
YAML list parsed by `packages/core/src/load.ts:437` (`parseLabels`), each entry
requiring `at` (a node/item id), optional `prop`, and `from: <file>:<line>`
(load.ts:414-426, format enforced). It exists **only** to check UI-label text
against the product's source (`packages/cli/src/labels.ts`, `checkLabels` /
`labelReport`) via `LabelPolicy` (`packages/core/src/labels.ts`). It has nothing
to do with capability flags or gates and cannot answer "which section does
capability X affect".

Everywhere else, source-to-content provenance is a YAML **comment** above a
`when:` row — e.g. `07-interfaz-general.yaml:111-112`,
`# LayersMap.tsx:76 — the entry only exists when config.name === "MV" || config.name === "DEMO"`.
Comments are not parsed by `load.ts`, not part of the AST, not machine-readable.

Coverage, verified by grep:

| Section file | Source citations | `when:` tags |
| --- | --- | --- |
| `07-interfaz-general.yaml` | 4 (all `LayersMap.tsx`) | 4 |
| `12-broadsec-of-things.yaml` | 3 (`AppRoutes.tsx:202-214`, `:207`, `:205-206`) | 1 |
| `13-historial-de-cambios.yaml` | 0 | 1 |
| the other seven | 0 | 0 |

Six functioning `when:` tags in the whole manual. Two of ten section files carry
any citation at all.

So the join has exactly one load-bearing mechanism (`labels:`, and it is the wrong
one — scoped to label text) plus a human-readable-only comment convention covering
20% of sections. An "informed module picker" cannot be built honestly on this. It
would need either:

- **(a)** a new structured citation field generalizing `labels:` to capability and
  gate provenance — a `block-authoring`-style "request a new prop", since the
  schema is Zod-validated and closed; or
- **(b)** a heuristic filename-grep over YAML comments — unreliable, and covering
  only 20% of sections today.

Building (a) is itself a content-provenance change: the very thing out of scope.

### How the wizard composes a flow (`packages/cli/src/wizard.ts`)

The main menu (wizard.ts:707-749) already routes an `"update"` action to
`updateFlow` (wizard.ts:1731-1762), which asks three things:

1. which manual — `select` + `describeState`
2. what to do — `askParagraph`, a multi-line free-text reader (wizard.ts:1607-1628)
3. `handOff` writes `.broadsec-manual/actualizar-<id>.md` and optionally launches
   an agent CLI

`assembleUpdatePrompt(s: ManualState, instruction: string)` (wizard.ts:1651-1719)
builds the prompt: Step 0 is a mandatory engram recall including a `needs_review`
caveat (wizard.ts:1662-1668); the instruction is quoted verbatim inside a fenced
block (wizard.ts:1677-1679); then derived `ManualState` facts; then two
non-negotiable rules (the version never moves on its own; never rewrite an
existing section); then stop-on-conflict; then a close-out reminder (ESTADO.md +
engram).

**Crucially**: `assembleUpdatePrompt` takes the whole `instruction` as one opaque
string. There is no `scope` parameter. `SCOPES` (wizard.ts:86-108,
`spike | module | full`) is entirely a creation-path concept, consumed only by
`assemblePrompt` (wizard.ts:349-419) and `SCOPE_INSTRUCTIONS` (wizard.ts:318-331).
`updateFlow` never references `Scope`, `SCOPES` or `SCOPE_INSTRUCTIONS` — verified
by grep. Today's "update a specific module" lives entirely inside the free-text
paragraph the operator types; nothing structural exists yet to extend.

`select` (wizard.ts:635-656) is a numbered menu over `{ label, detail?, value }` —
the idiom any new picker step must reuse. `readManualStates` / `describeState`
(wizard.ts:259-316) derive `ManualState` purely from disk (`manual.config.yaml`,
`sections/*.yaml` count, `image-requests.json`, `ESTADO.md` presence). Nothing
there touches the map's contents beyond `existsSync` (wizard.ts:294, `hasMap`).

### Commit-trailer precedent (`Producto:`)

`skills/release-notes/SKILL.md:44-48` documents an existing convention: commits
declare `Producto: nuevo | cambio | sin-cambio`, read via
`git log --format='...%(trailers:key=Producto,valueonly)'` (SKILL.md:53).

**Verified: zero code in `packages/` parses this trailer.** It appears only in the
skill file, inside a prompt string built for an agent (wizard.ts:1185-1189, which
references the skill rather than parsing the trailer), in its own test, and in
`manuals/AGENTS.md`. There is no parser, no schema, no CLI command that reads or
validates it programmatically. It is a documented human/agent convention, never
machine-consumed.

This is the closest analogue to Design A below: the repo does tolerate
trailer-based bookkeeping for a comparable problem, but every existing consumer is
an LLM agent reading `git log` text, not code.

## Affected areas

| Path | Why |
| --- | --- |
| `packages/cli/src/wizard.ts:751-762, 1607-1762` | `updateFlow` / `assembleUpdatePrompt` / `askParagraph`; any structured scope step lands here, with `SCOPES` (86-108) as prior art |
| `packages/cli/src/extract.ts:1-416` | `extract`, `diffMaps`, `ModuleMap`, `PreviousMap`, `normalizeMap`; a baseline reads/writes state adjacent to this output |
| `manuals/<manual>/knowledge/module-map.json` | the artifact any baseline keys off; has no `generatedAt`/`sourceCommit`, and a timestamp is explicitly forbidden (extract.ts:411-412, source-extraction/SKILL.md:197-199) |
| `packages/core/src/load.ts:429-538`, `packages/core/src/labels.ts` | the one existing structured citation mechanism; nearest precedent for a general capability/gate citation prop (out of scope here) |
| `packages/cli/src/wizard.test.ts:1091-1180`, `packages/cli/src/extract.test.ts` | existing coverage for `assembleUpdatePrompt` and `diffMaps`/`extract`/`normalizeMap`; new tests land beside these |
| `sources/registry.yaml`, `skills/release-notes/SKILL.md` | precedent and mechanism for the `Producto:` trailer, relevant only as design comparison |

## Approaches — the per-module baseline

### A — Commit trailers (owner's proposal)

Each update commit carries a trailer keyed to the module (or the whole manual) it
updated. "Update module X" means walking `git log` backwards for the first commit
keyed to X or to the whole manual.

**Pros.** No new artifact to keep in sync with git. Consistent with the existing
`Producto:` precedent. Natural for an agent already comfortable with
`git log --format` / `--trailers`.

**Cons.** Every existing trailer consumer in this repo is an LLM agent reading
text, never code. Building a machine-queryable "since which commit was module X
last verified" on trailers means either routing through an agent every time the
wizard needs an answer — the wizard is a plain Node CLI (wizard.ts:679) with no
agent access of its own — or writing the first programmatic git-trailer parser in
`packages/cli`, which nothing today does. Not robust to squash (silently drops a
module's trailer history), to revert (the trailer says the module was touched, not
that the touch is still true), or to a commit that touches a module incidentally.
Answering "since which product commit" requires walking potentially the whole
history with no index: O(n) per query, growing forever.

**Effort.** Medium-High.

### B — Baseline artifact (`knowledge/baselines.json`)

Per module: `{ productCommit: string | null, verifiedAt: timestamp }`.

**Pros.** O(1) query, no new git parsing. `null` legitimately says "never
verified", matching this codebase's established stance — `PreviousMap.axis`
optionality (extract.ts:101) and `absentFrom` (source-extraction/SKILL.md:26)
already model "record uncertainty rather than assume" as first-class. Still gets
git history for free via `git log -- knowledge/baselines.json`. Survives
rebase/squash because it is a snapshot, not a fact derived from the log.

**Cons.** A second JSON artifact that can drift out of sync with reality — nothing
enforces that a commit which *should* update it actually does. This is the same
trust problem the `pending` / `awaiting-product.json` split already manages by
making export an explicit act (module-completeness/SKILL.md:381, "It is likewise
not build output"). Needs its own writer step, which does not exist yet.

**Effort.** Medium.

### C — Stamp the map itself with per-module baselines

Extend `ModuleMap` with an optional `moduleBaselines` key.

**Pros.** One artifact instead of two, regenerated in the same `extract()` call
that already writes the map (extract.ts:405-413).

**Cons.** Direct conflict with two explicit invariants. `extract` rewrites the
whole map on every run — "a hand-authored key is deleted by the next extraction.
Growing the map means growing the extractor"
(source-extraction/SKILL.md:43-44) — and the map deliberately carries no
timestamp because "the map is regenerated constantly, and a clock would make every
regeneration a diff" (extract.ts:411-412). A per-module baseline is exactly the
kind of fact that must not be silently overwritten by the next run and must not
read as drift when unrelated modules regenerate.

**Effort.** Low to build, but structurally fighting the codebase's stated design.

### Recommendation

**B.** It is the only option that is both queryable without new git-parsing code
and does not fight the map's "always regenerated, no memory" invariant.

**A** should be explicitly rejected as the query mechanism, or demoted to an
informational trailer for human/agent audit. The repo's own `Producto:` precedent
shows trailers here are read by agents, not parsed by code, and this change does
not justify building the CLI's first programmatic git-trailer parser.

**C** should be rejected outright as incompatible with `extract`'s contract.

Note for the proposal: any Design B field must **not** be "when the map was
written" but "which product commit a MODULE was verified against" — a materially
different field with a different write trigger.

## Ordering hazard — map regeneration vs baseline recording

`extract()` always overwrites the map in full on every run (extract.ts:405-413)
and computes drift against whatever was on disk *before* that overwrite
(extract.ts:406-408).

If a baseline is written in the same step as extraction, or by a step that runs
after extraction without checking drift first, the hazard is: recording "module X
verified against commit C" after a regeneration that already silently absorbed
unrelated drift for other modules leaves those other modules' baselines stale
against a map that has moved on, with nothing forcing their re-verification.

The correct ordering — implemented nowhere today — is: run `extract`, surface
drift, let the human or agent decide **per module** whether that drift is
addressed, and only then write that module's baseline entry. Never write baselines
for all modules just because one extraction ran.

## Scope boundary — what tooling cannot honestly build

The owner scoped this change to TOOLING only; content re-grounding of sections
`08`/`09`/`10`/`11` is explicitly out. Given the join finding above, that
constrains the deliverable:

- **An "informed module picker" that maps drift to affected modules automatically
  CANNOT be built** on what exists today. The only structured citation mechanism
  (`labels:`, load.ts:437) is scoped to UI-label text, not capability or gate
  provenance, and the informal comment convention that would carry the link covers
  2 of 10 section files. Building the join is a content-provenance change.
- **What tooling CAN honestly build**: (1) surface `extract`'s existing drift array
  to the wizard and the handed-off prompt, unfiltered; (2) let the operator pick a
  scope unit — the whole manual, or one `sections/*.yaml` file / one section id —
  chosen BY THE HUMAN via the existing `select` idiom, without pretending the tool
  knows which modules the drift affects; (3) record a per-module baseline (Design
  B) keyed to whatever unit the human names, without inferring it from drift.

This is a real constraint on the proposal, not a reason to widen scope. The
"informed" part of "informed module picker" is not achievable honestly within this
change's stated boundary, and the drift→module join should be named as a tracked
follow-on that requires a content-provenance change.

## What could not be determined

- No Bash/shell tool was available in the exploration context, so `git log` could
  not be run. The commit hashes cited for the map's history (`6c065c6`,
  `5d47d6e`) were not independently re-verified.
- Not every `.tsx` in the `broadlineavida` checkout was checked for undocumented
  gating. `source-extraction/SKILL.md:116` warns that "products rarely gate in one
  place", so this picture is bounded by what `extract`'s two scan roots
  (`entry.extract.components`, `entry.extract.pages`, extract.ts:378) cover.
- Only `broadlineavida` was inspected. Whether another manual uses a different
  section/module granularity is unknown, so "module = human-designated
  `SectionNode`" should be read as this manual's shape, not a repo-wide law — per
  `source-extraction/SKILL.md` rule 6, "every shape below is one product's shape".

## Testing context

Strict TDD is active. Test command `pnpm test` (`vitest run --passWithNoTests`),
**747/747 passing**. Type-check `pnpm -r type-check`, 9/9 packages clean. New tests
land beside `packages/cli/src/wizard.test.ts:1091-1180` (which already covers
`assembleUpdatePrompt`) and `packages/cli/src/extract.test.ts` (`diffMaps`,
`extract`, `normalizeMap`).

## Next recommended

`sdd-propose`, carrying the *Scope boundary* caveat explicitly.
