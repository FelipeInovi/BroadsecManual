import { z } from "zod";
import { COMMON_SET } from "./images.ts";

/**
 * Capturing a manual's pending figures from the running product.
 *
 * The screenshot is the easy half. What makes this worth building is that the
 * recipes are RE-RUNNABLE: today a UI change silently rots every figure that
 * shows it, and nobody finds out. With a recipe per slot, that drift becomes one
 * command.
 *
 * This module is the pure half — schema and planning. Driving the browser lives
 * in `chrome.ts`, so all of the judgement here is testable without a network.
 */

/** A selector that must be non-empty once trimmed. */
const selector = (field: string) =>
  z
    .string()
    .refine((s) => s.trim().length > 0, { message: `${field} must be a real selector` });

const authSchema = z
  .object({
    route: z.string(),
    /** NAMES of environment variables. Never the values. */
    userEnv: z.string(),
    passwordEnv: z.string(),
    userSelector: selector("userSelector"),
    passwordSelector: selector("passwordSelector"),
    submitSelector: selector("submitSelector"),
    /** Proof the login actually succeeded, rather than silently re-rendering. */
    doneWhen: selector("doneWhen"),
  })
  // A credential in this file gets committed, and then it is in the history for
  // good. Rejecting the shape is the only moment we can stop it cheaply.
  .strict();

const recipeSchema = z
  .object({
    slot: z.string(),
    route: z.string(),
    /**
     * A selector that only matches once real DATA has rendered.
     *
     * Required, and the reason this whole module can be trusted. A route paints
     * its chrome — header, empty table, spinner gone — well before the first row
     * arrives, so "the page loaded" is not a capture signal. An empty alarms
     * list is not a neutral screenshot; it tells the operator the screen is
     * empty, which is worse than the placeholder it replaced.
     */
    dataReady: selector("dataReady"),
    /**
     * Clicks needed to reach the pane, in order.
     *
     * Not every screen has a route. The whole BroadSec of Things module is one
     * route and its sections are sidebar state, so Alarmas is unreachable by URL.
     * The product puts no test id on those buttons and its repository is
     * read-only, which leaves the visible label as the only stable handle — the
     * same i18n catalogue the manual already takes its labels from.
     */
    steps: z.array(z.object({ click: selector("click") }).strict()).optional(),
    /** What to photograph. Omitted means the whole viewport. */
    clip: z.string().optional(),
    viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
  })
  .strict();

/**
 * One deployed build of the product.
 *
 * The tenant is compiled INTO the bundle: `src/render/config/index.ts` selects
 * it from `VITE_NAME_PROJECT`, a build-time variable. So one URL is one tenant,
 * and there is no way to ask a running app to be another. `basePath` in the
 * tenant config says where it is SERVED, not which config it loaded — demo and
 * lv both use "lv" — so the URL alone cannot be trusted to identify a tenant.
 */
const deploymentSchema = z
  .object({
    baseUrl: z.string(),
    /**
     * A page to open right after login, and something that must be on it.
     *
     * What this proves: the session is real, the deployment is up, and the
     * module being captured exists in this build. What it does NOT prove is
     * WHICH TENANT the build is. That would need a tenant-specific artifact in
     * the DOM — the configured logo would be ideal, but `logoImages` is used
     * only on two report pages and does not render there. Adding one is a
     * product change, and the product repository is read-only.
     */
    verify: z.object({ route: z.string(), selector: selector("verify.selector") }).strict(),
  })
  .strict();

export const recipeDocSchema = z
  .object({
    version: z.literal(1),
    target: z
      .object({ deployments: z.record(z.string(), deploymentSchema), auth: authSchema })
      .strict(),
    recipes: z.array(recipeSchema),
  })
  .strict();

export type Deployment = z.infer<typeof deploymentSchema>;

export type CaptureRecipe = z.infer<typeof recipeSchema>;
export type RecipeDoc = z.infer<typeof recipeDocSchema>;

/** Parse and validate a recipe document, failing loudly and specifically. */
export function parseRecipes(raw: unknown): RecipeDoc {
  const doc = recipeDocSchema.parse(raw);
  const seen = new Set<string>();
  for (const r of doc.recipes) {
    if (seen.has(r.slot)) {
      throw new Error(
        `two recipes claim the slot "${r.slot}". One slot is delivered as one ` +
          `file, so the second capture would overwrite the first and nothing ` +
          `would report it.`,
      );
    }
    seen.add(r.slot);
  }
  return doc;
}

/**
 * The deployment to shoot for the tenant being captured.
 *
 * Named per tenant rather than left as one `baseUrl`, so `capture --tenant mv`
 * cannot quietly photograph whatever deployment happens to be configured. The
 * error lists what IS configured, because the fix is always to add one line.
 */
export function deploymentFor(doc: RecipeDoc, tenant: string): Deployment {
  const found = doc.target.deployments[tenant];
  if (!found) {
    const known = Object.keys(doc.target.deployments);
    throw new Error(
      `no deployment configured for tenant "${tenant}". Configured: ` +
        `${known.length > 0 ? known.join(", ") : "(none)"}. Add its baseUrl and a ` +
        `\`verify\` selector to capture-recipes.yaml — the tenant is compiled into ` +
        `the bundle, so each one is a separate URL.`,
    );
  }
  return found;
}

/**
 * Read a KEY=VALUE credentials file.
 *
 * Node does not load `.env` on its own, and asking someone to export two
 * variables before every run is a step they will forget once and then debug for
 * an hour. Deliberately small: no interpolation, no multi-line values, no
 * `export` prefix — a credentials file is two lines and every extra feature is
 * another way for a password to arrive subtly altered.
 *
 * Malformed lines are skipped rather than thrown on: a half-typed file should
 * still let the run reach the error that names the missing variable.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    // Split on the FIRST `=` only, and never treat `#` as a comment here: both
    // are ordinary password characters.
    const value = line.slice(eq + 1);
    const quoted = /^(["'])([\s\S]*)\1$/.exec(value.trim());
    out[key] = quoted ? (quoted[2] as string) : value.trim();
  }
  return out;
}

export interface PlannedCapture extends CaptureRecipe {
  /** Where the shot must land for the manual to pick it up. */
  readonly deliverTo: string;
}

export interface CapturePlan {
  readonly ready: readonly PlannedCapture[];
  /** Pending slots no recipe covers yet — the remaining authoring work. */
  readonly uncovered: readonly string[];
}

/**
 * Match recipes against what the manual is actually still asking for.
 *
 * Enforces the manifest's own rule — extraction cannot create demand. A recipe
 * for a slot that is not pending would write an orphan file, which the
 * `undeclared` check then reports as a stray delivery.
 */
export function planCaptures(
  recipes: readonly CaptureRecipe[],
  pending: ReadonlySet<string>,
): CapturePlan {
  const ready: PlannedCapture[] = [];
  for (const r of recipes) {
    if (!pending.has(r.slot)) {
      throw new Error(
        `recipe for "${r.slot}", but that slot is not pending. Either it is ` +
          `already delivered — in which case delete the file to re-shoot it — ` +
          `or the manual never declared it and this capture would be an orphan.`,
      );
    }
    ready.push({ ...r, deliverTo: `${COMMON_SET}/${r.slot}.png` });
  }
  const covered = new Set(ready.map((r) => r.slot));
  return { ready, uncovered: [...pending].filter((s) => !covered.has(s)).sort() };
}
