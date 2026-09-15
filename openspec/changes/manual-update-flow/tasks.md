# Tasks: `manual-update-flow`

- **Reads**: `spec.md` (required), `design.md` (required), `proposal.md`
- **Delivery (owner decision, 2026-09-11)**: 5 work-unit commits on the branch
  `feat/manual-update-flow`. No PR flow, no push, no merge to `main`.
  `main` stays parked at `adbe8ee` so the owner can test this branch in
  isolation. This supersedes the proposal's "direct to `main`" wording, which
  predates the branch split.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1700–2000 total (5 commits, inherited ~300/300/350/350/350, design notes commit 3 grew and commit 4 is likeliest to overrun) |
| 400-line budget risk | Low for commits 1/2/3/5; **Medium-High for commit 4** |
| Chained PRs recommended | No — owner decided on 2026-09-11 to keep all work on `feat/manual-update-flow` with no PR flow |
| Suggested split | Not a PR split. Commit 4 has a **pre-decided fallback split** in `design.md` §5: **4a** = `main.ts` (`documents` command/report), **4b** = `wizard.ts` (scope step). 4b depends on 4a; 4a stands alone. Use only if commit 4's diff exceeds ~400 lines |
| Delivery strategy | `ask-on-risk` — the guard fired (estimate is 4-5x the 400-line budget) and the owner was asked; see resolution below |
| Chain strategy | N/A — no chain exists under branch-only delivery |

Decision needed before apply: **No — resolved**
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: High overall (Medium-High on commit 4), accepted as `size:exception`

**Guard resolution (2026-09-11).** The proposal (§6) correctly forecast this
change at 3-4x the 400-line budget and required a decision before apply under
`ask-on-risk`. An earlier revision of this forecast wrongly recorded that
decision as already settled and answered "no decision needed"; that inverted the
proposal and is corrected here.

The owner was asked and chose: **all five slices land as five commits on
`feat/manual-update-flow`, with no chained PRs.** The rationale is that there is
no human reviewer on this branch, so a PR chain buys ceremony rather than review.
The protection that replaces it is a **per-commit gate**: `pnpm test` and
`pnpm -r type-check` must both be green before the next commit starts, and each
slice keeps its own rollback boundary as listed in `proposal.md` §6. The total
size is therefore accepted as `size:exception`, recorded deliberately rather
than by omission.

## Spec/Design Consistency Check

