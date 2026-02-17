import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ProviderStreamEvent } from "./types.ts";
import { anthropicProvider } from "./anthropic.ts";
import type { Config } from "../config.ts";

const testConfig: Config = {
  apiKey: "test-key",
  model: "test-model",
  baseUrl: "https://api.test.com",
  maxTokens: 1024,
  provider: "anthropic",
};

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = events.map((e) => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

describe("anthropic provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("streams text deltas", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          sseStream([
            JSON.stringify({
              type: "message_start",
              message: { usage: { input_tokens: 10 } },
            }),
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hello" },
            }),
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: " world" },
            }),
            JSON.stringify({
              type: "message_delta",
              usage: { output_tokens: 5 },
            }),
          ]),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    const events: ProviderStreamEvent[] = [];
    for await (const event of anthropicProvider.send(testConfig, [
      { role: "user", content: "hi" },
    ])) {
      events.push(event);
    }

    expect(events).toContainEqual({ type: "text", text: "Hello" });
    expect(events).toContainEqual({ type: "text", text: " world" });
    expect(events).toContainEqual({
      type: "usage",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it("handles API errors", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('{"error":"bad key"}', { status: 401 }),
      )) as unknown as typeof fetch;

    const events: ProviderStreamEvent[] = [];
    for await (const event of anthropicProvider.send(testConfig, [
      { role: "user", content: "hi" },
    ])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
  });

  it("streams tool_use blocks", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          sseStream([
            JSON.stringify({
              type: "message_start",
              message: { usage: { input_tokens: 5 } },
            }),
            JSON.stringify({
              type: "content_block_start",
              index: 0,
              content_block: {
                type: "tool_use",
                id: "tool_1",
                name: "read_file",
              },
            }),
            JSON.stringify({
              type: "content_block_delta",
              index: 0,
              delta: {
                type: "input_json_delta",
                partial_json: '{"path":',
              },
            }),
            JSON.stringify({
              type: "content_block_delta",
              index: 0,
              delta: {
                type: "input_json_delta",
                partial_json: '"/tmp/test"}',
              },
            }),
            JSON.stringify({
              type: "content_block_stop",
              index: 0,
            }),
            JSON.stringify({
              type: "message_delta",
              delta: { stop_reason: "tool_use" },
              usage: { output_tokens: 10 },
            }),
          ]),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    const events: ProviderStreamEvent[] = [];
    for await (const event of anthropicProvider.send(testConfig, [
      { role: "user", content: "read file" },
    ])) {
      events.push(event);
    }

    expect(events).toContainEqual({
      type: "tool_use",
      id: "tool_1",
      name: "read_file",
      input: { path: "/tmp/test" },
    });
    expect(events).toContainEqual({
      type: "stop",
      stopReason: "tool_use",
    });
  });
});
