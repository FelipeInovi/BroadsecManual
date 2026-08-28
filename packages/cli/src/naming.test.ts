import { describe, expect, it } from "vitest";
import {
  newestWorkNumberFor,
  nextWorkNumber,
  releaseNotesFilename,
  workNumberIn,
  workStamp,
} from "./naming.ts";

describe("releaseNotesFilename", () => {
  it("names the notes after the document they accompany, so the two sort together", () => {
    expect(releaseNotesFilename("manual-operador-bridge-todas-las-agencias-v1.1.0.pdf")).toBe(
      "manual-operador-bridge-todas-las-agencias-v1.1.0-notas-de-version.docx",
    );
  });

  it("is .docx even when handed the Word file, because there is only one format", () => {
    expect(releaseNotesFilename("manual-operador-mv-v1.1.0.docx")).toBe(
      "manual-operador-mv-v1.1.0-notas-de-version.docx",
    );
  });

  it("takes the LAST dot, so a version number is not mistaken for an extension", () => {
    expect(releaseNotesFilename("manual-operador-mv-v1.10.2.pdf")).toBe(
      "manual-operador-mv-v1.10.2-notas-de-version.docx",
    );
  });

  it("still produces a .docx from a name with no extension at all", () => {
    expect(releaseNotesFilename("manual-operador-mv-v1.1.0")).toBe(
      "manual-operador-mv-v1.1.0-notas-de-version.docx",
    );
  });

  it("leaves a leading dot alone rather than eating the whole name", () => {
    expect(releaseNotesFilename(".hidden")).toBe(".hidden-notas-de-version.docx");
  });
});

describe("workStamp", () => {
  it("pads to two digits so a folder listing sorts the way it reads", () => {
    expect(workStamp(1)).toBe("trabajo-01");
    expect(workStamp(9)).toBe("trabajo-09");
    expect(workStamp(10)).toBe("trabajo-10");
  });

  it("stops padding once the number outgrows two digits", () => {
    expect(workStamp(117)).toBe("trabajo-117");
  });
});

describe("workNumberIn", () => {
  it("reads the number out of a full build name", () => {
    expect(workNumberIn("manual-operador-mv-trabajo-08.pdf")).toBe(8);
  });

  it("reads it through a draft marker", () => {
    expect(workNumberIn("manual-operador-mv-trabajo-08-BORRADOR.pdf")).toBe(8);
  });

  it("finds nothing in a version-named file", () => {
    expect(workNumberIn("manual-operador-mv-v1.0.0.pdf")).toBeNull();
  });
});

describe("nextWorkNumber", () => {
  it("starts at 1 for a manual with nothing built", () => {
    expect(nextWorkNumber([])).toBe(1);
  });

  it("starts at 1 when the only files there are not working builds", () => {
    // An official build sits in `output/` after a delivery. It must not be read
    // as the eighth of anything — it is a version, not an iteration of work.
    expect(nextWorkNumber(["manual-operador-mv-v1.0.0.pdf", "notas.md"])).toBe(1);
  });

  it("continues from the highest number on disk", () => {
    expect(
      nextWorkNumber([
        "manual-operador-mv-trabajo-07.pdf",
        "manual-operador-mv-trabajo-08.pdf",
        "manual-operador-med-trabajo-08.pdf",
      ]),
    ).toBe(9);
  });

  it("compares numerically, so 10 beats 9 instead of sorting under it", () => {
    expect(nextWorkNumber(["m-trabajo-09.pdf", "m-trabajo-10.pdf"])).toBe(11);
  });

  it("counts a draft as a build that happened", () => {
    // Otherwise the next real build reuses 08, and two different documents on
    // disk would carry the same number.
    expect(nextWorkNumber(["manual-operador-mv-trabajo-08-BORRADOR.pdf"])).toBe(9);
  });

  it("sees every extension, so one run's pdf, html and docx do not each advance it", () => {
    expect(nextWorkNumber(["m-trabajo-04.pdf", "m-trabajo-04.html", "m-trabajo-04.docx"])).toBe(5);
  });

  it("is allocated per manual, so a filtered run leaves a true gap", () => {
    // `build --tenant mv` renders only mv, and 09 is spent. med's newest stays
    // at 08 and the next full build gives both 10 — which is the point: equal
    // numbers always mean equal content.
    const afterFilteredRun = ["mv-trabajo-09.pdf", "med-trabajo-08.pdf"];
    expect(nextWorkNumber(afterFilteredRun)).toBe(10);
  });
});

describe("newestWorkNumberFor", () => {
  const output = [
    "manual-operador-mv-trabajo-09.pdf",
    "manual-operador-mv-trabajo-08.pdf",
    "manual-operador-med-trabajo-08.pdf",
    "manual-operador-med-v1.4.7.pdf",
  ];

  it("reports each target's own newest build", () => {
    expect(newestWorkNumberFor(output, "mv")).toBe(9);
    expect(newestWorkNumberFor(output, "med")).toBe(8);
  });

  it("reports nothing for a target with no working build", () => {
    expect(newestWorkNumberFor(output, "demo")).toBeNull();
  });

  it("does not let one axis value match inside another", () => {
    // `mv` sits inside `mvd`. Bare inclusion would show mvd's builds under mv.
    expect(newestWorkNumberFor(["manual-operador-mvd-trabajo-04.pdf"], "mv")).toBeNull();
  });

  it("ignores an official build, which is not an iteration of work", () => {
    expect(newestWorkNumberFor(["manual-operador-mv-v1.0.0.pdf"], "mv")).toBeNull();
  });
});
