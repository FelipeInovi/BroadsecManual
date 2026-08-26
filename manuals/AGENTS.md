# Agent Information — `manuals/`

One folder per manual. Everything here is **content and data**, never code.

## Anatomy

```
<manual-id>/
  manual.config.yaml   Axes, targets, versioning, catalogue pin
  ESTADO.md            What was DECIDED, and why — see below
  knowledge/           Extracted facts (GENERATED — never hand-edit)
  sections/            Authored content, a tree of fragments
  assets/figures/      Delivered images + the pending placeholder
    _pending.svg       Optional — overrides the placeholder the pipeline
                       ships for every slot not delivered yet
    _common/           One image valid for every deployment
    <tenant>/          Images made for one deployment only
  output/              Build output (gitignored)
```

Images are addressed by **slot**, never by path — content names which image a
place needs, the build decides where the file lives. See the
`module-completeness` skill for the rule and the naming convention.

## `ESTADO.md` — decisions, never progress

A manual is written across many sessions by agents that share no memory. This
file is the only thing that carries intent from one to the next, so what goes in
it is narrow on purpose.

**Progress is derivable, so it is never written down.** Which sections exist,
how many images are outstanding, which parts of the product the manual is waiting
on, what was committed — `sections/`, `knowledge/module-map.json`,
`image-requests.json`, `awaiting-product.json` and `git log` already answer
those, and they cannot be stale because they *are* the state.

That last one is the newest and the one most likely to be written here by habit.
A part of the product that is on screen but unfinished — which the manual
therefore documents around without naming — is **declared** in its section's
`pending` list and exported by `broadsec-manual awaiting`. It is not narrated
here. Two of them were, as open questions, and two more sections were written
over them before either was chased; that is what a queue is for and prose is not.
What still belongs here is the DECISION about how such a part is handled, which
is not derivable from anything.

**Decisions are not derivable, so they go here:**

- Which module or section comes next, and **why that one**.
- What module inventory was agreed, if any was. Nothing in this repository
  declares a manual's full module list — the map emits tenants, capabilities and
  deployment references, never a list of modules — so an agreed scope exists
  only if it was written down.
- What was ruled out, and the reason. An option discarded without one gets
  proposed again next session.
- What is unresolved, and what would settle it.

Where this file and the disk disagree, **the disk wins**. This is text somebody
wrote, not a verified fact. A log that restates derivable progress goes stale on
the first revert and is believed anyway, which is worse than having no log.

Write or update it **at the end of a working session, before the turn ends** —
not as work happens, or it records intentions that were then abandoned.

It sits beside `AGENTS.md` rather than inside it because that file is timeless
product knowledge, and a status section rewritten every session would churn the
one file agents read for rules.

## Content language

Manual content is **Spanish**, neutral and formal ("Diríjase a…", "Haga clic
en…"). No regionalisms, no voseo, no second-person familiar.

**Ids and section filenames are Spanish too**, because they name this manual's own
subject matter: `mapa.capa.trafico`, `bot.alarmas.como-llegar`,
`10-fuerzas-en-campo.yaml`. Product acronyms and words the interface itself
borrows are written the way the product writes them — `cctv`, `ptz`, `avl`,
`barra.dashboard`. Whoever debugs a build reads an id beside the content it points
at, and a translated id makes that harder for no gain.

**The machinery is English**: config keys and block props (`when`, `rows`,
`widthPercent`), block type names, code comments, commit messages, and
infrastructure filenames (`manual.config.yaml`, `image-requests.json`). Those
belong to the pipeline, which is shared by every manual and every product, so
they cannot follow one manual's language.

## Skills that govern work here

Read these before writing content. They own their rules; this file does not
restate them, because a rule stated twice is a rule that drifts.

| Skill | Owns |
|---|---|
| `module-completeness` | When a module is finished, and the image rule |
| `block-authoring` | Choosing and filling a block type |
| `tenant-conditioning` | Tagging content per deployment |
| `source-extraction` | Getting facts out of the product |
| `source-assets` | Taking images from the product's own asset files |

One more exists and is **not** part of that set, because it applies only when a
condition holds:

| Skill | Read it only when |
|---|---|
| `manual-import` | The product ships a legacy manual that has to be migrated. A manual built from the product directly never needs it, and Broadsec's own import is long done — so this is the cold path, and its detail has not been audited the way the five above have. Treat what it says beyond the seven step headings as unverified. |

## Authoring rules

These follow directly from the architecture. Breaking one does not produce a
warning; it produces a wrong manual for some tenant.

1. **Never write a number.** Not `5.2`, not `Figura 7.1.3`, not "see section 4".
   Numbering is assigned per build target. Reference by stable id.
2. **Never write an anchor or slug.** Same reason.
3. **Tag conditioning at the smallest unit that varies** — a fragment, a table
   row, a step. Tagging a whole section when one row differs is what produced
   the single packed document this system replaces.
4. **Quote UI labels from i18n, never by hand.** If the screen says it, the
   manual sources it from the product's translation catalogue.
5. **Use a block from the catalogue.** If the content does not fit one, request
   a new block type. Do not improvise a layout — one hand-rolled table and the
   scalability is gone.
6. **Never hand-edit `knowledge/`.** It is generated. Fix the extractor.
7. **Assert nothing untraceable.** If a claim cannot be traced to the module map
   or to a reviewed screenshot, it does not go in.

## Figures

Named by the id of the block that owns them, never by number. A figure whose
filename is `7-1-3.png` breaks the moment a tenant does not see module 7.

## Versioning

**The version is not yours to move. The owner authorises every bump, and says
so explicitly.**

This rule replaced the opposite one, so read it carefully if you remember the
old: this file used to say *"a content change bumps the version"*, and that is
exactly the behaviour being removed. An agent that corrected a figure, reworded
a paragraph or fixed a typo would raise `contentVersion` on its way past, and
the number came to mean "how much work happened here" — which is a fact about
us, not about the reader.

**A version marks a DELIVERY.** It moves when something reaches the client, and
not before. Internal work — a corrected figure, a rewritten section, a repaired
`AGENTS.md`, an entire module built over a week — moves nothing on its own. Ten
sessions of work and no delivery is ten sessions at the same version, and that
is correct, not an oversight.

So:

- **Never edit `contentVersion` on your own initiative.** Not to be tidy, not
  because the change felt big, not because the last one was long ago.
- Authorisation is the owner saying so, in the conversation, about this change.
  Silence is not authorisation. Neither is a large diff.
- When you believe a delivery has happened, **say so and stop.** Propose the
  number and what its row should read; let the owner decide.

When it does move, SemVer still applies:

- **major** — a new module, or a restructure
- **minor** — new functionality documented inside an existing module
- **patch** — a step tweak, a wording or typo fix

### The change log is written by hand, and that is deliberate

This file used to say changelogs are generated from git history because
hand-maintained ones drift. That still holds — **for a log of commits**, which
is what that sentence was about.

The `change-log` block is a different object. It is the manual's DELIVERY
history: a handful of rows, one per version the client received, each carrying a
sentence the client can read. Git history cannot produce that, because git does
not know which commits were delivered — only the owner does, which is the same
fact that makes the authorisation rule necessary.

Every manual ends with it:

- It lives in the manual's **final module**, always, and there is exactly one
  per manual. The build enforces both.
- It is the **only** module that opens with no figure. Everything else in
  `module-completeness` still applies; that one rule does not reach a module
  about the manual rather than about a screen.
- Its rows condition per target, so one manual's two tenants can hold different
  delivery histories. A version delivered to one and not the other is normal.
