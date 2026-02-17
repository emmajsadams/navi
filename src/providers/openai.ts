/**
 * OpenAI Chat Completions API provider.
 * Streams responses via SSE.
 * Also works with OpenAI-compatible APIs (OpenRouter, Together, local models).
 */

import type {
  Provider,
  ProviderConfig,
  ProviderMessage,
  ProviderStreamEvent,
  ProviderTool,
} from "./types.ts";

// --- Message format conversion ---

type OpenAIMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content?: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
};

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ProviderTool["input_schema"];
  };
};

function toOpenAIMessages(messages: ProviderMessage[], systemPrompt?: string): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    // Handle content block arrays
    if (msg.role === "assistant") {
      const textParts: string[] = [];
      const toolCalls: OpenAIToolCall[] = [];

      for (const block of msg.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      const oaiMsg: OpenAIMessage = {
        role: "assistant",
        content: textParts.length > 0 ? textParts.join("") : null,
      };
      if (toolCalls.length > 0) {
        oaiMsg.tool_calls = toolCalls;
      }
      result.push(oaiMsg);
    } else {
      // User messages with tool_result blocks
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          result.push({
            role: "tool",
            content: block.content,
            tool_call_id: block.tool_use_id,
          });
        } else if (block.type === "text") {
          result.push({ role: "user", content: block.text });
        }
      }
    }
  }

  return result;
}

function toOpenAITools(tools: ProviderTool[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

// --- Stream parsing ---

type OpenAIStreamDelta = {
  id?: string;
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

async function* send(
  config: ProviderConfig,
  messages: ProviderMessage[],
  systemPrompt?: string,
  tools?: ProviderTool[],
): AsyncGenerator<ProviderStreamEvent> {
  const oaiMessages = toOpenAIMessages(messages, systemPrompt);

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: config.maxTokens,
    messages: oaiMessages,
    stream: true,
    stream_options: { include_usage: true },
  };

  if (tools && tools.length > 0) {
    body["tools"] = toOpenAITools(tools);
  }

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
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
  const toolCallBuilders = new Map<number, { id: string; name: string; argChunks: string[] }>();

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

      let chunk: OpenAIStreamDelta;
      try {
        chunk = JSON.parse(data) as OpenAIStreamDelta;
      } catch {
        continue;
      }

      const choice = chunk.choices?.[0];

      if (choice?.delta?.content) {
        yield { type: "text", text: choice.delta.content };
      }

      // Tool call streaming
      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.id) {
            // New tool call
            toolCallBuilders.set(tc.index, {
              id: tc.id,
              name: tc.function?.name ?? "",
              argChunks: [],
            });
          }
          const builder = toolCallBuilders.get(tc.index);
          if (builder && tc.function?.arguments) {
            builder.argChunks.push(tc.function.arguments);
          }
        }
      }

      // Finish reason
      if (choice?.finish_reason) {
        if (choice.finish_reason === "tool_calls") {
          // Emit accumulated tool calls
          for (const [idx, builder] of toolCallBuilders) {
            let input: Record<string, unknown> = {};
            const json = builder.argChunks.join("");
            if (json) {
              try {
                input = JSON.parse(json) as Record<string, unknown>;
              } catch {
                // malformed
              }
            }
            yield {
              type: "tool_use",
              id: builder.id,
              name: builder.name,
              input,
            };
            toolCallBuilders.delete(idx);
          }
          yield { type: "stop", stopReason: "tool_use" };
        } else {
          yield {
            type: "stop",
            stopReason: choice.finish_reason === "stop" ? "end_turn" : choice.finish_reason,
          };
        }
      }

      // Usage (comes in the final chunk with stream_options)
      if (chunk.usage) {
        yield {
          type: "usage",
          usage: {
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          },
        };
      }
    }
  }
}

export const openaiProvider: Provider = {
  name: "openai",
  send,
};
