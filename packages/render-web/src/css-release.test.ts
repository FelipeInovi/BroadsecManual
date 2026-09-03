import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { releaseStylesheet } from "./css-release.ts";
import { tokens } from "@broadsec-manual/tokens";

/**
 * The stylesheet is ONE template literal, so a backtick anywhere inside it — a
 * CSS comment included — is a TypeScript syntax error. The file says so at the
 * top and I still put one there three separate times, twice in the very comment
 * explaining the previous mistake. A note is not a guard; this is.
 */
describe("css-release.ts is one template literal", () => {
  const source = readFileSync(new URL("./css-release.ts", import.meta.url), "utf8");
  const css = source.slice(source.indexOf("return `") + 8, source.lastIndexOf("`"));

  it("carries no backtick inside the CSS, not even in a comment", () => {
    const lines = css.split("\n").filter((l) => l.includes("`"));
    expect(lines).toEqual([]);
  });

  it("balances its braces, so a dropped one cannot pass review as valid CSS", () => {
    let depth = 0;
    for (const ch of css) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
    }
    expect(depth).toBe(0);
  });
});

describe("releaseStylesheet", () => {
  it("carries the project name into the interior band", () => {
    expect(releaseStylesheet(tokens, "BRIDGE360")).toContain('content: "BRIDGE360"');
  });

  it("escapes a name that would otherwise close the string or the tag", () => {
    const out = releaseStylesheet(tokens, 'X" }</style><script>');
    expect(out).not.toContain("</style><script>");
    expect(out).toContain('\\"');
  });

  it("paints the band on the page box rather than the three margin boxes", () => {
    // A horizontal gradient across three sibling boxes is three gradients, each
    // restarting at its own left edge.
    expect(releaseStylesheet(tokens, "X")).toContain(".pagedjs_pagebox::before");
  });

  it("keeps the ghost ring on the sharp logo's centre, on both bands", () => {
    // The ring is the same mark enlarged, so the only position with a reason is
    // a shared centre — see the commit that moved it off the sheet's edge. It
    // has been resized since, and a resize anchored at the top-left corner
    // silently walks the centre off. This is what makes growing it safe.
    const css = releaseStylesheet(tokens, "X");
    const found = [...css.matchAll(/no-repeat (-?[\d.]+)pt (-?[\d.]+)pt \/ ([\d.]+)pt/g)];
    expect(found).toHaveLength(2);
    for (const [, x, , size] of found) {
      expect(Number(x) + Number(size) / 2).toBeCloseTo(32, 5);
    }
  });

  it("wraps the cover's standfirst where the rule above it ends", () => {
    // Absolutely positioned and left at its natural width, the standfirst ran to
    // the paper's right margin while the rule above it stopped at half the page.
    // The ragged edge read as a mistake because it was one: the eye takes the
    // rule as the column, so the text has to honour it.
    const css = releaseStylesheet(tokens, "X");
    const widthOf = (selector: string): string | undefined => {
      const at = css.indexOf(`${selector} {`);
      const block = css.slice(at, css.indexOf("}", at));
      return /width:\s*([^;]+);/.exec(block)?.[1]?.trim();
    };
    expect(widthOf(".cover__lede")).toBe(widthOf(".cover__rule"));
    expect(widthOf(".cover__lede")).toBeDefined();
  });
});
