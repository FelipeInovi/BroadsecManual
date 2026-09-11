import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBaselines, stampBaseline } from "./baselines.ts";

const tmp = (): string => mkdtempSync(join(tmpdir(), "baselines-"));

describe("readBaselines", () => {
  it("returns `null` when the file does not exist — no manual has been stamped yet", () => {
    expect(readBaselines(tmp())).toBeNull();
  });

  it("reads back exactly what `stampBaseline` wrote", () => {
    const dir = tmp();
    stampBaseline(dir, "broadlineavida", "sections/07-interfaz-general.yaml", {
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
    const read = readBaselines(dir);
    expect(read?.source).toBe("broadlineavida");
    expect(read?.modules["sections/07-interfaz-general.yaml"]).toEqual({
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
  });
});

describe("stampBaseline", () => {
  it("stamping module A leaves module B's entry byte-identical", () => {
    const dir = tmp();
    stampBaseline(dir, "broadlineavida", "sections/07-interfaz-general.yaml", {
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
    const before = readFileSync(join(dir, "baselines.json"), "utf8");
    const beforeModuleB = JSON.parse(before).modules["sections/07-interfaz-general.yaml"];

    stampBaseline(dir, "broadlineavida", "sections/12-broadsec-of-things.yaml", {
      productCommit: "b".repeat(40),
      verifiedAt: "2026-09-12",
    });
    const after = JSON.parse(readFileSync(join(dir, "baselines.json"), "utf8"));
    expect(after.modules["sections/07-interfaz-general.yaml"]).toEqual(beforeModuleB);
    expect(after.modules["sections/12-broadsec-of-things.yaml"]).toEqual({
      productCommit: "b".repeat(40),
      verifiedAt: "2026-09-12",
    });
  });

  it("leaves the file's `source` field unchanged across stamps", () => {
    const dir = tmp();
    stampBaseline(dir, "broadlineavida", "sections/07-interfaz-general.yaml", {
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
    const result = stampBaseline(dir, "broadlineavida", "sections/12-broadsec-of-things.yaml", {
      productCommit: "b".repeat(40),
      verifiedAt: "2026-09-12",
    });
    expect(result.source).toBe("broadlineavida");
  });

  it("writes keys sorted, whatever order they were stamped in", () => {
    const dir = tmp();
    stampBaseline(dir, "broadlineavida", "sections/12-broadsec-of-things.yaml", {
      productCommit: "b".repeat(40),
      verifiedAt: "2026-09-12",
    });
    const result = stampBaseline(dir, "broadlineavida", "sections/07-interfaz-general.yaml", {
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
    expect(Object.keys(result.modules)).toEqual([
      "sections/07-interfaz-general.yaml",
      "sections/12-broadsec-of-things.yaml",
    ]);
  });

  it("creates the file when it does not exist yet", () => {
    const dir = tmp();
    expect(existsSync(join(dir, "baselines.json"))).toBe(false);
    stampBaseline(dir, "broadlineavida", "sections/07-interfaz-general.yaml", {
      productCommit: "a".repeat(40),
      verifiedAt: "2026-09-11",
    });
    expect(existsSync(join(dir, "baselines.json"))).toBe(true);
  });
});

/**
 * The ordering guard's structural half (ADR-005): `extract.ts` must never
 * import `baselines.ts`, so that "one extraction stamps ten modules" cannot
 * even compile into existence. Blunt on purpose — a behavioural test cannot
 * see an import that has not been written yet, so this pins the source text.
 */
describe("the ordering guard", () => {
  it("`extract.ts` contains no reference to `baselines`", () => {
    const extractSource = readFileSync(
      fileURLToPath(new URL("./extract.ts", import.meta.url)),
      "utf8",
    );
    expect(extractSource).not.toMatch(/baselines/i);
  });
});
