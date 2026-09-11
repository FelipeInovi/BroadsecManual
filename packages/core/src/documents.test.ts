import { describe, expect, it } from "vitest";
import { classifyPath, matchesPath, FLAG_PATTERN } from "./documents.ts";

describe("classifyPath", () => {
  it("classifies a trailing-slash entry as a directory", () => {
    expect(classifyPath("src/render/components/")).toEqual({
      kind: "directory",
      path: "src/render/components/",
    });
  });

  it("classifies a single trailing `*` in the last segment as a glob", () => {
    expect(classifyPath("pages/BroadsecOfThings/*.tsx")).toEqual({
      kind: "glob",
      path: "pages/BroadsecOfThings/*.tsx",
    });
  });

  it("classifies anything else containing `/` or `.` as a file", () => {
    expect(classifyPath("src/pages/PMVPage.tsx")).toEqual({
      kind: "file",
      path: "src/pages/PMVPage.tsx",
    });
    expect(classifyPath("AppRoutes.tsx")).toEqual({ kind: "file", path: "AppRoutes.tsx" });
  });

  // The mistyped-entry case Ruling 1 exists to catch: `AppRoutes` (meant as
  // `AppRoutes.tsx`) must not be silently reclassified as a flag.
  it("refuses a bare identifier — it belongs under `flags:`, never inferred", () => {
    expect(classifyPath("AppRoutes")).toBeUndefined();
  });

  it("refuses a `*` that appears more than once", () => {
    expect(classifyPath("pages/*/*.tsx")).toBeUndefined();
  });
});

describe("FLAG_PATTERN", () => {
  it("matches a capability-flag identifier", () => {
    expect(FLAG_PATTERN.test("canSeeBoT")).toBe(true);
  });

  it("refuses a path-shaped string", () => {
    expect(FLAG_PATTERN.test("src/pages/PMVPage.tsx")).toBe(false);
  });
});

describe("matchesPath", () => {
  it("matches a `file` entry only on exact equality", () => {
    const entry = classifyPath("routes/AppRoutes.tsx");
    expect(entry).toBeDefined();
    if (!entry) throw new Error("unreachable");
    expect(matchesPath(entry, "routes/AppRoutes.tsx")).toBe(true);
    expect(matchesPath(entry, "routes/Other.tsx")).toBe(false);
  });

  // The load-bearing boundary case (ADR-007): a bare prefix would make
  // `components` match `components-old`, leaking one module's declaration
  // onto a sibling directory it never named.
  it("matches a `directory` entry as a prefix, never crossing into a sibling directory", () => {
    const entry = classifyPath("src/render/components/");
    expect(entry).toBeDefined();
    if (!entry) throw new Error("unreachable");
    expect(matchesPath(entry, "src/render/components/CustomTag.tsx")).toBe(true);
    expect(matchesPath(entry, "src/render/components-old/CustomTag.tsx")).toBe(false);
  });

  it("matches a `glob` entry, with `*` never crossing a `/`", () => {
    const entry = classifyPath("pages/BroadsecOfThings/*.tsx");
    expect(entry).toBeDefined();
    if (!entry) throw new Error("unreachable");
    expect(matchesPath(entry, "pages/BroadsecOfThings/Sidebar.tsx")).toBe(true);
    // `*` must not cross the `/` into a nested directory.
    expect(matchesPath(entry, "pages/BroadsecOfThings/nested/Sidebar.tsx")).toBe(false);
    expect(matchesPath(entry, "pages/BroadsecOfThings/Other.ts")).toBe(false);
  });
});
