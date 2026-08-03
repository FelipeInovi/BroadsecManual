import type { BlockCatalog, ManualNode, NodeId } from "@broadsec-manual/blocks";

/**
 * Assign every node its rendered ordinal for one build target.
 *
 * Runs AFTER conditioning, never before: the whole point is that a target
 * which cannot see a section has its following sections shift up.
 *
 * - Sections take their position in the tree: `1`, `1.2`, `1.2.3`.
 * - A numbered block counts against a counter chosen by the block type's
 *   `numbering.scope`:
 *     - `document` — one counter for the whole manual, never reset. Ordinal
 *       is the bare counter (`1`, `2`, `3`).
 *     - `section` — resets at each TOP-LEVEL section and keeps counting
 *       through every subsection nested under it, however deep. Ordinal is
 *       `<top-level section number>.<n>`.
 *     - `subsection` — resets at EVERY section, at any depth. Ordinal is
 *       `<full section path>.<n>`.
 *     - `block` — resets at every instance. Bare ordinal.
 * - A block that declares `numbering.itemsProp` numbers the items in that prop
 *   instead of itself, so a filtered table or procedure renumbers from one.
 */
export function assignNumbers(
  nodes: readonly ManualNode[],
  catalog: BlockCatalog,
): Map<NodeId, string> {
  const numbers = new Map<NodeId, string>();

  // `document`-scoped counters span the whole manual and are never reset,
  // regardless of how many sections or recursion frames the walk crosses.
  const documentCounters = new Map<string, number>();

  const walk = (
    children: readonly ManualNode[],
    prefix: readonly number[],
    /** Ordinal prefix of the enclosing TOP-LEVEL section, for `section` scope. */
    topLevelPrefix: readonly number[],
    /** `section`-scoped counters for the current top-level section — shared
     * by every subsection nested under it, no matter the depth. */
    sectionCounters: Map<string, number>,
  ): void => {
    let sectionIndex = 0;
    // `subsection`-scoped counters, reset for every section frame.
    const subsectionCounters = new Map<string, number>();

    for (const node of children) {
      if (node.kind === "section") {
        sectionIndex += 1;
        const path = [...prefix, sectionIndex];
        numbers.set(node.id, path.join("."));
        const isTopLevel = prefix.length === 0;
        walk(
          node.children,
          path,
          isTopLevel ? path : topLevelPrefix,
          isTopLevel ? new Map() : sectionCounters,
        );
        continue;
      }

      const def = catalog.get(node.type);
      if (!def?.numbering) continue;

      const { scope, labelKey, itemsProp } = def.numbering;
      // `block` scope gets a throwaway counter map: nothing outside this one
      // block instance may share or continue its count.
      const counters =
        scope === "document"
          ? documentCounters
          : scope === "section"
            ? sectionCounters
            : scope === "subsection"
              ? subsectionCounters
              : new Map<string, number>();
      const ordinalPrefix =
        scope === "section" ? topLevelPrefix : scope === "subsection" ? prefix : [];

      // A container numbers its items; anything else numbers itself. Which one
      // it is comes from the block's own declaration, never from prop names.
      const items = itemsProp === undefined ? undefined : node.props[itemsProp];

      if (Array.isArray(items)) {
        let n = counters.get(labelKey) ?? 0;
        for (const item of items) {
          if (typeof item !== "object" || item === null || !("id" in item)) continue;
          n += 1;
          numbers.set(String((item as { id: unknown }).id), [...ordinalPrefix, n].join("."));
        }
        counters.set(labelKey, n);
        continue;
      }

      const n = (counters.get(labelKey) ?? 0) + 1;
      counters.set(labelKey, n);
      numbers.set(node.id, [...ordinalPrefix, n].join("."));
    }
  };

  walk(nodes, [], [], new Map());
  return numbers;
}
