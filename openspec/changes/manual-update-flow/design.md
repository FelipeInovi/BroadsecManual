# Design — `manual-update-flow`

The architecture for driving "update a manual" from product drift, at module
granularity, with a per-module baseline hooked to the source product's commit.

- **Phase**: `design`
- **Artifact store**: hybrid (this file + engram `sdd/manual-update-flow/design`)
- **Inputs read in full**: `proposal.md` (420 lines), `explore.md` (316 lines)
- **Skills read in full**: `source-extraction`, `module-completeness`,
  `block-authoring`, `tenant-conditioning`, `work-unit-commits`
- **Every `file:line` below was printed back from the file before being written.**

## 0. What this design changes about the proposal

The proposal is adopted whole except for the five items below. Each is a decision
the proposal left open or stated without weighing a constraint this design found
in the code. Each is flagged, reversible, and moves nothing else.

| # | Proposal said | This design decides | Why |
|---|---|---|---|
| D1 | the command is `covers` (§3.4) | the command is **`documents`** | `covers` is a validated key with a different meaning (`load.ts:335-344`), and `coverage` is documented as never built and reserved for a different question (`packages/cli/AGENTS.md:42`, `tenant-conditioning/SKILL.md:128-134`). See ADR-008 |
| D2 | `documents:` is a flat list of paths and flag names (§3.1) | `documents:` is a mapping with **`paths:` and `flags:`** sub-keys | the two kinds join against different fact kinds and `sourceBase` applies to only one of them; inferring the kind from the string makes a mistyped path silently become a flag declaration. See ADR-002 |
| D3 | pin (1): `covers` is `[]` for a file that declares none | `documents` is **absent** (optional property), never `[]` | `documents: []` must be a `ContentError` (`load.ts:345-351`), and an empty array from an absent key would be the same value as one from a rejected key. The three-state join (§3.3) is only expressible if absence is distinguishable. See ADR-002 |
| D4 | `core/AGENTS.md`: `documents:` "is parsed here and joined in `cli`" (§4) | parsed in `core`, joined in a **new pure `cli` module** (`coverage.ts`), and the `drift` row is corrected to point at `packages/extract` | the join needs both `core`'s declaration type and `extract`'s fact type; `packages/extract` is a dependency-free leaf (`packages/extract/package.json` has no `@broadsec-manual/*` dependency), so it cannot import `core`. See ADR-003 |
| D5 | slice 5 seeds `null` baselines for `08`…`11` (§6) | slice 5 creates **no `baselines.json` at all** | an absent module key already means "never verified", so a file of nulls asserts nothing while breaking §3.5's rule that only `verified` writes that file. See ADR-005 |

Two corrections to the proposal's §5 additivity plan, declared here rather than
discovered in review:

- `ManualState` gains one **required** field, so **four** call sites in
  `wizard.test.ts` need it, not one: the literal at `:493`
  (`toEqual<ManualState[]>`), the builders at `:538` and `:570`, and the literal
  at `:1092`. The proposal declared only `:435-536`.
- `07-interfaz-general.yaml` carries **no** file-header source list. Its citations
  are four row-level comments naming a bare filename
  (`07-interfaz-general.yaml:111,120,129,138` — e.g. `# LayersMap.tsx:76 — the
  entry only exists when`). Seeding its `documents:` therefore requires resolving
  `LayersMap.tsx` to a real directory. That resolution reads the **map**, not the
  product — see ADR-010.

## 1. Architecture at a glance

Layering follows the dependency graph the workspace already declares:
`extract` is a leaf, `core` depends only on `blocks`, `cli` depends on all three
(`packages/extract/package.json`, `packages/core/package.json:13`,
`packages/cli/package.json:13-15`).

```
packages/core (pure, AST engine)
  documents.ts        NEW  DocumentsDeclaration, entry kinds, the string matcher
  load.ts             MOD  parseDocuments() beside parsePending/parseLabels;
                           LoadedSection.documents?

packages/extract (pure, leaf, product -> facts)
  (unchanged)              AxisReference, CapabilityRow already carry everything

packages/cli (the only package that touches the disk)
  extract.ts          MOD  DriftFact, diffFacts, describeDrift;
                           diffMaps = diffFacts(...).map(describeDrift)
  coverage.ts         NEW  the join: declarations x joinable facts -> module states
  baselines.ts        NEW  read/stamp manuals/<manual>/baselines.json
  main.ts             MOD  loadDocument/loadManual carry documents;
                           `documents` and `verified` commands in `run`
  wizard.ts           MOD  readModuleStates, UpdateScope, the scope step,
                           assembleUpdatePrompt's optional third parameter
```

Nothing enters the AST. `documents:` joins `pending`, `labels` and `sourceBase`
as the fourth member of the file-level facts channel, and `releaseLede`'s doc
comment already states the rule for that channel in general terms:

> "A TOP-LEVEL KEY, read from the raw mapping the way `loadSection` reads
> `pending` and `labels`: it is something the FILE says about itself rather than
> a block on the page, and the AST has no place for it."
> — `packages/cli/src/main.ts:1145-1147`

`packages/extract/AGENTS.md:51-52` claims "Nothing downstream of
`module-map.json` changes — `core`, the renderers and the content layer never
learn what a product is." **That claim survives this change, and it is a
constraint on the design, not an observation about it**: `core`'s matcher holds
opaque path strings and flag names, resolves nothing, and never touches a
filesystem. `packages/extract/AGENTS.md` therefore needs no edit.

## 2. Data flow

```
sources/registry.yaml ──▶ sourceRootFor(repoRoot, manualId)      extract.ts:286
                            │  sourceRoot, entry.extract.{components,pages}
                            ▼
product checkout ────────▶ extract()  ──▶ ModuleMap (fresh)      extract.ts:392
   (READ-ONLY)                │
knowledge/module-map.json ────┤  previous map on disk            extract.ts:406
                              ▼
                        diffFacts(before, after) : DriftFact[]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     ManualWideFact[]                  JoinableFact[]
   (axis-changed, axis-value)        (capability | gate)
              │                               │
              │        sections/*.yaml ──▶ loadSection ──▶ documents?
              │                               │           load.ts:532
              │                               ▼
              │                        joinCoverage(modules, facts)
              │                               │        cli/coverage.ts
              ▼                               ▼
        reported above          per-module: covered | clean | unknown
        every module            plus: undeclared facts, per-entry match counts,
                                unjoinable entries, stale baseline keys
                                            │
   manuals/<manual>/baselines.json ─────────┤  readBaselines()
   git -C <sourceRoot> rev-parse HEAD ──────┘  headCommit/isDirty  git.ts:30,42
                                            ▼
                                  `documents <manual>` report
                                            │
                          human decides, per module, then:
                                            ▼
                     `verified <manual> --module sections/NN-….yaml`
                                  writes ONE key. Never two.
```

`extract` sits **before** the join and writes no baseline. That ordering is
structural, not procedural — ADR-005.

## 3. Decisions

### ADR-001 — A module is identified by its section filename

**Decision.** A module's id is the string `sections/<name>.yaml`: exactly the
`file` argument `loadSection` is already handed
(`packages/cli/src/main.ts:170` — `loadSection(readFileSync(join(dir, f), "utf8"), \`sections/${f}\`, catalog)`).
It is the key of `baselines.json`, the value of `--module`, and the identity a
`DocumentsDeclaration` carries as `declaredIn`.

**Rationale.**

1. **It is already this identity everywhere else on the file-level channel.**
   `PendingDeclaration.file` is "The content file it was declared in"
   (`packages/core/src/pending.ts:32-33`) and `LabelCitation` is built with
   `declaredIn: file` (`packages/core/src/load.ts:525`). A third identity for the
   same unit would be a third thing to keep in step.
2. **The build already reports by it.** `assertChangeLog`'s `named(i)` is
   `files[i]` (`main.ts:256`), and its error text explains that filename order is
   load-bearing: "Sections load in FILENAME order, so the position is decided
   while naming a file, not while thinking about the change log"
   (`main.ts:242-244`).
