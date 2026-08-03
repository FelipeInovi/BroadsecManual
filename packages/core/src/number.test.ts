import { describe, expect, it } from "vitest";
import { catalog } from "@broadsec-manual/blocks";
import type { BlockNode, ManualNode, SectionNode } from "@broadsec-manual/blocks";
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

  it("counts figures of nested subsections against their own subsection", () => {
    const n = assignNumbers(
      [section("a", [fig("a.f1"), section("a.x", [fig("a.x.f1")])])],
      catalog,
    );
    expect(n.get("a.f1")).toBe("1.1");
    expect(n.get("a.x.f1")).toBe("1.1.1");
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
