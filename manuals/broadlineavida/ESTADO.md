# ESTADO — broadlineavida

Decisions and open questions for the Broadsec operator manual. Progress is not
recorded here; `sections/`, `image-requests.json` and `git log` already are the
state.

## Decided

- **The version numbering restarts from zero.** `1.4.7` became `1.0.0` and
  `1.5.0` became `1.1.0`. Broadsec team's decision: the old numbers belonged to
  the legacy SharePoint manual, written before this pipeline existed, so
  carrying them forward would have claimed a lineage this content does not have.
  The reason is also written where the numbers are, in `manual.config.yaml`.
- **`product` is the brand the document prints, not a catalogue entry.**
  `Broadsec`, not `Broadsec SIMM`. The owner saw "BROADSEC SIMM" on a cover and
  ruled on it (`7e3afe4`). The source repository is still `broadlineavida` and
  the product is still Broadsec SIMM internally — only the printed brand
  changed.
- **The two deployments are `mv` and `med`, and both are build targets.** Their
  delivery histories are independent by design: the change log gives `mv` a row
  at 1.1.0 that `med` never receives.
- **Which slots the product's own asset files could answer is settled**, per
  table, and the verdicts are in `AGENTS.md` under "Which images the product
  ships". They are not re-derived: the reasoning cost a full pass over the
  source and the answer does not change until the product does.

## Ruled out

- **Trusting the legacy manual's tenant badges.** Its `[LV]`/`[MV]` marks and
  its `_(por definir)_` metadata were rebuilt from the module map instead. See
  `AGENTS.md`, "The legacy manual".
- **Tagging conditioning at section level.** Divergence in this product is
  element-level inside shared screens; section-level tagging is what produced
  the packed document this manual replaces.

## Unresolved

1. **No incident-typification subsection exists, and nobody has decided whether
   one belongs.** `CustomTag.tsx` is the strongest join in the product — 338
   incident names onto 68 of 85 label images — and not one image can be
   delivered because no slot asks for them. **What settles it:** an authoring
   decision on whether the manual documents incident typification at all.
2. **`bot.mapa` holds a `term-list`, so it carries no icon column.** The product
   ships the element-type images the section describes in prose. **What settles
   it:** deciding whether that section gets an `icon-table`; the assets are
   ready either way.
3. **A delivery has been proposed and not authorised.** Every image slot is now
   filled and nothing has ever been handed over — `deliveries/broadlineavida/`
   is empty and no row carries a proof — so both existing rows are still
   stampable, which makes this the simplest kind of delivery: no summary to
   write and no agent to run. But a version marks a delivery and only the owner
   moves it. **What settles it:** the owner saying so, in the conversation,
   naming the target and the number.
