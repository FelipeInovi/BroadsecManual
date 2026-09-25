import { describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCommit } from "./commit-check.ts";
import { hiddenCommitMessage, hiddenPath, hiddenSlotSet, hideSlot, readHidden, showSlot } from "./hidden.ts";

const tmp = (): string => mkdtempSync(join(tmpdir(), "hidden-"));

describe("readHidden", () => {
  it("returns `null` when the file does not exist — nothing is hidden yet", () => {
    expect(readHidden(tmp())).toBeNull();
  });

  it("reads back exactly what `hideSlot` wrote", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-22" });
    const read = readHidden(dir);
    expect(read?.hidden["mapa.fig-capas"]).toEqual({ hiddenAt: "2026-09-22" });
  });

  it("keeps an optional note", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", {
      hiddenAt: "2026-09-22",
      note: "primera entrega — llega en la 1.1.0",
    });
    expect(readHidden(dir)?.hidden["mapa.fig-capas"]?.note).toBe(
      "primera entrega — llega en la 1.1.0",
    );
  });
});

describe("hideSlot", () => {
  it("hiding slot A leaves slot B's entry byte-identical", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-11" });
    const before = JSON.parse(readFileSync(join(dir, "hidden-images.json"), "utf8"));
    const beforeB = before.hidden["mapa.fig-capas"];

    hideSlot(dir, "barra.busqueda", { hiddenAt: "2026-09-12" });
    const after = JSON.parse(readFileSync(join(dir, "hidden-images.json"), "utf8"));
    expect(after.hidden["mapa.fig-capas"]).toEqual(beforeB);
    expect(after.hidden["barra.busqueda"]).toEqual({ hiddenAt: "2026-09-12" });
  });

  it("writes keys sorted, whatever order they were hidden in", () => {
    const dir = tmp();
    hideSlot(dir, "zeta.fig", { hiddenAt: "2026-09-12" });
    const result = hideSlot(dir, "alfa.fig", { hiddenAt: "2026-09-11" });
    expect(Object.keys(result.hidden)).toEqual(["alfa.fig", "zeta.fig"]);
  });

  it("creates the file when it does not exist yet", () => {
    const dir = tmp();
    expect(existsSync(join(dir, "hidden-images.json"))).toBe(false);
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-11" });
    expect(existsSync(join(dir, "hidden-images.json"))).toBe(true);
  });
});

describe("showSlot", () => {
  it("un-hides exactly the named slot, leaving the rest untouched", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-11" });
    hideSlot(dir, "barra.busqueda", { hiddenAt: "2026-09-12" });

    const result = showSlot(dir, "mapa.fig-capas");
    expect(result.hidden["mapa.fig-capas"]).toBeUndefined();
    expect(result.hidden["barra.busqueda"]).toEqual({ hiddenAt: "2026-09-12" });
  });

  it("is a harmless no-op on a slot that was never hidden", () => {
    const dir = tmp();
    hideSlot(dir, "barra.busqueda", { hiddenAt: "2026-09-12" });
    const result = showSlot(dir, "never.hidden");
    expect(Object.keys(result.hidden)).toEqual(["barra.busqueda"]);
  });

  it("does not throw when the file does not exist yet", () => {
    const dir = tmp();
    expect(() => showSlot(dir, "mapa.fig-capas")).not.toThrow();
  });

  // A manual that never hid anything must not gain a tracked file just
  // because somebody ran `--show` against it — that is a pointless entry in
  // `git status` nobody asked for.
  it("leaves no hidden-images.json behind when nothing was ever hidden", () => {
    const dir = tmp();
    showSlot(dir, "mapa.fig-capas");
    expect(existsSync(join(dir, "hidden-images.json"))).toBe(false);
  });

  // Node's built-in `fs` exports cannot be spied on under ESM (the module
  // namespace is not configurable), so the write attempt is caught the other
  // way: make the file read-only first. A real write throws EPERM; a correct
  // no-op does not touch the file at all.
  it("does not attempt to write when un-hiding a slot that is not in the file", () => {
    const dir = tmp();
    hideSlot(dir, "barra.busqueda", { hiddenAt: "2026-09-12" });
    const path = join(dir, "hidden-images.json");
    chmodSync(path, 0o444);
    try {
      expect(() => showSlot(dir, "never.hidden")).not.toThrow();
    } finally {
      chmodSync(path, 0o666);
    }
  });
});

describe("hiddenPath", () => {
  it("names hidden-images.json inside the manual directory", () => {
    expect(hiddenPath(join("manuals", "un-manual"))).toBe(
      join("manuals", "un-manual", "hidden-images.json"),
    );
  });
});

describe("hiddenCommitMessage", () => {
  const STAGED = ["manuals/un-manual/hidden-images.json"];

  it("passes checkCommit for a hide with a note", () => {
    const message = hiddenCommitMessage("hide", "un-manual", "s.fig", "llega en la 1.1.0");
    expect(message).toContain("chore(un-manual): hide s.fig");
    expect(message).toContain("llega en la 1.1.0");
    expect(message).toContain("Producto: sin-cambio");
    expect(checkCommit({ message, stagedPaths: STAGED })).toEqual({ ok: true, problems: [] });
  });

  it("passes checkCommit for a hide with no note, using a short generic line", () => {
    const message = hiddenCommitMessage("hide", "un-manual", "s.fig");
    expect(checkCommit({ message, stagedPaths: STAGED })).toEqual({ ok: true, problems: [] });
  });

  it("passes checkCommit for a show", () => {
    const message = hiddenCommitMessage("show", "un-manual", "s.fig");
    expect(message).toContain("chore(un-manual): show s.fig again");
    expect(message).toContain("Producto: sin-cambio");
    expect(checkCommit({ message, stagedPaths: STAGED })).toEqual({ ok: true, problems: [] });
  });

  it("carries the manual id into the header scope, matching the staged path's manual", () => {
    const message = hiddenCommitMessage("hide", "otro-manual", "s.fig");
    expect(
      checkCommit({ message, stagedPaths: ["manuals/otro-manual/hidden-images.json"] }),
    ).toEqual({ ok: true, problems: [] });
  });

  it("never carries AI attribution", () => {
    const message = hiddenCommitMessage("hide", "un-manual", "s.fig", "una nota");
    expect(message).not.toMatch(/Co-Authored-By/i);
    expect(message.toLowerCase()).not.toContain("claude");
  });
});

describe("hiddenSlotSet", () => {
  it("is empty when nothing is hidden — a missing file means nothing is hidden, never a throw", () => {
    expect(hiddenSlotSet(tmp())).toEqual(new Set());
  });

  it("names every currently hidden slot, ready to hand to `core`", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-11" });
    hideSlot(dir, "barra.busqueda", { hiddenAt: "2026-09-12" });
    expect(hiddenSlotSet(dir)).toEqual(new Set(["mapa.fig-capas", "barra.busqueda"]));
  });

  it("drops a slot from the set the moment it is shown again", () => {
    const dir = tmp();
    hideSlot(dir, "mapa.fig-capas", { hiddenAt: "2026-09-11" });
    showSlot(dir, "mapa.fig-capas");
    expect(hiddenSlotSet(dir)).toEqual(new Set());
  });
});
