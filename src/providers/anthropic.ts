/**
 * Anthropic Messages API provider.
 * Streams responses via SSE.
 */

import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderStreamEvent,
  ProviderTool,
} from "./types.ts";

type ApiStreamEvent = {
  type: string;
  index?: number;
  content_block?: { type?: string; id?: string; name?: string };
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
    stop_reason?: string;
  };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
  error?: { message?: string };
};

async function* send(
  config: ProviderConfig,
  messages: ProviderMessage[],
  systemPrompt?: string,
  tools?: ProviderTool[],
): AsyncGenerator<ProviderStreamEvent> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages,
    stream: true,
  };
  if (systemPrompt) {
    body["system"] = systemPrompt;
  }
  if (tools && tools.length > 0) {
    body["tools"] = tools;
  }

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    yield { type: "error", error: `API error ${response.status}: ${text}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolBlocks = new Map<number, { id: string; name: string; jsonChunks: string[] }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      let event: ApiStreamEvent;
      try {
        event = JSON.parse(data) as ApiStreamEvent;
      } catch {
        continue;
      }

      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "text_delta" &&
        event.delta.text
      ) {
        yield { type: "text", text: event.delta.text };
      }

      if (
        event.type === "content_block_start" &&
        event.content_block?.type === "tool_use" &&
        event.index !== undefined
      ) {
        toolBlocks.set(event.index, {
          id: event.content_block.id ?? "",
          name: event.content_block.name ?? "",
          jsonChunks: [],
        });
      }

      if (
        event.type === "content_block_delta" &&
        event.delta?.type === "input_json_delta" &&
        event.index !== undefined
      ) {
        const block = toolBlocks.get(event.index);
        if (block && event.delta.partial_json) {
          block.jsonChunks.push(event.delta.partial_json);
        }
      }

      if (event.type === "content_block_stop" && event.index !== undefined) {
        const block = toolBlocks.get(event.index);
        if (block) {
          let input: Record<string, unknown> = {};
          const json = block.jsonChunks.join("");
          if (json) {
            try {
              input = JSON.parse(json) as Record<string, unknown>;
            } catch {
              // malformed JSON
            }
          }
          yield {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input,
          };
          toolBlocks.delete(event.index);
        }
      }

      if (event.type === "message_start" && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens ?? 0;
      }

      if (event.type === "message_delta") {
        if (event.usage) {
          outputTokens = event.usage.output_tokens ?? 0;
        }
        if (event.delta?.stop_reason) {
          yield {
            type: "stop",
            stopReason: event.delta.stop_reason,
          };
        }
      }

      if (event.type === "error") {
        yield {
          type: "error",
          error: event.error?.message ?? "Unknown stream error",
        };
        return;
      }
    }
  }

  yield { type: "usage", usage: { inputTokens, outputTokens } };
}

export const anthropicProvider: Provider = {
  name: "anthropic",
  send,
};
