# Proposal — `manual-update-flow`

Drive "update a manual" from product drift, at module granularity, with a
per-module baseline hooked to the source product's commit.

- **Phase**: `propose`
- **Artifact store**: hybrid (this file + engram `sdd/manual-update-flow/proposal`)
- **Input**: `openspec/changes/manual-update-flow/explore.md` (read in full)
- **Product**: `broadlineavida` @ `develop` `25b7ce94`

## 1. Intent — why updating a manual is a guess today

`extract()` diffs the fresh map against "whatever JSON is at
`knowledge/module-map.json` at the moment it runs"
(`packages/cli/src/extract.ts:406-408`), then overwrites that file
(`extract.ts:413`). There is no record of which product commit any part of the
manual was last checked against, and the drift array is printed to a terminal
(`main.ts:1958-1962`) and then discarded. Meanwhile `updateFlow` asks for a
free-text paragraph (`wizard.ts:1746`) and hands the whole string to an agent
opaquely (`assembleUpdatePrompt`, `wizard.ts:1651`), with no scope parameter at
all. So the operator decides what to update from memory, the agent regenerates a
map that silently absorbs unrelated drift, and nothing anywhere says whether
module `09` has ever been held against the code it describes. It has not:
`09-security-dashboard.yaml:1-7` records a known contradiction with
`canViewTimeMetrics` and says it was "recorded and NOT acted on".

## 2. The mechanical definition of a module

**A module IS one file in `manuals/<manual>/sections/`.** Nothing narrower.

This is the unit `loadDocument` already treats as a unit — it reads the
directory in filename order and maps one file to one child
(`main.ts:162-176`) — and filename order is already load-bearing enough that
the build enforces a rule on it (`assertChangeLog`, `main.ts:249-281`). The
nested `SectionNode`s inside a file (`mapa`, `barra-superior`, `incidentes` in
`07-interfaz-general.yaml:32`) are explicitly NOT modules for this change.

`broadlineavida` therefore has 10 modules, `04`…`13`.

## 3. The design

### 3.1 `documents:` — file-level coverage declaration

**Decision: the YAML key is `documents:`, not `covers:`.** `covers` is already a
validated key with a *different* meaning — inside a `pending` entry it is a list
of **node ids in this section**, and its own error text teaches exactly that
(`load.ts:335-351`). Two meanings for one word in one dialect is the class of
defect this repo refuses elsewhere (`main.ts:1158-1174`, `releaseLede` exists
precisely because it is NOT `manual.lede`). One-word veto if the owner prefers
`covers:`; nothing else in the design moves.

