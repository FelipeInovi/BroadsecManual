import { describe, expect, it } from "vitest";
import type { ManualNode, ResolvedManual, SectionNode } from "@broadsec-manual/blocks";
import { projectMark, renderReleaseNotes, type ReleaseOptions } from "./release.ts";

const CONTACT = {
  org: "Inovisec Colombia S.A.S.",
  lines: ["Calle 80 N 11 – 42, Bogotá, Colombia", "Teléfono: (601) 6407772"],
  email: "oficinabog@inovisec.com",
};

const block = (id: string, type: string, props: Record<string, unknown>): ManualNode => ({
  kind: "block",
  id,
  type,
  props,
});

const section = (id: string, title: string, children: readonly ManualNode[]): SectionNode => ({
  kind: "section",
  id,
  title: [{ kind: "text", value: title }],
  children,
});

const manual = (children: readonly ManualNode[]): ResolvedManual => ({
  manualId: "bridge-manual",
  version: "1.1.0",
  target: { permission: "todas-las-agencias" },
  children,
  numbers: new Map([
    ["notas", "1"],
    ["notas.menu", "1.1"],
  ]),
  figures: new Map(),
});

const options = (project = "BRIDGE360", contact?: typeof CONTACT): ReleaseOptions => ({
  footerTitle: "Actualización – nuevas características",
  cover: {
    project,
    version: "1.1.0",
    title: "Nuevas Características Habilitadas",
    lede: "Características nuevas disponibles en la plataforma",
    date: "3 de septiembre de 2026",
    ...(contact === undefined ? {} : { contact }),
  },
});

const render = (children: readonly ManualNode[], project?: string, contact?: typeof CONTACT) =>
  renderReleaseNotes(manual(children), options(project, contact));

/**
 * The BODY only. The stylesheet is inlined in `<head>` and names every class it
 * styles, so asserting against the whole document could not tell a class that is
 * merely styled from one that is actually emitted.
 */
const body = (html: string): string => html.slice(html.indexOf("</style>"));

const CONTENT: readonly ManualNode[] = [
  section("notas", "Actualización", [
    block("notas.vigencia", "term-list", {
      entries: [
        {
          id: "notas.vigencia.1",
          term: "Módulo de Comando y Control",
          definition: "Actualización efectiva desde el 7 de agosto de 2026.",
        },
      ],
    }),
    section("notas.menu", "Menú de navegación", [
      block("notas.menu.p", "prose", { text: "Se implementó una **actualización** visual." }),
      block("notas.menu.aviso", "callout", { variant: "important", text: "Cierre la sesión." }),
    ]),
  ]),
];

describe("cover", () => {
  it("names no third party anywhere, which is the rule the reference breaks", () => {
    expect(render(CONTENT, "BRIDGE360", CONTACT).toLowerCase()).not.toContain("carbyne");
  });

  it("prints the office when given one, and omits the block when not", () => {
    expect(body(render(CONTENT, "BRIDGE360", CONTACT))).toContain("Inovisec Colombia S.A.S.");
    expect(body(render(CONTENT, "BRIDGE360"))).not.toContain("cover__contact");
  });

  it("makes the address a link the reader can use", () => {
    expect(body(render(CONTENT, "BRIDGE360", CONTACT))).toContain(
      'href="mailto:oficinabog@inovisec.com"',
    );
  });

  it("draws the mark rather than loading it, because on a band it has to be white", () => {
    const out = body(render(CONTENT));
    expect(out).toContain('class="cover__mark"');
    expect(out).toContain('stroke="#FFFFFF"');
  });

  it("names the version it reports, which nothing else on the page did", () => {
    // Not the filename's job: a reader opens the document, not the directory.
    // Two sets of notes a fortnight apart were otherwise told apart by their
    // date alone.
    expect(body(render(CONTENT))).toContain("1.1.0");
  });

  it("labels it, because a bare number on a cover is not self-explanatory", () => {
    expect(body(render(CONTENT))).toContain("Versión 1.1.0");
  });

  it("sits below the date, and leaves the headline the one word it had", () => {
    const out = body(render(CONTENT));
    const eyebrow = out.indexOf("cover__eyebrow");
    expect(out.slice(eyebrow, out.indexOf("</p>", eyebrow))).not.toContain("1.1.0");
    expect(out.indexOf("cover__version")).toBeGreaterThan(out.indexOf("cover__date"));
  });

  it("escapes it, because it reaches the page as an argument like any other", () => {
    const out = renderReleaseNotes(manual(CONTENT), {
      ...options(),
      cover: { ...options().cover, version: '1.0<script>' },
    });
    expect(out).not.toContain("<script>");
  });
});