3. **A key whose file stops existing is detectable** — `readdirSync(dir).filter(f => f.endsWith(".yaml")).sort()` (`main.ts:163-165`) is the complete
   authoritative list, so a baselines key with no file is a reportable fact.

**Rejected: the root `SectionNode.id`** (e.g. `interfaz-general`,
`07-interfaz-general.yaml:11`). It does not survive conditioning. A whole file
can be conditioned away — `12-broadsec-of-things.yaml:24-25` carries
`when: tenant: [mv, demo]` — so for the `med` target that root node and its id
are gone, and a baseline keyed on it would be unresolvable for exactly the
targets that most need auditing. The filename exists for every target.

**Rejected: a declared `module:` key.** A required new field in all ten files,
enforcing by convention what the filename already enforces by construction, and
a second name to keep in step with the first.

**Consequence, accepted.** Renaming a section file orphans its baseline entry.
Handled by reporting, in the spirit of `registryMismatch` — "Reported, never
reconciled automatically" (`packages/cli/src/extract.ts:88-89`): `documents`
prints a baselines key with no matching file as a stale entry, and `verified`
refuses a `--module` naming a file that does not exist.

**Tests.** `packages/cli/src/coverage.test.ts` — a module list and a baselines
map that disagree produce a stale-entry finding. `packages/cli/src/main.test.ts`
— `verified` with an unknown `--module` returns 1.

### ADR-002 — `documents:` shape, parser and where it lands

**Decision.** A new top-level key on a section file, parsed in
`packages/core/src/load.ts` by a hand-rolled `parseDocuments`, mirroring
`parsePending` (`load.ts:295-392`) and `parseLabels` (`load.ts:437-529`) rather
than introducing Zod into that file — neither of the two existing parsers uses
it, and `selectorSchema` (`load.ts:173`) is the only schema `load.ts` reaches
for, for a value that has a schema elsewhere.

```yaml
# sections/12-broadsec-of-things.yaml
sourceBase: src/render/
documents:
  paths:
    - routes/AppRoutes.tsx            # a file
    - pages/PMV/PMVPage.tsx           # a file
    - pages/BroadsecOfThings/*.tsx    # a glob: `*` never crosses a `/`
    - components/                     # a directory: the trailing `/` is required
  flags:
    - canSeeBoT                       # a capability flag name
```

Types, in a new `packages/core/src/documents.ts` (exported from
`packages/core/src/index.ts`, which is seven `export *` lines today):

```ts
/** A product path a module says it documents, classified at parse time. */
export type DocumentedPath =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "directory"; readonly path: string }   // always ends in "/"
  | { readonly kind: "glob"; readonly path: string };       // one "*", last segment

/** A capability flag a module says it documents. Never a path — see below. */
export interface DocumentedFlag { readonly flag: string }

export interface DocumentsDeclaration {
  /** `sections/12-broadsec-of-things.yaml` — the module id. See ADR-001. */
  readonly declaredIn: string;
  /** The root section's id, so a message can name the section as well. */
  readonly section: string;
  readonly paths: readonly DocumentedPath[];
  readonly flags: readonly DocumentedFlag[];
}

/** Pure, string-only. Never touches a filesystem; never resolves anything. */
export function matchesPath(entry: DocumentedPath, file: string): boolean;
```

On `LoadedSection` (`load.ts:253-277`), as an **optional** property:

```ts
  /**
   * Which parts of the product this section says it describes.
   *
   * ABSENT and EMPTY are different, and absent is the load-bearing one: a file
   * that declares nothing has UNKNOWN coverage, not none. `documents: {}` is a
   * ContentError, for the same reason an empty `pending.covers` is.
   */
  readonly documents?: DocumentsDeclaration;
```

**Rationale for two sub-keys rather than one heterogeneous list (D2).**

1. **They join against different fact kinds.** A path joins on
   `AxisReference.file` (`packages/extract/src/tenant-references.ts:34`); a flag
   joins on `CapabilityRow.flag`, and `CapabilityRow` carries `flag`, `values`,
   `absentFrom`, `enabledFor` and **no path at all**
   (`packages/extract/src/tenant-config.ts:83-91`), with `FlagFact` being
   `{ value, line }` (`tenant-config.ts:15-18`).
2. **`sourceBase` applies to one and must not apply to the other.**
   `sourceBase` is a path prefix (`load.ts:449-452`,
   `parseFrom` applies it at `load.ts:426` as `` `${base}${raw.slice(0, at)}` ``).
   Prefixing `canSeeBoT` with `src/render/` produces a declaration that matches
   nothing and reads like a path. With sub-keys that rule is structural; with one
   list it has to be re-derived from each string's shape at every use.
3. **Inference fails silently and in the wrong direction.** Told to classify by
   shape, `AppRoutes` (a mistyped `AppRoutes.tsx`) becomes a flag declaration,
   and `documents` then reports "declared flag absent from the capability
   matrix" — a confident message about the wrong thing. `parseFrom` already
   refuses the analogous inference: "`from` must be `<file>:<line>`, not "…". The
   line is what makes the citation checkable; a bare filename can only be
   searched, and a search finds the label wherever it moved to and reports
   nothing." (`load.ts:421-424`).

**Rationale for absent-not-empty (D3).** `documents: {}`, `paths: []` and
`flags: []` are all `ContentError`, for the reason `pending.covers` is: "`covers`
needs at least one node id, or the entry points the queue at nothing"
(`load.ts:345-351`). An absent key returning `[]` would be indistinguishable from
a rejected one, and the `unknown` join state (§3.3 of the proposal) is only
expressible if absence survives parsing. Optional-property is the repo's idiom
for "absent means unknown": `ModuleMap.registryMismatch?` (`extract.ts:90`),
`CapabilityRow.absentFrom?` (`tenant-config.ts:88`), `PreviousMap.axis?`
(`extract.ts:101`), each with the same argument written above it.

**Validation rules, each with its error text's job.**

| Rule | Error says |
|---|---|
| `documents` must be a mapping, not a list | which two sub-keys it takes and what each joins on |
| at least one of `paths`/`flags`, non-empty | that an empty declaration points at nothing, and that omitting the key entirely is the honest way to say "unknown" |
| a path entry is a non-empty string containing `/` or `.` | that a path must look like a path, and that a bare identifier belongs under `flags:` |
| a path entry carries no `:<line>` | that gate identity is deliberately never line-based (`extract.ts:143-150`, `gateKey` at `:151`), so a line could not narrow a join that has no line to match on — the line range in a header comment stays a comment |
| `*` appears at most once, in the last segment, and a `directory` entry ends in `/` | why a bare prefix is refused — see ADR-007 |
| a flag entry matches `/^[A-Za-z_][A-Za-z0-9_]*$/` | that a flag is the identifier the product's config declares (`BOOLEAN_FLAG`, `tenant-config.ts:32`), not a path |
| `documents` on a block-rooted file | reuses the existing message by adding `"documents"` to the list at `load.ts:545`: "`documents` belongs on a section, not on a block. Both are things a content FILE says about itself, and a file is a section." |

**Tests.**
`packages/core/src/documents.test.ts` (pure: classification and `matchesPath`).
`packages/core/src/load-documents.test.ts` (integration, named after the existing
`load-pending.test.ts`): every rule above, plus the additivity pin — a section
file with no `documents:` yields a `LoadedSection` whose `node`, `warnings`,
`pending` and `labels` are identical to today's and whose `documents` is
`undefined`.

### ADR-003 — Where the fact type, the diff and the join live

**Decision.** Three homes, decided by what each piece can import:

| Piece | Home | Why it cannot live elsewhere |
|---|---|---|
| `DriftFact`, `diffFacts`, `describeDrift` | `packages/cli/src/extract.ts`, beside `diffMaps` | see below |
| `DocumentsDeclaration`, `matchesPath` | `packages/core/src/documents.ts` | it is what a content file says about itself, which is `core`'s channel |
| `joinCoverage` — the join | **new** `packages/cli/src/coverage.ts` | it needs `core`'s declaration type AND `extract`'s fact type, and `packages/extract` declares no `@broadsec-manual/*` dependency at all, so it cannot import `core` |