**Where it lives: a top-level key in the section file, parsed by
`packages/core/src/load.ts`.** This is not a new mechanism — `loadSection`
already has a first-class channel for "things a content FILE says about itself"
that travels beside the AST: `pending`, `labels`, `sourceBase`, with the
rationale stated in the code (`load.ts:541-556`, and again in
`PendingDeclaration`'s doc comment, `packages/core/src/pending.ts:19-25`).
`documents:` is the fourth member of that set.

| Rejected alternative | Why |
|---|---|
| `manual.config.yaml` | One file for ten modules invites the coverage list to drift from the content it describes; and the config is axes/targets/output (`manualConfigSchema`, `main.ts:93-149`), not per-module facts |
| `knowledge/module-map.json` | `extract` rewrites it whole every run; a hand-authored key is deleted by the next extraction (`extract.ts:413`, `source-extraction/SKILL.md:43-44`) |
| A new block type | It is not a block. `block-authoring`'s "the catalogue is closed — nine types" (`SKILL.md:88-91`) governs `packages/blocks/src/catalog/`; a file-level key never reaches the AST and no renderer sees it |

**Cost:** a `parseCovers` function in `core` mirroring `parsePending`
(`load.ts:295-392`), one new field on `LoadedSection` (`load.ts:253-277`), and
`"documents"` added to the block-rejection list at `load.ts:545`. It is a schema
change to `loadSection`, and it is the same size as the one `pending` already
paid for.

**Granularity of an entry: a product-repo-relative posix path — a file, or a
directory (matched by prefix), or a `*` glob.** Not invented: authors already
write exactly this shape in a file-header comment. `12-broadsec-of-things.yaml:7-11`
lists `AppRoutes.tsx:202-214`, `pages/PMV/PMVPage.tsx`,
`pages/BroadsecOfThings/*.tsx`, `locales/translations/es.json`. This change
promotes that comment into a validated key; it does not ask for new work.

**Second entry kind: a capability flag name.** Required, not optional. Gate
drift joins by file — `AxisReference.file` is a repo-relative posix path
(`extract.ts:382`, and `module-map.json:1152` reads
`src/render/components/AddObservation.tsx`) — but **capability drift has no file
to join on**: `CapabilityRow` carries `flag`, `values`, `absentFrom`,
`enabledFor` and no path (`packages/extract/src/tenant-config.ts:83-91`), and
`FlagFact` is `{ value, line }` with the line pointing into the per-tenant
config every module shares (`tenant-config.ts:15-18`). Without flag entries,
`capability added: canViewFilterTrafficDetails` — a real line from today's
extraction — is unjoinable forever. Authors already cite flags this way:
`09-security-dashboard.yaml:5` names `canViewTimeMetrics`.

`sourceBase:` (`load.ts:449-452`) applies to `documents:` entries the same way it
applies to `labels[].from` (`load.ts:426`) — one prefix mechanism, one rule.

### 3.2 `baselines.json` — Design B, relocated

Design B's substance is adopted: per module `{ productCommit, verifiedAt }`,
`null` meaning never verified. Designs A and C stay rejected on the exploration's
reasoning.

**Decision: `manuals/<manual>/baselines.json`, NOT `knowledge/baselines.json`.**
The exploration's path violates a documented invariant it did not weigh:
`knowledge/` is "Extracted facts (GENERATED — never hand-edit)"
(`manuals/AGENTS.md:12`) and authoring rule 6 is "Never hand-edit `knowledge/`.
It is generated. Fix the extractor" (`manuals/AGENTS.md:124`). A baseline is
neither generated nor hand-edited — it is recorded by an explicit command. The
repo already has that category, and it lives beside the manual:
`image-requests.json` and `awaiting-product.json` are both committed, both
outside `output/`, both explicitly "not build output"
(`packages/cli/AGENTS.md:71-75`; `module-completeness/SKILL.md:181-186`).

```jsonc
{
  "source": "broadlineavida",
  "modules": {
    "sections/07-interfaz-general.yaml": { "productCommit": "25b7ce94", "verifiedAt": "2026-09-10" },
    "sections/09-security-dashboard.yaml": { "productCommit": null, "verifiedAt": null }
  }
}
```

Keyed by the section filename, because that is what a module IS (§2) and a key
whose file stops existing is detectable.

**On the timestamp objection.** The map carries no clock because "the map is
regenerated constantly, and a clock would make every regeneration a diff"
(`extract.ts:411-412`). That reasoning does not transfer: this file is written
only by an explicit per-module act, so `verifiedAt` churns nothing. `null` is
first-class for the same reason `absentFrom` is — "absent is NOT false"
(`tenant-config.ts:96-102`) — and the same reason `PreviousMap.axis` is optional
(`extract.ts:93-101`).

**`productCommit` needs no new git code.** `git()` already takes any root via
`-C` (`packages/cli/src/git.ts:18-27`), so `headCommit(sourceRoot)` and
`isDirty(sourceRoot)` work on the product checkout as-is, with `sourceRoot`
resolved by the existing `sourceRootFor` (`extract.ts:286-319`).

### 3.3 The join

`diffMaps` returns `readonly string[]` (`extract.ts:192`), and `describeGate`
(`extract.ts:154-157`) is lossy. Re-parsing those strings would be brittle.

**Decision: add `diffFacts(before, after): readonly DriftFact[]` and define
`diffMaps` as `diffFacts(...).map(describe)`.** `diffMaps` keeps its exported
signature and byte-identical output — which is simultaneously the design and the
additivity proof (§5). `DriftFact` carries the discriminator the string throws
away: `{ kind: "axis-value" | "capability" | "gate", file?, flag?, codes?, text }`.

Join, per module, producing three states and never a fourth:

| State | When | Reported as |
|---|---|---|
| `covered` | module declares `documents:`, and ≥1 drift fact matches an entry | the matching drift facts, per module |
| `clean` | module declares `documents:`, no drift fact matches | "no drift in what this module documents" |
| `unknown` | module declares **no** `documents:` | "unknown coverage — every drift fact may be this module's business", and the full drift list is repeated under it |

**`unknown` is never rendered as `unaffected`.** That is the whole point, and it
follows the same discipline as `absentFrom`: silence about a fact is not the
fact's negation.

**The reverse check, and it is the one that matters.** A drift fact matched by
**no** module's `documents:` is reported as undeclared coverage — the exact
analogue of an image on disk that no slot asked for
(`imageRequests`'s `undeclared`, `main.ts:459` and `main.ts:511`;
`printUndeclaredImages`, `main.ts:523-531`). That check is what catches drift in
a product file nobody documents, which today is absorbed silently.

### 3.4 `documents:` is verified, not trusted

`broadsec-manual covers <manual>` — modelled on `labels` (`main.ts:1998-2016`),
same contract: needs the source checked out, **reports and never blocks**.

1. Every declared path that no longer exists in the product checkout, in the
   spirit of `registryMismatch` — "Reported, never reconciled automatically"
   (`extract.ts:86-90`).
2. Every declared flag absent from `map.capabilities`.
3. Undeclared coverage (§3.3).
4. Each module's baseline state: verified at commit C, or never verified.

### 3.5 The ordering rule, made structural

The exploration's hazard is answered by construction, not by discipline:

**`extract` writes no baseline. Ever.** Stamping is a separate command,
`broadsec-manual verified <manual> --module sections/09-….yaml`, which:

- refuses if `isDirty(sourceRoot) !== false` — a baseline recorded against a
  dirty checkout names a commit that does not describe what was read, the same
  argument `deliver` already makes about archived bytes (`main.ts:1323-1336`);
- writes **only the named module's entry**, leaving every other byte untouched;
- has no `--all`, so "one extraction ran" can never stamp ten modules.

Correct order — extract → surface drift → decide per module → stamp that
module — is then the only order the CLI permits.

### 3.6 The wizard flow

`updateFlow` (`wizard.ts:1731-1762`) gains one step and `assembleUpdatePrompt`
gains one optional parameter.

| Step | Today | After |
|---|---|---|
| 1 | which manual (`select`, `wizard.ts:635-656`) | unchanged, `describeState` gains a baseline clause |
| 2 | — | **NEW** — scope: the whole manual, or one of the `sections/*.yaml` files, via the same `select`; each option's `detail` shows that module's baseline and coverage state |
| 3 | free-text paragraph (`askParagraph`, `wizard.ts:1607`) | unchanged |
| 4 | `handOff` | unchanged |

**The wizard does not run `extract`.** It reads `baselines.json` and the section
files' `documents:` off disk — `readManualStates` is already disk-only
(`wizard.ts:259-302`) — and the assembled prompt instructs the agent to run
`extract` and `covers` as its first act. Running a mutating extraction inside a
picker is the ordering hazard itself, and the wizard's contract is that "it
POINTS; it does not instruct" (`wizard.ts:333-348`).

`assembleUpdatePrompt(s, instruction, scope?)` — third parameter **optional**,
defaulting to whole-manual, so every existing call and test compiles and passes
unchanged (§5).

## 4. Harness changes

| File | Change |
|---|---|
| `AGENTS.md` | Command list at `:112-114` ("Four commands take a manual id") is already wrong — there are 9. Correct it and add `covers` / `verified`. Add the module definition (§2) to the pipeline description at `:21-36` |
| `packages/cli/AGENTS.md` | `:16` claims "There are **four**. The dispatch is `main.ts:854`" — both false today (8 rows in its own table; dispatch is `run`, `main.ts:1862`). Fix, add the two commands, add `--module` to the flag table at `:32-38` |
| `packages/core/AGENTS.md` | The `drift` row at `:13` says core compares declared facts against the map. It does not, and now something does. State that `documents:` is parsed here and joined in `cli` |
| `manuals/AGENTS.md` | `:49-52` — "Nothing in this repository declares a manual's full module list … so an agreed scope exists only if it was written down [in ESTADO.md]". This change makes it mechanical; that paragraph must be rewritten, not left to contradict the code. Add `baselines.json` to the Anatomy block at `:7-19` and say why it is not in `knowledge/` |
| `manuals/broadlineavida/AGENTS.md` | Add a Sources-of-truth row (`:35-40`): "which product paths a module documents → that section's `documents:`" |
| `skills/source-extraction/SKILL.md` | Step 6 "Emit and diff" (`:164-182`) owns the diff, so it owns the baseline and the ordering rule. Add both; add `diffFacts`; point at the new skill |
| `skills/module-completeness/SKILL.md` | `:26` currently sends the author to the map for a submodule list, which the map does not emit. Fix. Definition of done (`:386-411`) gains the `documents:`/baseline item — **see Open question** |
| `skills/block-authoring/SKILL.md` | One line: file-level keys (`pending`, `labels`, `sourceBase`, `documents`) are not blocks, so the closed-catalogue rule at `:88-91` does not apply to them |
| `skills/tenant-conditioning/SKILL.md` | **No change.** Its provenance-comment rule (`:118-121`) is row-level and stays; `documents:` is file-level. Its claim that "a drift report proves the tag still matches the code" becomes more true, not less |

### A new skill is warranted: `manual-update`

`source-extraction` owns "get facts out of the product"; `module-completeness`
owns "when a module is finished". Neither owns **the procedure for updating a
manual that already exists** — read the baseline, extract, join, decide per
module, stamp, then author. Burying it in `source-extraction` would make it
undiscoverable: "`description` is the whole discovery mechanism … a vague
description means the skill never fires" (`skills/AGENTS.md:58-61`), and an agent
told "update module 09" will not fire a skill whose description is about
extracting a map. And `skills/AGENTS.md:70-79` is explicit that a rule stated in
two layers drifts, so the pieces the two existing skills already own stay with
them and are *referenced*, not copied.

## 5. Additivity proof plan

Nine flows must be provably untouched. Strict TDD is active; baseline is
`pnpm test` **747/747** and `pnpm -r type-check` **9/9**.

| Flow | Tests that must stay green **with unchanged expectations** |
|---|---|
| creation | `wizard.test.ts` — `assemblePrompt` (`:272`), `assembleContinuationPrompt` (`:569`), hand-off (`:695`), `normaliseSourcePath` (`:135`), `validateManualId` (`:193`), `readRegistrySources` (`:212`), `knownTenants` (`:227`) |
| build | `main.test.ts` — `run` (`:401`), `assertChangeLog` (`:421`), `deliveredVersion` (`:497`), `outputFilename` (`:335`), `workFilename` (`:354`), `primaryAxis` (`:306`), `manualConfigSchema` (`:275`); `core/load.test.ts`, `condition.test.ts`, `number.test.ts`, `slots.test.ts` |
| deliver / undeliver | `deliver.test.ts`, `delivery-state.test.ts`, `naming.test.ts`, `main.test.ts` `deliveryProofFor` (`:557`) |
| awaiting | `awaiting.test.ts`, `core/pending.test.ts`, `core/load-pending.test.ts` |
| images | `images.test.ts`, `pending-table.test.ts`, `blocks/image.test.ts`, `main.test.ts` `imageRequests` (`:75`), `parseOutPath` (`:35`), `draftFilename` (`:52`) |
| labels | `core/labels.test.ts`, `extract/label-check.test.ts` |
| capture | `capture.test.ts`, `capture-run.test.ts` |
| release-notes | `render-web/release.test.ts`, `css-release.test.ts`, `main.test.ts` `releaseLede` (`:665`), `releaseNotesFile` (`:628`), `releaseDate` (`:645`) |
| extract | `cli/extract.test.ts`; `extract/tenant-references.test.ts`, `tenant-config.test.ts`, `reconcile.test.ts` |

New tests whose job is to **pin additivity**, not to cover new code:

1. `core/load-covers.test.ts` — a section file with no `documents:` yields a
   `LoadedSection` whose `node`, `warnings`, `pending` and `labels` are identical
   to today's; `covers` is `[]` and nothing else differs.
2. `cli/extract.test.ts` — the existing `diffMaps` expectations, unchanged, run
   against the `diffFacts().map(describe)` implementation. If one string moves by
   a character, the refactor is not additive.
3. `cli/main.test.ts` — `run(["covers"])` with no manual id returns `2` and the
   usage text still names every pre-existing command. Guards the allow-list at
   `main.ts:1873-1884` against a dropped `else if`.
4. `cli/wizard.test.ts` — the existing two-argument `assembleUpdatePrompt(state, "x")`
   assertions (`:1091-1180`) pass untouched, proving the third parameter is optional.
5. `cli/baselines.test.ts` — stamping module A leaves module B's entry
   byte-identical. This is the ordering hazard, pinned.
6. Manual smoke, named as such because it is not a unit test:
   `build broadlineavida` before and after must report the same section count and
   the same numbered-node count per target.

**Known, accepted test edits** (not behaviour breaks, but not purity either):
`readManualStates` expectations in `wizard.test.ts:435-536` gain a field, and
`describeState` (`:537`) gains a clause. Declared here rather than discovered in
review.

## 6. First slice, and the review budget

**Honest forecast: this exceeds the 400-line budget by roughly 3-4x.** Delivery
strategy is `ask-on-risk`, so it needs a decision before apply. Proposed chain,
five slices, each with its own start/finish/verification/rollback:

| # | Slice | Est. lines | Rollback |
|---|---|---|---|
| 1 | `documents:` parser + validator in `core` | ~300 | revert; no manual declares it yet, so nothing depends on it |
| 2 | `baselines.json` reader/writer + `verified` command | ~300 | revert; the file does not exist yet |
| 3 | `diffFacts` + the join + the reverse check | ~350 | revert; `diffMaps`'s output is unchanged either way |
| 4 | `covers` command + wizard scope step | ~350 | revert; `updateFlow` returns to two steps |
| 5 | Harness + skills + seed `broadlineavida` | ~350 | revert; docs and metadata only |

**Slice 1 is the first slice.** Start: `core/load-covers.test.ts` written first.
Finish: `documents:` parses, validates, rejects on a block-rooted file
(`load.ts:545`), and travels on `LoadedSection`. Verification: `pnpm test`
≥ 747 + new, `pnpm -r type-check` 9/9, plus pin (1). It is the only slice
everything else depends on, and it is inert until slice 5 seeds a declaration.

**Seeding, precisely bounded.** Slice 5 seeds `documents:` for `07` and `12`
**only** — both already carry the paths in a committed comment
(`12-broadsec-of-things.yaml:7-11`), so transcribing them reads no source. `08`,
`09`, `10`, `11` and the rest get **no `documents:` key** and a `null` baseline:
they then report `unknown coverage`, which is the true state. Writing a
`documents:` list for a never-verified module would require reading the product
to find out which files it describes — and that is content re-grounding, which is
out of scope. `documents:` must never be empty, for the reason `pending.covers`
must not be (`load.ts:345-351`): an empty list points at nothing.

## 7. Non-goals

- **Re-grounding the content of `08`/`09`/`10`/`11`.** Separate change. Seeding a
  `null` baseline and omitting `documents:` is metadata that records ignorance;
  it asserts nothing about the prose and changes not one word of it.
- **Node-level source citations.** The exploration's option (a) — generalising
  `labels:` to per-node capability/gate provenance — is rejected as unnecessary.
  Module-level provenance needs 10 declarations, not thousands, and that is the
  whole unblock.
- **Sub-module granularity.** Settled in §2.
- **Fixing the `08`-vs-`07` map-layer contradiction** (`08` says "Tenants: Todos"
  where `07-interfaz-general.yaml:111-145` carries the real `when` conditions,
  each with its `LayersMap.tsx` line above it). In scope only to the extent of
  not contradicting it.
- **The `dev` `registryMismatch`.** Pre-existing; `sources/registry.yaml` has a
  config the manual's axis values do not declare. Unchanged by this work.
- **Emitting modules/routes/screens from `extract`.** Steps 3 and 5 of
  `source-extraction` stay unimplemented (`SKILL.md:41-49`).
- **Parsing the `Producto:` trailer in code.** Design A stays rejected; the
  trailer remains informational.

## Capabilities

### New Capabilities

- `module-coverage`: the `documents:` file-level declaration — its schema,
  validation, `sourceBase` interaction, and the rule that an absent declaration
  means unknown coverage rather than none.
- `module-baselines`: `manuals/<manual>/baselines.json` — per-module
  `{ productCommit, verifiedAt }`, `null` semantics, the clean-checkout refusal,
  and the one-module-at-a-time write rule.
- `drift-module-join`: `diffFacts`, the three join states, the reverse
  undeclared-coverage check, and the `covers` command's report.
- `manual-update-flow`: the wizard's scope step, the optional `scope` parameter
  on `assembleUpdatePrompt`, and the extract → surface → decide → stamp ordering.

### Modified Capabilities

None. `openspec/specs/` is empty — this repository's behaviour is specified in
`AGENTS.md` files and skills, and those changes are enumerated in §4.

## 8. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `diffFacts` refactor changes a drift string by a character, and every consumer's expectation is a string | Med | Pin (2): existing `diffMaps` expectations run unchanged against the new implementation. If they move, the refactor is rejected, not the test |
| `documents:` becomes trusted decoration nobody checks — the exact failure the `labels:` mechanism was built to avoid | Med | §3.4: `covers` verifies every declared path against the checkout, and reports declared-but-gone AND drifted-but-undeclared. Verified, not trusted |
| An author or agent reads `unknown coverage` as "no drift here" | Med | The report repeats the **full** drift list under every `unknown` module rather than printing a count. Wording, and a test on the wording |
| Path matching is too coarse: one `documents:` entry naming `src/render/components/` matches every gate in the product | Med | Report the match count per entry in `covers`; an entry matching most of the drift is visible as such. Not blocked — an over-broad declaration is still more honest than none |
| `baselines.json` drifts from reality because nothing forces a commit to update it | Med | Accepted, and named in the exploration. Same trust model as `awaiting-product.json`, managed the same way: an explicit act, committed, visible in review |
| Slice 4 touches `wizard.ts`, the file the whole creation flow lives in | Med | Optional third parameter (§3.6) so no existing caller changes; pin (4) |
| Five chained PRs stall mid-chain, leaving `documents:` parsed and nothing reading it | Low | Every slice is inert-but-harmless alone. Slices 1-3 add capability no flow invokes; a stall leaves the nine existing flows exactly as they are |
| `packages/render-pdf` and `packages/catalog` are marked unused in their own `AGENTS.md` | Low | Not touched. Their `AGENTS.md` files are unaffected by §4 |

## 9. Open question — one, and it needs the owner

**Does declaring `documents:` become a `module-completeness` definition-of-done
item?**

Could not be answered from the code, and guessing wrong is expensive in one
direction. That checklist has teeth — the skill states "A section with an entry
in that queue is NOT complete, and must not be counted as done"
(`module-completeness/SKILL.md:196-197`), and "Anything unchecked is not a rough
edge. It is the module not being done" (`:412`). Adding the item makes 8 of
`broadlineavida`'s 10 modules formally incomplete the day it lands, for a manual
that is already delivery-proposed (`ESTADO.md:47-53`). That is a statement about
a shipped document's status, not a tooling decision, and it is the owner's call.

**Recommended default so nothing blocks:** add it, in slice 5, phrased as
*"the module declares which product paths it documents, and its baseline names
the commit it was verified against — or `null`, honestly"*. Rationale: 8 of 10
are already not done by other items on that list (`08`…`11` are unverified
legacy ports), so the item reveals a state rather than creating one. If the owner
prefers otherwise, slices 1-4 are unaffected and slice 5 drops one bullet.

Everything else in this proposal is decided on evidence and recorded above,
including the `documents:` naming (§3.1, one-word reversible), the baseline's
location (§3.2), and the seeding boundary (§6).

## Rollback plan

Per slice, per the table in §6 — each is a single revert with no data migration,
because nothing on disk exists until slice 5 and nothing reads `documents:`
until slice 3. Whole-change rollback: revert slices 5→1 in order; the nine
existing flows are restored by construction, and pins (1)-(5) are what prove it.

## Success criteria

- [ ] `pnpm test` green, with every test named in §5 passing on **unchanged**
      expectations except the two edits declared there
- [ ] `pnpm -r type-check` 9/9
- [ ] `broadsec-manual covers broadlineavida` reports, for all 10 modules,
      either joined drift or an explicit `unknown coverage` — and never
      `unaffected`
- [ ] `broadsec-manual covers broadlineavida` reports today's real drift
      (`AddObservation.tsx`, `CaseFiltering.tsx`, `CustomTag.tsx`,
      `MobileInfoWindow.tsx`, `OfficerDispatchDetail.tsx`,
      `canViewFilterTrafficDetails`) against `07`/`12` or as undeclared coverage
- [ ] `verified broadlineavida --module sections/07-interfaz-general.yaml`
      stamps exactly one entry and refuses on a dirty product checkout
- [ ] `extract broadlineavida` writes no baseline
- [ ] `build broadlineavida` reports the same section and numbered-node counts as
      before the change
- [ ] Every claim in §4's harness table is landed, and no `AGENTS.md` contradicts
      the code after it
