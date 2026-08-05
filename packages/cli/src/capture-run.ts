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

    // Once for the whole run, before any shot: if the deployment is wrong or the
    // module is missing, every capture below is wrong and none should be taken.
    try {
      await page.goto(`${baseUrl}${deployment.verify.route}`, {
        waitUntil: "networkidle0",
        timeout: WAIT_MS,
      });
      await page.waitForSelector(deployment.verify.selector, { timeout: WAIT_MS });
    } catch {
      throw new Error(
        `${baseUrl}${deployment.verify.route} never showed ` +
          `\`${deployment.verify.selector}\`, so the module this run captures is ` +
          `not in this build. Nothing was captured.`,
      );
    }
    onProgress(`  reachable, and the module is present`);

    for (const shot of plan) {
      try {
        await page.setViewport(shot.viewport ?? DEFAULT_VIEWPORT);
        await page.goto(`${baseUrl}${shot.route}`, {
          waitUntil: "networkidle0",
          timeout: WAIT_MS,
        });
        // Reach panes that have no route of their own — see `steps` in capture.ts.
        // Each click is retried once: expanding a sidebar parent re-renders the
        // menu, so the node found a moment ago is detached by the time the click
        // lands. Retrying re-queries against the menu that now exists.
        for (const step of shot.steps ?? []) {
          for (let attempt = 0; ; attempt++) {
            try {
              if ("drag" in step) {
                // Real pointer events, not element.dispatchEvent: HTML5 and
                // pointer-based drag libraries both ignore synthetic events that
                // carry no coordinates, and would silently do nothing.
                const src = await page.waitForSelector(step.drag.from, { timeout: WAIT_MS });
                const dst = await page.waitForSelector(step.drag.to, { timeout: WAIT_MS });
                const a = await src!.boundingBox();
                const b = await dst!.boundingBox();
                if (!a || !b) throw new Error("drag endpoint has no box — it is not visible");
                await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
                await page.mouse.down();
                // Move in steps: a single jump can land before the drag source
                // has registered the press, and nothing picks up.
                await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
                await page.mouse.up();
                break;
              }
              await page.waitForSelector(step.click, { timeout: WAIT_MS });
              await page.click(step.click);
              break;
            } catch (error) {
              const detached = /detached|not clickable|No node found/i.test(String(error));
              if (!detached || attempt >= 1) throw error;
              await new Promise((r) => setTimeout(r, 1200));
            }
          }
          // Let the pane it opened settle before the next click or the gates.
          await new Promise((r) => setTimeout(r, 1500));
        }
        // WHICH screen, then WHETHER it has data. In that order: the previous
        // section's table is still on the page while a parent menu merely
        // expands, and it would satisfy dataReady before we ever arrived.
        await page.waitForSelector(shot.screenIs, { timeout: WAIT_MS });
        await page.waitForSelector(shot.dataReady, { timeout: WAIT_MS });

        if (shot.settleMs) await new Promise((r) => setTimeout(r, shot.settleMs));

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
