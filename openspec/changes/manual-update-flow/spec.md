# Spec — `manual-update-flow`

- **Phase**: `spec`
- **Artifact store**: hybrid (this file + engram `sdd/manual-update-flow/spec`)
- **Inputs**: `openspec/changes/manual-update-flow/proposal.md` (required, read in
  full), `openspec/changes/manual-update-flow/explore.md` (required, read in
  full). For this reconciliation revision only, also
  `openspec/changes/manual-update-flow/design.md` (authoritative on the two
  rulings below, read in full — see "Reconciliation note")
- **Product under study**: `broadlineavida` @ `develop` `25b7ce94`

## Reconciliation note (this revision)

`sdd-spec` and `sdd-design` were run in parallel from the same proposal and
diverged on two points. The orchestrator ruled **design wins both**, and this
revision conforms the spec to `design.md` (read in full as an additional input
for this pass):

1. **`documents:` schema** (§1, S-1, MUF-001/003/004) — a **mapping** with
   `paths:`/`flags:` sub-keys (design ADR-002, D2/D3), not a flat list
   classified by string shape. Requirement ids are unchanged; their content is
   rewritten.
2. **CLI command name** (§2, MUF-101–104, MUF-306, MUF-810, MUF-811) — the
   command is **`documents <manual>`** (design ADR-008, D1), not `covers`.
   Requirement ids are unchanged; the command name inside them is renamed.

§9 / MUF-901 is untouched by this revision — that ruling was already settled
and is not reopened. A third, non-conflicting gate-review finding is folded in
as new requirement MUF-307 (§4): a missing test that must pin a byte-level
separator asymmetry the design flags in ADR-004.

Two more spec/design divergences surfaced later, each independently, in
post-implementation gate reviews rather than in the original parallel run
above. Each is resolved the same way — **design wins** — with its own inline
"Reconciled" note at the requirement it touches, rather than being folded into
the numbered list above (that list is specifically the two divergences found
at the original `sdd-spec`/`sdd-design` parallel run):

3. **`DriftFact` carries no `text` field** (§4, MUF-301) — an earlier revision
   of this requirement asked for a `text` field stored on the fact; ADR-004
   types the fact with no `text` field and derives the sentence via
   `describeDrift` instead. Reconciled inline at MUF-301.
4. **Axis-value fact reporting** (§4, MUF-303, MUF-305) — an earlier revision
   of these requirements filed every `axis-value` fact under "undeclared
   coverage"; ADR-004 types `axis-value` and `axis-changed` as
   `ManualWideFact`, structurally excluded from `CoverageReport.undeclared:
   readonly JoinableFact[]`, and the shipped code prints them under a
   separate "N manual-wide change(s):" heading instead. Reconciled inline at
   MUF-303 and MUF-305, this revision.

This document specifies WHAT must be true after `manual-update-flow` lands. It
does not choose data structures, function names, or file layouts inside
`packages/` — that is `sdd-design`'s job. Where a requirement needs a concrete,
testable shape to be expressible as a failing test (Strict TDD is active), this
document commits to the minimum shape necessary and marks it explicitly as a
**spec-time decision**, distinct from the proposal's already-settled decisions.

Every requirement has a stable id (`MUF-###`), a plain-language statement, and
at least one Given/When/Then scenario a test can be written from directly.

## Settled decisions carried in from the proposal (not re-litigated here)

1. The YAML key is `documents:` (`proposal.md` §3.1; `load.ts:335-344` shows
   `covers` already means something else inside `pending`).