Verified during this pass: `documents:` mapping schema (spec S-1/MUF-001 ==
design ADR-002/D2/D3) and command name `documents` (spec §2 == design ADR-008/D1)
agree. `baselines.json` absent-key-means-unverified (spec MUF-201 == design
ADR-005/D5) agrees. No new load-bearing contradiction found. Residual: MUF-304's
"notes the overlap" wording vs. design's per-entry `matched` count is a
phrasing nuance, not a contradiction (design's count IS the note) — carry as a
SUGGESTION, not CRITICAL.

## Phase 1 — Commit 1: `feat(core): a section can declare which product paths it documents`

- [x] 1.1 RED — `packages/core/src/documents.test.ts`: classify file/directory/glob/flag, `matchesPath`, `components/` vs `components-old/`, glob `*` never crosses `/` (ADR-002/007)
- [x] 1.2 GREEN — `packages/core/src/documents.ts`: `DocumentedPath`, `DocumentedFlag`, `DocumentsDeclaration`, `matchesPath`
- [x] 1.3 RED — `packages/core/src/load-documents.test.ts`: MUF-001..004 (mapping-only, empty-mapping/empty-sublist rejected, path-shape/flag-shape cross-rejection, no `:<line>`, block-rejection at `load.ts:545`), additivity pin (`documents` undefined when key absent)
- [x] 1.4 GREEN — `packages/core/src/load.ts`: `parseDocuments` beside `parsePending`/`parseLabels`; `LoadedSection.documents?`; add `"documents"` to block-rejection list
- [x] 1.5 `packages/core/src/index.ts`: `export * from "./documents.ts"`
- [x] 1.6 Verify `pnpm test` ≥747+new, `pnpm -r type-check` 9/9; commit — 772/772, 9/9, commit `88ae931`

## Phase 2 — Commit 2 (independent of Phase 1): `feat(cli): record which product commit a module was verified against`

- [x] 2.1 RED — `packages/cli/src/baselines.test.ts`: stamping module A leaves B byte-identical, sorted keys, missing file → `null`, source-text assertion `extract.ts` has no `baselines` reference
- [x] 2.2 GREEN — `packages/cli/src/baselines.ts`: `Baseline`, `BaselineFile`, `readBaselines`, `stampBaseline(manualDir, source, module, at)` — one `string`, no array (ADR-005/D5 — no seeded nulls)
- [x] 2.3 RED — `packages/cli/src/main.test.ts`: `verified` no `--module` → 1; `--all` → 1; unknown `--module` → 1; dirty / `isDirty===null` / unreadable-git refuse, write nothing (ADR-006, S-2); detached `HEAD` succeeds (S-3)
- [x] 2.4 GREEN — `packages/cli/src/main.ts`: wire `verified` into `run()` (`main.ts:1862`), `headCommit`/`isDirty` from `git.ts`, `--module` via `rest.indexOf`
- [x] 2.5 `packages/cli/AGENTS.md`: `verified` row, `--module` flag
- [x] 2.6 Verify + commit — 787/787, 9/9

## Phase 3 — Commit 3 (needs `DocumentsDeclaration` from Phase 1): `refactor(cli): drift becomes facts, and its report becomes their description`

- [x] 3.1 RED — `packages/cli/src/extract.test.ts`: new `diffFacts` cases incl. MUF-307 separator pin (`added` → `", "`, `changed` → `","`, `extract.ts:220` vs `:223-224`); every existing `diffMaps` expectation must stay green, unchanged
- [x] 3.2 GREEN — `packages/cli/src/extract.ts`: `DriftFact`/`JoinableFact`/`ManualWideFact`, `diffFacts`, `describeDrift`; `diffMaps = diffFacts(...).map(describeDrift)` (ADR-004)
- [x] 3.3 RED — `packages/cli/src/coverage.test.ts`: `covered`/`clean`/`unknown` states, multi-module match reported under every matching module, per-entry `matched` counts, `joinable` flag, stale-baseline key, wording assertion (never "unaffected")
- [x] 3.4 GREEN — `packages/cli/src/coverage.ts`: `joinCoverage(modules, facts, context)` → `EntryMatch`/`ModuleCoverage`/`CoverageReport` (ADR-007)
- [x] 3.5 Verify + commit — 813/813, 9/9, commit pending

## Phase 4 — Commit 4 (needs Phases 1–3; heaviest — apply 4a/4b split if diff >~400 lines): `feat(cli): the update flow points at a module and at its drift`

- [x] 4.1 RED — `packages/cli/src/main.test.ts`: `run(["documents"])` no manual id → 2; usage text names all 11 commands
- [x] 4.2 GREEN (4a) — `packages/cli/src/main.ts`: `loadDocument`/`loadManual` carry `documents`; `documents <manual>` command (MUF-101..104, MUF-306); allow-list gains `documents`/`verified`
- [x] 4.3 RED — `packages/cli/src/wizard.test.ts`: the 4 existing 2-arg `assembleUpdatePrompt` assertions (`:1091-1180`) pass untouched; module-scope prompt names the file, never a number; undeclared module says "unknown", never "unaffected"; ordering `extract`→`documents`→`verified`; `readModuleStates` describe block; `ManualState` literal edits at `:493`, `:538`, `:570`, `:1092`
- [x] 4.4 GREEN (4b) — `packages/cli/src/wizard.ts`: `UpdateScope`; `assembleUpdatePrompt(s, instruction, scope = {kind:"manual"})`; `readModuleStates`; `ManualState.baselines`; `describeState` clause; `updateFlow` gains scope step (new step 2), renumbers rest
- [x] 4.5 Verify + commit — split 4a/4b per design §5 (combined diff was 560 lines, over the ~400 budget): 4a (main.ts + extract.ts + their tests) 273 lines; 4b (wizard.ts + its tests) 287 lines. 831/831 tests, 9/9 type-check
- [x] 4.6 **Remediation** (post-4a/4b gate review, 2 CRITICAL): CRITICAL-1 — `documents`'s report never printed ADR-007's per-entry `matched` count or the unjoinable-path annotation, so a module with declared paths outside the scanned roots (e.g. `12-broadsec-of-things.yaml`, seeded in Phase 5) would read plain `clean`; `main.ts` now prints both. CRITICAL-2 — zero tests exercised `documents <manual>`'s printed report body; added a `documents <manual>` describe block in `main.test.ts` reusing `verified`'s temp-repo/git harness, covering MUF-101/102/103/104/306 (regression pins for already-correct behaviour) and the two new CRITICAL-1 behaviours (genuinely RED before the fix — see apply-progress for the evidence table). SUGGESTION — `coverage.test.ts`'s "never unaffected" pin recomments that it only guards the `state` union, not the CLI's real prose; the authoritative wording pin now lives in `main.test.ts`. 839/839 tests, 9/9 type-check; `documents broadlineavida` re-run live, all ten modules report unknown coverage (none seed `documents:` yet), never `unaffected`, tree stays clean.

## Phase 5 — Commit 5 (needs Phases 1 and 4; no test — verified by command output): `docs: the harness learns what a module documents, and 07 and 12 declare it`

- [x] 5.1 Docs per ADR-010 table: root `AGENTS.md` (`:89`, `:112-114`, plus the module definition in the four-stage pipeline description), `packages/cli/AGENTS.md` (`:15-16` — count and dispatch line fixed, missing `documents` row added; `:29-30`; `:40-49` — `documents` vs `coverage` clarified; `--module` flag row already present from Phase 2, no change needed), `packages/core/AGENTS.md` (`:13`, `drift` row corrected to name `coverage.ts`), `manuals/AGENTS.md` (`:7-19` — `baselines.json`/`image-requests.json`/`awaiting-product.json` added to Anatomy; `:49-52`; `:99-106` — `manual-update` row added), `manuals/broadlineavida/AGENTS.md` (`:35-40` — Sources-of-truth row added), `skills/source-extraction/SKILL.md` (`:164-182` — `diffFacts` and the `manual-update` pointer added), `skills/module-completeness/SKILL.md` (`:26`, DoD at `:386-411` untouched), `skills/block-authoring/SKILL.md` (`:88-91` — file-level-keys-are-not-blocks line added)
- [x] 5.2 New `skills/manual-update/SKILL.md`; validated with `npx skills-ref validate ./skills/manual-update` → `Valid skill: ./skills/manual-update`
- [x] 5.3 Seeded `manuals/broadlineavida/sections/07-interfaz-general.yaml` (`sourceBase: src/render/`, `documents.paths: [components/LayersMap.tsx]`, resolved via `knowledge/module-map.json:1573` `references[].file`) and `12-broadsec-of-things.yaml` (`sourceBase: src/render/`, `documents.paths: [routes/AppRoutes.tsx, pages/PMV/PMVPage.tsx, pages/BroadsecOfThings/*.tsx, locales/translations/es.json]`, resolved via `sources/registry.yaml:27,30,32`; no `flags:` — left for whoever re-grounds the module per design §7). No product file read, no line ranges seeded.
- [x] 5.4 Verified: `documents broadlineavida` run live — module 12 prints the ADR-007 unjoinable annotation on real content ("2 of this module's 4 declared paths lie outside the scanned roots..."), module 07 reports `clean — never verified` with `0 of 3 facts`, today's real drift (3 `capability added` facts) appears entirely under "undeclared coverage" (neither module declares a matching `flags:` entry); `git status --short` unchanged after the run (ADR-008 writes nothing). `build broadlineavida` run before AND after seeding (via `git stash push -u -- <the two section files>` / `pop`, isolating the metadata-only diff): both runs report identically `tenant=mv 10 section(s), 206 numbered node(s), 80 page(s), 240/240 image(s)` and `tenant=med 9 section(s), 159 numbered node(s), 59 page(s), 186/186 image(s)` — byte-identical section/node/page/image counts. `pnpm test` 839/839, `pnpm -r type-check` 9/9, both unchanged by this commit. Commit `645251a`.

**Phase 5 / Commit 5 done. All five phases of `manual-update-flow` are complete on `feat/manual-update-flow`.**

## Phase 6 — Remediation commit (post change-level verify gate, 1 CRITICAL + 2 WARNING)

Fresh-context change-level verify gate before archive (range `adbe8ee..c51c5f0`)
found one new CRITICAL and two new WARNINGs, none blocking on prior gates
because none scoped their review to these classes of defect. Scope held
strictly to the three findings — nothing else touched.

- [x] 6.1 **CRITICAL-1** — spec.md MUF-303's table and MUF-305's scenario
  disagreed with design.md ADR-004 on axis-value fact reporting: spec said
  every `axis-value` fact is always reported under "undeclared coverage";
  ADR-004 types `axis-value`/`axis-changed` as `ManualWideFact`, structurally
  excluded from `CoverageReport.undeclared: readonly JoinableFact[]`, and the
  shipped code (`main.ts:2143-2145`) already prints them under a separate
  "N manual-wide change(s):" heading. Resolved: **design wins**, the fourth
  such ruling in this change (see spec.md's Reconciliation note, rulings 3
  and 4) — reconciled inline at MUF-303's table and MUF-305's requirement
  text/scenario, each with its own "Reconciled 2026-09-15" note matching the
  pattern MUF-301 already used. Risks table also updated.
- [x] 6.2 **Test gap closed** — no test anywhere exercised an axis-value fact
  end-to-end through `documents`. Added
  `packages/cli/src/main.test.ts`'s `CRITICAL-1 (ADR-004)` test, reusing the
  existing `documents <manual>` describe block's temp-repo/git-free harness
  (the fixture's one tenant config with no prior `knowledge/module-map.json`
  already produces an `axis-value: "added"` fact for `mv` on every run — no
  new fixture needed). The assertion discriminates the routing (walks the
  "undeclared coverage" block specifically and asserts the fact is absent
  from it, rather than a bare `toContain`) — proved by temporarily merging
  `report.manualWide` into the undeclared print path in `main.ts`
  (simulating the old, contradicted spec reading), observing
  `expected -1 to be greater than -1` (the "manual-wide change(s):" heading
  never printed), then restoring the original routing. 840/840 tests
  (839 + 1 new), 9/9 type-check.
- [x] 6.3 **WARNING-1** — `packages/cli/AGENTS.md`'s commands table listed 10
  rows against its own "eleven" header, permanently omitting
  `release-notes <manual>` (pre-existing since before this branch). Added the
  missing row, matching the table's shape and voice.
- [x] 6.4 **WARNING-2** — `packages/cli/AGENTS.md:15`'s "corrected" dispatch
  line (`main.ts:1862`, copied from design.md ADR-008 before Phase 4 shifted
  the file ~250 lines) was itself stale; `run` is actually at `main.ts:1884`
  (`rg -n "^export async function run\("`). Fixed. Re-derived every other
  `file:line` reference and count claim in the five AGENTS.md files this
  change touched (`AGENTS.md`, `packages/cli/AGENTS.md`,
  `packages/core/AGENTS.md`, `manuals/AGENTS.md`,
  `manuals/broadlineavida/AGENTS.md`) against HEAD: `packages/cli/AGENTS.md`
  held the only `file:line` reference in the set (the one just fixed);
  `AGENTS.md`'s "eleven"/"twelfth" command counts checked against the actual
  11 manual-id-taking commands + `new` — correct, no change. No other stale
  reference or count found.

Verify (fresh-context, this batch): `pnpm test` 840/840, `pnpm -r type-check`
9/9, both green. `git status --short` shows only the intended files. No push,
no PR, no merge — `main` stays parked at `adbe8ee`.

## Phase 7 — Remediation commit: a post-verify defect none of the four gates caught

Found by the owner, live, running the exact sequence the change's own
documentation prescribed: `node packages/cli/src/main.ts documents
broadlineavida` reported 3 undeclared-coverage facts; `extract broadlineavida`
printed the same 3 facts AND overwrote `knowledge/module-map.json`;
`documents broadlineavida` immediately after reported **nothing at all, for
every module** — `extract` had already stamped the map with the post-drift
state, so the next diff was empty. Two shipped artifacts told the operator to
run exactly that destructive sequence: `wizard.ts`'s assembled per-module
prompt (`extract` then `documents`) and `skills/manual-update/SKILL.md`'s
one-line procedure and numbered steps (same order).

- [x] 7.1 **Lesson, recorded plainly**: four fresh-context gates (Phases 1-4's
  per-phase gates plus the change-level verify gate before archive) all
  exercised `documents` in isolation. None of them ran the sequence the
  change's own documentation told an operator to run. A gate that checks a
  command's own correctness is not the same as a gate that checks whether the
  *documented procedure* is safe to follow — this defect lived entirely in
  the second category, and nothing in this change's review process targeted
  it.
- [x] 7.2 Fixed the order and removed `extract` from the per-module loop
  entirely (not merely reordered — `extract` rewrites the map for the WHOLE
  manual, so it cannot run inside a scoped update without discarding drift
  for every module not being edited): `packages/cli/src/wizard.ts`'s
  `scopeBlock` now instructs `documents <manual>` as the first act and
  explicitly says `extract` does not belong in this flow.
- [x] 7.3 RED — `packages/cli/src/wizard.test.ts`'s `"the optional scope
  parameter (ADR-009)"` describe block had an assertion pinning the WRONG
  order (`extract` → `documents` → `verified`). Rewrote it to pin
  `documents` before `verified` and to fail if `extract` is ever instructed
  to run before `documents`; observed genuine RED against the unmodified
  `wizard.ts` — `AssertionError: expected false to be true` at the
  `extractAt === -1 || extractAt > documentsAt` assertion (`extract` was
  found before `documents`, confirming the old prescription).
- [x] 7.4 GREEN — after the `wizard.ts` fix, the same test and the full
  `wizard.test.ts` file (157 tests) pass.
- [x] 7.5 `skills/manual-update/SKILL.md` — rewrote the one-line procedure and
  renumbered the steps: `documents` → decide → stamp is the per-module loop;
  `extract` moved to its own "Refreshing the map (separate, whole-manual)"
  section with an explicit warning against running it mid-update, plus an
  updated frontmatter `description` and "Using the wizard" section.
- [x] 7.6 Swept for other artifacts prescribing the same order:
  `openspec/changes/manual-update-flow/spec.md` (MUF-503/504/506, corrected
  inline, plus reconciliation ruling 5 and a new Risks row),
  `openspec/changes/manual-update-flow/design.md` (ADR-009 item 4, its
  "Tests" paragraph, and a new Risks row), and `manuals/AGENTS.md`'s
  `manual-update` row (the ordering summary and the `extract`-is-separate
  clarification). `packages/cli/AGENTS.md`, the root `AGENTS.md`, and the
  other eight skills were checked and did not prescribe this order.
- [x] 7.7 Live verification against `broadlineavida` with the corrected
  sequence, reverted before commit (see report for the exact output).

Verify (this batch): `pnpm test` 840/840, `pnpm -r type-check` 9/9, both
green. `documents broadlineavida` confirmed to still report the same 3
capability facts after the fix, with any map write reverted via
`git checkout --` and `git status` clean before commit. No push, no PR, no
merge — `main` stays parked at `adbe8ee`.

## Dependencies

Phase 1 ⟂ Phase 2 (parallel-safe, no shared files) → Phase 3 (needs 1) →
Phase 4 (needs 1,2,3) → Phase 5 (needs 1,4). Each phase = one commit = one
`pnpm test` + `pnpm -r type-check` green gate before the next starts.
