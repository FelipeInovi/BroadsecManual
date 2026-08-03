import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

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

/**
 * Print an HTML file to PDF with headless Chrome.
 *
 * `--virtual-time-budget` matters: the pagination polyfill rewrites the
 * document after load, and printing before it finishes yields a single
 * unpaginated page.
 */
export function printToPdf(htmlPath: string, pdfPath: string, timeoutMs = 30000): void {
  execFileSync(
    findChrome(),
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--virtual-time-budget=${timeoutMs}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "pipe", timeout: timeoutMs + 30000 },
  );
}