**Why the fact type does not move to `packages/extract`.** It was considered: the
package is "Source product → facts. Pure functions over source text"
(`packages/extract/AGENTS.md:3-4`), and `reconcileAxisValues` is already the
precedent — a pure comparison living there with its own test
(`packages/extract/src/reconcile.test.ts`), consumed by `extract()` in `cli`
(`extract.ts:390`). Rejected on two grounds. `diffMaps` and `normalizeMap` are
already pure and already tested with no filesystem in
`packages/cli/src/extract.test.ts`, which imports them from `"./extract.ts"`
(`extract.test.ts:6`) — so the testability that `packages/cli/AGENTS.md:51-55`
protects is already satisfied. And pin (2)'s entire value is that the file
holding the byte-identity proof does not move; relocating the thing whose
byte-identity is the evidence weakens the evidence. Moving `ModuleMap` would buy
layering for the fact type and none for the decision that matters, since the join
cannot follow it there.

**Why a pure decision module is allowed in `cli`.** `packages/cli/AGENTS.md:51-55`
says "Any decision made here is a decision in the wrong package — pipeline logic
belongs in `core`, where it can be tested without a filesystem." The concern it
names is testability without a filesystem, and the repository already resolves
the straddling case this way: `delivery-state.ts`, `naming.ts`, `awaiting.ts` and
`pending-table.ts` are pure modules in `cli`, each with its own filesystem-free
test. `delivery-state.ts` is the exact analogue — it joins change-log rows
(content) with delivery facts, and `deliveryProofFor`'s comment states the rule:
"The WALK is this function's job; the judgement is `proofFor`'s… two
implementations of 'does this count as a delivery' is how one of them comes to
say yes where the other says no" (`main.ts:320-323`).

**Consequence for the harness.** `packages/core/AGENTS.md:13`'s `drift` row —
"Compare declared facts against the extracted `module-map.json`" — describes
something `core` does not do and now will not do. It is corrected to name where
each half lives, not moved into `cli` (D4).

### ADR-004 — The drift fact type, and `diffMaps` as its `describe`

**Decision.** `diffFacts(before, after): readonly DriftFact[]`, and
`diffMaps(before, after) = diffFacts(before, after).map(describeDrift)`.
`diffMaps` keeps its exported name, signature and byte-identical output
(`extract.ts:192`), which is simultaneously the design and the additivity proof.

**The type splits joinable from manual-wide, structurally.**

```ts
/** A fact that names something a module could have declared it documents. */
export type JoinableFact =
  | { readonly kind: "capability"; readonly change: "added" | "removed" | "changed";
      readonly flag: string;
      readonly was?: readonly string[]; readonly now?: readonly string[] }
  | { readonly kind: "gate"; readonly change: "added" | "removed" | "changed";
      readonly file: string; readonly codes: readonly string[];
      readonly gateKind: AxisReference["kind"];
      readonly was?: string; readonly now?: string };

/**
 * A fact no module documents, because it is true of the whole manual.
 *
 * Separated in the TYPE rather than filtered at runtime: `joinCoverage` takes
 * `JoinableFact[]`, so handing it a deployment that appeared is a type error
 * instead of a judgement somebody has to remember to make.
 */
export type ManualWideFact =
  | { readonly kind: "axis-changed"; readonly before: string; readonly after: string }
  | { readonly kind: "axis-value"; readonly change: "added" | "removed";
      readonly axis: string; readonly id: string };

export type DriftFact = JoinableFact | ManualWideFact;
export function describeDrift(fact: DriftFact): string;
```

**Why `axis-value` is manual-wide and not "undeclared coverage".** An axis value
has neither a file nor a flag, so it can never match any `documents:` entry, and
filing every one of them under "no module declared this" would be technically
true and practically noise. `imageRequests` has already paid for that lesson —
the orphan set is computed across all deployments because judging it per
deployment "reported every tenant-specific image as an orphan, which is noise
that trains people to ignore the one report that matters"
(`main.ts:424-428`). A deployment appearing or disappearing changes
`manual.config.yaml`'s `axes` and every build target (`manualConfigSchema`,
`main.ts:116-117`), so its reader is whoever maintains the config.

**Why the gate fact carries `file`, `codes` and `gateKind` separately.** Today
`gateKey` joins them into `` `${r.file}|${r.codes.join(",")}|${r.kind}` ``
(`extract.ts:151`) and `describeGate` splits the key back apart to print it
(`extract.ts:154-157`). That round trip is the lossiness this design removes: the
join needs `file` as a field, not as the first segment of a delimited string.
`describeDrift` rebuilds `` `${file} — ${codes.join(",")} (${gateKind})` ``, which
is byte-identical because `gateKey` joined the codes with `","` and
`describeGate` printed that joined segment verbatim.

**Two byte-level hazards this refactor must not smooth over.**

1. **The capability separators differ per change kind.** `added` prints
   `` row.enabledFor.join(", ") || "nobody" `` — comma-space
   (`extract.ts:220`). `changed` prints `` old.enabledFor.join(",") `` and
   `` row.enabledFor.join(",") `` — comma, no space (`extract.ts:223-224`).
   `describeDrift` applies the separator per `change`, and a single well-meant
   normalisation here is the most likely way this refactor stops being additive.
2. **Emission order is part of the output.** `diffFacts` emits in exactly the
   order `diffMaps` does today: axis values added then removed
   (`extract.ts:211-212`); capabilities by iterating `after` for added and
   changed, then `before` for removed (`extract.ts:217-232`); gates by iterating
   after for added and changed, then before for removed
   (`extract.ts:236-253`). The `axis-changed` early return
   (`extract.ts:200-206`) returns that single fact and nothing else.

**Tests.** `packages/cli/src/extract.test.ts` — every existing `diffMaps`
expectation runs **unchanged** against the new implementation, including
`report()`'s newline join (`extract.test.ts:35`), the `toEqual([])` assertions
(`:76`, `:132`, `:142`, `:197`, `:225-226`) and the `toContain("axis changed:
tenant -> permission")` assertion (`:93`). New tests in the same file assert the
fact shapes and that `diffMaps` equals `diffFacts().map(describeDrift)` for each
change kind. If one string moves by a character, the refactor is rejected — not
the test.

### ADR-005 — `baselines.json`: read, stamp, and the ordering guard

**Decision.** `manuals/<manual>/baselines.json`, in a new
`packages/cli/src/baselines.ts`.

```ts
export interface Baseline {
  /** The FULL 40-char sha `rev-parse HEAD` gave. Never abbreviated on disk. */
  readonly productCommit: string;
  /** ISO date, from the stamping run. */
  readonly verifiedAt: string;
}

export interface BaselineFile {
  readonly source: string;
  /** Keyed by `sections/<name>.yaml` — ADR-001. Written sorted, always. */
  readonly modules: Readonly<Record<string, Baseline>>;
}

/** `null` when the file does not exist — no manual has been stamped yet. */
export function readBaselines(manualDir: string): BaselineFile | null;

/**
 * Stamp ONE module. The parameter is a `string`, not an array, and this module
 * exports no array-taking function — so "stamp them all" is unrepresentable
 * rather than merely discouraged.
 */
export function stampBaseline(
  manualDir: string,
  source: string,
  module: string,
  at: Baseline,
): BaselineFile;
```

**An absent key means never verified, and there is no explicit `null` on disk.**
The proposal typed `productCommit: string | null` and seeded nulls (§3.2, §6).
This design drops the null (D5): absent and `null` would mean the same thing, and
two spellings of one fact is the defect `documents:` was named to avoid (§3.1).
`readBaselines` returns `null` for a missing file and the reader treats a missing
key as never-verified, which is the `absentFrom` discipline read correctly —
"absent is NOT false" (`tenant-config.ts:96-102`) holds because here absent and
false-ish genuinely coincide, and saying so once is more honest than writing ten
nulls.

