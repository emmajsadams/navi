import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { type StreamEvent, streamMessage } from "./api.ts";
import type { Config } from "./config.ts";

const testConfig: Config = {
  apiKey: "test-key",
  model: "test-model",
  baseUrl: "https://api.test.com",
  maxTokens: 1024,
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

describe("streamMessage", () => {
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

    const events: StreamEvent[] = [];
    for await (const event of streamMessage(testConfig, [{ role: "user", content: "hi" }])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text", text: "Hello" },
      { type: "text", text: " world" },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 5 } },
    ]);
  });

  it("handles API errors", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response('{"error":"bad key"}', { status: 401 }),
      )) as unknown as typeof fetch;

    const events: StreamEvent[] = [];
    for await (const event of streamMessage(testConfig, [{ role: "user", content: "hi" }])) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
  });

  it("sends correct request shape", async () => {
    let capturedBody: string | undefined;

    globalThis.fetch = ((_url: unknown, init: unknown) => {
      const opts = init as RequestInit;
      capturedBody = typeof opts.body === "string" ? opts.body : undefined;
      return Promise.resolve(new Response(sseStream([]), { status: 200 }));
    }) as typeof fetch;

    const messages = [{ role: "user" as const, content: "test" }];
    for await (const _event of streamMessage(testConfig, messages)) {
      // exhaust generator
    }

    const body = JSON.parse(capturedBody ?? "{}") as Record<string, unknown>;
    expect(body["model"]).toBe("test-model");
    expect(body["max_tokens"]).toBe(1024);
    expect(body["messages"]).toEqual(messages);
    expect(body["stream"]).toBe(true);
  });

  it("streams tool_use blocks", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          sseStream([
            JSON.stringify({
              type: "message_start",
              message: { usage: { input_tokens: 10 } },
            }),
            JSON.stringify({
              type: "content_block_start",
              index: 0,
              content_block: { type: "tool_use", id: "toolu_123", name: "read_file" },
            }),
            JSON.stringify({
              type: "content_block_delta",
              index: 0,
              delta: { type: "input_json_delta", partial_json: '{"path":' },
            }),
            JSON.stringify({
              type: "content_block_delta",
              index: 0,
              delta: { type: "input_json_delta", partial_json: '"/tmp/x"}' },
            }),
            JSON.stringify({
              type: "content_block_stop",
              index: 0,
            }),
            JSON.stringify({
              type: "message_delta",
              delta: { stop_reason: "tool_use" },
              usage: { output_tokens: 8 },
            }),
          ]),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    const events: StreamEvent[] = [];
    for await (const event of streamMessage(testConfig, [{ role: "user", content: "hi" }])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "tool_use", id: "toolu_123", name: "read_file", input: { path: "/tmp/x" } },
      { type: "stop", stopReason: "tool_use" },
      { type: "usage", usage: { inputTokens: 10, outputTokens: 8 } },
    ]);
  });

  it("passes tools in request body", async () => {
    let capturedBody: string | undefined;

    globalThis.fetch = ((_url: unknown, init: unknown) => {
      const opts = init as RequestInit;
      capturedBody = typeof opts.body === "string" ? opts.body : undefined;
      return Promise.resolve(new Response(sseStream([]), { status: 200 }));
    }) as typeof fetch;

    const tools = [
      {
        name: "test_tool",
        description: "A test",
        input_schema: { type: "object" as const, properties: {}, required: [] },
      },
    ];
    for await (const _event of streamMessage(
      testConfig,
      [{ role: "user", content: "hi" }],
      undefined,
      tools,
    )) {
      // exhaust
    }

    const body = JSON.parse(capturedBody ?? "{}") as Record<string, unknown>;
    expect(body["tools"]).toEqual(tools);
  });

  it("emits stop event from message_delta", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          sseStream([
            JSON.stringify({
              type: "message_start",
              message: { usage: { input_tokens: 5 } },
            }),
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hi" },
            }),
            JSON.stringify({
              type: "message_delta",
              delta: { stop_reason: "end_turn" },
              usage: { output_tokens: 2 },
            }),
          ]),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    const events: StreamEvent[] = [];
    for await (const event of streamMessage(testConfig, [{ role: "user", content: "hi" }])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text", text: "Hi" },
      { type: "stop", stopReason: "end_turn" },
      { type: "usage", usage: { inputTokens: 5, outputTokens: 2 } },
    ]);
  });
});
