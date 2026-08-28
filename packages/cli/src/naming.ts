/**
 * What a build on disk is called, and what its name means.
 *
 * TWO KINDS OF NAME, and keeping them apart is the whole reason this file
 * exists. A version says what a client received: it is a fact about somebody
 * else's document, fixed forever the moment it is handed over. A WORKING NUMBER
 * says which iteration of our own work a file is, and it moves every build.
 *
 * They used to be one thing. Every build was named after the highest change-log
 * row, so the day after a delivery every build carried a name that already
 * belonged to the client's copy — and `-NO-ENTREGADO` was invented to mark the
 * ones that were lying. That marker is gone, along with the collision it
 * covered: a working build now cannot be named after a version at all.
 *
 * Lives in its own module because `main.ts` imports the wizard, so anything the
 * two share has to sit below both or the import graph closes into a cycle.
 */

/** Matches the working number in a filename, whatever else the name carries. */
const WORK_NUMBER = /-trabajo-(\d+)/;

/** The working number a filename carries, or null when it carries none. */
export function workNumberIn(name: string): number | null {
  const found = WORK_NUMBER.exec(name);
  return found?.[1] === undefined ? null : Number(found[1]);
}

/** `8` -> `trabajo-08`. Padded so a folder listing sorts the way it reads. */
export function workStamp(workNumber: number): string {
  return `trabajo-${String(workNumber).padStart(2, "0")}`;
}

/**
 * The next working number for a manual's `output/`.
 *
 * Read off the FILENAMES rather than a ledger. `output/` is gitignored and
 * disposable, so the trail is local by construction; a ledger describing files
 * that only exist on one machine would be state with no reader. A fresh clone
 * starts at 1, which is correct — it has no working builds to be the ninth of.
 *
 * Allocated ONCE PER BUILD RUN, per manual, and every target that run renders
 * carries it. Two files with the same number are therefore always the same
 * content, which is the whole property worth having. The visible cost is gaps:
 * `build --tenant mv` moves the manual's counter, so `med`'s newest file can
 * sit at 08 while `mv` is at 09. That gap is true — run 09 did not include
 * `med`.
 */
export function nextWorkNumber(names: readonly string[]): number {
  let highest = 0;
  for (const name of names) {
    const number = workNumberIn(name);
    if (number !== null) highest = Math.max(highest, number);
  }
  return highest + 1;
}

/**
 * The release notes that accompany one official document.
 *
 * Derived from the document's own name rather than composed from the config, so
 * the two cannot drift: whatever axis value and version the manual carries, its
 * notes carry the same ones and sort beside it in `deliveries/`.
 *
 * ALWAYS `.docx`, whatever came in. The manual is a PDF and a Word file; the
 * notes are Word only, by decision — they are read and forwarded inside the
 * client's organisation rather than printed, and one format is one fewer thing
 * to keep identical. Taking the extension from the input instead would produce a
 * `…-notas-de-version.pdf` the delivery would then look for and never find.
 *
 * Deliberately NOT symmetrical with `draftFilename`, which preserves the
 * extension because a draft is the same document with a marker on it. This is a
 * different document.
 *
 * THE EXTENSION IS RECOGNISED, NOT ASSUMED TO BE THE LAST DOT. Every name here
 * carries a semver, so the last dot is usually the one inside `v1.1.0` — cutting
 * there turned `…-v1.1.0` into `…-v1.1-notas-de-version.docx` and silently
 * dropped the patch number. Only a short run of letters counts as an extension;
 * `0` does not. `draftFilename` has the same shape and is not fixed here because
 * it is only ever handed a name that ends in one, but the hazard is the same.
 */
const EXTENSION = /^[a-z]{2,5}$/i;

export function releaseNotesFilename(officialName: string): string {
  const dot = officialName.lastIndexOf(".");
  const isExtension = dot > 0 && EXTENSION.test(officialName.slice(dot + 1));
  const stem = isExtension ? officialName.slice(0, dot) : officialName;
  return `${stem}-notas-de-version.docx`;
}

/**
 * The highest working number among files naming one axis value.
 *
 * Matched on the axis value bounded by separators, never by bare inclusion:
 * `mv` appears inside `manual-operador-mv-…` and would also appear inside a
 * hypothetical `…-mvd-…`, and a picker that showed one target's builds under
 * another target's name would be worse than showing nothing.
 */
export function newestWorkNumberFor(
  names: readonly string[],
  axisValue: string,
): number | null {
  let highest: number | null = null;
  for (const name of names) {
    if (!name.includes(`-${axisValue}-`)) continue;
    const number = workNumberIn(name);
    if (number !== null && (highest === null || number > highest)) highest = number;
  }
  return highest;
}
