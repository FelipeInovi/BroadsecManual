import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import puppeteer from "puppeteer-core";
import { findChrome } from "./chrome.ts";
import type { Deployment, PlannedCapture, RecipeDoc } from "./capture.ts";

/** What happened to one planned capture. */
export interface CaptureResult {
  readonly slot: string;
  readonly ok: boolean;
  /** Why it failed, in the terms the operator can act on. */
  readonly reason?: string;
  readonly bytes?: number;
}

const DEFAULT_VIEWPORT = { width: 1600, height: 900 };
/** Long enough for a slow query, short enough that a dead selector is not a hang. */
const WAIT_MS = 20000;

/**
 * Read the credentials the recipe NAMES, and fail with the variable name.
 *
 * The recipe carries variable names rather than values so it can be committed.
 * The error therefore has to say which variable to set, or the whole indirection
 * just moves the confusion somewhere else.
 */
function credentials(auth: RecipeDoc["target"]["auth"]): { user: string; password: string } {
  const user = process.env[auth.userEnv];
  const password = process.env[auth.passwordEnv];
  const missing = [
    user ? null : auth.userEnv,
    password ? null : auth.passwordEnv,
  ].filter((v): v is string => v !== null);
  if (missing.length > 0) {
    throw new Error(
      `capture needs the product login: ${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} empty.\n` +
        `  Fill them in .env.capture at the repository root (copy .env.capture.example\n` +
        `  if it is not there yet). That file is gitignored; the recipe file is not,\n` +
        `  which is why the login is never written into it.`,
    );
  }
  return { user: user as string, password: password as string };
}

/**
 * Log in once and shoot every planned slot.
 *
 * One browser and one session for the whole run: logging in per capture would
 * multiply the slowest step by the number of figures, and every extra login is
 * another chance to be rate-limited half way through a batch.
 *
 * A failure is recorded per slot and the run continues. A recipe whose selector
 * has rotted should cost that one figure, not the other eighteen.
 */
export async function runCaptures(
  doc: RecipeDoc,
  deployment: Deployment,
  tenant: string,
  plan: readonly PlannedCapture[],
  figuresDir: string,
  onProgress: (line: string) => void,
): Promise<readonly CaptureResult[]> {
  const { user, password } = credentials(doc.target.auth);
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });
  const results: CaptureResult[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport(DEFAULT_VIEWPORT);

    const { auth } = doc.target;
    const { baseUrl } = deployment;
    await page.goto(`${baseUrl}${auth.route}`, { waitUntil: "networkidle0", timeout: WAIT_MS });
    await page.type(auth.userSelector, user);
    await page.type(auth.passwordSelector, password);
    await page.click(auth.submitSelector);
    // Proof the session exists. Without it a wrong password silently leaves us
    // on the login page and every capture below shoots that same form.
    await page.waitForSelector(auth.doneWhen, { timeout: WAIT_MS });
    onProgress("  signed in");

    // Proof this deployment IS the tenant asked for. The tenant is compiled
    // into the bundle, so pointing at the wrong URL does not fail — it succeeds
    // and quietly files another tenant's screens under this one's name. Whole
    // run, not per shot: if the deployment is wrong, every capture is wrong.
    try {
      await page.waitForSelector(deployment.verify, { timeout: WAIT_MS });
    } catch {
      throw new Error(
        `this deployment does not look like "${tenant}": ${baseUrl} never showed ` +
          `\`${deployment.verify}\`. The tenant is baked in at build time, so the ` +
          `URL is the only thing that selects it. Nothing was captured.`,
      );
    }
    onProgress(`  confirmed this build is ${tenant}`);

    for (const shot of plan) {
      try {
        await page.setViewport(shot.viewport ?? DEFAULT_VIEWPORT);
        await page.goto(`${baseUrl}${shot.route}`, {
          waitUntil: "networkidle0",
          timeout: WAIT_MS,
        });
        // Reach panes that have no route of their own — see `steps` in capture.ts.
        for (const step of shot.steps ?? []) {
          await page.waitForSelector(step.click, { timeout: WAIT_MS });
          await page.click(step.click);
        }
        // The gate that makes the shot meaningful — see `dataReady` in capture.ts.
        await page.waitForSelector(shot.dataReady, { timeout: WAIT_MS });

        const target = shot.clip ? await page.$(shot.clip) : page;
        if (!target) throw new Error(`clip selector "${shot.clip}" matched nothing`);
        const buffer = (await target.screenshot({ type: "png" })) as Buffer;

        const out = join(figuresDir, shot.deliverTo);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, buffer);
        results.push({ slot: shot.slot, ok: true, bytes: buffer.length });
        onProgress(`  ok      ${shot.slot} -> ${shot.deliverTo} (${buffer.length} bytes)`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        results.push({ slot: shot.slot, ok: false, reason });
        onProgress(`  FAILED  ${shot.slot}: ${reason.split("\n")[0]}`);
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
