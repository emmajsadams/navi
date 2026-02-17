import { describe, expect, it } from "bun:test";
import { createConversation, parseInput } from "./repl.ts";

describe("parseInput", () => {
  it("parses /quit", () => {
    expect(parseInput("/quit")).toEqual({ type: "quit" });
    expect(parseInput("/exit")).toEqual({ type: "quit" });
  });

  it("parses /clear", () => {
    expect(parseInput("/clear")).toEqual({ type: "clear" });
  });

  it("parses /usage", () => {
    expect(parseInput("/usage")).toEqual({ type: "usage" });
  });

  it("parses regular messages", () => {
    expect(parseInput("hello world")).toEqual({
      type: "message",
      text: "hello world",
    });
  });

  it("trims whitespace", () => {
    expect(parseInput("  /quit  ")).toEqual({ type: "quit" });
    expect(parseInput("  hello  ")).toEqual({
      type: "message",
      text: "hello",
    });
  });
});

describe("createConversation", () => {
  it("creates empty state", () => {
    const state = createConversation(undefined);
    expect(state.messages).toEqual([]);
    expect(state.turns).toBe(0);
    expect(state.totalInputTokens).toBe(0);
    expect(state.totalOutputTokens).toBe(0);
    expect(state.systemPrompt).toBeUndefined();
  });

  it("stores system prompt", () => {
    const state = createConversation("You are helpful.");
    expect(state.systemPrompt).toBe("You are helpful.");
  });
});
