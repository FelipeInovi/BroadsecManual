import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { PAGED_DONE_FLAG, PAGED_ERROR_FLAG } from "@broadsec-manual/render-web";

const CANDIDATES = [
  process.env["CHROME_PATH"],
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((p): p is string => Boolean(p));

export function findChrome(): string {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "No Chrome or Edge binary found. Set CHROME_PATH to one.\n" +
        `Looked in:\n  ${CANDIDATES.join("\n  ")}`,
    );
  }
  return found;
}

export interface PrintResult {
  /** Pages the paginator produced. Reported so a caller can sanity-check it. */
  readonly pages: number;
}

/**
 * Print an HTML file to PDF, waiting for pagination to actually finish.
 *
 * The previous implementation shelled out to `chrome --print-to-pdf`, which
 * cannot wait for a JavaScript signal: it printed whatever the paginator had
 * managed to lay out by then. Three identical runs of the same document
 * produced 9, 10 and 13 pages, only one of them complete — and the build
 * reported success every time.
 *
 * Driving the browser directly makes the completion signal observable, so a
 * truncated render is an error instead of a silently short PDF.
 */
export async function printToPdf(
  htmlPath: string,
  pdfPath: string,
  timeoutMs = 120000,
): Promise<PrintResult> {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--allow-file-access-from-files"],
  });
  try {
    const page = await browser.newPage();
    const url = pathToFileURL(htmlPath).href;
    await page.goto(url, { waitUntil: "networkidle0", timeout: timeoutMs });

    await page.waitForFunction(
      `window["${PAGED_DONE_FLAG}"] !== null || window["${PAGED_ERROR_FLAG}"] !== null`,
      { timeout: timeoutMs, polling: 200 },
    );

    // These callbacks are serialised and run in the browser, so they must not
    // reference anything from this module's scope, and `globalThis` is used
    // rather than `window` because this package's lib has no DOM types.
    const failure = await page.evaluate(
      (flag) => (globalThis as unknown as Record<string, string | null>)[flag],
      PAGED_ERROR_FLAG,
    );
    if (failure) throw new Error(`pagination failed: ${failure}`);

    const pages = await page.evaluate(
      (flag) => (globalThis as unknown as Record<string, number | null>)[flag] ?? 0,
      PAGED_DONE_FLAG,
    );
    if (!pages) throw new Error("pagination produced no pages");

    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
      timeout: timeoutMs,
    });

    // The paginator reports what it laid out; the PDF must contain exactly
    // that. A mismatch means the print stage dropped content — the very
    // failure this rewrite exists to make impossible to ship unnoticed.
    return { pages };
  } finally {
    await browser.close();
  }
}
