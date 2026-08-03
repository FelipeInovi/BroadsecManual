import type { BlockCatalog, ManualNode, NodeId } from "@broadsec-manual/blocks";

/**
 * Assign every node its rendered ordinal for one build target.
 *
 * Runs AFTER conditioning, never before: the whole point is that a target
 * which cannot see a section has its following sections shift up.
 *
 * - Sections take their position in the tree: `1`, `1.2`, `1.2.3`.
 * - A numbered block counts within its nearest enclosing section, per the
 *   block type's `numbering.scope`.
 * - Rows inside a numbered block continue that block's scope counter, so a
 *   filtered table renumbers from one.
 */
export function assignNumbers(
  nodes: readonly ManualNode[],
  catalog: BlockCatalog,
): Map<NodeId, string> {
  const numbers = new Map<NodeId, string>();

  const walk = (children: readonly ManualNode[], prefix: readonly number[]): void => {
    let sectionIndex = 0;
    // Per-scope counters, reset for every section — that is what makes
    // numbering local and therefore stable under conditioning.
    const blockCounters = new Map<string, number>();

    for (const node of children) {
      if (node.kind === "section") {
        sectionIndex += 1;
        const path = [...prefix, sectionIndex];
        numbers.set(node.id, path.join("."));
        walk(node.children, path);
        continue;
      }

      const def = catalog.get(node.type);
      if (!def?.numbering) continue;

      const scope = def.numbering.labelKey;
      const rows = node.props["rows"];

      if (Array.isArray(rows)) {
        // The block itself is a container of numbered items.
        let n = blockCounters.get(scope) ?? 0;
        for (const row of rows) {
          if (typeof row !== "object" || row === null || !("id" in row)) continue;
          n += 1;
          numbers.set(String((row as { id: unknown }).id), [...prefix, n].join("."));
        }
        blockCounters.set(scope, n);
        continue;
      }

      const n = (blockCounters.get(scope) ?? 0) + 1;
      blockCounters.set(scope, n);
      numbers.set(node.id, [...prefix, n].join("."));
    }
  };

  walk(nodes, []);
  return numbers;
}