describe("projectMark", () => {
  it("splits trailing digits into their own weight, so the name reads as a lockup", () => {
    expect(projectMark("BRIDGE360")).toBe("<span>BRIDGE</span><b>360</b>");
  });

  it("prints a name with no trailing digits whole, rather than dropping part of it", () => {
    expect(projectMark("BROADSEC")).toBe("<span>BROADSEC</span>");
  });

  it("does not treat an all-digit name as a bare suffix", () => {
    expect(projectMark("360")).toBe("<span>360</span>");
  });

  it("escapes, because a project name reaches the page and the band's CSS", () => {
    expect(projectMark("A<b>&")).toBe("<span>A&lt;b&gt;&amp;</span>");
  });
});

describe("table of contents", () => {
  it("is titled Contenido, as the reference has it and unlike the manuals", () => {
    const out = body(render(CONTENT));
    expect(out).toContain("Contenido");
    expect(out).not.toContain("Tabla de Contenido");
  });

  it("carries both levels, numbered from the resolved map", () => {
    const out = body(render(CONTENT));
    expect(out).toContain("toc__entry--l1");
    expect(out).toContain("toc__entry--l2");
    expect(out).toContain("1. Actualización");
    expect(out).toContain("1.1. Menú de navegación");
  });
});

describe("sections", () => {
  it("wraps the whole module, so the opener page covers its content too", () => {
    const out = body(render(CONTENT));
    // The bug this prevents: wrapping only the heading gave the opener a page of
    // its own and pushed everything under it onto the next one.
    const open = out.indexOf('<div class="module">');
    const close = out.indexOf("</div>", out.indexOf('class="term-list"'));
    expect(open).toBeGreaterThan(-1);
    expect(out.slice(open, close)).toContain('class="term-list"');
  });

  it("puts the section number in its own element, so the band can colour it", () => {
    expect(body(render(CONTENT))).toContain("<b>1.</b><span>Actualización</span>");
  });
});

describe("blocks", () => {
  it("renders the three types these notes are made of", () => {
    const out = body(render(CONTENT));
    expect(out).toContain('class="prose"');
    expect(out).toContain('class="callout callout--important"');
    expect(out).toContain('class="term-list"');
  });

  it("applies bold markup inside prose", () => {
    expect(body(render(CONTENT))).toContain("<strong>actualización</strong>");
  });

  it("labels an important callout the way the manuals do", () => {
    expect(body(render(CONTENT))).toContain("<strong>IMPORTANTE:</strong>");
  });

  it("leaves the validity term without the manuals' trailing colon", () => {
    expect(body(render(CONTENT))).toContain("<dt>Módulo de Comando y Control</dt>");
  });

  it("draws nothing for a type it does not know, rather than throwing", () => {
    // A fourth block type means the document outgrew this template. A silent gap
    // in a proof is easier to notice than a stack trace in a build log.
    const out = body(render([section("notas", "Actualización", [
      block("notas.fig", "figure", { caption: "algo" }),
    ])]));
    expect(out).not.toContain("figure");
    expect(out).toContain('class="module"');
  });
});

describe("running elements", () => {
  it("emits both hosts, so the paginator has a header and a footer to place", () => {
    const out = body(render(CONTENT));
    expect(out).toContain('class="rh-host"');
    expect(out).toContain('class="rf-host"');
  });

  it("carries the three footer lines a margin box could not hold in one row", () => {
    const out = body(render(CONTENT));
    expect(out).toContain('class="rf__title"');
    expect(out).toContain('class="rf__row"');
    expect(out).toContain('class="rf__seal"');
  });

  it("names the project in the footer, beside the page number", () => {
    expect(body(render(CONTENT))).toContain("Inovisec &ndash; BRIDGE360");
  });
});

describe("stylesheet", () => {
  it("is the release sheet, not either brand's", () => {
    const out = render(CONTENT);
    // The band painted on the page box is this sheet's own device.
    expect(out).toContain(".pagedjs_pagebox::before");
  });

  it("carries the project name into the interior band", () => {
    expect(render(CONTENT)).toContain('content: "BRIDGE360"');
  });
});
