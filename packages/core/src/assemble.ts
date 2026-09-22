import type {
  BlockCatalog,
  BuildTarget,
  ManualDocument,
  ResolvedManual,
} from "@broadsec-manual/blocks";
import { conditionNodes } from "./condition.ts";
import { assignNumbers } from "./number.ts";

/**
 * Turn an authored document into one ready to render for a single target.
 *
 * The order is the contract: condition, THEN number. Never the reverse.
 *
 * `hidden` names image slots a delivery-time act is currently hiding (see
 * `packages/cli/src/hidden.ts`) — threaded to `assignNumbers` so a hidden
 * slot never receives a figure number. Optional and empty by default so
 * every existing caller keeps compiling and assembling exactly as before.
 */
export function assemble(
  doc: ManualDocument,
  target: BuildTarget,
  catalog: BlockCatalog,
  hidden: ReadonlySet<string> = new Set(),
): ResolvedManual {
  const children = conditionNodes(doc.children, target);
  const { numbers, figures } = assignNumbers(children, catalog, hidden);
  return {
    manualId: doc.manualId,
    version: doc.version,
    target,
    children,
    numbers,
    figures,
  };
}