**Consequence:** slice 5 creates no `baselines.json`. The file comes into
existence the first time `verified` runs. `documents` reports its absence as "no
module has been held against a product commit", which is today's true state.

**Keys are always written sorted.** Section files already load in sorted filename
order (`main.ts:163-165`), and `packages/extract` sorts on the same principle —
`configs.sort((x, y) => x.id.localeCompare(y.id))` (`extract.ts:371`) and
`[...new Set(...)].sort()` in `capabilityMatrix` (`tenant-config.ts:104`).
Sorting makes "stamping A leaves B byte-identical" true regardless of write
order, which is what makes the ordering hazard pinnable.

Serialisation follows the repository's one idiom for a committed JSON artefact:
`` `${JSON.stringify(x, null, 2)}\n` `` (`extract.ts:413`, `main.ts:933`,
`main.ts:994`).

**The ordering guard, in four structural parts.**

1. **`extract.ts` never imports `baselines.ts`.** `ExtractResult`
   (`extract.ts:258-262`) gains no field. Pinned by a source-level assertion in
   `packages/cli/src/baselines.test.ts`: the text of `extract.ts` contains no
   `baselines` reference. Blunt on purpose — the hazard is a future edit, and a
   behavioural test cannot see an import that has not been written yet.
2. **`stampBaseline` takes one `string`.** No overload, no array, no
   `readonly string[]` anywhere in the module's exported surface.
3. **`verified` has no `--all`, and refuses it loudly.** `parseAxisFilters`
   ignores unrecognised flags — its loop has no `else` branch
   (`main.ts:714-735`) — so an unhandled `--all` would be silently dropped and
   the operator would believe ten modules were stamped. `verified` therefore
   matches `--all` explicitly and exits 1, saying that correct order is
   extract → surface drift → decide per module → stamp that module, and that one
   extraction must never stamp ten modules.
4. **`verified` refuses a dirty or unreadable product checkout** — ADR-006.

**Tests.** `packages/cli/src/baselines.test.ts`: stamping module A leaves module
B's entry byte-identical; keys come out sorted whatever order they went in; a
missing file yields `null`; the import-absence assertion.
`packages/cli/src/main.test.ts`: `verified` with no `--module` returns 1, with
`--all` returns 1 and says why, with an unknown module returns 1.

### ADR-006 — Reading the product commit, honestly

**Decision.** `headCommit(sourceRoot)` and `isDirty(sourceRoot)` from
`packages/cli/src/git.ts`, with `sourceRoot` from `sourceRootFor`
(`extract.ts:286-319`). **No new git code.** `git()` already takes any root:
`execFileSync("git", ["-C", repoRoot, ...args], …)` (`git.ts:20`), and it uses
`execFileSync` rather than `execSync` deliberately — "no shell, so a repository
path containing a space or a quote is an argument… This repository's own path has
three spaces in it" (`git.ts:12-15`), which matters because the product sits at
`../broadlineavida` relative to a root with three spaces in it
(`sources/registry.yaml:20`).

| Checkout state | `verified` does | Why |
|---|---|---|
| clean, `HEAD` readable | records the full sha and today's date | the commit describes what was read |
| dirty (`isDirty` returns `true`) | exits 1, writes nothing | a baseline against a dirty tree names a commit that does not describe what was read — the argument `deliver` already makes about archived bytes (`main.ts:1302-1307`) |
| `isDirty` returns `null` | exits 1, writes nothing, and says git could not answer | `git.ts:37-40`: "`null` means 'cannot tell', which callers must not read as 'clean': an unanswerable question and a negative answer are different, and collapsing them is how a guard silently stops guarding." `deliver` already spells this out to the operator — `dirty === null ? " (o git no responde)" : ""` (`main.ts:1325`) |
| `headCommit` returns `null` (no git, not a repo) | exits 1, writes nothing | mirrors `deliver` at `main.ts:1337-1341` |
| detached `HEAD` | **accepted**, records the sha | `rev-parse HEAD` answers on a detached head and the commit is exactly what was read. A branch name is not part of the fact being recorded, and `deliver` records `headCommit` with no branch either (`main.ts:1337`) |

**Never a fabricated or partial record.** On any refusal, nothing is written —
not even `productCommit: null`. Writing a null there would be indistinguishable
from "never verified", turning a tool failure into a false record of ignorance.

**`documents` also answers "is the checkout still there?"** for free, with
`isExactly(sourceRoot, baseline.productCommit)` (`git.ts:75-83`), which requires
both a matching commit and a clean tree and "compare[s] on the shorter of the
two" (`git.ts:80-82`) — which is why storing the full sha costs nothing and
storing an abbreviation would.

**Tests.** `packages/cli/src/git.test.ts` already exists and covers `git.ts`; no
change there. The refusals are tested in `packages/cli/src/main.test.ts` against
a temp directory that is not a repository.

### ADR-007 — The join: precedence, multiplicity, and making a coarse match visible

**Decision.** `joinCoverage` in `packages/cli/src/coverage.ts`, pure:

```ts
export interface EntryMatch {
  readonly entry: DocumentedPath | DocumentedFlag;
  readonly matched: number;
  /**
   * False when this entry lies outside every scanned root, so no fact about it
   * can ever be produced. NOT the same as `matched: 0`.
   */
  readonly joinable: boolean;
}

export interface ModuleCoverage {
  readonly module: string;                        // `sections/NN-….yaml`
  readonly state: "covered" | "clean" | "unknown";
  readonly facts: readonly JoinableFact[];        // empty unless `covered`
  readonly entries: readonly EntryMatch[];        // empty when `unknown`
  readonly baseline: Baseline | null;
}

export interface CoverageReport {
  readonly modules: readonly ModuleCoverage[];
  readonly manualWide: readonly ManualWideFact[];
  readonly undeclared: readonly JoinableFact[];
  readonly staleBaselines: readonly string[];
}
```

**Matching rules.**

| Entry kind | Matches a `gate` fact when | Matches a `capability` fact when |
|---|---|---|
| `file` | `fact.file === entry.path` | never |
| `directory` (ends `/`) | `fact.file.startsWith(entry.path)` | never |
| `glob` (one `*`, last segment) | the pattern matches `fact.file`, with `*` never crossing a `/` | never |
| `flag` | never | `fact.flag === entry.flag` |

**Why a directory entry must be written with a trailing `/`.** Prefix-matching a
bare string makes `src/render/components` match
`src/render/components-old/Foo.tsx`. That is the same class of defect
`conditioning.ts` rejects a bare scalar selector for — "unvalidated it turns
`Array#includes` into `String#includes`, which matches substrings instead of
values and **leaks content across tenants**"
(`tenant-conditioning/SKILL.md:114-117`, and the refusal itself at
`load.ts:174-186`). The trailing slash makes the segment boundary explicit, so
"I mean this whole directory" is a deliberate act and a typo'd file path is a
`matched: 0` entry rather than a silent over-claim.

**Precedence: none. Multiplicity: reported, never resolved.** A fact matched by
several entries, in one module or in five, is listed under every module that
claimed it. Precedence would silently drop a module that also documents the
changed file, and hiding a module from a drift report is precisely what the
`unknown` state exists to prevent. The reverse index is reported too: each
`undeclared` fact is a fact no module claimed.

**How a coarse match is made visible, with no magic threshold.** Every entry is
reported with its `matched` count and its kind, sorted descending, so
`src/render/components/ (directory) — 48 of 61 facts` is legible as the
over-broad declaration it is. No threshold, no `broad: true` flag: a number
beside a total is a judgement the reader can make and a constant in the code
cannot. This is the proposal's §8 mitigation made concrete, and it reports rather
than blocks, matching `labels`: "Reports, never blocks: what a renamed label
should now say is a judgement about the product, not something this command
decides" (`main.ts:2013-2015`).

