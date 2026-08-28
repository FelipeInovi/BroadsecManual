import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POPPINS, poppinsPath } from "./fonts.ts";

/**
 * The font files are the difference between a document that IS in Poppins and
 * one that merely names it. Losing them would not break a build — the chain
 * falls through and the page still renders — so nothing else would notice.
 */
describe("bundled faces", () => {
  it("declares the four weights the layout uses", () => {
    expect(POPPINS.map((f) => f.weight)).toEqual([300, 400, 600, 700]);
  });

  it("has every file on disk", () => {
    for (const { file } of POPPINS) {
      expect(existsSync(poppinsPath(file)), `missing ${file}`).toBe(true);
    }
  });

  it("has real TrueType in each of them, not a stub or an error page", () => {
    // A curl that got a 404 writes an HTML page under the right filename.
    for (const { file } of POPPINS) {
      const head = readFileSync(poppinsPath(file)).subarray(0, 4);
      expect([...head], `${file} is not TrueType`).toEqual([0x00, 0x01, 0x00, 0x00]);
    }
  });

  it("keeps the licence beside them, which the OFL requires", () => {
    expect(existsSync(poppinsPath("OFL.txt"))).toBe(true);
    expect(readFileSync(poppinsPath("OFL.txt"), "utf8")).toContain("SIL Open Font License");
  });
});
