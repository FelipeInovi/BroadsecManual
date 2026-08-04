import { describe, expect, it } from "vitest";
import { reconcileTenants } from "./reconcile.ts";

describe("reconcileTenants", () => {
  it("says nothing when the manual declares exactly what the product has", () => {
    expect(reconcileTenants(["mv", "med"], ["mv", "med"])).toEqual([]);
  });

  // The case that made this necessary: the product ships `dev.config.ts`, so the
  // extraction finds seven deployments where the manual declares six. Left
  // unreported, `dev` quietly joins every `enabledFor` list and the map reads as
  // though a development config were a client.
  it("reports a product deployment the manual never declared", () => {
    const out = reconcileTenants(["mv", "med", "dev"], ["mv", "med"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/dev/);
    expect(out[0]).toMatch(/not declared/i);
  });

  it("reports a manual deployment with no config behind it — the worse direction", () => {
    const out = reconcileTenants(["mv"], ["mv", "ghost"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/ghost/);
    expect(out[0]).toMatch(/no config/i);
  });

  it("reports both directions at once", () => {
    expect(reconcileTenants(["mv", "dev"], ["mv", "ghost"])).toHaveLength(2);
  });

  it("is order-insensitive", () => {
    expect(reconcileTenants(["med", "mv"], ["mv", "med"])).toEqual([]);
  });
});
