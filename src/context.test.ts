import { describe, expect, it } from "bun:test";
import type { Message } from "./api.ts";
import {
  estimateTokens,
  estimateSystemTokens,
  totalMessageTokens,
  truncateMessages,
  manageContext,
  getContextLimit,
  type ContextConfig,
} from "./context.ts";

function msg(role: "user" | "assistant", content: string): Message {
  return { role, content };
}

describe("estimateTokens", () => {
  it("estimates string content", () => {
    // "hello" = 5 chars, ~2 tokens at 4 chars/token
    const tokens = estimateTokens(msg("user", "hello"));
    expect(tokens).toBe(2);
  });

  it("estimates longer content", () => {
    const text = "a".repeat(400);
    expect(estimateTokens(msg("user", text))).toBe(100);
  });

  it("estimates content block arrays", () => {
    const message: Message = {
      role: "assistant",
      content: [{ type: "text", text: "a".repeat(100) }],
    };
    expect(estimateTokens(message)).toBe(25);
  });

  it("estimates tool_use blocks", () => {
    const message: Message = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "123",
          name: "read_file",
          input: { path: "/tmp/test.txt" },
        },
      ],
    };
    const tokens = estimateTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });

  it("estimates tool_result blocks", () => {
    const message: Message = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "123",
          content: "file contents here",
        },
      ],
    };
    const tokens = estimateTokens(message);
    expect(tokens).toBeGreaterThan(0);
  });
});

describe("estimateSystemTokens", () => {
  it("handles undefined system prompt", () => {
    expect(estimateSystemTokens(undefined, undefined)).toBe(0);
  });

  it("estimates system prompt", () => {
    expect(estimateSystemTokens("You are helpful.", undefined)).toBe(4);
  });

  it("includes tool schemas", () => {
    const tools = [
      {
        name: "test",
        description: "A test tool",
        input_schema: {
          type: "object" as const,
          properties: {
            x: { type: "string", description: "input" },
          },
          required: ["x"],
        },
      },
    ];
    const tokens = estimateSystemTokens("system", tools);
    expect(tokens).toBeGreaterThan(4); // more than just system prompt
  });
});

describe("totalMessageTokens", () => {
  it("sums all messages", () => {
    const messages = [
      msg("user", "a".repeat(40)), // 10 tokens
      msg("assistant", "b".repeat(80)), // 20 tokens
    ];
    expect(totalMessageTokens(messages)).toBe(30);
  });

  it("handles empty array", () => {
    expect(totalMessageTokens([])).toBe(0);
  });
});

describe("truncateMessages", () => {
  it("returns all messages when under budget", () => {
    const messages = [msg("user", "hi"), msg("assistant", "hello")];
    const result = truncateMessages(messages, 1000);
    expect(result.messages).toHaveLength(2);
    expect(result.dropped).toBe(0);
  });

  it("keeps first and latest messages", () => {
    const messages = [
      msg("user", "a".repeat(100)), // 25 tokens
      msg("assistant", "b".repeat(100)), // 25 tokens
      msg("user", "c".repeat(100)), // 25 tokens
      msg("assistant", "d".repeat(100)), // 25 tokens
    ];
    // Budget for first + last two = 75 tokens
    const result = truncateMessages(messages, 75);
    expect(result.messages).toHaveLength(3);
    expect(result.dropped).toBe(1);
    // Should keep first and last two
    expect(result.messages[0]).toBe(messages[0]);
    expect(result.messages[2]).toBe(messages[3]);
  });

  it("handles empty messages", () => {
    const result = truncateMessages([], 100);
    expect(result.messages).toHaveLength(0);
    expect(result.dropped).toBe(0);
  });
});

describe("manageContext", () => {
  const config: ContextConfig = {
    maxContextTokens: 100,
    strategy: "truncate",
    reservedTokens: 10,
  };

  it("passes through when under limit", () => {
    const messages = [msg("user", "hi")];
    const result = manageContext(messages, config, undefined, undefined);
    expect(result.dropped).toBe(0);
  });

  it("truncates when over limit", () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", "x".repeat(100)),
    );
    const result = manageContext(messages, config, undefined, undefined);
    expect(result.dropped).toBeGreaterThan(0);
  });

  it("throws on error strategy", () => {
    const errorConfig: ContextConfig = {
      maxContextTokens: 10,
      strategy: "error",
      reservedTokens: 0,
    };
    const messages = [msg("user", "a".repeat(1000))];
    expect(() => manageContext(messages, errorConfig, undefined, undefined)).toThrow(
      "Context limit exceeded",
    );
  });

  it("accounts for system prompt in budget", () => {
    const tightConfig: ContextConfig = {
      maxContextTokens: 50,
      strategy: "error",
      reservedTokens: 0,
    };
    // Without system prompt: 40 chars = 10 tokens, fits in 50
    const messages = [msg("user", "a".repeat(40))];
    expect(() => manageContext(messages, tightConfig, undefined, undefined)).not.toThrow();

    // With large system prompt eating budget: should fail
    expect(() => manageContext(messages, tightConfig, "x".repeat(200), undefined)).toThrow();
  });
});

describe("getContextLimit", () => {
  it("returns known model limits", () => {
    expect(getContextLimit("claude-sonnet-4-20250514")).toBe(200_000);
  });

  it("returns default for unknown models", () => {
    expect(getContextLimit("unknown-model")).toBe(200_000);
  });
});