2. The baseline file is `manuals/<manual>/baselines.json`, not under
   `knowledge/` (`manuals/AGENTS.md:11`: "`knowledge/` — Extracted facts
   (GENERATED — never hand-edit)").
3. `documents:` accepts capability flag names, not only paths
   (`packages/extract/src/tenant-config.ts:83-91`, `CapabilityRow` carries
   `flag`, no path).
4. `diffMaps` is redefined as `diffFacts(...).map(describe)`, byte-identical
   output (`extract.ts:192-256` is today's implementation; its behaviour is
   the additivity pin).
5. A module IS one `sections/*.yaml` file. No sub-section granularity.
6. `documents:` lives on a section file as a fourth member of the file-level
   facts channel alongside `pending`, `labels`, `sourceBase`
   (`packages/core/src/load.ts:544-556` — the rejection list and the
   `LoadedSection` return shape, verified by direct read).
7. Delivery is 5 work-unit commits directly to `main`. No PR flow.
8. `documents:` is **optional**, and its absence is **reported as `unknown`
   coverage — never as an incomplete module**. `module-completeness`'s
   definition of done is NOT amended by this change. Settled by the
   orchestrator; see §9 / MUF-901 for the scope reasoning.

## Spec-time decisions (new — needed to make requirements testable)

**S-1. `documents:` schema — a mapping with `paths:` and `flags:` sub-keys;
entries classified by sub-key first, then by shape within `paths:`.**
**SUPERSEDED by `sdd-design` (ADR-002, D2/D3) — the orchestrator ruled design
wins.** The original grammar in this section classified a flat list of
strings into four kinds by shape alone, including path-vs-flag. That is
replaced: a mistyped path (`AppRoutes` meant as `AppRoutes.tsx`) would
otherwise silently become a valid flag declaration, and `sourceBase`
(MUF-004) applies to paths only — a rule that is structural with sub-keys and
would otherwise have to be re-derived from each string's shape at every use.
This spec's own S-1 explicitly permitted design to refine this grammar
"without revisiting this spec" for a stricter identifier check; the schema
shape itself is revisited here because the divergence found was load-bearing,
not a refinement.

```yaml
# sections/12-broadsec-of-things.yaml
documents:
  paths:
    - routes/AppRoutes.tsx
    - pages/PMV/PMVPage.tsx
    - pages/BroadsecOfThings/*.tsx
    - components/
  flags:
    - canSeeBoT
```

The path-vs-flag axis is decided by which sub-key an entry appears under —
never inferred from the string. Within `paths:`, an entry is further
classified by shape, which is still needed to distinguish `file` /
`directory` / `glob`:

| Entry under `paths:` looks like | Kind |
|---|---|
| ends in `/` | directory |
| contains exactly one `*`, in the last segment (`*` never crosses a `/`) | glob |
| anything else | file — and MUST contain `/` or `.`, or it is rejected as belonging under `flags:` instead |

Every entry under `flags:` MUST match `/^[A-Za-z_][A-Za-z0-9_]*$/` — the
identifier shape the product's own capability config declares
(`tenant-config.ts:32`) — never a path shape.

This is the grammar every scenario below tests against, carried in from
design ADR-002 rather than the superseded flat-list grammar. `sdd-design` has
already settled it for this change; a future change may still refine the
`flags:` identifier regex further, but may not reintroduce shape-based
path-vs-flag inference or remove a kind.

**S-2. `verified` command refusal is on `isDirty(sourceRoot) !== false`,
covering both `true` and `null`.** `packages/cli/src/git.ts:42-45` documents
`isDirty` returning `null` for "cannot tell", and its own doc comment says
callers must not read that as clean. The proposal's phrase "refuses if
`isDirty(sourceRoot) !== false`" (proposal §3.5) already encodes this; this
spec makes the two-branch behaviour (dirty vs. unknown) an explicit,
independently testable scenario rather than one collapsed case.

**S-3. A detached `HEAD` in the product checkout is NOT a refusal case.**
`headCommit` (`git.ts:30-33`) runs `git rev-parse HEAD`, which resolves in a
detached-HEAD state exactly as it does on a branch — it returns null only when
git itself cannot answer (not a repository, git not on `PATH`, or a repository
with no commits). This spec explicitly narrows the proposal-adjacent
exploration language ("dirty tree, detached head, not a repo" as failure
modes) to what the code actually does: **dirty tree** and **git unreadable**
are refusal cases; **detached HEAD** is not, and must not become one.

## 1. `documents:` declaration

**MUF-001 — schema shape.** A section file MAY declare a top-level
`documents:` key. When present, its value MUST be a **mapping** with two
optional sub-keys, `paths:` and `flags:` — never a flat list — of which at
least one MUST be present and non-empty:

- `paths:` — a non-empty YAML list of strings, each classified per S-1 into
  `file`, `directory`, or `glob`.
- `flags:` — a non-empty YAML list of strings, each a capability-flag
  identifier (`/^[A-Za-z_][A-Za-z0-9_]*$/`).

> Given a section file with `documents: ["a", "b"]` (a list, not a mapping —
> the superseded shape)
> When the file is parsed
> Then parsing fails with a `ContentError` naming the two sub-keys
> `documents:` takes (`paths:`, `flags:`) and what each joins on — a path
> joins by file, a flag joins by capability flag.

> Given a section file with `documents: {}` (an empty mapping — neither
> `paths:` nor `flags:` present)
> When the file is parsed
> Then parsing fails with a `ContentError` in the voice of `load.ts:345-351`
> (`pending`'s empty-`covers` message, verified at that line): the
> declaration must have at least one entry under `paths:` or `flags:`, or it
> points at nothing — and omitting the `documents:` key entirely is the
> honest way to say "unknown" (MUF-003).

> Given a section file with `documents: {paths: [], flags: []}` (both
> sub-keys present but empty)
> When the file is parsed
> Then parsing fails the same way as the empty-mapping case — an empty
> sub-key is indistinguishable from an empty declaration.

> Given a section file with
> `documents: {paths: ["src/pages/PMVPage.tsx", "AppRoutes.tsx"]}`
> When the file is parsed
> Then both entries are accepted and classified as `file` (neither ends in
> `/` nor contains `*`, and each contains `/` or `.`).

> Given a section file with `documents: {paths: ["pages/BroadsecOfThings/*.tsx"]}`
> When the file is parsed
> Then the entry is accepted and classified as `glob`.

> Given a section file with `documents: {paths: ["src/render/components/"]}`
> When the file is parsed
> Then the entry is accepted and classified as `directory`.

> Given a section file with `documents: {flags: ["canViewFilterTrafficDetails"]}`
> When the file is parsed
> Then the entry is accepted and classified as `flag`.

> Given a section file with `documents: {paths: ["AppRoutes"]}` (a bare
> identifier with no `/` or `.`, listed under `paths:`)
> When the file is parsed
> Then parsing fails with a `ContentError` explaining that a `paths:` entry
> must look like a path, and that a bare identifier belongs under `flags:`
> instead — this is the mistyped-entry case Ruling 1 exists to catch:
> `AppRoutes` (meant as `AppRoutes.tsx`) is rejected rather than silently
> reclassified as a flag.

> Given a section file with `documents: {flags: ["src/pages/PMVPage.tsx"]}`
> (a path-shaped string listed under `flags:`)
> When the file is parsed
> Then parsing fails with a `ContentError` explaining that a `flags:` entry
> must match a capability-flag identifier shape, not a path.

> Given a section file with `documents: {paths: ["AppRoutes.tsx:202"]}` (a
> path entry carrying a `:<line>` suffix)
> When the file is parsed
> Then parsing fails with a `ContentError` explaining that gate identity is
> deliberately never line-based (`extract.ts:143-150`, `gateKey` at `:151`),
> so a line could not narrow a join that has no line to match on.

> Given a section file with `documents: {paths: [123]}` (a non-string entry)
> When the file is parsed
> Then parsing fails with a `ContentError` explaining that every `documents`
> entry must be a string.

**MUF-002 — valid only on a section, never on a block.** `documents:` MUST be
rejected exactly where `pending`, `labels`, and `sourceBase` already are:
present on a block-rooted file (`load.ts:544-555`).

> Given a content file whose top-level node is a block (not a section) and
> which declares `documents:`
> When the file is parsed
> Then parsing fails with a `ContentError` reading, in the register of
> `load.ts:550-551`: "`documents` belongs on a section, not on a block. Both
> are things a content FILE says about itself, and a file is a section."

**MUF-003 — absent `documents:` is not an error, and is not the same as an
empty declaration.** A section file with no `documents:` key parses
successfully. Its `LoadedSection.documents` is `undefined` (absent), never a
present-but-empty value — an empty mapping or an empty `paths:`/`flags:` list
is rejected as a `ContentError` by MUF-001, precisely so "absent" and "empty"
cannot collapse into the same on-disk shape. Every consumer downstream (§4,
§6) MUST treat an absent `documents` as `unknown` coverage, never as `clean`
or `unaffected`.

> Given a section file with no `documents:` key
> When the file is parsed
> Then parsing succeeds, `warnings`, `pending`, and `labels` are exactly as
> they are today (pin, see MUF-801), and `LoadedSection.documents` is
> `undefined` — not absent-as-error, not an empty mapping standing in for
> "nothing to check".

**MUF-004 — `sourceBase` applies to `documents.paths` entries the same way
it applies to `labels[].from`, and never to `documents.flags` entries.** When
a section declares `sourceBase:` (`load.ts:449-452`), every entry under
`documents.paths` (kind `file`, `directory`, or `glob`) is resolved relative
to that base, exactly as `parseFrom` already prefixes `labels[].from`
(`load.ts:426`). An entry under `documents.flags` is never prefixed — flags
have no path to prefix, and prefixing one would produce a declaration that
matches nothing while reading like a path.

> Given a section with `sourceBase: src/render/` and
> `documents: {paths: ["components/AddObservation.tsx"]}`
> When drift facts are joined against this module (§4)
> Then the entry is compared against `src/render/components/AddObservation.tsx`,
> not the bare `components/AddObservation.tsx`.

> Given a section with `sourceBase: src/render/` and
> `documents: {flags: ["canSeeBoT"]}`
> When drift facts are joined against this module (§4)
> Then the flag entry is compared against `canSeeBoT` exactly, with no prefix
> applied.

## 2. `documents:` verification (`documents` command)

**MUF-101 — declared-path-gone is surfaced, never fails a build.** For every
`documents.paths` entry of kind `file` or `directory`, `broadsec-manual
documents <manual>` checks it against the checked-out product (needs the
source checked out, same contract as `labels` at `main.ts:1998-2016`). A path
that no longer exists is reported, in the spirit of `registryMismatch` —
"Reported, never reconciled automatically" (`extract.ts:88-90`) — and the
command still exits `0`. It never causes `build` to fail and never causes
`documents` itself to exit non-zero on this account alone.

> Given module `X` declares `documents: {paths: ["src/pages/Retired.tsx"]}`
> and that file no longer exists in the product checkout
> When `documents <manual>` runs
> Then it prints a line naming module `X` and the missing path, and exits `0`.

**MUF-102 — declared-flag-gone is surfaced the same way.** A `flags` entry
absent from the freshly-extracted `map.capabilities` (i.e., no
`CapabilityRow` has that `flag`) is reported the same way as MUF-101, never
blocking.

> Given module `X` declares `documents: {flags: ["neverExistedFlag"]}`
> When `documents <manual>` runs against a map with no such flag
> Then it prints a line naming module `X` and the unmatched flag, and exits
> `0`.

**MUF-103 — the reverse check: undeclared coverage.** A drift fact (§4) that
matches **no** module's `documents:` entry is reported as undeclared
coverage — the analogue of `imageRequests`'s `undeclared` set
(`main.ts:511`, printed by `printUndeclaredImages`, `main.ts:523-531`). This
is not the same failure as MUF-101/102 (a stale declaration); it is a drift
fact nobody has claimed.

> Given today's real drift includes a gate change in `CustomTag.tsx` and no
> module's `documents.paths` names `CustomTag.tsx` (by file, directory
> prefix, or glob)
> When `documents <manual>` runs
> Then the `CustomTag.tsx` drift fact appears under an "undeclared coverage"
> heading, distinct from any per-module report.

**MUF-104 — `documents` also reports each module's baseline state.** For
every module, `documents` prints either "verified at `<commit>`" or "never
verified" (§3), sourced from `baselines.json`.

> Given `baselines.json` has `{"sections/09-security-dashboard.yaml": {"productCommit": null, "verifiedAt": null}}`
> When `documents <manual>` runs
> Then it reports module `09` as never verified.

## 3. `baselines.json`

**MUF-201 — schema.** `manuals/<manual>/baselines.json` holds
`{ "source": "<source id>", "modules": { "<section filename>": { "productCommit": string | null, "verifiedAt": string | null } } }`.
`productCommit` and `verifiedAt` are both `null` together (never verified) or
both non-null together (verified once). A section filename absent from
`modules` is equivalent to `{ productCommit: null, verifiedAt: null }` — it is
never treated as an error, so a manual with the file absent entirely (before
slice 2 seeds it) behaves identically to one where every module is present
and `null`.

> Given `baselines.json` does not exist for a manual
> When any reader asks for module `07`'s baseline
> Then the answer is `{ productCommit: null, verifiedAt: null }`, not an
> error.

**MUF-202 — read path is disk-only, no git call.** Reading a module's
baseline never shells out to git; it is a JSON read, matching the existing
`readManualStates` idiom of deriving state purely from disk
(`wizard.ts:259-302`).

> Given `baselines.json` exists with module `07` verified at commit `abc1234`
> When the wizard's scope step (§6) needs to show `07`'s baseline
> Then it reads `baselines.json` directly and issues no `git` subprocess call.

**MUF-203 — write path is the `verified` command, and only it.** No other
command (`extract`, `build`, `deliver`, `documents`) ever writes
`baselines.json`.

> Given `extract <manual>` runs and produces a fresh module map with drift
> When the run completes
> Then `baselines.json` is byte-identical to its state before the run (or
> remains absent if it was absent).

**MUF-204 — `verified` refuses on a dirty or unreadable product checkout.**
`broadsec-manual verified <manual> --module <section-filename>` refuses when
`isDirty(sourceRoot) !== false` (S-2: covers both `true` and `null`) and when
`headCommit(sourceRoot)` returns `null`. On refusal, it writes nothing and
exits non-zero, with an error in the register of `main.ts:1326-1334`
(`deliverManual`'s dirty-tree refusal): naming what a baseline promises
(a commit that actually describes what was read) and why a wrong one is worse
than none.

> Given the product checkout at `sourceRoot` has uncommitted changes
> When `verified <manual> --module sections/07-interfaz-general.yaml` runs
> Then it refuses, writes nothing to `baselines.json`, and exits non-zero.

> Given `isDirty(sourceRoot)` returns `null` (git cannot answer)
> When `verified` runs
> Then it refuses exactly as it does for a dirty tree — "cannot tell" is
> never read as "clean" (S-2).

> Given the product checkout is on a detached `HEAD` with a clean tree
> When `verified` runs
> Then it succeeds — detached `HEAD` is not, by itself, a refusal condition
> (S-3).

**MUF-205 — `verified` writes exactly one module's entry.** Stamping module
`A` leaves every other module's entry in `baselines.json` byte-identical, and
leaves the file's `source` field unchanged. There is no `--all` flag; a
section filename not present in `manuals/<manual>/sections/` is rejected
before any write.

> Given `baselines.json` has entries for modules `07` and `12`
> When `verified <manual> --module sections/07-interfaz-general.yaml` runs
> successfully
> Then module `07`'s entry gains the new `productCommit`/`verifiedAt`, and
> module `12`'s entry is byte-for-byte unchanged.

> Given `verified <manual> --module sections/99-does-not-exist.yaml`
> When it runs
> Then it refuses before touching `baselines.json`, naming that no such
> section file exists.

## 4. Structured drift (`diffFacts`)

**MUF-301 — `diffFacts` shape.** `diffFacts(before, after): readonly DriftFact[]`
returns one entry per drift item `diffMaps` reports today, each carrying at
minimum a `kind` discriminator plus whichever of `file`, `flag`, `codes` applies
to that kind. `file` is present exactly on `kind: "gate"` entries (gates are
keyed by `file|codes|kind`, `extract.ts:151`); `flag` is present exactly on
`kind: "capability"` entries; axis-value entries carry neither.

**A fact carries NO `text` field.** The human sentence is derived by
`describeDrift(fact)`, never stored on the fact — see ADR-004 for the type.
Storing it would give the same sentence two homes, which is the duplication this
change exists to remove, and would reduce `diffMaps = diffFacts(...).map(describeDrift)`
to `map(f => f.text)`, making the refactor pointless. The authoritative shapes
are ADR-004's `JoinableFact` and `ManualWideFact`, which also split joinable
from manual-wide facts structurally; this requirement's `kind` list is
subordinate to them.

> Given the same two maps used in today's `diffMaps` gate-added test case
> When `diffFacts` runs
> Then it returns one fact with `kind: "gate"` and a `file` equal to the gate's
> file, and `describeDrift` of that fact equals today's `diffMaps` line for it.

*Reconciled 2026-09-11: an earlier revision of this requirement asked for a
`text` field on the fact, contradicting ADR-004. ADR-004 wins, for the reasons
stated above. The implementation in commit `6b89d43` follows ADR-004.*

**MUF-302 — `diffMaps` is `diffFacts(...).map(describe)`, byte-identical.**
Every existing `diffMaps` test in `packages/cli/src/extract.test.ts` passes
unchanged, character for character, against the refactored implementation.
This is the additivity proof for the whole drift layer, not a separate
concern from MUF-301 — see MUF-802.

> Given `extract.test.ts`'s existing `diffMaps` fixtures and expected string
> arrays
> When run against `diffFacts(...).map(describe)`
> Then every expected string array is produced unchanged, in the same order.

**MUF-303 — the join: how a drift fact matches a `documents:` entry.** Per
module, per drift fact:

| Drift fact kind | Matches a `documents:` entry of kind | Match rule |
|---|---|---|
| `gate` | `file` | fact's `file` equals the entry (after `sourceBase`, MUF-004) |
| `gate` | `directory` | fact's `file` starts with the entry's path |
| `gate` | `glob` | fact's `file` matches the entry's glob pattern |
| `capability` | `flag` | fact's `flag` equals the entry, exact string match |
| `axis-value` | — | never matched by any `documents:` entry kind, because no module declares an axis value the way it declares a path or a flag; structurally excluded from "undeclared coverage" as well — see the reconciled reading below |

> Given module `X` declares `documents: {paths: ["src/render/components/"]}`
> and a drift fact with `kind: "gate"`,
> `file: "src/render/components/CustomTag.tsx"`
> When the join runs
> Then module `X` is reported `covered` with that fact attributed to it.

> Given module `X` declares `documents: {flags: ["canViewFilterTrafficDetails"]}`
> and a drift fact `{ kind: "capability", flag: "canViewFilterTrafficDetails" }`
> When the join runs
> Then module `X` is reported `covered` with that fact attributed to it.

*Reconciled 2026-09-15: an earlier revision of this table's `axis-value` row
read "always reported under 'undeclared coverage' for every axis-value fact",
contradicting ADR-004. ADR-004 wins, for the same reason it already won for
MUF-301 (see the Reconciliation note, ruling 4): `diffFacts` returns
`DriftFact = JoinableFact | ManualWideFact`, and `axis-value` (with
`axis-changed`) is typed as `ManualWideFact` — a fact with neither a `file`
nor a `flag`, which cannot be joined to a module's `documents:` by
construction. ADR-004 excludes `ManualWideFact` from "undeclared coverage"
structurally (`CoverageReport.undeclared: readonly JoinableFact[]`) rather
than filtering it at runtime, for the reason ADR-004 states: filing every
axis-value fact under "no module declared this" would be technically true
and practically noise, reproducing the lesson `imageRequests`' orphan set
already paid for. The shipped code
(`packages/cli/src/main.ts:2143-2145`) prints `report.manualWide` under its
own "N manual-wide change(s):" heading, never under "undeclared coverage".
MUF-305, below, restates the count invariant to match.*

**MUF-304 — a multi-module match reports the fact under every matching
module, never picks one.** When a drift fact matches more than one module's
`documents:` entries (e.g. two modules both name an overlapping directory),
`documents` reports that fact under each matching module, and additionally notes
the overlap so an author can see their declarations are too coarse (this is
the wording pinned by proposal Risk row 4 — "Report the match count per
entry").

> Given modules `X` and `Y` both declare `documents:` entries whose directory
> prefixes both contain the same drifted file
> When the join runs
> Then the drift fact appears under both `X` and `Y`'s reports.

**MUF-305 — an unmatched drift fact is reported, never dropped.** Every
`JoinableFact` not matched by any module's `documents:` (§4.3's rule) appears
under "undeclared coverage" (MUF-103). Every `ManualWideFact` — every
`axis-value` and `axis-changed` fact, by construction (MUF-303) — is never a
candidate for "undeclared coverage" at all; it appears under its own
"N manual-wide change(s):" heading instead (ADR-004). The reverse is also
true, restated per category rather than as one pooled total: the count of
(per-module attributed `JoinableFact`s) + (undeclared `JoinableFact`s) equals
the total `JoinableFact` count from `diffFacts`, with facts counted once per
module they match (a multi-matched fact is not double-subtracted from
"undeclared"); separately, every `ManualWideFact` `diffFacts` returns appears
under "manual-wide". Across both headings, none of `diffFacts`' output is
silently absent from the report.

> Given `diffFacts` returns N `JoinableFact`s and P `ManualWideFact`s, and M
> of the `JoinableFact`s match at least one module's `documents:`
> When `documents` runs
> Then exactly `N - M` `JoinableFact`s appear under "undeclared coverage",
> all P `ManualWideFact`s appear under "manual-wide" and never under
> "undeclared coverage", and none of the N + P facts are silently absent from
> the report.

*Reconciled 2026-09-15: an earlier revision of this requirement counted
`axis-value` facts into the pooled "N - M under undeclared coverage"
invariant, contradicting ADR-004 for the reason recorded at MUF-303's table
(reconciliation ruling 4). This is the fourth "design wins" reconciliation in
this change. The implementation already follows ADR-004
(`packages/cli/src/coverage.ts`'s `joinCoverage` passes `context.manualWide`
straight through to `report.manualWide`, and computes `undeclared` only from
its `JoinableFact[]` argument) — this reconciliation and the accompanying
`packages/cli/src/main.test.ts` coverage close the gap between that shipped
behaviour and what this spec asserted.*

**MUF-306 — the three-state module report.** For every module, `documents`
reports exactly one of:

- `covered` — module declares `documents:` and ≥1 drift fact matched
- `clean` — module declares `documents:` and no drift fact matched
- `unknown` — module declares no `documents:` at all

`unknown` MUST NOT be worded as "unaffected", "no drift", or anything implying
a checked absence. When a module is `unknown`, the report repeats the full
current drift list under it (proposal §3.3 wording pin, mitigating Risk row
3), never a bare count.

> Given module `08` declares no `documents:`
> When `documents` runs with any non-empty drift
> Then module `08`'s report reads "unknown coverage" and lists every current
> drift fact beneath it, not a count.

> Given module `07` declares `documents:` and today's real drift includes
> `AddObservation.tsx`, `CaseFiltering.tsx`, `CustomTag.tsx`,
> `MobileInfoWindow.tsx`, `OfficerDispatchDetail.tsx`, and
> `canViewFilterTrafficDetails`
> When `documents broadlineavida` runs
> Then each of those facts appears attributed to `07` and/or `12` (per their
> seeded `documents:`, proposal §6) or under "undeclared coverage" — never
> under a module marked "unaffected".

**MUF-307 — a new test pins the capability-`added` separator for two-or-more
`enabledFor` values.** `packages/cli/src/extract.test.ts` today has no test
exercising a `capability added` fact where `row.enabledFor` carries two or
more values — only the `changed` case pins a multi-value separator
(`extract.test.ts:72`, asserting `"now [mv,med]"`, verified by direct read).
Since `diffMaps`'s byte-identical output is this change's additivity proof
(MUF-302), and `packages/cli/src/extract.ts:220` prints `enabledFor.join(", ")`
(comma-space) for `added` while `:223-224` prints `enabledFor.join(",")`
(comma, no space) for `changed` — both verified by direct read — a NEW test
MUST assert the exact separator for a two-or-more-value `added` fact, so the
refactor in commit 3 (ADR-004) cannot silently normalise this asymmetry away.

> Given a capability fact with `change: "added"` and
> `enabledFor: ["mv", "med"]`
> When `describeDrift` (or `diffMaps`, which must produce the same string)
> formats it
> Then the output contains `"on for mv, med"` — comma-space, matching
> `extract.ts:220`'s current format — and NOT `"on for mv,med"`.

> Given a capability fact with `change: "changed"`, `was: ["mv"]`,
> `now: ["mv", "med"]`
> When formatted
> Then the output contains `"now [mv,med]"` — comma, no space, matching
> `extract.ts:223-224`'s current format — distinct from the `added` case's
> separator above, and this distinction is what the new test exists to pin.

## 5. The ordering rule

**MUF-401 — `extract` writes no baseline, ever.** `extract`'s only writes are
`manuals/<manual>/knowledge/module-map.json` (`extract.ts:405-413`, already
true today) and nothing under `baselines.json`. This is MUF-203 restated as
a negative-space guarantee on the extraction path specifically, because it is
the path most likely to be extended by mistake.

> Given a manual with an existing `baselines.json`
> When `extract <manual>` runs and reports non-empty drift
> Then `baselines.json` is untouched — same bytes before and after.

**MUF-402 — no command can stamp more than one module per invocation.**
`verified` has no `--all` flag and no batch mode. There is no command,
existing or new, whose successful run causes more than one entry in
`modules` to change.

> Given ten modules all have stale baselines
> When any single CLI invocation runs to completion
> Then at most one module's entry in `baselines.json` differs from before
> that invocation.

**MUF-403 — the only permitted order is extract → surface drift → decide per
module → stamp that module.** There is no code path that writes a baseline
entry without a preceding read of the current drift for that module. (This is
process discipline enforced by construction — MUF-401 and MUF-402 together —
not a runtime check the CLI performs on the operator; the guarantee is that
skipping the "decide" step produces no observable-different baseline write,
because the write always requires an explicit, single `--module` argument
naming what was decided on.)

## 6. The wizard's update flow

**MUF-501 — the scope step is new, inserted as step 2, pushing today's
free-text paragraph to step 3.** `updateFlow` (`wizard.ts:1731-1762`) gains a
step between "which manual" and "what to do": a `select` (reusing the
`select` idiom, `wizard.ts:635-656`) offering "the whole manual" plus one
option per `sections/*.yaml` file.

> Given a manual with 10 section files
> When `updateFlow` runs
> Then step 2 presents 11 options: "whole manual" plus one per section file,
> each with a `label`/`detail` pair per the existing `select` shape.

**MUF-502 — each module option's `detail` shows baseline and coverage
state.** For each section-file option, `detail` states: verified commit (or
"never verified"), and coverage state (`covered` / `clean` / `unknown`, §4.6),
derived from `baselines.json` and the section's `documents:` — read from disk
only (MUF-202), no `extract` run.

> Given module `09` has `productCommit: null` and no `documents:`
> When the scope step renders its option
> Then its `detail` reads something equivalent to "never verified · unknown
> coverage" — both facts stated, neither implying the other.

**MUF-503 — the wizard does not run `extract`.** Consistent with
`readManualStates` being disk-only (`wizard.ts:259-302`) and the wizard's
existing contract that "it POINTS; it does not instruct"
(`wizard.ts:333-348`, cited in proposal §3.6): no step in `updateFlow` invokes
`extract`. The assembled prompt (MUF-504) instructs the agent to run
`extract` and `documents` as its own first act.

> Given the wizard's scope step is displayed
> When it renders every module's baseline and coverage detail
> Then it does so without spawning `extract` or reading the source product's
> git state — every fact comes from `manuals/<manual>/` on disk.

**MUF-504 — `assembleUpdatePrompt` gains an optional third parameter.**
`assembleUpdatePrompt(s: ManualState, instruction: string, scope?: Scope | string)`
— the third parameter defaults to whole-manual scope when omitted, so every
existing call compiles and every existing assertion
(`wizard.test.ts:1091-1180`) passes unchanged (pin, MUF-804).

> Given the existing test calling `assembleUpdatePrompt(state, "x")` with two
> arguments
> When it runs against the changed signature
> Then its output is identical to today's, because the omitted third
> argument defaults to whole-manual scope.

> Given `assembleUpdatePrompt(state, "x", "sections/09-security-dashboard.yaml")`
> When it runs
> Then the assembled prompt names that module specifically as the scope, and
> instructs the agent to run `extract` and `documents` before editing.

**MUF-505 — a module with a `null` baseline or no `documents:` is presented,
never hidden or skipped.** Every module appears as a selectable option
regardless of its baseline or coverage state; MUF-502's wording rule
(never implying "unaffected") applies here too.

> Given module `10` has never been verified and declares no `documents:`
> When the scope step lists its options
> Then module `10` is a selectable option with a `detail` stating both facts
> plainly.

**MUF-506 — empty drift is stated, not hidden.** When the assembled prompt's
instruction to run `extract`/`documents` would (per the agent's own run)
encounter zero drift for the chosen scope, the wizard-authored parts of the
prompt say so is possible and expected — the prompt never asserts drift
exists. (The wizard itself never runs `extract`, so it cannot know in
advance whether drift will be empty; this requirement is about the prompt's
wording not presupposing non-empty drift, not about the wizard computing the
answer.)

> Given the assembled prompt for scope `sections/07-interfaz-general.yaml`
> When its wording is inspected
> Then it does not assert that drift exists for that module, and does not
> instruct the agent to "fix the drift" as though some is guaranteed present.

## 7. The product commit

**MUF-601 — the commit is read via `headCommit(sourceRoot)`, never
invented.** Every place this change needs "which product commit," it calls
`headCommit` (`git.ts:30-33`) against the resolved `sourceRoot`
(`sourceRootFor`, `extract.ts:286-319`). No code path constructs, guesses, or
defaults a commit hash.

> Given `headCommit(sourceRoot)` returns `"25b7ce94"`
> When `verified` stamps a module
> Then the written `productCommit` is exactly `"25b7ce94"`, not a truncated,
> padded, or otherwise transformed value.

**MUF-602 — an unreadable product repo refuses the write, per MUF-204.**
Covered fully in §3; restated here as the commit-specific half: `headCommit`
returning `null` (not a repository, git unavailable, no commits) is a refusal
condition with the same never-invent guarantee — there is no fallback commit
string, not even `"unknown"` or `"HEAD"`.

> Given `sourceRoot` is not a git repository
> When `verified` runs
> Then it refuses and writes nothing; no placeholder commit string ever
> reaches `baselines.json`.

**MUF-603 — detached `HEAD` is a successful read, not a refusal (S-3).**
Restated from S-3 as its own scenario because it is the one place the
exploration's language and the code's actual behaviour diverge, and getting
it wrong would make `verified` refuse in a case where the commit is perfectly
well-defined.

> Given the product checkout is checked out at a specific commit with no
> branch attached (detached `HEAD`), and the tree is clean
> When `verified` runs
> Then it succeeds and records that commit.

## 8. Additivity

Nine existing flows must be provably untouched. Baseline: `pnpm test`
**747/747**, `pnpm -r type-check` **9/9** (proposal §5, explore.md "Testing
context").

**MUF-801 — creation flow untouched.** `wizard.test.ts` assertions for
`assemblePrompt` (`:272`), `assembleContinuationPrompt` (`:569`), hand-off
(`:695`), `normaliseSourcePath` (`:135`), `validateManualId` (`:193`),
`readRegistrySources` (`:212`), `knownTenants` (`:227`) — all pass unchanged.

**MUF-802 — build flow untouched.** `main.test.ts`'s `run` (`:401`),
`assertChangeLog` (`:421`), `deliveredVersion` (`:497`), `outputFilename`
(`:335`), `workFilename` (`:354`), `primaryAxis` (`:306`), `manualConfigSchema`
(`:275`); `core/load.test.ts`, `condition.test.ts`, `number.test.ts`,
`slots.test.ts` — all pass unchanged.

> Given a section file with no `documents:` key
> When `load.test.ts`'s existing suite runs against it
> Then every existing assertion passes; the only observable difference for a
> file without `documents:` is an added, optional `documents` field on
> `LoadedSection` whose value is `undefined` (MUF-003).

**MUF-803 — deliver/undeliver untouched.** `deliver.test.ts`,
`delivery-state.test.ts`, `naming.test.ts`, `main.test.ts`'s
`deliveryProofFor` (`:557`) — all pass unchanged. No file this change touches
is on the `deliver`/`undeliver` write path.

**MUF-804 — awaiting untouched.** `awaiting.test.ts`, `core/pending.test.ts`,
`core/load-pending.test.ts` — all pass unchanged. `documents:` is parsed
beside `pending`, never inside it, and `parsePending` (`load.ts:295-392`) is
not modified by this change.

**MUF-805 — images untouched.** `images.test.ts`, `pending-table.test.ts`,
`blocks/image.test.ts`, `main.test.ts`'s `imageRequests` (`:75`),
`parseOutPath` (`:35`), `draftFilename` (`:52`) — all pass unchanged.

**MUF-806 — labels untouched.** `core/labels.test.ts`,
`extract/label-check.test.ts` — all pass unchanged. `documents:` reuses the
`sourceBase` mechanism (MUF-004) but does not modify `parseLabels`
(`load.ts:437-529`).

**MUF-807 — capture untouched.** `capture.test.ts`, `capture-run.test.ts` —
all pass unchanged.

**MUF-808 — release-notes untouched.** `render-web/release.test.ts`,
`css-release.test.ts`, `main.test.ts`'s `releaseLede` (`:665`),
`releaseNotesFile` (`:628`), `releaseDate` (`:645`) — all pass unchanged.

**MUF-809 — extract untouched in its observable output.** `cli/extract.test.ts`
(`diffMaps` expectations unchanged per MUF-302); `extract/tenant-references.test.ts`,
`tenant-config.test.ts`, `reconcile.test.ts` — all pass unchanged.

**MUF-810 — the command allow-list still names every pre-existing command.**
`run(["documents"])` and `run(["verified"])` with no manual id both return
`2`, and the printed usage text still lists `build`, `images`, `awaiting`,
`labels`, `extract`, `deliver`, `undeliver`, `capture`, `release-notes` — the
existing allow-list at `main.ts:1873-1884` gains two entries, drops none.

> Given the CLI is invoked with an unrecognised command or a recognised
> command missing its manual id
> When usage is printed
> Then it names all 11 commands (9 existing + `documents` + `verified`), and
> `run` still returns `2`.

**MUF-811 — manual smoke test.** `build broadlineavida` before and after this
change reports the same section count and the same numbered-node count per
target (proposal §5 item 6). This is not a unit test; it is the
delivered-document-level additivity check.

## 9. `documents:` and `module-completeness`'s definition of done

**MUF-901 — `documents:` is NOT a definition-of-done item in this change.**
SETTLED by the orchestrator, not open. The proposal (§9) raised it as an
owner question; the owner has delegated design authority for everything
decidable and asked not to be consulted, so it was decided rather than
deferred.

**The decision: `skills/module-completeness/SKILL.md`'s definition of done is
NOT amended by this change.** Declaring `documents:` is optional, and its
absence is reported as `unknown` coverage — never as an incomplete module.

The reasoning, which is a scope argument rather than a preference. Adding the
item would render 8 of `broadlineavida`'s 10 modules formally incomplete on
the day it lands, for a manual whose `mv` target is already delivered at
v1.1.0 and whose `med` target is delivered at v1.0.0
(`deliveries/broadlineavida/`, four sealed documents). Changing the standard a
shipped document is measured against is a statement about that document. This
change is scoped to tooling; it does not get to make it as a side effect.

It may become a definition-of-done item later, deliberately, once the modules
that would fail it have been re-grounded. That is the follow-on change, and it
is named as such rather than smuggled in here.

> Given a section file that declares no `documents:`
> When any command in this change reports on its coverage
> Then it is reported as `unknown`, never as incomplete
> And `skills/module-completeness/SKILL.md`'s definition of done is unchanged
> by this change, verifiable by `git diff` over that file showing no edit to
> its definition-of-done list.

## What could not be determined at spec time

- The `documents:` schema's shape (S-1 — mapping with `paths:`/`flags:`) is
  now settled by `sdd-design` ADR-002, not merely proposed; this reconciliation
  pass carried that ruling into the spec. A future change may still refine the
  `flags:` identifier regex further, but reintroducing shape-based
  path-vs-flag inference would re-litigate a settled ruling, not refine one.
- Nothing remains open on MUF-901. It was the proposal's one owner question
  and the orchestrator settled it: the definition of done is not amended by
  this change. See §9 for the scope reasoning.

## Risks

| Risk | Note |
|---|---|
| ~~MUF-901 adopted from the proposal's default~~ — RESOLVED, no longer a risk | Settled by the orchestrator: the definition of done is NOT amended by this change. Slice 5 adds no bullet to `skills/module-completeness/SKILL.md`. See §9 |
| ~~S-1's classification grammar is a spec-time addition, not literally in the proposal~~ — RESOLVED, superseded | The orchestrator ruled `sdd-design`'s ADR-002 mapping schema (`paths:`/`flags:` sub-keys) wins over this spec's original flat-list-by-shape grammar. This revision carries that schema into S-1 and MUF-001/003/004. No longer an open divergence |
| MUF-304 (multi-module match reporting) specifies "report under every matching module plus a note," but the proposal's own Risk row 4 only commits to "report the match count per entry" — this spec's phrasing is a reasonable but not verbatim reading | Design phase should confirm the exact reporting shape against proposal Risk row 4 |
| ~~MUF-303/MUF-305 filed every `axis-value` fact under "undeclared coverage", contradicting ADR-004's `ManualWideFact` exclusion~~ — RESOLVED, design wins (ruling 4) | Found by the change-level verify gate, unreconciled at the time. ADR-004 wins for the reason recorded at MUF-303's and MUF-305's inline "Reconciled" notes; the shipped code (`main.ts:2143-2145`) already prints axis-value facts under "N manual-wide change(s):", never "undeclared coverage". `main.test.ts` now pins the routing end-to-end |
