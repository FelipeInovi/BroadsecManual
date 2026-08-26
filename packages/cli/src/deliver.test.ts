import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { archive, hashFile, planDelivery, stampProof } from "./deliver.ts";

const tmp = (): string => mkdtempSync(join(tmpdir(), "deliver-"));
const file = (dir: string, name: string, body: string): string => {
  const p = join(dir, name);
  writeFileSync(p, body, "utf8");
  return p;
};

describe("hashFile", () => {
  it("is the SHA-256 of the bytes, lower-case hex", () => {
    const dir = tmp();
    // The digest of the empty string, which is a value anyone can check.
    expect(hashFile(file(dir, "empty", ""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("changes completely when one byte changes", () => {
    const dir = tmp();
    const a = hashFile(file(dir, "a", "manual"));
    const b = hashFile(file(dir, "b", "manuaL"));
    expect(a).not.toBe(b);
    expect(a.slice(0, 8)).not.toBe(b.slice(0, 8));
  });
});

describe("planDelivery", () => {
  const setup = () => {
    const out = tmp();
    file(out, "m-mv-v1.0.0.pdf", "pdf");
    file(out, "m-mv-v1.0.0.docx", "docx");
    file(out, "m-mv-v1.0.0-BORRADOR.pdf", "draft");
    file(out, "m-mv-v1.0.0-NO-ENTREGADO.pdf", "superseded");
    return out;
  };

  it("collects every named file for a target and hashes it", () => {
    const { plan, missing } = planDelivery(
      setup(),
      "1.0.0",
      new Map([["mv", ["m-mv-v1.0.0.pdf", "m-mv-v1.0.0.docx"]]]),
    );
    expect(plan).toHaveLength(2);
    expect(missing).toEqual([]);
    expect(plan[0]?.sha).toMatch(/^[0-9a-f]{64}$/);
  });

  /**
   * A draft carries internal slot paths and must never reach a client. It is
   * excluded by never being asked for, rather than by a filter someone has to
   * remember to write.
   */
  it("cannot pick up a draft or a superseded build, because it never names one", () => {
    const { plan } = planDelivery(
      setup(),
      "1.0.0",
      new Map([["mv", ["m-mv-v1.0.0.pdf"]]]),
    );
    expect(plan.map((f) => basename(f.path))).toEqual(["m-mv-v1.0.0.pdf"]);
  });

  it("reports a target whose files were never built", () => {
    const { missing } = planDelivery(
      setup(),
      "1.0.0",
      new Map([["mv", ["m-mv-v1.0.0.pdf"]], ["med", ["m-med-v1.0.0.pdf"]]]),
    );
    expect(missing).toEqual(["med"]);
  });
});

describe("archive", () => {
  const plan = (dir: string) => [
    { axisValue: "mv", path: file(dir, "m-mv-v1.0.0.pdf", "pdf"), sha: "a".repeat(64) },
  ];

  it("copies into a per-manual subfolder", () => {
    const src = tmp();
    const dest = tmp();
    const { copied, refused } = archive(dest, "broadlineavida", plan(src));
    expect(copied).toEqual(["m-mv-v1.0.0.pdf"]);
    expect(refused).toEqual([]);
    expect(existsSync(join(dest, "broadlineavida", "m-mv-v1.0.0.pdf"))).toBe(true);
  });

  /**
   * The archive is the only copy of what a client received, and the proof in
   * the repository refers to exactly those bytes. Overwriting destroys the
   * thing the proof is about.
   */
  it("REFUSES to overwrite a file already in the archive", () => {
    const src = tmp();
    const dest = tmp();
    mkdirSync(join(dest, "m"), { recursive: true });
    writeFileSync(join(dest, "m", "m-mv-v1.0.0.pdf"), "el que recibió el cliente", "utf8");

    const { copied, refused } = archive(dest, "m", plan(src));
    expect(copied).toEqual([]);
    expect(refused).toEqual(["m-mv-v1.0.0.pdf"]);
    expect(readFileSync(join(dest, "m", "m-mv-v1.0.0.pdf"), "utf8")).toBe(
      "el que recibió el cliente",
    );
  });
});

describe("stampProof", () => {
  const SECTION = `# A comment carrying reasoning that must survive.
id: historial-cambios
children:
  - id: historial.tabla
    type: change-log
    props:
      rows:
        - id: historial.tabla.1-0-0
          version: 1.0.0
          date: 2026-08-26
          description: >-
            Primera entrega.
`;

  const proof = {
    commit: "8a0ab58",
    files: [
      { axisValue: "agencia-propia", path: "x", sha: "a".repeat(64) },
      { axisValue: "todas-las-agencias", path: "y", sha: "b".repeat(64) },
    ],
  };

  it("inserts the proof under the row that declares the version", () => {
    const out = stampProof(SECTION, "1.0.0", proof) as string;
    expect(out).toContain("          delivered:");
    expect(out).toContain("            commit: 8a0ab58");
    expect(out).toContain(`              agencia-propia: ${"a".repeat(64)}`);
    expect(out).toContain(`              todas-las-agencias: ${"b".repeat(64)}`);
  });

  it("puts it after the date, leaving the human-facing fields together", () => {
    const out = stampProof(SECTION, "1.0.0", proof) as string;
    const lines = out.split("\n");
    expect(lines.findIndex((l) => l.includes("date:"))).toBeLessThan(
      lines.findIndex((l) => l.includes("delivered:")),
    );
    expect(lines.findIndex((l) => l.includes("delivered:"))).toBeLessThan(
      lines.findIndex((l) => l.includes("description:")),
    );
  });

  /**
   * The comments in these files carry why the manual is the way it is. A YAML
   * round-trip would erase them, which is why this edits text.
   */
  it("leaves every comment and every other line untouched", () => {
    const out = stampProof(SECTION, "1.0.0", proof) as string;
    expect(out).toContain("# A comment carrying reasoning that must survive.");
    for (const line of SECTION.split("\n")) expect(out).toContain(line);
  });

  /** The caller's signal that this is a new row, which an agent must write. */
  it("returns null when no row declares that version", () => {
    expect(stampProof(SECTION, "2.0.0", proof)).toBeNull();
  });

  it("does not confuse 1.0.0 with 1.0.01 or 11.0.0", () => {
    const odd = SECTION.replace("version: 1.0.0", "version: 11.0.0");
    expect(stampProof(odd, "1.0.0", proof)).toBeNull();
  });
});
