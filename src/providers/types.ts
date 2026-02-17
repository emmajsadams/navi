/**
 * Provider-agnostic types for LLM communication.
 * All providers must normalize their responses to these types.
 */

export type ProviderMessage = {
  role: "user" | "assistant";
  content: ProviderMessageContent;
};

export type ProviderMessageContent = string | ProviderContentBlock[];

export type ProviderContentBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export type ProviderToolSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type ProviderTool = {
  name: string;
  description: string;
  input_schema: ProviderToolSchema;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ProviderStreamEvent =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "usage"; usage: ProviderUsage }
  | { type: "error"; error: string }
  | { type: "stop"; stopReason: string };

export type ProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
};

export type Provider = {
  name: string;
  send: (
    config: ProviderConfig,
    messages: ProviderMessage[],
    systemPrompt?: string,
    tools?: ProviderTool[],
  ) => AsyncGenerator<ProviderStreamEvent>;
};
