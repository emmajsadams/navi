import { describe, expect, it } from "bun:test";
import { color, styled, getTerminalSize } from "./ansi.ts";

describe("styled", () => {
  it("wraps text with ANSI codes", () => {
    const result = styled("hello", color.red);
    expect(result).toBe(`\x1b[31mhello\x1b[0m`);
  });

  it("applies multiple styles", () => {
    const result = styled("hello", color.bold, color.cyan);
    expect(result).toBe(`\x1b[1m\x1b[36mhello\x1b[0m`);
  });

  it("returns plain text with no styles", () => {
    expect(styled("hello")).toBe("hello");
  });
});

describe("getTerminalSize", () => {
  it("returns rows and cols", () => {
    const size = getTerminalSize();
    expect(size.rows).toBeGreaterThan(0);
    expect(size.cols).toBeGreaterThan(0);
  });
});
