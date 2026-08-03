# Agent Information — `sources/`

Registry of the product repositories this system documents.

## READ-ONLY — no exceptions

Source repositories are **inputs**. Never create, edit, delete or move a file
inside one. Never run a command that mutates one — no `git` writes, no
installs, no formatters, no "harmless" fixes.

If documenting something reveals a bug in the product, **report it**. Fixing it
here is out of scope and silently couples two repositories that must stay
independent.

## What lives here

`registry.yaml` — one entry per source repo: id, path, framework, and where the
facts are extracted from. That is all. No copies of source code, no vendored
snapshots.

## Extraction, not interpretation

Everything read from a source repo lands in that manual's `knowledge/` folder as
data, with a file-and-line provenance for each fact. Content is then written
against that data.

Nobody authors a manual by reading source code directly. That is how a manual
ends up asserting things nobody can trace, and how it silently rots when the
code moves.

## Adding a source

1. Add an entry to `registry.yaml`.
2. Create `manuals/<id>/` with a `manual.config.yaml`.
3. Run `broadsec-manual extract <id>`.
4. Review the generated `module-map.json` before writing a word of content.

Step 4 is not optional. An extraction nobody checked is a set of confident
claims nobody verified.
