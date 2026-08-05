import { describe, expect, it } from "vitest";
import { themes, tokens } from "@broadsec-manual/tokens";
import { stylesheet } from "./css.ts";

describe("stylesheet", () => {
  it("escapes a double quote in the header so the CSS string is not broken", () => {
    const css = stylesheet(tokens, 'BROADSEC | Manual "especial" | v1.0');
    expect(css).toContain('content: "BROADSEC | Manual \\"especial\\" | v1.0";');
  });

  it("escapes a backslash in the header", () => {
    const css = stylesheet(tokens, "BROADSEC \\ v1.0");
    expect(css).toContain('content: "BROADSEC \\\\ v1.0";');
  });

  it("neutralises a literal </style> sequence so it cannot close the surrounding <style> element early", () => {
    const css = stylesheet(tokens, "BROADSEC </style><script>alert(1)</script>");
    expect(css).not.toMatch(/<\/style/i);
  });

  // The two palettes are close enough that colour alone would not tell the
  // manuals apart — Broadsec already uses Bridge360's teals. What separates
  // them is structural, so it has to actually reach the stylesheet.
  it("gives Bridge a display face distinct from its body face", () => {
    const css = stylesheet(themes.bridge, "BRIDGE");
    expect(css).toContain("Outfit");
  });

  it("keeps Broadsec on one neutral face, which is what makes it read operational", () => {
    const css = stylesheet(themes.broadsec, "BROADSEC");
    expect(css).not.toContain("Outfit");
  });

  it("draws Bridge's deck rule under the running header", () => {
    expect(stylesheet(themes.bridge, "BRIDGE")).toContain("#14B8A6");
  });

  it("leaves the deck rule invisible on a brand that has none", () => {
    const css = stylesheet(themes.broadsec, "BROADSEC");
    expect(css).toContain("border-bottom: 1.5pt solid transparent");
  });
});
