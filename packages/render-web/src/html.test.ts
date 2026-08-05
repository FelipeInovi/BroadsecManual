import { describe, expect, it } from "vitest";
import type { BlockNode, ManualNode, ResolvedImage, ResolvedManual } from "@broadsec-manual/blocks";
import { renderHtml, type RenderOptions } from "./html.ts";

const PENDING: ResolvedImage = {
  url: "file:///figures/_pending.svg",
  state: "pending",
  deliverTo: "_common/barra/busqueda.png",
};

const DELIVERED: ResolvedImage = {
  url: "file:///figures/_common/barra/busqueda.png",
  state: "common",
};

const block = (id: string, type: string, props: Record<string, unknown>): BlockNode => ({
  kind: "block",
  id,
  type,
  props,
});

const manual = (children: readonly ManualNode[]): ResolvedManual => ({
  manualId: "m",
  version: "0.1.0",
  target: { tenant: "mv" },
  children,
  numbers: new Map(),
  figures: new Map([["s.fig", "1.1"]]),
});

const render = (
  children: readonly ManualNode[],
  slots: Array<[string, string]>,
  resolved: ResolvedImage,
  draft?: boolean,
): string => {
  const options: RenderOptions = {
    header: "BROADSEC",
    slots: new Map(slots),
    images: () => resolved,
    figures: new Map(slots.map(([id], i) => [id, `1.${i + 1}`])),
    ...(draft === undefined ? {} : { draft }),
    cover: { brand: "B", title: "T", version: "0.1.0", lede: "L", meta: "M" },
  };
  return renderHtml(manual(children), options);
};

/**
 * The rendered BODY only.
 *
 * The stylesheet is inlined in `<head>` and names every class it styles, so
 * asserting a class is absent from the whole document would always fail — and
 * would have hidden whether the markup actually carries it.
 */
const body = (html: string): string => html.slice(html.indexOf("</style>"));

/**
 * The body with its tags removed — what a reader actually sees.
 *
 * The delivery path is deliberately split across two elements so the filename
 * cannot wrap, so asserting on raw markup would test the split rather than the
 * thing that matters: that the whole path is readable and transcribable.
 */
const visible = (html: string): string => body(html).replace(/<[^>]*>/g, "");

const figure = [block("s.fig", "figure", { caption: "Barra de búsqueda", widthPercent: 80 })];
const figureSlots: Array<[string, string]> = [["s.fig", "barra.busqueda"]];

describe("pending image names", () => {
  // The whole reason the draft build exists: whoever captures the screenshots
  // works from this PDF and has no other way to know what to call the file.
  it("prints the delivery path beside a pending image in a draft", () => {
    const html = render(figure, figureSlots, PENDING, true);
    expect(visible(html)).toContain("_common/barra/busqueda.png");
    expect(body(html)).toContain('class="shot__name"');
  });

  // Invariant 4: a tenant's PDF carries no trace of the pipeline's internals.
  // This is the test that keeps a slot path out of a document marked Confidential.
  it("never prints it in a client build, even though the image is pending", () => {
    const html = body(render(figure, figureSlots, PENDING));
    expect(html).not.toContain("_common/barra/busqueda.png");
    expect(html).not.toContain("shot__name");
    // The placeholder itself still renders — a pending slot is never a gap.
    expect(html).toContain("_pending.svg");
  });

  it("prints nothing for a delivered image, draft or not", () => {
    for (const draft of [true, false]) {
      const html = body(render(figure, figureSlots, DELIVERED, draft));
      expect(html, `draft=${draft}`).not.toContain("shot__name");
    }
  });

  // The whole draft exists so a filename can be transcribed exactly. The
  // longest one wrapped between "…seleccionar." and "png", which reads as a
  // name ending in a dot — the one way this text can be copied wrong.
  it("keeps the filename unbreakable, so it can never wrap mid-extension", () => {
    const html = body(render(figure, figureSlots, PENDING, true));
    expect(html).toContain('<span class="shot__file">busqueda.png</span>');
    // The directory stays outside it: that is the one place a long path MAY
    // break, and breaking there costs nothing.
    expect(html).toContain('>_common/barra/<span class="shot__file">');
  });

  it("escapes the path, so it cannot inject markup", () => {
    const html = body(
      render(
        figure,
        figureSlots,
        {
          url: "file:///x.svg",
          state: "pending",
          deliverTo: "_common/<script>alert(1)</script>.png",
        },
        true,
      ),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("puts a table row's name in the description cell, not the 34pt icon column", () => {
    const table = [
      block("s.tabla", "icon-table", {
        labelHeader: "Control",
        descriptionHeader: "Función",
        rows: [{ id: "r1", label: "Buscar", description: "Busca casos." }],
      }),
    ];
    const html = body(render(table, [["r1", "barra.busqueda"]], PENDING, true));
    const iconCell = html.slice(html.indexOf('class="tbl__icon'), html.indexOf('class="tbl__label'));
    expect(iconCell).not.toContain("shot__name");
    expect(html).toContain("Busca casos.");
    expect(html.indexOf("shot__name")).toBeGreaterThan(html.indexOf("Busca casos."));
  });
});

// A page number exists nowhere but the paginated DOM, and the DOM can only say
// WHICH image it is if the markup carries the slot. Without this the page
// numbers would have to be matched to slots by caption text — which breaks the
// moment two figures show the same thing.
describe("slot identity in the markup", () => {
  it("tags every image with the slot it belongs to", () => {
    const html = body(render(figure, figureSlots, PENDING));
    expect(html).toContain('data-slot="barra.busqueda"');
  });

  it("tags a table icon too, so an icon slot is locatable as well", () => {
    const table = [
      block("s.tabla", "icon-table", {
        labelHeader: "Control",
        descriptionHeader: "Función",
        rows: [{ id: "r1", label: "Buscar", description: "Busca casos." }],
      }),
    ];
    const html = body(render(table, [["r1", "barra.busqueda"]], PENDING));
    expect(html).toContain('data-slot="barra.busqueda"');
  });

  // It identifies a slot, it does not leak one: the attribute names the slot,
  // never the delivery path that invariant 4 keeps out of a client build.
  it("carries the slot in a client build without leaking the delivery path", () => {
    const html = body(render(figure, figureSlots, PENDING));
    expect(html).toContain('data-slot="barra.busqueda"');
    expect(html).not.toContain("_common/barra/busqueda.png");
  });
});

describe("image slots the renderer was not given", () => {
  // The renderer holds no image policy: a node absent from the slots map has no
  // image, full stop. If it invented one, prose would sprout placeholders.
  it("renders no image at all for a node with no slot", () => {
    const html = body(render([block("s.p", "prose", { text: "Sin ilustración." })], [], PENDING, true));
    expect(html).not.toContain("_pending.svg");
    expect(html).not.toContain("shot");
  });
});
