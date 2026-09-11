import { describe, expect, it } from "vitest";
import { catalog } from "@broadsec-manual/blocks";
import { loadSection, ContentError } from "./load.ts";

const FILE = "sections/12-broadsec-of-things.yaml";

const withDocuments = (documents: string, sourceBase = ""): string => `
id: bot
title: Broadsec of Things
${sourceBase ? `sourceBase: ${sourceBase}\n` : ""}documents:
${documents}
children:
  - id: bot.panel
    type: prose
    props:
      text: Panel.
`;

const NO_DOCUMENTS = `
id: bot
title: Broadsec of Things
children:
  - id: bot.panel
    type: prose
    props:
      text: Panel.
`;

describe("loadSection — `documents:` declaration (MUF-001)", () => {
  it("is `undefined` for a section that declares none — absent, not empty (MUF-003)", () => {
    const { documents, node, warnings, pending, labels } = loadSection(NO_DOCUMENTS, FILE, catalog);
    expect(documents).toBeUndefined();
    expect(node.kind).toBe("section");
    expect(warnings).toEqual([]);
    expect(pending).toEqual([]);
    expect(labels).toEqual([]);
  });

  it("refuses a flat list — `documents:` must be a mapping with `paths:`/`flags:`", () => {
    const flatList = `
id: bot
title: Broadsec of Things
documents:
  - a
  - b
children: []
`;
    const run = (): unknown => loadSection(flatList, FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/paths/);
    expect(run).toThrow(/flags/);
  });

  it("refuses an empty mapping — it points at nothing", () => {
    const empty = `
id: bot
title: Broadsec of Things
documents: {}
children: []
`;
    expect((): unknown => loadSection(empty, FILE, catalog)).toThrow(ContentError);
    expect((): unknown => loadSection(empty, FILE, catalog)).toThrow(/points at nothing/);
  });

  it("refuses both sub-keys present but empty — same failure as an empty mapping", () => {
    const bothEmpty = `
id: bot
title: Broadsec of Things
documents:
  paths: []
  flags: []
children: []
`;
    expect((): unknown => loadSection(bothEmpty, FILE, catalog)).toThrow(/points at nothing/);
  });

  it("accepts and classifies `file` entries", () => {
    const { documents } = loadSection(
      withDocuments('  paths:\n    - src/pages/PMVPage.tsx\n    - AppRoutes.tsx\n'),
      FILE,
      catalog,
    );
    expect(documents?.paths).toEqual([
      { kind: "file", path: "src/pages/PMVPage.tsx" },
      { kind: "file", path: "AppRoutes.tsx" },
    ]);
  });

  it("accepts and classifies a `glob` entry", () => {
    const { documents } = loadSection(
      withDocuments("  paths:\n    - pages/BroadsecOfThings/*.tsx\n"),
      FILE,
      catalog,
    );
    expect(documents?.paths).toEqual([{ kind: "glob", path: "pages/BroadsecOfThings/*.tsx" }]);
  });

  it("accepts and classifies a `directory` entry", () => {
    const { documents } = loadSection(
      withDocuments("  paths:\n    - src/render/components/\n"),
      FILE,
      catalog,
    );
    expect(documents?.paths).toEqual([{ kind: "directory", path: "src/render/components/" }]);
  });

  it("accepts a `flag` entry", () => {
    const { documents } = loadSection(withDocuments("  flags:\n    - canSeeBoT\n"), FILE, catalog);
    expect(documents?.flags).toEqual([{ flag: "canSeeBoT" }]);
  });

  it("refuses a bare identifier under `paths:` — it belongs under `flags:` (Ruling 1)", () => {
    const run = (): unknown => loadSection(withDocuments("  paths:\n    - AppRoutes\n"), FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/flags/);
  });

  it("refuses a path-shaped string under `flags:`", () => {
    const run = (): unknown =>
      loadSection(withDocuments("  flags:\n    - src/pages/PMVPage.tsx\n"), FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/capability-flag/);
  });

  it("refuses a `:<line>` suffix on a path — gate identity is never line-based", () => {
    const run = (): unknown =>
      loadSection(withDocuments("  paths:\n    - AppRoutes.tsx:202\n"), FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/line/i);
  });

  it("refuses a non-string entry", () => {
    const run = (): unknown => loadSection(withDocuments("  paths:\n    - 123\n"), FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/string/);
  });

  it("refuses `documents` on a block, exactly where `pending`/`labels`/`sourceBase` already are", () => {
    const onBlock = `
id: b
type: prose
documents:
  flags:
    - canSeeBoT
props:
  text: Texto.
`;
    const run = (): unknown => loadSection(onBlock, FILE, catalog);
    expect(run).toThrow(ContentError);
    expect(run).toThrow(/section/i);
  });

  it("applies `sourceBase` to `documents.paths`, and never to `documents.flags` (MUF-004)", () => {
    const { documents } = loadSection(
      withDocuments(
        "  paths:\n    - components/AddObservation.tsx\n  flags:\n    - canSeeBoT\n",
        "src/render/",
      ),
      FILE,
      catalog,
    );
    expect(documents?.paths).toEqual([
      { kind: "file", path: "src/render/components/AddObservation.tsx" },
    ]);
    expect(documents?.flags).toEqual([{ flag: "canSeeBoT" }]);
  });

  it("keeps `declaredIn` as the file and `section` as the root section id", () => {
    const { documents } = loadSection(withDocuments("  flags:\n    - canSeeBoT\n"), FILE, catalog);
    expect(documents?.declaredIn).toBe(FILE);
    expect(documents?.section).toBe("bot");
  });
});
