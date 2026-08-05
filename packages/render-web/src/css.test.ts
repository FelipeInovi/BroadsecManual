import { describe, expect, it } from "vitest";
import { themes, tokens } from "@broadsec-manual/tokens";
import { stylesheet } from "./css.ts";
import { bridgeStylesheet } from "./css-bridge.ts";

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

  // Bridge has its OWN stylesheet. These assert the separation itself, because
  // the first attempt shared one configurable sheet and that is exactly how a
  // delivered document becomes something another brand's change can break.
  it("keeps Broadsec's sheet free of anything Bridge introduced", () => {
    const css = stylesheet(themes.broadsec, "BROADSEC");
    expect(css).not.toContain("Outfit");
    expect(css).not.toContain("cover__lockup");
    expect(css).not.toContain("section-header__kicker");
  });

  it("renders Broadsec identically whichever brand exists beside it", () => {
    // The Broadsec sheet takes tokens, so this is the guarantee that matters:
    // its output depends on ITS tokens and nothing else.
    expect(stylesheet(themes.broadsec, "X")).toBe(stylesheet(themes.broadsec, "X"));
  });

  it("gives Bridge its display face, its deck rule and its cover ornament", () => {
    const css = bridgeStylesheet(themes.bridge, "BRIDGE");
    expect(css).toContain("Outfit");
    expect(css).toContain("#14B8A6");
    expect(css).toContain("cover__lockup");
    expect(css).toContain("section-header__kicker");
  });

  it("escapes the header in Bridge's sheet too, not only in Broadsec's", () => {
    const css = bridgeStylesheet(themes.bridge, 'BRIDGE </style><script>alert(1)</script>');
    expect(css).not.toMatch(/<\/style/i);
  });
});
