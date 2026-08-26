---
name: delivery-summary
description: Writes the description of one row in a manual's Historial de cambios — the sentence a client reads to learn what a delivered version changed. Two modes, chosen for you by the wizard that invokes it: a FIRST delivery describes what the manual covers, since there is nothing to diff against; a LATER one reads `git log <previous-delivery-commit>..HEAD` and reports only what changed for the READER. Use when promoting a manual to an official delivery, when a change-log row exists with no description, or when asked to summarise what a version changed for a client.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
---

# Writing a delivery's row

One row of the `change-log` block, in a manual's final module. You write **one
field**: `description`. Everything else in that row was already filled in by
`broadsec-manual deliver`, and none of it is yours to touch.

## The only question that matters

**Would the reader notice, opening the manual?**

That is the whole filter, and it is harsher than it sounds. Most of what a
delivery contains is invisible to a client, because most of our work is about
how we make manuals rather than about what a manual says.

A worked example, from a real session that produced twelve commits:

| Commit | Does the reader notice |
|---|---|
| a new module in the manual | **Yes** — there is a chapter that was not there |
| fifteen figures delivered | **Yes** — grey placeholders became screenshots |
| Word figures no longer overflow the page | **Yes** — they were unreadable |
| a new block type in the catalogue | No |
| the version now derives from the change log | No |
| the pending-image sheet for the capture team | No |
| an `AGENTS.md` that was telling the next agent something false | No |

**Three or four of twelve.** That ratio is normal. A row listing all twelve
would be a changelog of our repository, which is not what a client is holding.

## What a reader notices

- A module added, removed or restructured
- Procedures that changed — different steps, a different order, a control that
  moved
- Figures that appeared where a placeholder was, or that were replaced
- A correction to something the manual **said** that was wrong
- Content that was withdrawn, and this one is easy to forget: a reader who had
  a section and no longer has it deserves to be told

## What a reader does not

Block types, renderers, the build, the CLI, guards, skills, `AGENTS.md`, capture
tooling, the pending-image sheets, how versions are numbered. **A change to how
we work is not a change to the manual — even when it shows on the cover.**

## The two modes

The wizard tells you which. Do not choose.

### `summarise-since` — there is a previous delivery

Read `git log <commit>..HEAD`, where the commit is the one the prompt names. It
is the commit the last delivered file was built from, so that range is exactly
what the client has not seen.

Read the **diffs**, not only the subjects. A commit subject describes the work;
the diff shows whether a reader is affected. A commit titled as a fix to the
pipeline sometimes changes what a figure looks like, and a commit titled as
content sometimes only moves a comment.

Restrict yourself to that manual's own directory plus anything that visibly
changed its output. Another manual's commits are not this manual's history.

### `summarise-first` — nothing was delivered before

There is no diff to take, so do not manufacture one. Describe **what the manual
covers**: name its modules, in reading order, in one sentence. The reader is
opening this document for the first time and wants to know what is in it.

Read `sections/*.yaml` for the module titles. Do not read them off a build.

## How the sentence reads

- **Spanish**, neutral and formal, like the rest of the manual.
- **One or two sentences.** This is a table cell a reader scans, not a release
  note. If it needs three, you are listing instead of summarising.
- **In the past, about the document**: "Incorpora…", "Actualiza…", "Corrige…".
- Name modules as the manual names them — `Fuerzas en Campo`, not `forces`.
- No commit hashes, no filenames, no slot ids, no version numbers other than
  the row's own.
- Inline `**bold**` is available and is worth using on a module name.

Two rows already written, as the register to match:

> Versión actual documentada en este manual. Incluye mejoras en interfaz, Call
> AI, Fuerzas en Campo y Security Dashboard.

> Incorpora el módulo Broadsec of Things, con la gestión de dispositivos en
> campo.

## Never invent a change

If the range holds nothing a reader would notice, **say so and stop** — report
it to whoever asked rather than writing a sentence to fill the cell. A delivery
that changed nothing visible is a real thing; a manufactured novelty in a
permanent record is not, and the record is what this whole flow exists to
protect.

Same if the range is empty, or the commit the prompt names is not in the
history. Both mean the anchor is wrong, and a summary written from a wrong
anchor is worse than none.

## Where it goes

The manual's final module, the section whose block is `type: change-log`. Find
it by reading — it sorts last, but its number differs per manual
(`08-historial-de-cambios.yaml` in bridge, `13-` in broadlineavida).

Write into the row whose `version` matches the one the prompt names.

```yaml
- id: historial.tabla.1-1-0
  version: 1.1.0
  date: 2026-09-14
  delivered:
    commit: a65d448
    files:
      mv: 9ab5064e…
  description: >-
    Incorpora el módulo **Broadsec of Things**, con la gestión de dispositivos
    en campo.
```

If no row carries that version, the `deliver` command said so and the row has
to be written whole — same `id` shape as its siblings, `version` and `date` from
the prompt, and no `delivered` block, which is the command's to write and not
yours.

## Before you finish

- **Do not touch `delivered`.** Those hashes are the proof of what a client
  received; editing one silently breaks the only check that can ever verify it.
- **Do not touch other rows.** A delivered row is history.
- **Rows ascend.** A new row goes at the BOTTOM, and the build enforces it.
- Rebuild to confirm the row renders: `broadsec-manual build <manual>`. A row
  that fails validation fails the whole manual.
- If the row belongs to some targets and not others, it needs a `when` — see
  `tenant-conditioning`. A version delivered to one target and not another is
  normal, not an edge case.
