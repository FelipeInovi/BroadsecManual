import type { BlockCatalog } from "../definition.js";
import { prose } from "./prose.ts";
import { iconTable } from "./icon-table.ts";
import { figure } from "./figure.ts";
import { note } from "./note.ts";
import { detailHeader } from "./detail-header.ts";

export * from "./prose.ts";
export * from "./icon-table.ts";
export * from "./figure.ts";
export * from "./note.ts";
export * from "./detail-header.ts";

/** PROVISIONAL — see README.md in this folder. */
export const catalog: BlockCatalog = new Map(
  [prose, iconTable, figure, note, detailHeader].map((b) => [b.type, b as never]),
);