**`joinable`, and the honest reading of `clean`.** The extractor scans exactly
two roots — `[entry.extract.components, entry.extract.pages]`
(`extract.ts:378`), i.e. `src/render/components` and `src/render/pages`
(`sources/registry.yaml:32-33`). Two of `12-broadsec-of-things.yaml`'s four
declared paths lie outside them: `routes/AppRoutes.tsx`
(`sources/registry.yaml:27`) and `locales/translations/es.json`
(`sources/registry.yaml:30`). **No fact about either can ever be produced**,
because routes and i18n labels are steps 3 and 5 of `source-extraction`, and
those are "specified here and not implemented" (`source-extraction/SKILL.md:41`).
So a module whose entries are all unjoinable would report `clean`, and `clean`
would mean "nothing could be reported", not "nothing changed".

The join therefore computes `joinable` per entry against the resolved scan roots,
and the report prints, for any module with an unjoinable entry:

> *N of this module's M declared paths lie outside the scanned roots
> (`src/render/components`, `src/render/pages`), so drift in them cannot be
> reported today — see `source-extraction`, steps 3 and 5.*

`clean` for a module with **no** joinable entry at all leads with that line. This
keeps the proposal's three states and never a fourth (§3.3), and adds an
annotation in exactly the discipline `absentFrom` established: silence about a
fact is not the fact's negation.

**`unknown` is never rendered as `unaffected`**, and the full joinable-fact list
is repeated under every `unknown` module rather than a count — the proposal's
§3.3 and §8 wording requirement, which gets its own test on the wording.

**Tests.** `packages/cli/src/coverage.test.ts`, pure, no filesystem: each match
rule including the `components` / `components-old` case; `*` refusing to cross a
`/`; one fact claimed by two modules appearing under both; the three states; an
`unknown` module carrying the full fact list; per-entry counts; an unjoinable
entry annotated; a stale baselines key; and a wording assertion that the report
never contains the word `unaffected`.

### ADR-008 — CLI surface: `documents` and `verified`

**Decision.** Two commands, wired into `run` (`packages/cli/src/main.ts:1862`).

| Command | Reads | Writes | Exit |
|---|---|---|---|
| `documents <manual>` | `sections/*.yaml`, `knowledge/module-map.json`, `baselines.json`, the product checkout | nothing | always 0 — reports, never blocks |
| `verified <manual> --module sections/NN-….yaml` | the product checkout, `baselines.json` | one key of `baselines.json` | 0 on success, 1 on every refusal |

**Wiring, precisely.** The dispatch is `run` at `main.ts:1862` — **not**
`main.ts:854`, which `packages/cli/AGENTS.md:16` claims and which is inside
`parseAxisFilters`'s neighbourhood, not a dispatcher. Three edits:

1. The allow-list at `main.ts:1873-1884` gains `command !== "documents" && command !== "verified"`. Because the same condition also requires `!manualId`
   (`main.ts:1883`), `run(["documents"])` with no manual id falls through to the
   usage text and returns 2 with no extra code.
2. The usage text at `main.ts:1886-1927` gains two invocation lines and two
   explanatory paragraphs, in the register the existing entries use.
3. Two handlers, placed immediately after `labels` (`main.ts:1998-2016`).
   `documents` shares `labels`' contract exactly — needs the source checked out,
   reports and never blocks — so grouping the two verification commands together
   is where a reader will look for the second one.

`--module`'s value is parsed from `rest` with `rest.indexOf("--module")`, the
idiom `--version` and `--only` already use (`main.ts:1967`, `main.ts:1985`,
`main.ts:1343`). `parseAxisFilters(rest)` runs first for every command
(`main.ts:1936`) and ignores `--module` harmlessly, since its loop recognises
only `--tenant` and `--axis` (`main.ts:714-735`).

**Why `documents` and not `covers` (D1).** Three reasons, and the first is the
proposal's own argument turned on the command name:

1. `covers` is already a validated key with a different meaning — inside a
   `pending` entry it is "a list of node ids in this section", and its own error
   text teaches exactly that (`load.ts:340-344`). `broadsec-manual covers`
   therefore reads as "check the `covers` lists", which is `pending`'s field.
   The proposal rejected `covers:` as the key for precisely this reason (§3.1);
   the reason does not stop applying at the command boundary.
2. `coverage` is documented as never built and must stay claimable. Two places
   say so: "`validate` and `coverage` were never built… Do not re-add any of them
   to this table before the code exists" (`packages/cli/AGENTS.md:42-49`), and
   "There is no `coverage` command… A coverage report was designed to answer the
   three questions below and was never built"
   (`tenant-conditioning/SKILL.md:128-131`) — dead content, thin tenants,
   cross-target references. A command named `covers` sitting beside a
   never-built `coverage` that answers a different question is a name collision
   waiting to be mis-invoked.
3. One word for one thing: the key is `documents:`, the command is `documents`,
   and the thing it checks is what a module documents.

**Revert cost if the owner prefers `covers`:** the string literal in the
allow-list, the usage text, the handler, the three tests that name it, and the
proposal's §7 success criteria. Nothing else in this design moves.

**Why `verified` and not `verify`.** It names the state recorded, not an action
performed — the command verifies nothing, a human did, and the command writes
down that they did. A command called `verify` would read as "check it for me",
which is `documents`. The repository already has this shape: `awaiting`
(`main.ts:2028`) is a participle naming the queue's state, not an instruction.

**Why two commands rather than `documents --stamp`.** The write must not sit
behind a flag on a read command, because §3.5's whole structural guarantee is
that stamping is a separate act. The repository makes the same argument about
`images`: "`build` reports image counts but never writes it: handing work to
another team is an explicit act, not a side effect of rendering a PDF"
(`packages/cli/AGENTS.md:71-75`).

**Tests.** `packages/cli/src/main.test.ts` — `run(["documents"])` returns 2 and
the usage text still names every pre-existing command (guarding the allow-list at
`main.ts:1873-1884` against a dropped `else if`); `run(["verified"])` likewise;
`verified` refusals per ADR-005 and ADR-006.

### ADR-009 — The wizard's new step, and a separate update-scope type

**Decision.** `updateFlow` (`wizard.ts:1731-1762`) gains one step, and
`assembleUpdatePrompt` gains one optional third parameter typed with a **new**
`UpdateScope`.

```ts
/**
 * What an update is scoped to. A discriminated union, so "a module update with
 * no module named" is unrepresentable rather than an invariant nobody enforces.
 */
export type UpdateScope =
  | { readonly kind: "manual" }
  | { readonly kind: "module"; readonly file: string };   // `sections/NN-….yaml`

export function assembleUpdatePrompt(
  s: ManualState,
  instruction: string,
  scope: UpdateScope = { kind: "manual" },
): string;
```

