---
name: commit-messages
description: How to write a commit in this repository — conventional `type(scope): subject`, the manual id inside the scope whenever a commit touches `manuals/<id>/`, the mandatory `Producto:` trailer that declares what a change means for the OPERATOR (`nuevo`, `cambio`, `retirado`, `sin-cambio`), why a commit touches at most one manual, how a `git revert` is not exempt, and why no commit carries AI attribution. Use when writing ANY commit message in this repository, especially one that touches `manuals/`; when the `commit-msg` hook (`.githooks/commit-msg`, `packages/cli/src/commit-check.ts`) rejects a commit and you need to fix the message; or when deciding whether a change is `nuevo`, `cambio`, `retirado` or `sin-cambio`.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
---

# Writing a commit in this repository

Every commit is a conventional commit:

```
type(scope): subject
```

`type` is the usual set — `feat`, `fix`, `chore`, `refactor`, `revert`, and so
on. `scope` names what the commit is about, comma-separated when more than one
thing applies: `fix(cli): …`, `chore(deliver): …`.

## When a commit touches a manual, its scope must say which one

If any staged path matches `manuals/<id>/…`, `<id>` MUST appear among the
scope's comma-separated entries:

```
feat(broadlineavida): the emergency release on the agent's profile
fix(broadlineavida,cli): correct the change-log date format
```

A file directly under `manuals/` (`manuals/AGENTS.md`, for instance) belongs to
no manual and carries no such requirement.

This is enforced by a hook — see "The hook enforces this" below — not left to
memory.

## One manual per commit

A `Producto:` trailer (next section) makes ONE statement about ONE product. It
cannot describe two products at once, so a commit that touches two different
manuals' directories has no single true trailer to carry. **Split it**: one
commit per manual, each with its own scope and its own trailer.

The hook refuses a commit staging paths under two or more `manuals/<id>/`
directories outright — there is no value of `Producto:` that would make it
pass, so it does not try to guess one.

## The `Producto:` trailer — mandatory on a manual-touching commit

A trailer, at the end of the commit message:

```
feat(broadlineavida): the emergency release on the agent's profile

Producto: nuevo
```

Four values, and they are a statement about the OPERATOR, not about the
manual:

```
Producto: nuevo        a capability the operator did not have before
Producto: cambio       one they had, now behaving differently
Producto: retirado     one they had, and no longer has — it may come back
Producto: sin-cambio   nothing changed for them
```

### Why this is YOUR statement, and never inferred

A manual's diff mixes several things that look identical in it: the manual was
wrong and got corrected, the manual finally caught up with something the
product always did, the product gained a capability the operator did not have,
or the product LOST one the operator used to have. Only the gain and the loss
are news to a client, and **no diff can tell them apart from a correction** —
only the person making the change knows, at the moment they make it. That is
why this is the author's statement, written now, and why nothing downstream
(`release-notes`, `delivery-summary`, a future reader of `git log`) may infer
it later. If you are not sure, stop and think about what actually changed for
someone using the product — not for someone reading the manual — before you
pick a value.

**An absent trailer is read as `sin-cambio`** by everything downstream that
reads it (`release-notes`, the stale-notes guard in the delivery wizard) — so
a forgotten trailer silently costs the client a novelty rather than failing
loudly. That is exactly why the hook makes it mandatory at commit time instead
of leaving "absent means nothing changed" as the only safety net: a commit
that reaches history without one is a commit whose author never had to decide.

### `git revert` is not exempt

The default `git revert` message — `Revert "<original subject>"` — has no
`type(scope):` header and no trailer, so the hook rejects it exactly like any
other manual-touching commit that is missing both. This is deliberate, not an
oversight: a revert of a manual change is itself a product-facing fact (if it
reverted something delivered, the operator may see a capability disappear
again) and undoing a change without declaring what that undo means would be
exactly the silent inference this rule exists to prevent. Write the revert as
an ordinary conventional commit instead:

```
revert(broadlineavida): mv v1.2.0 — entrega deshecha, no salió

Producto: sin-cambio
```

(`sin-cambio` there because the delivery never reached anyone — see
`packages/cli/AGENTS.md` on `undeliver`. A revert of something that WAS
delivered is a different judgement call, made the same way as any other
commit: what does this mean for the operator, right now.)

## No AI attribution

No `Co-Authored-By` line, no other AI attribution trailer, on any commit in
this repository — regardless of what tooling wrote around the change.

## The hook enforces this

`.githooks/commit-msg` runs on every commit (`core.hooksPath` is set by the
root `prepare` script, so `pnpm install` activates it). It wraps the pure
decision function `checkCommit` in `packages/cli/src/commit-check.ts`, which
takes the commit message and the staged paths and returns either `ok` or a
list of problems in Spanish, actionable, naming what to add and where. Merge
commits and `fixup!`/`squash!` messages are exempt — everything else that
touches a manual is checked.

If the hook rejects your commit, read what it printed: it names the missing
scope entry or the missing trailer directly. Fix the message and commit again;
nothing about your change or your staged files needs to change, only the
message.

## Pre-existing history predates this rule

The hook checks every commit made from here on. It does not, and cannot,
reach into history: commits made before this rule existed have no `Producto:`
trailer and no manual in their scope, and that is correct — they are exactly
what "an absent trailer counts as `sin-cambio`" was written for.

The rule bites again the moment old history is REPLAYED as a new commit:

- `git cherry-pick` of a pre-existing manual-touching commit
- `git rebase -i` with `reword` or `edit` on one
- `git commit --amend` on one

Each of these asks git to write a NEW commit object from an old message, and
the hook runs on that new commit like any other — so a pre-existing message
with no scope and no trailer is rejected the same way a freshly typed one
would be.

**The deliberate way through this is `--no-verify`** (`git cherry-pick
--no-verify`, `git rebase --no-verify`, `git commit --amend --no-verify`) —
and it is deliberate ONLY for replaying history that already existed before
this rule, never for a commit that is new content. There is no code exemption
for this case (no special-cased path, no "looks like a replay" heuristic):
the hook cannot tell a legitimate replay of old history from someone routing
a brand-new change around the rule through the same command, so the decision
of which one this is stays with the person running the command, made
explicitly with a flag, every time — not inferred silently.
