import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/**
 * The CSS Paged Media polyfill, as a string to inline into a rendered page.
 *
 * Chrome implements `@page { size, margin }` but not margin boxes, so running
 * headers, footers and `counter(page)` do not work without it. It belongs to
 * the renderer, not to whoever calls the renderer.
 *
 * The path is derived from the package entry point because pagedjs declares
 * export conditions only — `dist/` is not reachable as a subpath.
 */
export function pagedPolyfill(): string {
  const root = dirname(dirname(require.resolve("pagedjs")));
  return readFileSync(join(root, "dist", "paged.polyfill.min.js"), "utf8");
}