**Why not reuse `Scope`.** `Scope` is `spike | module | full`
(`wizard.ts:86-108`) and every one of its values is a creation-path verb —
"Spike de pipeline — una sección, de punta a punta… Así arrancó broadlineavida"
(`wizard.ts:88-94`). A spike is meaningless for a manual whose pipeline is
proven and delivered. It is consumed by `SCOPE_INSTRUCTIONS`
(`wizard.ts:318-331`), whose text is creation instruction ("Escribí UNA sección…
Decí cuál elegiste y por qué"), so reusing the type would either drag that text
into the update prompt or need a second lookup table keyed on the same type — two
meanings for one type, which is the `covers:`/`documents:` argument again (§3.1)
and the `releaseLede`-is-not-`manual.lede` argument (`main.ts:1149-1152`). And
`Scope` is a bare string union that cannot carry the chosen file, so the module
id would have to ride in a parallel field with nothing enforcing that the two
agree. The exploration confirmed `updateFlow` references none of
`Scope`/`SCOPES`/`SCOPE_INSTRUCTIONS` today (`explore.md:130-137`), so there is
nothing to be consistent with.

**Steps after the change.** The existing step titles are literal strings in
`updateFlow` and no test asserts them — `updateFlow` is not exported and does not
appear in `wizard.test.ts`. Renumbering is therefore free.

| Step | Today | After |
|---|---|---|
| 1 | which manual — `select` + `describeState` (`wizard.ts:1736-1744`) | unchanged, except `describeState` gains one clause |
| 2 | — | **NEW** — scope, via the same `select` (`wizard.ts:635-656`): "el manual entero" or one `sections/*.yaml`, each option's `detail` showing that module's baseline and `documents:` state |
| 3 | free-text paragraph (`askParagraph`, `wizard.ts:1607`) | unchanged, was step 2 |
| 4 | preview + `handOff` (`wizard.ts:1748-1761`) | unchanged, was step 3; the preview also shows the chosen scope |

**Where the picker's per-module detail comes from.** A new exported
`readModuleStates(repoRoot, manualId): ModuleState[]` in `wizard.ts`, mirroring
`readManualStates`' contract — "Every field here is DERIVED, which is the point:
progress is readable off disk and therefore cannot be stale"
(`wizard.ts:240-243`).

It reads each section file's **raw YAML top level only**, with `parseYaml` and a
cast, exactly as `readManualStates` reads `manual.config.yaml`
(`wizard.ts:269-271`). It deliberately does **not** call `loadSection`: that
would drag `catalog` and full block validation into a picker, and `loadSection`
throws `ContentError` on an invalid prop (`load.ts:216-220`) — a picker that
crashes because a section has a bad prop is a picker nobody can use to fix that
section. The consequence is stated rather than hidden: the picker's `documents:`
count is **unvalidated**, and `documents` is where it gets validated.

**`ManualState` gains one field, not two.**

```ts
  /**
   * How many modules have a recorded baseline, out of how many exist. `null`
   * when `baselines.json` does not exist — nothing has been stamped yet.
   */
  readonly baselines: { readonly verified: number; readonly total: number } | null;
```

One field because `describeState` is a single summary line
(`wizard.ts:305-316`); per-module detail belongs on the module picker. `T | null`
and required, following `pending: number | null` exactly
(`wizard.ts:252-253`) — the established idiom for "derived off disk, absent means
not exported yet". `describeState` gains one clause in the same register as its
existing `pending` clause (`wizard.ts:311-313`).

**What the handed-off prompt must now carry.** The wizard "POINTS; it does not
instruct" (`wizard.ts:333-348`), so each item below is a pointer or a fact read
off disk, never a restatement of a rule that lives in an `AGENTS.md` or a skill.

1. **The scope, named as the section FILE** — never as a module number.
   Numbering is per target (`tenant-conditioning` Rule 2; enforced at
   `load.ts:92-119`), and "módulo 9" is a different module for a target that
   cannot see one of the earlier ones.
2. **That module's baseline** — the commit it was verified against, or that it
   never has been. Read off disk, not asserted.
3. **Whether that module declares `documents:`**, and if not, that its coverage
   is **unknown** — explicitly not "unaffected".
4. **The ordering, as the agent's first act**: run `extract <manual>`, then
   `documents <manual>`, and read the drift before editing anything. The wizard
   does not run `extract` itself: `readManualStates` is disk-only
   (`wizard.ts:259-302`, touching the map only via `existsSync` at `:294`), and a
   mutating extraction inside a picker is the ordering hazard itself
   (`explore.md:251-267`).
5. **The stamping rule**: `verified <manual> --module <file>` is the last act,
   only for the module whose drift was actually addressed, and only if the owner
   has seen it. Proposing a stamp nobody has seen is the same class of act as
   moving the version, which the prompt already forbids in the same section
   ("La versión no se mueve sola… sólo Daniel la autoriza",
   `wizard.ts:1707-1709`).

**Language.** Operator-facing wizard copy stays **Spanish**, matching the
surface it extends — `SCOPES` (`wizard.ts:86-108`), `SCOPE_INSTRUCTIONS`
(`:318-331`), `describeState` (`:305-316`) and `updateFlow`'s step titles
(`:1738`, `:1746`, `:1748`) are all Spanish today. Identifiers, types, comments,
this design and every `AGENTS.md` edit stay **English** (`AGENTS.md:98-100`).
The new commands' own output is English, matching `extract` and `labels`
(`main.ts:1944-1962`, `main.ts:1999-2012`) rather than `deliver`'s Spanish
(`main.ts:1326-1334`), because these two reports are read by the same audience as
`extract`'s drift list.

**Tests.** `packages/cli/src/wizard.test.ts` — the four existing two-argument
`assembleUpdatePrompt` assertions (`:1109-1180`) pass untouched, proving the
third parameter is optional; new assertions that a `module` scope names the file
and never a number, that an undeclared module's prompt says `unknown` and never
`unaffected`, and that the prompt names `extract` before `documents` before
`verified`. `readModuleStates` gets its own describe block beside
`readManualStates` (`:435`), including a section file with an invalid block prop,
which it must survive.

### ADR-010 — Harness changes, and one new skill

Ten files, and the reasoning for each. The proposal's §4 table is adopted with
four additions and one correction (marked **+** and **±**).

| File | Change |
|---|---|
| `AGENTS.md:112-114` | "Four commands take a manual id — `build`, `images`, `capture`, `extract`" is wrong today: there are **nine** (`build`, `images`, `awaiting`, `labels`, `extract`, `deliver`, `undeliver`, `capture`, `release-notes` — the allow-list at `main.ts:1874-1882`), and eleven after this change. Correct the count and stop enumerating, or enumerate completely |
| **+** `AGENTS.md:89` | The repo map line reads `cli/  broadsec-manual build \| images \| capture \| extract`. Same defect, same fix |
| `AGENTS.md:21-36` | Add the module definition (ADR-001) to the four-stage pipeline description, since "module" is used there with no mechanical meaning |
| `packages/cli/AGENTS.md:15-16` | **Verified defect, two errors in one sentence**: "There are **four**. The dispatch is `main.ts:854`" — its own table has **eight** rows (`:20-27`) and the dispatch is `run` at `main.ts:1862`. Fix both, add `documents` and `verified` rows |
| `packages/cli/AGENTS.md:29-30` | "Every command takes the axis filters … except `extract`" gains `documents` and `verified`, which are per-manual and per-module |
| `packages/cli/AGENTS.md:32-38` | Add `--module` to the flag table, on `verified` |
| `packages/cli/AGENTS.md:40-49` | Say that `documents` is **not** the never-built `coverage`, and that `coverage`'s three questions stay unbuilt and unclaimed — otherwise the next reader concludes it shipped |
| `packages/core/AGENTS.md:13` | The `drift` row claims core compares declared facts against the map. It does not. Correct it to: `documents:` is parsed here, and the join lives in `packages/cli/src/coverage.ts` (**±** the proposal said "joined in `cli`" without naming why — D4) |
| `manuals/AGENTS.md:49-52` | "Nothing in this repository declares a manual's full module list … so an agreed scope exists only if it was written down" is exactly what this change ends. Rewrite it rather than leave it contradicting the code |
| `manuals/AGENTS.md:7-19` | Add `baselines.json` to the Anatomy block, and say why it is not in `knowledge/` — that directory is "Extracted facts (GENERATED — never hand-edit)" (`:11`) and authoring rule 6 is "Never hand-edit `knowledge/`. It is generated. Fix the extractor" (`:124`), while a baseline is neither generated nor hand-edited. **+** `image-requests.json` and `awaiting-product.json` are also missing from that block though they are named at `:34`; adding all three is the same edit |
| **+** `manuals/AGENTS.md:99-106` | Add the new skill to the **conditional** table ("Read it only when"), not the always-read table at `:91-97`. Updating an existing manual is a condition, not a phase of authoring — the same shape as `delivery-summary` and `release-notes` |
| `manuals/broadlineavida/AGENTS.md:35-40` | Add a Sources-of-truth row: "which product paths a module documents → that section's `documents:`". Note that `:42-44` ("All of it reaches content through `knowledge/module-map.json`") still holds: `documents:` declares which product paths a module covers, never a fact the content asserts |
| `skills/source-extraction/SKILL.md:164-182` | Step 6 "Emit and diff" owns the diff, so it owns the baseline and the ordering rule. Add both, add `diffFacts`, and point at the new skill. Its `diffMaps` paragraph (`:175-180`) stays true and gains the fact-level sentence |
| `skills/module-completeness/SKILL.md:26` | "list the submodules from `knowledge/module-map.json`" sends the author to a file that does not emit them — as `skills/source-extraction/SKILL.md:41-44` ("Steps 3 and 5 below — routes and screens, UI labels — are specified here and not implemented") and `:182-183` ("Modules and elements are not compared, because they are not emitted") both state. Fix. **Definition of done (`:386-411`) is NOT touched** — settled by the orchestrator, and this design does not reopen it |
| `skills/block-authoring/SKILL.md:88-91` | One line: file-level keys (`pending`, `labels`, `sourceBase`, `documents`) are not blocks, so the closed-catalogue rule does not apply to them |
| `skills/tenant-conditioning/SKILL.md` | **No change.** Its provenance-comment rule (`:118-121`) is row-level and stays; `documents:` is file-level. Its claim that "a drift report proves the tag still matches the code" becomes more true. `:128-134`'s statement that there is no `coverage` command also stays true — see `packages/cli/AGENTS.md` above |
| **+** `packages/extract/AGENTS.md` | **No change**, and this is a decision rather than an omission: `:51-52`'s claim that nothing downstream of the map "learn[s] what a product is" is a constraint this design keeps by making `core`'s matcher string-only |

**A new skill is warranted: `skills/manual-update/`.** The proposal's argument is
adopted and one placement decision is added.

`source-extraction` owns "get facts out of the product";
`module-completeness` owns "when a module is finished". Neither owns **the
procedure for updating a manual that already exists** — read the baseline,
extract, join, decide per module, stamp, then author. Burying it in
`source-extraction` would make it undiscoverable: "`description` is the whole
discovery mechanism. Only `name` and `description` are loaded at startup… A vague
description means the skill never fires" (`skills/AGENTS.md:58-61`), and an agent
told "update module 09" will not fire a skill whose description is about
extracting a map.

It **references** rather than copies: `skills/AGENTS.md:77-79` — "Duplicating
rules across both means they drift… State a rule once, in the layer that owns it,
and reference it from the other." So the skill owns the procedure and the
ordering rule, and points at `source-extraction` for extraction, at
`module-completeness` for what finished means, and at `packages/cli/AGENTS.md`
for the commands.

Its frontmatter must satisfy `skills/AGENTS.md:41-48` (`name` equal to the folder
name, `description` saying what and when, 1–1024 chars) and the body must stay
under 500 lines (`:62`). Validate with `skills-ref validate ./skills/manual-update`
(`:53`).

**Seeding, and the resolution problem the proposal did not see.** Slice 5 seeds
`documents:` for `07` and `12` only. `12-broadsec-of-things.yaml:7-11` lists:

```
#   AppRoutes.tsx:202-214            route and gating
#   pages/PMV/PMVPage.tsx            tab shell and polling
#   pages/BroadsecOfThings/*.tsx     sidebar and header
#   locales/translations/es.json     every UI label quoted below
```

Three of those four resolve under `sourceBase: src/render/`. **`AppRoutes.tsx`
does not** — it is a bare filename and the file is at
`src/render/routes/AppRoutes.tsx` (`sources/registry.yaml:27`). And
`07-interfaz-general.yaml` has no header list at all; its four citations are
bare-filename row comments (`:111`, `:120`, `:129`, `:138`).

So transcription is not literal, and resolving each bare filename must read
**something**. It reads the map and the registry, never the product:

| Bare name | Resolves through | To |
|---|---|---|
| `LayersMap.tsx` | `knowledge/module-map.json` `references[].file` (`:1573` reads `src/render/components/LayersMap.tsx`) | `components/LayersMap.tsx` under `sourceBase: src/render/` |
| `AppRoutes.tsx` | `sources/registry.yaml:27` `extract.routes` | `routes/AppRoutes.tsx` |
| `locales/translations/es.json` | `sources/registry.yaml:30` `extract.i18n` | `locales/translations/es.json` |

That keeps the seeding inside the pipeline's own rule — "read the map, and fix the
extractor if the map is missing something"
(`manuals/broadlineavida/AGENTS.md:42-44`) — and out of the product. Slice 5
reads no source file. Line ranges are dropped per ADR-002.

`08`, `09`, `10`, `11` and `13` get **no** `documents:` key, so they report
`unknown coverage`, which is their true state. Writing one for them would require
reading the product to find out which files they describe, and that is content
re-grounding — out of scope (proposal §7).

## 4. Test map — strict TDD

Strict TDD is active. Baseline: `pnpm test` **747/747**, `pnpm -r type-check`
**9/9**. Every decision above names where its test goes; collected here so no
slice starts without one.

| New test file | Pure? | Covers |
|---|---|---|
| `packages/core/src/documents.test.ts` | yes | entry classification, `matchesPath`, the `components` vs `components-old` case, `*` not crossing `/` — ADR-002, ADR-007 |
| `packages/core/src/load-documents.test.ts` | yes | every validation rule, the block-rejection at `load.ts:545`, and the additivity pin (D3) — ADR-002 |
| `packages/cli/src/coverage.test.ts` | yes | the three states, multiplicity, per-entry counts, `joinable`, stale baselines, the wording pin — ADR-007 |
| `packages/cli/src/baselines.test.ts` | mostly (temp dirs) | one-module writes, sorted keys, missing file, the `extract.ts` import-absence assertion — ADR-005 |

| Existing test file | Change |
|---|---|
| `packages/cli/src/extract.test.ts` | **expectations unchanged**; new `diffFacts` describes added — ADR-004, pin (2) |
| `packages/cli/src/main.test.ts` | new: `run(["documents"])` and `run(["verified"])` return 2; usage still names every pre-existing command; every `verified` refusal — ADR-005, ADR-006, ADR-008 |
| `packages/cli/src/wizard.test.ts` | **declared edits**: `ManualState`'s new field at `:493`, `:538`, `:570`, `:1092`; `readManualStates` gains a field and `describeState` a clause. New: `readModuleStates`, and the `UpdateScope` assertions — ADR-009 |

**Manual smoke, named as such because it is not a unit test.**
`build broadlineavida` before and after must report the same section count and
the same numbered-node count per target. `extract broadlineavida` must write no
`baselines.json`.

**The nine flows that must stay green on unchanged expectations** are the
proposal's §5 table, adopted verbatim: creation, build, deliver/undeliver,
awaiting, images, labels, capture, release-notes, extract.

## 5. The five work-unit commits

Direct commits on `main`, per `work-unit-commits`: one clear purpose each, tests
in the same commit as the behaviour they verify, docs with the user-visible change
they explain, and a rollback that removes no unrelated work. **No PRs, no push.**
Every commit leaves `pnpm test` green and `pnpm -r type-check` 9/9.

### Commit 1 — `feat(core): a section can declare which product paths it documents`

- **Contains.** `packages/core/src/documents.ts`; `parseDocuments` in `load.ts`;
  `LoadedSection.documents?`; `"documents"` added to the block-rejection list
  (`load.ts:545`); `export * from "./documents.ts"` in `index.ts`;
  `documents.test.ts` and `load-documents.test.ts`.
- **Starts with.** `load-documents.test.ts`, red.
- **Proves done.** Every validation rule tested; the additivity pin passes;
  `pnpm test` ≥ 747 + new; type-check 9/9.
- **Leaves inert.** Nothing reads `documents`, no manual declares it, and
  `loadDocument` does not yet aggregate it. `build`, `images`, `awaiting`,
  `labels` and `extract` are untouched by construction.
- **Rollback.** Single revert. Nothing depends on it and no file on disk uses it.
- **Depends on.** Nothing. Everything else depends on this.

### Commit 2 — `feat(cli): record which product commit a module was verified against`

- **Contains.** `packages/cli/src/baselines.ts`; the `verified` command and its
  three dispatch edits; `baselines.test.ts`; `main.test.ts` additions;
  `packages/cli/AGENTS.md`'s `verified` row and `--module` flag.
- **Starts with.** `baselines.test.ts`'s "stamping A leaves B byte-identical",
  red.
- **Proves done.** All four ordering guards tested (ADR-005); every refusal
  returns 1 and writes nothing (ADR-006); `run(["verified"])` returns 2.
- **Leaves inert.** No manual has a `baselines.json`, nothing reads one, and
  `extract` still writes none.
- **Rollback.** Single revert; the file does not exist for any manual.
- **Depends on.** Nothing. Independent of commit 1 — deliberately, so a stall
  after either leaves the other useful.

### Commit 3 — `refactor(cli): drift becomes facts, and its report becomes their description`

- **Contains.** `DriftFact`/`JoinableFact`/`ManualWideFact`, `diffFacts`,
  `describeDrift` in `extract.ts`; `diffMaps` redefined as
  `diffFacts(...).map(describeDrift)`; `packages/cli/src/coverage.ts` with
  `joinCoverage`; `coverage.test.ts`; new `diffFacts` tests in
  `extract.test.ts`.
- **Starts with.** `coverage.test.ts`, red — and the existing `extract.test.ts`
  green before and after, which is the acceptance condition for the refactor
  half.
- **Proves done.** Every pre-existing `diffMaps` expectation passes **unchanged**,
  including the two byte hazards in ADR-004; the join's three states, per-entry
  counts and `joinable` annotation are tested with no filesystem.
- **Leaves inert.** `diffMaps`' output is byte-identical either way, so `extract`
  prints exactly what it printed. `joinCoverage` has no caller.
- **Rollback.** Single revert. `diffMaps`' behaviour is unchanged in both
  directions, which is what makes this the safest of the five to revert.
- **Depends on.** Commit 1 for `DocumentsDeclaration`.

### Commit 4 — `feat(cli): the update flow points at a module and at its drift`

- **Contains.** `loadDocument`/`loadManual` carrying `documents`; the `documents`
  command and its dispatch edits; `readModuleStates`; `ManualState.baselines`;
  `describeState`'s clause; `UpdateScope`; `assembleUpdatePrompt`'s optional
  third parameter; `updateFlow`'s new step and renumbering; `main.test.ts` and
  `wizard.test.ts` changes.
- **Starts with.** The `wizard.test.ts` assertion that a module-scoped prompt
  names the file and never a number, red.
- **Proves done.** `documents broadlineavida` reports, for all ten modules,
  either joined drift or an explicit `unknown coverage`, and never `unaffected`;
  the four existing two-argument `assembleUpdatePrompt` assertions pass
  untouched; the four declared `ManualState` edits are the only test edits.
- **Leaves inert.** Nothing, and this is the one that is not: it is the first
  commit an operator can see. It is still safe alone — no manual declares
  `documents:` yet, so every module reports `unknown coverage`, which is true.
- **Rollback.** Single revert; `updateFlow` returns to three steps and the
  command disappears.
- **Depends on.** Commits 1, 2 and 3.
- **The heaviest slice.** If it overruns, the split is clean and pre-decided:
  **4a** = `loadDocument` + the `documents` command (the report), **4b** = the
  wizard (the pointer). 4b is useless without 4a and 4a is useful alone.

### Commit 5 — `docs: the harness learns what a module documents, and 07 and 12 declare it`

- **Contains.** Every `AGENTS.md` and skill edit in ADR-010;
  `skills/manual-update/SKILL.md`; `documents:` seeded in
  `07-interfaz-general.yaml` and `12-broadsec-of-things.yaml`.
- **Starts with.** No test, and it says so: this commit changes documentation and
  two content declarations. Its verification is the two commands' real output.
- **Proves done.** `documents broadlineavida` reports today's real drift against
  `07`/`12` or as undeclared coverage; `skills-ref validate ./skills/manual-update`
  passes; no `AGENTS.md` contradicts the code after it; `build broadlineavida`
  reports the same section and numbered-node counts as before the change.
- **Leaves inert.** Nothing new in code. The two seeded declarations flip `07`
  and `12` from `unknown` to `covered` or `clean`.
- **Rollback.** Single revert; docs and two content keys only.
- **Depends on.** Commits 1 and 4 — commit 1 for the parser that accepts the two
  seeded keys, commit 4 for the command the docs describe.

**Chain stall behaviour.** Commits 1, 2 and 3 add capability no flow invokes; a
stall after any of them leaves the nine existing flows exactly as they are. A
stall after 4 leaves a working report and an unseeded manual, which reports
`unknown coverage` everywhere — the honest state, not a broken one.

## 6. Risks this design carries

| Risk | Where it bites | Mitigation designed in |
|---|---|---|
| The capability separator asymmetry (`", "` for added, `","` for changed, `extract.ts:220` vs `:223-224`) gets normalised | commit 3 | ADR-004 names it explicitly; pin (2) fails if it moves |
| A module's `documents:` entries are all outside the scan roots, so `clean` means "unreportable" | `12`, whose `routes/` and `locales/` entries are both outside (`extract.ts:378`) | ADR-007's `joinable` flag and the leading annotation line |
| A directory entry claims most of the drift and looks like coverage | any module declaring `components/` | ADR-007 reports `matched` of total per entry, sorted, with no threshold |
| `documents:` becomes trusted decoration | over time | the `documents` command verifies every declared path against the checkout and reports declared-but-gone and drifted-but-undeclared — verified, not trusted |
| Renaming a section file orphans its baseline | commit 2 onward | ADR-001: reported as a stale key; `verified` refuses an unknown module |
| `baselines.json` drifts from reality because nothing forces a commit to update it | always | **accepted**, same trust model as `awaiting-product.json` — an explicit act, committed, visible in review |
| Commit 4 touches `wizard.ts`, where the whole creation flow lives | commit 4 | optional third parameter, so no existing caller changes; the four existing assertions are the pin |
| Commit 4 exceeds 400 lines | commit 4 | the 4a/4b split is pre-decided above |
| The `documents` rename (D1) diverges from the proposal's success criteria | review | flagged in §0 with an exact revert cost |

## 7. What could not be determined

- **Whether today's drift list is still what the proposal recorded.** No command
  was run in this phase. The proposal's §7 criteria name `AddObservation.tsx`,
  `CaseFiltering.tsx`, `CustomTag.tsx`, `MobileInfoWindow.tsx`,
  `OfficerDispatchDetail.tsx` and `canViewFilterTrafficDetails`. The first three
  are confirmed present in `knowledge/module-map.json` as
  `references[].file` values (`:1152`, `:1263`, `:1373`); the drift itself
  depends on the product checkout's current state, which commit 5's verification
  is where it gets established.
- **Whether `bridge-primera-entrega` or `bridge-manual` has a section granularity
  that makes ADR-001 wrong for it.** Only `broadlineavida` was inspected, and
  `source-extraction/SKILL.md:66-70` warns that "every shape below is one
  product's shape". ADR-001 is safe for a second manual regardless — a manual
  that declares no `documents:` and has no `baselines.json` behaves exactly as it
  does today — but whether the filename is the *useful* unit there is unknown.
- **How many lines each commit actually runs to.** The proposal's estimates
  (~300/300/350/350/350) are inherited, not re-derived. Commit 3 grew with
  `coverage.ts` and commit 4 is the one most likely to overrun, which is why its
  split is pre-decided rather than discovered.
- **Whether `12-broadsec-of-things.yaml` should declare `flags:`.** The header
  comment names route and role gating (`:13-16`) but no capability flag, and
  `canSeeBoT` is in the capability matrix (`knowledge/module-map.json:364`).
  Whether that module documents it is
  a content judgement about what the module covers, so slice 5 seeds only the
  paths the file already committed to, and leaves `flags:` for whoever
  re-grounds the module.
