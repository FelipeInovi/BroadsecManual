import { describe, expect, it } from "vitest";
import { z } from "zod";
import { catalog } from "@broadsec-manual/blocks";
import type { BlockCatalog, BlockDefinition, BlockNode, ManualNode, SectionNode } from "@broadsec-manual/blocks";
import { assignNumbers } from "./number.ts";

const fig = (id: string): BlockNode => ({
  kind: "block",
  id,
  type: "figure",
  props: { src: "x.png", caption: "c", widthPercent: 100 },
});

const table = (id: string, rowIds: readonly string[]): BlockNode => ({
  kind: "block",
  id,
  type: "icon-table",
  props: {
    labelHeader: "Elemento",
    descriptionHeader: "Descripción",
    rows: rowIds.map((r) => ({ id: r, label: r, description: r })),
  },
});

const section = (id: string, children: readonly ManualNode[]): SectionNode => ({
  kind: "section",
  id,
  title: [{ kind: "text", value: id }],
  children,
});

/**
 * Test-only block types, one per `NumberingScope`, so numbering behaviour
 * for each scope can be exercised in isolation from the shipped catalogue.
 * Never add fixtures like these to `packages/blocks/src/catalog/`.
 */
const testCounterProps = z.object({});

const docCounterBlock: BlockDefinition<z.infer<typeof testCounterProps>> = {
  type: "test-doc-counter",
  version: "0.1.0",
  description: "Test-only block numbered with `document` scope.",
  schema: testCounterProps,
  children: { kind: "none" },
  numbering: { scope: "document", labelKey: "item" },
};

const subCounterBlock: BlockDefinition<z.infer<typeof testCounterProps>> = {
  type: "test-sub-counter",
  version: "0.1.0",
  description: "Test-only block numbered with `subsection` scope.",
  schema: testCounterProps,
  children: { kind: "none" },
  numbering: { scope: "subsection", labelKey: "note" },
};

const catalogWithTestBlocks: BlockCatalog = new Map([
  ...catalog,
  [docCounterBlock.type, docCounterBlock],
  [subCounterBlock.type, subCounterBlock],
]);

const docItem = (id: string): BlockNode => ({ kind: "block", id, type: docCounterBlock.type, props: {} });
const subItem = (id: string): BlockNode => ({ kind: "block", id, type: subCounterBlock.type, props: {} });

describe("assignNumbers", () => {
  it("numbers top-level sections from one", () => {
    const n = assignNumbers([section("a", []), section("b", [])], catalog);
    expect(n.get("a")).toBe("1");
    expect(n.get("b")).toBe("2");
  });

  it("numbers nested sections by their position in the tree", () => {
    const n = assignNumbers(
      [section("a", [section("a.x", []), section("a.y", [section("a.y.1", [])])])],
      catalog,
    );
    expect(n.get("a.x")).toBe("1.1");
    expect(n.get("a.y")).toBe("1.2");
    expect(n.get("a.y.1")).toBe("1.2.1");
  });

  it("renumbers after an earlier section is absent", () => {
    // Conditioning removed what would have been section 1.
    const n = assignNumbers([section("b", []), section("c", [])], catalog);
    expect(n.get("b")).toBe("1");
    expect(n.get("c")).toBe("2");
  });

  it("numbers figures within their section and resets per section", () => {
    const n = assignNumbers(
      [
        section("a", [fig("a.f1"), fig("a.f2")]),
        section("b", [fig("b.f1")]),
      ],
      catalog,
    );
    expect(n.get("a.f1")).toBe("1.1");
    expect(n.get("a.f2")).toBe("1.2");
    expect(n.get("b.f1")).toBe("2.1");
  });

  it("figure is `section`-scoped: nested subsections keep counting against their top-level section, not their own subsection", () => {
    const n = assignNumbers(
      [section("a", [fig("a.f1"), section("a.x", [fig("a.x.f1")])])],
      catalog,
    );
    expect(n.get("a.f1")).toBe("1.1");
    // Nested one level deeper, but still counted against top-level section "a".
    expect(n.get("a.x.f1")).toBe("1.2");
  });

  it("`document` scope keeps one counter for the whole manual, never reset", () => {
    const n = assignNumbers(
      [
        section("a", [docItem("a.d1"), docItem("a.d2")]),
        section("b", [section("b.x", [docItem("b.x.d1")])]),
      ],
      catalogWithTestBlocks,
    );
    expect(n.get("a.d1")).toBe("1");
    expect(n.get("a.d2")).toBe("2");
    expect(n.get("b.x.d1")).toBe("3");
  });

  it("`section` scope resets at each top-level section and ignores nesting depth", () => {
    const n = assignNumbers(
      [
        section("a", [fig("a.f1"), section("a.x", [fig("a.x.f1"), fig("a.x.f2")])]),
        section("b", [fig("b.f1")]),
      ],
      catalog,
    );
    expect(n.get("a.f1")).toBe("1.1");
    expect(n.get("a.x.f1")).toBe("1.2");
    expect(n.get("a.x.f2")).toBe("1.3");
    // A new top-level section resets the counter.
    expect(n.get("b.f1")).toBe("2.1");
  });

  it("`subsection` scope resets at every section, at any depth", () => {
    const n = assignNumbers(
      [section("a", [subItem("a.s1"), section("a.x", [subItem("a.x.s1")])])],
      catalogWithTestBlocks,
    );
    expect(n.get("a.s1")).toBe("1.1");
    expect(n.get("a.x.s1")).toBe("1.1.1");
  });

  it("numbers table rows against the owning subsection", () => {
    const n = assignNumbers(
      [section("a", [section("a.x", [table("a.x.t", ["r1", "r2", "r3"])])])],
      catalog,
    );
    expect(n.get("r1")).toBe("1.1.1");
    expect(n.get("r2")).toBe("1.1.2");
    expect(n.get("r3")).toBe("1.1.3");
  });

  it("renumbers rows after conditioning removed one", () => {
    const n = assignNumbers(
      [section("a", [section("a.x", [table("a.x.t", ["r1", "r3"])])])],
      catalog,
    );
    expect(n.get("r1")).toBe("1.1.1");
    expect(n.get("r3")).toBe("1.1.2");
  });
});
