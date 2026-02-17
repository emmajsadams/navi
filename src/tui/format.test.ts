import { describe, expect, it } from "bun:test";
import { formatMarkdown, formatInline, formatStatusBar, stripAnsi, truncate } from "./format.ts";

describe("stripAnsi", () => {
  it("strips ANSI escape codes", () => {
    expect(stripAnsi("\x1b[31mhello\x1b[0m")).toBe("hello");
  });

  it("leaves plain text unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });
});

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("truncates long text with ellipsis", () => {
    expect(truncate("hello world", 5)).toBe("hell…");
  });
});

describe("formatInline", () => {
  it("formats inline code", () => {
    const result = formatInline("use `foo` here");
    expect(stripAnsi(result)).toBe("use foo here");
    expect(result).toContain("\x1b["); // has ANSI codes
  });

  it("formats bold", () => {
    const result = formatInline("this is **bold** text");
    expect(stripAnsi(result)).toBe("this is bold text");
  });

  it("formats italic", () => {
    const result = formatInline("this is *italic* text");
    expect(stripAnsi(result)).toBe("this is italic text");
  });

  it("handles plain text", () => {
    const result = formatInline("no formatting here");
    expect(result).toBe("no formatting here");
  });
});

describe("formatMarkdown", () => {
  it("formats headers", () => {
    const result = formatMarkdown("# Title\n## Subtitle");
    expect(stripAnsi(result)).toBe("Title\nSubtitle");
    expect(result).toContain("\x1b[");
  });

  it("formats code blocks", () => {
    const result = formatMarkdown("```ts\nconst x = 1;\n```");
    const stripped = stripAnsi(result);
    expect(stripped).toContain("ts");
    expect(stripped).toContain("const x = 1;");
  });

  it("formats bullet lists", () => {
    const result = formatMarkdown("- item one\n- item two");
    const stripped = stripAnsi(result);
    expect(stripped).toContain("•");
    expect(stripped).toContain("item one");
    expect(stripped).toContain("item two");
  });

  it("formats numbered lists", () => {
    const result = formatMarkdown("1. first\n2. second");
    const stripped = stripAnsi(result);
    expect(stripped).toContain("1.");
    expect(stripped).toContain("first");
  });

  it("formats horizontal rules", () => {
    const result = formatMarkdown("---");
    const stripped = stripAnsi(result);
    expect(stripped).toContain("─");
  });

  it("passes plain text through", () => {
    const result = formatMarkdown("just text");
    expect(result).toBe("just text");
  });
});

describe("formatStatusBar", () => {
  it("creates padded status bar", () => {
    const result = formatStatusBar("left", "right", 20);
    const stripped = stripAnsi(result);
    expect(stripped).toContain("left");
    expect(stripped).toContain("right");
    expect(stripped.length).toBe(20);
  });
});
