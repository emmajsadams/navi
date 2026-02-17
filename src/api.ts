import type { Config } from "./config.ts";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "usage"; usage: Usage }
  | { type: "error"; error: string };

type ApiStreamEvent = {
  type: string;
  delta?: { type?: string; text?: string; stop_reason?: string };
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
  error?: { message?: string };
};

export async function* streamMessage(
  config: Config,
  messages: Message[],
  systemPrompt?: string,
): AsyncGenerator<StreamEvent> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages,
    stream: true,
  };
  if (systemPrompt) {
    body["system"] = systemPrompt;
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
    yield {
      type: "error",
      error: `API error ${response.status}: ${text}`,
    };
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

      if (event.type === "message_start" && event.message?.usage) {
        inputTokens = event.message.usage.input_tokens ?? 0;
      }

      if (event.type === "message_delta" && event.usage) {
        outputTokens = event.usage.output_tokens ?? 0;
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
