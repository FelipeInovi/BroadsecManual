/**
 * ONE-OFF, OUTSIDE THE RECIPE PIPELINE. Delete after use.
 *
 * Shoots `fuerzas.turno-asignar.fig` against DEMO and writes it under the slot
 * mv's manual renders, on the owner's explicit instruction. It sits here rather
 * than in `capture-recipes.yaml` for the same reason the release figures did:
 * `capture` binds the deployment to the build target, and a recipe claiming mv
 * while opening demo is the trap that file exists to prevent.
 *
 * IT DOES NOT DISPATCH. The figure is the Asignar PANE — a search box and the
 * list of dispatchable cases — and opening the tab is all it takes.
 * `DispatchTab` holds three `useState` calls and renders a search bar and a
 * list; the dispatch needs a case SELECTED and then CONFIRMED in
 * `InstaDispatchModal`, which this script never reaches, selects or names
 * outside this comment. Permission to dispatch was given and is not used: a
 * write that a read already answers is a write not worth making.
 *
 * THREE PRECONDITIONS, all of them the product's, none arrangeable from here:
 *   1. a shift that is not `Finished`               (ShiftsDetailsTabs.tsx:96)
 *   2. its agent NOT assigned/unavailable/emergency (ShiftsDetailsTabs.tsx:196-215)
 *      — otherwise the pane is replaced by "Operación en Proceso"
 *   3. at least one case in `case_open`             (AssignAgentMobilityCase.tsx:47-50)
 * `--dry-run` reports all three and shoots nothing.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type ElementHandle, type Page } from "puppeteer-core";
import { findChrome } from "./chrome.ts";

const BASE = "https://web.inovisec.com/lv"; // DEMO and LV share this basePath.
const WAIT = 45_000;
const FIGURES = join("manuals", "broadlineavida", "assets", "figures", "_common");
const AGENT = process.env["SHOOT_AGENT"] ?? "Ospina";

function env(): { user: string; password: string } {
  const raw = readFileSync(".env.capture", "utf8");
  const get = (key: string): string => {
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, "");
    }
    throw new Error(`${key} is not set in .env.capture`);
  };
  return {
    user: get("BROADSEC_CAPTURE_USER_DEMO"),
    password: get("BROADSEC_CAPTURE_PASSWORD_DEMO"),
  };
}

const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const { user, password } = env();
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });
  try {
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });

    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle0", timeout: WAIT });
    await page.type('input[name="email"]', user);
    await page.type('input[name="password"]', password);
    await page.click("#submit-button");
    await page.waitForSelector(".h-screen", { timeout: WAIT });

    await page.goto(`${BASE}/#/dashboard`, { waitUntil: "networkidle0", timeout: WAIT });
    await page.waitForSelector('img[alt="Project logo"][src*="bridge_logo"]', { timeout: WAIT });
    console.log("signed in, deployment verified: DEMO");

    await page.goto(`${BASE}/#/home-shifts`, { waitUntil: "networkidle0", timeout: WAIT });
    await settle(6000);

    const rows = await page.evaluate((needle: string) => {
      const all = Array.from(document.querySelectorAll(".simplebar-content > div > div"));
      return all.map((r, i) => ({
        i,
        text: (r.textContent ?? "").replace(/\s+/g, " ").slice(0, 70),
        ongoing: ((r.querySelector("div")?.className ?? "") as string).includes("#26344E"),
        match: (r.textContent ?? "").includes(needle),
      }));
    }, AGENT);
    console.log(`\nshifts (${rows.length}):`);
    for (const r of rows) {
      console.log(`  [${r.i}]${r.match ? " <-- " : "    "}${r.ongoing ? "ongoing " : "finished"} ${r.text}`);
    }

    const pick = rows.find((r) => r.match && r.ongoing) ?? rows.find((r) => r.match);
    if (!pick) {
      console.log(`\nNO SHIFT for "${AGENT}". Nothing shot, nothing written.`);
      return;
    }
    if (!pick.ongoing) {
      console.log(`\n"${AGENT}" has a shift but it is FINISHED — the Asignar tab is not offered.`);
      return;
    }

    await page.evaluate((i: number) => {
      const all = Array.from(document.querySelectorAll(".simplebar-content > div > div"));
      (all[i] as HTMLElement).click();
    }, pick.i);
    await settle(7000);
    console.log(`\nopened ${page.url()}`);

    const tabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="tab"]')).map((el) => (el.textContent ?? "").trim()),
    );
    console.log(`tabs: ${JSON.stringify(tabs)}`);
    if (!tabs.some((t) => t.includes("Asignar"))) {
      console.log("\nNO Asignar TAB — the shift is finished. Nothing shot.");
      return;
    }

    await page.click("button::-p-text(Asignar)");
    await settle(6000);

    const pane = await page.evaluate(() => ({
      busy: document.body.innerText.includes("Operación en Proceso"),
      cases: document.querySelectorAll('div[class~="space-y-0.5"] > div').length,
      spinner: document.querySelectorAll(".loading-spinner").length,
    }));
    console.log(
      `pane: ${pane.busy ? "OPERACIÓN EN PROCESO (agent is assigned/unavailable/emergency)" : "dispatch pane"}` +
        `, ${pane.cases} open case(s), ${pane.spinner} spinner(s)`,
    );

    if (pane.busy) {
      console.log("\nThe agent's state blocks the pane. Nothing shot, nothing written.");
      return;
    }
    if (pane.cases === 0) {
      console.log("\nNO OPEN CASE to dispatch — the list is empty. Nothing shot, nothing written.");
      return;
    }
    if (dryRun) {
      console.log("\n--dry-run: all three preconditions met. Re-run without the flag to shoot.");
      return;
    }

    // The same clip the committed recipe declares: the wrapper
    // ShiftDetailsPage.tsx:409-418 puts around the shift card and the tab bar.
    const tab = await page.waitForSelector('[role="tab"]', { timeout: WAIT });
    const handle = await tab!.evaluateHandle((n) => (n as Element).closest("div.w-full"));
    const target = handle.asElement() as ElementHandle | null;
    if (!target) throw new Error("no div.w-full ancestor");
    const buf = await target.screenshot();
    const file = join(FIGURES, "fuerzas.turno-asignar.fig.png");
    writeFileSync(file, buf);
    console.log(`\n  wrote ${file} (${buf.length} bytes)`);
    console.log("done — the tab was opened and photographed, nothing was dispatched");
  } finally {
    await browser.close();
  }
}

await main();
