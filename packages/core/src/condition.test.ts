import { describe, expect, it } from "vitest";
import type { BlockNode, ManualNode, SectionNode, Selector } from "@broadsec-manual/blocks";
import { conditionNodes, matches } from "./condition.ts";

const block = (id: string, when?: BlockNode["when"], props: object = {}): BlockNode => ({
  kind: "block",
  id,
  type: "prose",
  props: props as BlockNode["props"],
  ...(when ? { when } : {}),
});

const section = (
  id: string,
  children: readonly ManualNode[],
  when?: SectionNode["when"],
): SectionNode => ({
  kind: "section",
  id,
  title: [{ kind: "text", value: id }],
  children,
  ...(when ? { when } : {}),
});

const ids = (nodes: readonly ManualNode[]): string[] =>
  nodes.flatMap((n) => [n.id, ...(n.kind === "section" ? ids(n.children) : [])]);

describe("matches", () => {
  const target = { tenant: "mv" };

  it("includes content with no selector", () => {
    expect(matches(undefined, target)).toBe(true);
  });

  it("includes content selecting the target value", () => {
    expect(matches({ tenant: ["mv"] }, target)).toBe(true);
  });

  it("excludes content selecting only other values", () => {
    expect(matches({ tenant: ["amva", "med"] }, target)).toBe(false);
  });

  it("includes content selecting all", () => {
    expect(matches({ tenant: ["all"] }, target)).toBe(true);
  });

  it("ignores axes the target does not constrain", () => {
    expect(matches({ role: ["admin"] }, target)).toBe(true);
  });

  it("requires every constrained axis to match", () => {
    const multi = { tenant: "mv", role: "operator" };
    expect(matches({ tenant: ["mv"], role: ["operator"] }, multi)).toBe(true);
    expect(matches({ tenant: ["mv"], role: ["admin"] }, multi)).toBe(false);
  });
});

describe("conditionNodes", () => {
  const target = { tenant: "amva" };

  it("keeps unconditioned content", () => {
    expect(ids(conditionNodes([block("a"), block("b")], target))).toEqual(["a", "b"]);
  });

  it("drops content excluded by the target", () => {
    const kept = conditionNodes([block("a"), block("b", { tenant: ["mv"] })], target);
    expect(ids(kept)).toEqual(["a"]);
  });

  it("drops a whole section when the section is excluded", () => {
    const tree = [section("s", [block("s.a")], { tenant: ["mv"] })];
    expect(ids(conditionNodes(tree, target))).toEqual([]);
  });

  it("keeps an excluded child excluded even inside an included parent", () => {
    const tree = [section("s", [block("s.a"), block("s.b", { tenant: ["mv"] })])];
    expect(ids(conditionNodes(tree, target))).toEqual(["s", "s.a"]);
  });

  it("drops a child that an included parent cannot rescue", () => {
    // A child selecting only `mv` inside a section selecting `all`.
    const tree = [
      section("s", [block("s.a", { tenant: ["mv"] })], { tenant: ["all"] }),
    ];
    expect(ids(conditionNodes(tree, target))).toEqual(["s"]);
  });

  it("filters conditioned rows inside block props", () => {
    const table = block("t", undefined, {
      rows: [
        { id: "r1", label: "keep" },
        { id: "r2", label: "drop", when: { tenant: ["mv"] } },
        { id: "r3", label: "keep too", when: { tenant: ["amva"] } },
      ],
    });
    const [out] = conditionNodes([table], target) as BlockNode[];
    const rows = out?.props["rows"] as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  it("leaves arrays of plain values untouched", () => {
    const b = block("b", undefined, { tags: ["x", "y"], count: 2 });
    const [out] = conditionNodes([b], target) as BlockNode[];
    expect(out?.props).toEqual({ tags: ["x", "y"], count: 2 });
  });

  it("drops a standalone nested object conditioned by `when` that the target cannot see", () => {
    const b = block("b", undefined, {
      detail: { when: { tenant: ["mv"] }, text: "mv only" },
      other: "kept",
    });
    const [out] = conditionNodes([b], target) as BlockNode[];
    expect(out?.props).toEqual({ other: "kept" });
  });

  it("keeps a standalone nested object conditioned by `when` that the target can see, stripping the tag", () => {
    const b = block("b", undefined, {
      detail: { when: { tenant: ["amva"] }, text: "amva only" },
    });
    const [out] = conditionNodes([b], target) as BlockNode[];
    expect(out?.props).toEqual({ detail: { text: "amva only" } });
  });
});

describe("matches — malformed selector guard", () => {
  it("throws instead of silently degrading when an axis value is not an array", () => {
    const malformed = { tenant: "mv" } as unknown as Selector;
    expect(() => matches(malformed, { tenant: "mv" })).toThrow();
  });
});
