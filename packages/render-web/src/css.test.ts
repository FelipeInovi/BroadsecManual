import { describe, expect, it } from "vitest";
import { tokens } from "@broadsec-manual/tokens";
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
});
