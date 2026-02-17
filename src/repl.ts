import type { Message } from "./api.ts";
import { streamMessage } from "./api.ts";
import type { Config } from "./config.ts";

export type Command =
  | { type: "quit" }
  | { type: "clear" }
  | { type: "usage" }
  | { type: "message"; text: string };

export function parseInput(input: string): Command {
  const trimmed = input.trim();
  if (trimmed === "/quit" || trimmed === "/exit") return { type: "quit" };
  if (trimmed === "/clear") return { type: "clear" };
  if (trimmed === "/usage") return { type: "usage" };
  return { type: "message", text: trimmed };
}

export type ConversationState = {
  messages: Message[];
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

export async function sendMessage(
  config: Config,
  state: ConversationState,
  userText: string,
  onText: (text: string) => void,
): Promise<void> {
  state.messages.push({ role: "user", content: userText });

  const assistantChunks: string[] = [];

  for await (const event of streamMessage(config, state.messages, state.systemPrompt)) {
    switch (event.type) {
      case "text":
        assistantChunks.push(event.text);
        onText(event.text);
        break;
      case "usage":
        state.totalInputTokens += event.usage.inputTokens;
        state.totalOutputTokens += event.usage.outputTokens;
        break;
      case "error":
        throw new Error(event.error);
    }
  }

  const assistantContent = assistantChunks.join("");
  if (assistantContent) {
    state.messages.push({ role: "assistant", content: assistantContent });
    state.turns++;
  }
}
