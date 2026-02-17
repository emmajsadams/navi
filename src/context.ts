import type { ContentBlock, Message } from "./api.ts";
import type { ApiTool } from "./tools.ts";

export type ContextStrategy = "truncate" | "error";

export type ContextConfig = {
  maxContextTokens: number;
  strategy: ContextStrategy;
  reservedTokens: number; // budget reserved for system prompt + tool schemas
};

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "claude-sonnet-4-20250514": 200_000,
  "claude-opus-4-20250514": 200_000,
  "claude-haiku-35-20241022": 200_000,
};

export const DEFAULT_CONTEXT_LIMIT = 200_000;

export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? DEFAULT_CONTEXT_LIMIT;
}

/**
 * Estimate token count for a message.
 * Uses a rough heuristic: ~4 chars per token for English text.
 * Not perfect, but good enough for budget tracking without a tokenizer dependency.
 */
export function estimateTokens(message: Message): number {
  if (typeof message.content === "string") {
    return Math.ceil(message.content.length / 4);
  }

  let total = 0;
  for (const block of message.content) {
    total += estimateBlockTokens(block);
  }
  return total;
}

function estimateBlockTokens(block: ContentBlock): number {
  switch (block.type) {
    case "text":
      return Math.ceil(block.text.length / 4);
    case "tool_use":
      return (
        Math.ceil(block.name.length / 4) + Math.ceil(JSON.stringify(block.input).length / 4) + 10 // overhead for id, structure
      );
    case "tool_result":
      return Math.ceil(block.content.length / 4) + 10;
    default:
      return 0;
  }
}

export function estimateSystemTokens(
  systemPrompt: string | undefined,
  tools: ApiTool[] | undefined,
): number {
  let total = 0;
  if (systemPrompt) {
    total += Math.ceil(systemPrompt.length / 4);
  }
  if (tools && tools.length > 0) {
    total += Math.ceil(JSON.stringify(tools).length / 4);
  }
  return total;
}

export function totalMessageTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg);
  }
  return total;
}

export type TruncationResult = {
  messages: Message[];
  dropped: number;
};

/**
 * Truncate messages to fit within a token budget.
 * Keeps the first message (usually the initial user prompt) and drops
 * the oldest messages in between until the total fits.
 */
export function truncateMessages(messages: Message[], maxTokens: number): TruncationResult {
  if (messages.length === 0) {
    return { messages: [], dropped: 0 };
  }

  const total = totalMessageTokens(messages);
  if (total <= maxTokens) {
    return { messages: [...messages], dropped: 0 };
  }

  // Always keep the first message (initial user prompt provides context)
  const first = messages[0]!;
  const firstTokens = estimateTokens(first);

  if (firstTokens > maxTokens) {
    // Even the first message doesn't fit — just return it and let the API error
    return { messages: [first], dropped: messages.length - 1 };
  }

  // Build from the end, adding messages until we run out of budget
  let budget = maxTokens - firstTokens;
  const kept: Message[] = [];

  for (let i = messages.length - 1; i >= 1; i--) {
    const msg = messages[i]!;
    const tokens = estimateTokens(msg);
    if (tokens <= budget) {
      kept.unshift(msg);
      budget -= tokens;
    } else {
      break; // Stop at first message that doesn't fit (preserve contiguity)
    }
  }

  const result = [first, ...kept];
  return {
    messages: result,
    dropped: messages.length - result.length,
  };
}

/**
 * Apply context management strategy to messages before sending.
 */
export function manageContext(
  messages: Message[],
  config: ContextConfig,
  systemPrompt: string | undefined,
  tools: ApiTool[] | undefined,
): TruncationResult {
  const reservedTokens = estimateSystemTokens(systemPrompt, tools);
  const availableTokens = config.maxContextTokens - reservedTokens - config.reservedTokens;

  if (availableTokens <= 0) {
    throw new Error(
      "System prompt and tools consume the entire context window. Reduce system prompt size or tool count.",
    );
  }

  const total = totalMessageTokens(messages);

  if (total <= availableTokens) {
    return { messages: [...messages], dropped: 0 };
  }

  switch (config.strategy) {
    case "truncate":
      return truncateMessages(messages, availableTokens);
    case "error":
      throw new Error(
        `Context limit exceeded: ${total} estimated tokens, ${availableTokens} available. Use /clear or switch to truncate strategy.`,
      );
    default:
      return truncateMessages(messages, availableTokens);
  }
}
