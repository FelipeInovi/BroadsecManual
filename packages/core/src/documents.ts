/**
 * Which parts of the product a section says it documents.
 *
 * A path joins against `AxisReference.file` (a gate); a flag joins against
 * `CapabilityRow.flag`. The two are never inferred from one string's shape —
 * they are two sub-keys of one mapping (`paths:`/`flags:`), decided once at
 * the schema boundary rather than re-derived at every use. See the design's
 * ADR-002 for why a heterogeneous flat list was rejected.
 */

/** A product path a module says it documents, classified at parse time. */
export type DocumentedPath =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "directory"; readonly path: string } // always ends in "/"
  | { readonly kind: "glob"; readonly path: string }; // one "*", last segment

/** A capability flag a module says it documents. Never a path — see above. */
export interface DocumentedFlag {
  readonly flag: string;
}

export interface DocumentsDeclaration {
  /** `sections/12-broadsec-of-things.yaml` — the module id. */
  readonly declaredIn: string;
  /** The root section's id, so a message can name the section as well. */
  readonly section: string;
  readonly paths: readonly DocumentedPath[];
  readonly flags: readonly DocumentedFlag[];
}

/**
 * The identifier shape a capability flag must match — the same shape the
 * product's own capability config declares. Never a path shape.
 */
export const FLAG_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Classify one `paths:` entry by its shape alone.
 *
 * Returns `undefined` for a bare identifier — a string with no `/` and no
 * `.` — which is deliberately not a valid path shape: it belongs under
 * `flags:` instead, and inferring it as a flag here (rather than refusing
 * it) is exactly the silent mis-classification Ruling 1 exists to prevent.
 * Also `undefined` for a `*` that appears more than once — this design
 * accepts exactly one, in the last segment.
 */
export function classifyPath(raw: string): DocumentedPath | undefined {
  if (raw.endsWith("/")) return { kind: "directory", path: raw };

  const stars = raw.match(/\*/g)?.length ?? 0;
  if (stars > 1) return undefined;
  if (stars === 1) {
    const lastSlash = raw.lastIndexOf("/");
    const lastSegment = lastSlash === -1 ? raw : raw.slice(lastSlash + 1);
    if (lastSegment.includes("*")) return { kind: "glob", path: raw };
    return undefined; // the "*" crosses a "/" — not the shape this design accepts
  }

  if (raw.includes("/") || raw.includes(".")) return { kind: "file", path: raw };

  return undefined; // a bare identifier — belongs under `flags:`
}

/** Escape every regex metacharacter except the `*` this function replaces itself. */
function escapeForGlob(segment: string): string {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A glob's `*` matches any run of characters, but never crosses a `/`. */
function globMatches(pattern: string, file: string): boolean {
  const parts = pattern.split("*").map(escapeForGlob);
  const source = `^${parts.join("[^/]*")}$`;
  return new RegExp(source).test(file);
}

/**
 * Pure, string-only. Never touches a filesystem; never resolves anything.
 *
 * A `directory` entry matches by prefix. Requiring the entry to end in `/`
 * (enforced at classification, not here) is what makes a plain `startsWith`
 * safe: `src/render/components/` does not match a fact under
 * `src/render/components-old/`, because the character right after
 * `components` in the entry is `/`, not `-old`.
 */
export function matchesPath(entry: DocumentedPath, file: string): boolean {
  switch (entry.kind) {
    case "file":
      return file === entry.path;
    case "directory":
      return file.startsWith(entry.path);
    case "glob":
      return globMatches(entry.path, file);
  }
}
