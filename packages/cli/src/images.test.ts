import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PENDING_PLACEHOLDER, buildImageIndex } from "./images.ts";

let figures: string;

/** Create an image file at `rel` under the figures root. */
const put = (rel: string): void => {
  const path = join(figures, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "x");
};

beforeEach(() => {
  figures = mkdtempSync(join(tmpdir(), "broadsec-images-"));
  put(PENDING_PLACEHOLDER);
});

afterEach(() => {
  rmSync(figures, { recursive: true, force: true });
});

describe("buildImageIndex", () => {
  it("prefers the deployment's own image over the shared one", () => {
    put("_common/barra/busqueda.png");
    put("mv/barra/busqueda.png");
    const index = buildImageIndex(figures, "mv");
    const resolved = index.resolve("barra.busqueda");
    expect(resolved.state).toBe("tenant");
    expect(resolved.url).toContain("/mv/barra/busqueda.png");
  });

  it("falls back to the shared image, so an identical screen is stored once", () => {
    put("_common/barra/busqueda.png");
    const index = buildImageIndex(figures, "mv");
    const resolved = index.resolve("barra.busqueda");
    expect(resolved.state).toBe("common");
    expect(resolved.url).toContain("/_common/barra/busqueda.png");
  });

  it("falls back to the one placeholder when nothing was delivered", () => {
    const index = buildImageIndex(figures, "mv");
    const resolved = index.resolve("barra.busqueda");
    expect(resolved.state).toBe("pending");
    expect(resolved.url).toContain(PENDING_PLACEHOLDER);
  });

  it("resolves a single-segment slot at the root of a set", () => {
    put("_common/dashboard.png");
    expect(buildImageIndex(figures, "mv").resolve("dashboard").state).toBe("common");
  });

  it("accepts any of the delivery formats, whatever the area sends", () => {
    put("_common/uno.png");
    put("_common/dos.jpg");
    put("_common/tres.svg");
    put("_common/cuatro.webp");
    const index = buildImageIndex(figures, "mv");
    for (const slot of ["uno", "dos", "tres", "cuatro"]) {
      expect(index.resolve(slot).state, slot).toBe("common");
    }
  });

  it("ignores a file that is not an image", () => {
    put("_common/notas.txt");
    expect(buildImageIndex(figures, "mv").resolve("notas").state).toBe("pending");
  });

  // Two files for one slot means the same image was delivered twice under
  // different formats. Picking one silently is how a stale capture survives a
  // redelivery, so it stops the build instead.
  it("refuses two files claiming the same slot", () => {
    put("_common/barra/busqueda.png");
    put("_common/barra/busqueda.jpg");
    expect(() => buildImageIndex(figures, "mv")).toThrow(/barra\.busqueda/);
    expect(() => buildImageIndex(figures, "mv")).toThrow(/busqueda\.jpg|busqueda\.png/);
  });

  it("allows the same slot in a deployment set and in the shared set", () => {
    put("_common/barra/busqueda.png");
    put("mv/barra/busqueda.jpg");
    expect(() => buildImageIndex(figures, "mv")).not.toThrow();
  });

  it("ignores another deployment's images entirely", () => {
    put("amva/barra/busqueda.png");
    expect(buildImageIndex(figures, "mv").resolve("barra.busqueda").state).toBe("pending");
  });

  // Reports what it SAW, never what it judged unused: deciding that needs every
  // deployment, because an image one of them uses is legitimately unused by the
  // others. That judgement belongs to `imageRequests`.
  it("lists every slot on disk, from both its own set and the shared one", () => {
    put("_common/barra/buscar.png");
    put("mv/barra/otro.png");
    const index = buildImageIndex(figures, "mv");
    expect(index.indexed()).toEqual(["barra.buscar", "barra.otro"]);
  });

  it("lists a slot whether or not anything resolved it", () => {
    put("_common/barra/busqueda.png");
    const index = buildImageIndex(figures, "mv");
    index.resolve("barra.busqueda");
    expect(index.indexed()).toEqual(["barra.busqueda"]);
  });

  it("never lists the placeholder as a delivered slot", () => {
    const index = buildImageIndex(figures, "mv");
    expect(index.indexed()).toEqual([]);
  });

  it("ignores another deployment's folder when listing", () => {
    put("amva/barra/busqueda.png");
    expect(buildImageIndex(figures, "mv").indexed()).toEqual([]);
  });

  // The placeholder is infrastructure: without it a pending slot renders a
  // broken image, which is exactly the blank gap the design forbids.
  it("refuses to build without the placeholder", () => {
    rmSync(join(figures, PENDING_PLACEHOLDER));
    expect(() => buildImageIndex(figures, "mv")).toThrow(/placeholder/i);
  });

  it("works when a deployment has no folder of its own yet", () => {
    put("_common/barra/busqueda.png");
    expect(buildImageIndex(figures, "nuevo").resolve("barra.busqueda").state).toBe("common");
  });

  it("works when nothing has been delivered at all", () => {
    expect(buildImageIndex(figures, "mv").resolve("cualquiera").state).toBe("pending");
  });
});
