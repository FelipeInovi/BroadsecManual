---
name: release-notes
description: Writes the release notes a client receives beside an updated manual — a short document of its own, in Word, that reports what changed in the PRODUCT rather than in the manual. Classifies each commit of the range by its `Producto:` trailer and never by inference, because a manual's diff mixes three different things and only one of them is news to the operator. Use when promoting a manual to a LATER official delivery and at least one commit in the range declares a product change. Not needed for a first delivery, for a row that already exists, or when no commit declares one — then no document is emitted at all.
license: Proprietary — internal Broadsec / Inovisec use only.
metadata:
  author: Inovisec AG
  version: "1.0"
---

# Writing a version's release notes

A short document, its own file, delivered in Word beside the manual. It tells an
operator what changed in the **product** they use. It is not a summary of the
manual, and it is not a changelog of this repository.

You are invoked from step 1 of a delivery, over the same commit range as
`delivery-summary`. That skill writes the one sentence the manual prints; you
write the document that develops it. Read the range once and produce both.

## Your question is not the manual's

`delivery-summary` asks *would the reader notice, opening the manual?* You ask a
different one:

> **Would the operator notice, using the product?**

Same range, different subject. A figure that replaced a placeholder is news to a
reader of the manual and is nothing to an operator — the screen never changed.

## The trailer decides, and you never infer it

A manual's diff mixes three things that must not reach a client mixed:

| What actually happened | Goes in |
|---|---|
| The product changed | **Yes** — this is the whole document |
| The manual was wrong and was corrected | No. The product was always like that |
| The manual caught up with something old | No. The operator has used it for months |

The YAML says *what* the manual asserts now, never *why* it changed, so the
second and third are invisible in a diff. Only the commit author knows. They
declare it with a trailer:

```
Producto: nuevo        una capability the operator did not have
Producto: cambio       one they had, now behaving differently
Producto: sin-cambio   nothing changed for them
```

Read them, do not guess:

```bash
git log --format='%H%x09%s%x09%(trailers:key=Producto,valueonly)' <commit>..HEAD
```

`<commit>` is `delivered.<target>.commit` from the previous row — the commit the
last delivered file was built from.

**An absent trailer counts as `sin-cambio`.** Notes that forget a novelty are a
problem of ours; notes that invent one are the client's problem, and this
document is permanent.

Read the **diffs** of the commits that do declare a change: the trailer says
*there is product news here*, the diff tells you what to say about it.

## When you write nothing

Stop and report, rather than filling the document:

- No commit in the range declares `nuevo` or `cambio`.
- The range is empty, or the anchor commit is not in the history.
- Every declared change turns out, in its diff, to be about the manual.

An update with no product news is a real thing. Say so; the wizard decides.

## Where the content goes

```
manuals/<manual>/release-notes/v<version>.yaml
```

One file per delivered version. It lives inside the manual so it shares its
axis, its targets, its theme and its change log — the version it reports is the
row's, never a number of its own.

## The shape, and it is fixed

**One level-1 section, then one level-2 section per change.** Two levels, like
the manual — never three.

```yaml
id: notas
title: Actualización
children:
  - kind: block
    type: release-scope
    props:
      module: Módulo de Comando y Control
      effective: 2026-08-07

  - kind: section
    id: notas.menu
    title: Menú de navegación
    children:
      - kind: block
        type: prose
        props:
          text: >-
            Se implementó una actualización visual en el menú; no obstante,
            las funcionalidades se mantienen sin cambios.
```

Blocks available to you — no others, and do not improvise a layout:

| Block | For |
|---|---|
| `prose` | every paragraph |
| `callout` `important` | a consequence the operator must not miss |
| `term-list` | the validity row: one entry, `term` the module, `definition` the date it takes effect |

**The validity row reuses `term-list` rather than a block of its own**, and that
is deliberate: a block added to the catalogue is an option every manual author
can then pick, in a manual where it does not belong. `term-list` already has the
shape — a term and its definition, one line, no screenshot — and the release
notes' own stylesheet is what makes it print as a bordered row.

Leave its `from` off. Declaring a citation would send the label checker looking
for the module's name in the product's source, and this text is ours, not a
label the product shows.

Numbering, the table of contents and the cover are **generated**. Never write an
ordinal, a page number or an anchor. See `block-authoring` for the catalogue's
rules and `tenant-conditioning` for `when`.

## How the prose reads

- **Spanish**, neutral and formal.
- **About the product, in the past**: "Se implementó…", "Se incorporó…", "Ahora
  es posible…".
- Name controls as the product labels them, and screens as the manual titles
  them.
- Say where a thing is reached and what it does. An operator reads this to know
  what to do differently on Monday.
- No commit hashes, no filenames, no slot ids, no block types, no version
  numbers other than the row's.
- **Never name a third party.** Not in a heading, not in prose, not in a
  control's name. The reference document said "el Carbyne ID"; ours says "el
  identificador del incidente".

The register to match:

> Se incorporó un acceso al módulo de Bridge of Things desde el menú principal,
> que centraliza las integraciones del sistema.

> Ahora es posible cerrar casos directamente desde la lista. Para ello, ubique
> el cursor sobre el identificador del incidente; al hacerlo aparecerá un ícono
> de carpeta.

## Conditioning is not optional here

The manual is conditioned, so its notes are too. A change only some targets can
see carries a `when` on its section — and a section that names a control one
target does not have is worse in these notes than in the manual, because a
client reading about a control they cannot find has no chapter to check.

## Before you finish

- **Do not write the change-log row.** That is `delivery-summary`, and it is a
  different sentence about a different subject.
- **Do not touch `delivered`.** Those hashes are the proof of what a client
  received.
- Build to confirm the file renders and the numbering resolves.
- If a change has no `Producto:` trailer but you are certain it is product news,
  **report it — do not promote it yourself.** The trailer is the author's
  statement, and overriding it silently is how an invented novelty gets in.
