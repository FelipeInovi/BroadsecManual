import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Poppins, bundled.
 *
 * WHY THE FILES ARE IN THE REPOSITORY. The release notes are set in Poppins, and
 * a document that merely NAMES a face gets it only where the reading machine
 * already has it — which for a client is nowhere. Naming it and not shipping it
 * was worse than not using it: the PDF fell through to Century Gothic without a
 * word, and the .docx would have handed the client whatever their Word chose.
 *
 * Licensed under the SIL Open Font License 1.1, which permits bundling and
 * requires the licence to travel with the files. `OFL.txt` sits beside them and
 * must not be separated from them.
 *
 * PATHS, NOT BYTES. Only the CLI may read a disk; the renderers are handed the
 * bytes. See the note in `render-web/html.ts` about the cover mark.
 */
const here = dirname(fileURLToPath(import.meta.url));

/** The bundled faces, by the weight each one is declared as. */
export const POPPINS: readonly { readonly weight: number; readonly file: string }[] = [
  { weight: 300, file: "Poppins-Light.ttf" },
  { weight: 400, file: "Poppins-Regular.ttf" },
  { weight: 600, file: "Poppins-SemiBold.ttf" },
  { weight: 700, file: "Poppins-Bold.ttf" },
];

/** Where the files live, so a caller can read them. */
export const poppinsPath = (file: string): string => join(here, "..", "assets", "fonts", file);
