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
- [x] 1.6 Verify `pnpm test` ≥747+new, `pnpm -r type-check` 9/9; commit — 772/772, 9/9, commit `c6cafef`

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

- [ ] 4.1 RED — `packages/cli/src/main.test.ts`: `run(["documents"])` no manual id → 2; usage text names all 11 commands
- [ ] 4.2 GREEN (4a) — `packages/cli/src/main.ts`: `loadDocument`/`loadManual` carry `documents`; `documents <manual>` command (MUF-101..104, MUF-306); allow-list gains `documents`/`verified`
- [ ] 4.3 RED — `packages/cli/src/wizard.test.ts`: the 4 existing 2-arg `assembleUpdatePrompt` assertions (`:1091-1180`) pass untouched; module-scope prompt names the file, never a number; undeclared module says "unknown", never "unaffected"; ordering `extract`→`documents`→`verified`; `readModuleStates` describe block; `ManualState` literal edits at `:493`, `:538`, `:570`, `:1092`
- [ ] 4.4 GREEN (4b) — `packages/cli/src/wizard.ts`: `UpdateScope`; `assembleUpdatePrompt(s, instruction, scope = {kind:"manual"})`; `readModuleStates`; `ManualState.baselines`; `describeState` clause; `updateFlow` gains scope step (new step 2), renumbers rest
- [ ] 4.5 Verify + commit (or split 4a then 4b per design §5 if oversized)

## Phase 5 — Commit 5 (needs Phases 1 and 4; no test — verified by command output): `docs: the harness learns what a module documents, and 07 and 12 declare it`

- [ ] 5.1 Docs per ADR-010 table: root `AGENTS.md` (`:89`, `:112-114`), `packages/cli/AGENTS.md` (`:15-16`, `:29-30`, `:40-49`), `packages/core/AGENTS.md` (`:13`), `manuals/AGENTS.md` (`:7-19`, `:49-52`, `:99-106`), `manuals/broadlineavida/AGENTS.md` (`:35-40`), `skills/source-extraction/SKILL.md` (`:164-182`), `skills/module-completeness/SKILL.md` (`:26`, DoD untouched), `skills/block-authoring/SKILL.md` (`:88-91`)
- [ ] 5.2 New `skills/manual-update/SKILL.md`; validate with `skills-ref validate ./skills/manual-update`
- [ ] 5.3 Seed `manuals/broadlineavida/sections/07-interfaz-general.yaml` and `12-broadsec-of-things.yaml` `documents:` (resolve bare filenames per ADR-010 table — `module-map.json`/`registry.yaml`, no product read, no line ranges)
- [ ] 5.4 Verify: `documents broadlineavida` reports real drift against 07/12; `build broadlineavida` same section/node counts before/after; commit

## Dependencies

Phase 1 ⟂ Phase 2 (parallel-safe, no shared files) → Phase 3 (needs 1) →
Phase 4 (needs 1,2,3) → Phase 5 (needs 1,4). Each phase = one commit = one
`pnpm test` + `pnpm -r type-check` green gate before the next starts.
