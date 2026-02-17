import type { Config } from "./config.ts";
import { type ContextConfig, manageContext } from "./context.ts";
import type { Provider, ProviderContentBlock, ProviderMessage } from "./providers/types.ts";
import type { ToolRegistry } from "./tools.ts";

export type Command =
  | { type: "quit" }
  | { type: "clear" }
  | { type: "usage" }
  | { type: "save" }
  | { type: "load"; id: string }
  | { type: "sessions" }
  | { type: "message"; text: string };

export function parseInput(input: string): Command {
  const trimmed = input.trim();
  if (trimmed === "/quit" || trimmed === "/exit") return { type: "quit" };
  if (trimmed === "/clear") return { type: "clear" };
  if (trimmed === "/usage") return { type: "usage" };
  if (trimmed === "/save") return { type: "save" };
  if (trimmed === "/sessions") return { type: "sessions" };
  if (trimmed.startsWith("/load ")) {
    return { type: "load", id: trimmed.slice(6).trim() };
  }
  return { type: "message", text: trimmed };
}

export type ConversationState = {
  messages: ProviderMessage[];
  systemPrompt: string | undefined;
  totalInputTokens: number;
  totalOutputTokens: number;
  turns: number;
};

export function createConversation(systemPrompt: string | undefined): ConversationState {
  return {
    messages: [],
    systemPrompt,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    turns: 0,
  };
}

export type SendOptions = {
  config: Config;
  provider: Provider;
  state: ConversationState;
  userText: string;
  toolRegistry: ToolRegistry | undefined;
  contextConfig: ContextConfig | undefined;
  onText: (text: string) => void;
  onToolCall: (name: string, input: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string, isError: boolean) => void;
  onContextTruncation?: (dropped: number) => void;
  confirmTool?: (name: string, input: Record<string, unknown>) => Promise<boolean>;
};

export async function sendMessage(opts: SendOptions): Promise<void> {
  const {
    config,
    provider,
    state,
    userText,
    toolRegistry,
    contextConfig,
    onText,
    onToolCall,
    onToolResult,
    onContextTruncation,
    confirmTool,
  } = opts;

  state.messages.push({ role: "user", content: userText });
  await runAgentLoop(
    config,
    provider,
    state,
    toolRegistry,
    contextConfig,
    onText,
    onToolCall,
    onToolResult,
    onContextTruncation,
    confirmTool,
  );
  state.turns++;
}

const DANGEROUS_TOOLS = new Set(["exec", "write_file"]);

async function runAgentLoop(
  config: Config,
  provider: Provider,
  state: ConversationState,
  toolRegistry: ToolRegistry | undefined,
  contextConfig: ContextConfig | undefined,
  onText: (text: string) => void,
  onToolCall: (name: string, input: Record<string, unknown>) => void,
  onToolResult: (name: string, result: string, isError: boolean) => void,
  onContextTruncation?: (dropped: number) => void,
  confirmTool?: (name: string, input: Record<string, unknown>) => Promise<boolean>,
): Promise<void> {
  const tools = toolRegistry?.apiFormat();
  let maxIterations = 20;

  while (maxIterations-- > 0) {
    // Apply context management before each API call
    let messagesToSend = state.messages;
    if (contextConfig) {
      const result = manageContext(state.messages, contextConfig, state.systemPrompt, tools);
      if (result.dropped > 0) {
        onContextTruncation?.(result.dropped);
        state.messages = result.messages;
        messagesToSend = result.messages;
      }
    }

    const contentBlocks: ProviderContentBlock[] = [];
    const textChunks: string[] = [];
    let stopReason = "end_turn";

    for await (const event of provider.send(config, messagesToSend, state.systemPrompt, tools)) {
      switch (event.type) {
        case "text":
          textChunks.push(event.text);
          onText(event.text);
          break;
        case "tool_use":
          contentBlocks.push({
            type: "tool_use",
            id: event.id,
            name: event.name,
            input: event.input,
          });
          break;
        case "usage":
          state.totalInputTokens += event.usage.inputTokens;
          state.totalOutputTokens += event.usage.outputTokens;
          break;
        case "stop":
          stopReason = event.stopReason;
          break;
        case "error":
          throw new Error(event.error);
      }
    }

    // Build assistant message
    const assistantContent: ProviderContentBlock[] = [];
    if (textChunks.length > 0) {
      assistantContent.push({
        type: "text",
        text: textChunks.join(""),
      });
    }
    assistantContent.push(...contentBlocks);

    if (assistantContent.length > 0) {
      state.messages.push({
        role: "assistant",
        content: assistantContent,
      });
    }

    // If no tool calls, we're done
    if (contentBlocks.length === 0 || stopReason !== "tool_use") {
      return;
    }

    // Execute tools
    const toolResults: ProviderContentBlock[] = [];

    for (const block of contentBlocks) {
      if (block.type !== "tool_use") continue;

      onToolCall(block.name, block.input);

      const tool = toolRegistry?.get(block.name);
      if (!tool) {
        const errMsg = `Unknown tool: ${block.name}`;
        onToolResult(block.name, errMsg, true);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: errMsg,
          is_error: true,
        });
        continue;
      }

      // Confirm dangerous tools
      if (confirmTool && DANGEROUS_TOOLS.has(block.name)) {
        const confirmed = await confirmTool(block.name, block.input);
        if (!confirmed) {
          const denyMsg = "Tool execution denied by user.";
          onToolResult(block.name, denyMsg, true);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: denyMsg,
            is_error: true,
          });
          continue;
        }
      }

      try {
        const result = await tool.execute(block.input);
        onToolResult(block.name, result, false);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        onToolResult(block.name, errMsg, true);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: errMsg,
          is_error: true,
        });
      }
    }

    // Add tool results as user message
    state.messages.push({ role: "user", content: toolResults });
  }
}
