#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { loadConfig } from "./config.ts";
import { type ContextConfig, getContextLimit } from "./context.ts";
import { getProvider } from "./providers/registry.ts";
import { createConversation, parseInput, sendMessage } from "./repl.ts";
import type { ConversationState } from "./repl.ts";
import { generateSessionId, listSessions, loadSession, saveSession } from "./sessions.ts";
import { builtinTools, createToolRegistry } from "./tools.ts";
import { color, styled } from "./tui/ansi.ts";
import { formatMarkdown, formatStatusBar } from "./tui/format.ts";
import { createSpinner } from "./tui/spinner.ts";

function parseArgs(args: string[]): {
  prompt: string | undefined;
  systemPrompt: string | undefined;
  noTools: boolean;
  contextStrategy: "truncate" | "error";
  noTui: boolean;
  provider: string | undefined;
  sessionId: string | undefined;
} {
  let systemPrompt: string | undefined;
  let noTools = false;
  let noTui = false;
  let provider: string | undefined;
  let sessionId: string | undefined;
  let contextStrategy: "truncate" | "error" = "truncate";
  const rest: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--system" && i + 1 < args.length) {
      const val = args[++i];
      if (val) {
        try {
          systemPrompt = readFileSync(val, "utf-8").trim();
        } catch {
          systemPrompt = val;
        }
      }
    } else if (arg === "--no-tools") {
      noTools = true;
    } else if (arg === "--no-tui") {
      noTui = true;
    } else if (arg === "--provider" && i + 1 < args.length) {
      provider = args[++i];
    } else if (arg === "--session" && i + 1 < args.length) {
      sessionId = args[++i];
    } else if (arg === "--context-strategy" && i + 1 < args.length) {
      const val = args[++i];
      if (val === "truncate" || val === "error") {
        contextStrategy = val;
      }
    } else if (arg) {
      rest.push(arg);
    }
  }

  return {
    prompt: rest.length > 0 ? rest.join(" ") : undefined,
    systemPrompt,
    noTools,
    noTui,
    provider,
    sessionId,
    contextStrategy,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks)).trim();
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function runSingleShot(
  prompt: string,
  systemPrompt: string | undefined,
  useTui: boolean,
  providerName: string | undefined,
) {
  const config = loadConfig(providerName);
  const provider = getProvider(config.provider);
  const messages = [{ role: "user" as const, content: prompt }];
  const chunks: string[] = [];

  for await (const event of provider.send(config, messages, systemPrompt)) {
    switch (event.type) {
      case "text":
        chunks.push(event.text);
        if (!useTui) {
          process.stdout.write(event.text);
        }
        break;
      case "usage":
        if (useTui) {
          const formatted = formatMarkdown(chunks.join(""));
          process.stdout.write(`${formatted}\n`);
          const cols = process.stdout.columns ?? 80;
          console.log(
            formatStatusBar("", `${event.usage.inputTokens}↑ ${event.usage.outputTokens}↓`, cols),
          );
        } else {
          console.log(
            `\n\n---\ntokens: ${event.usage.inputTokens} in / ${event.usage.outputTokens} out`,
          );
        }
        break;
      case "error":
        console.error(`\n${styled("error:", color.red)} ${event.error}`);
        process.exit(1);
    }
  }
}

async function runRepl(
  systemPrompt: string | undefined,
  useTools: boolean,
  contextStrategy: "truncate" | "error",
  useTui: boolean,
  providerName: string | undefined,
  resumeSessionId: string | undefined,
) {
  const config = loadConfig(providerName);
  const provider = getProvider(config.provider);
  const toolRegistry = useTools ? createToolRegistry(builtinTools) : undefined;

  const contextConfig: ContextConfig = {
    maxContextTokens: getContextLimit(config.model),
    strategy: contextStrategy,
    reservedTokens: config.maxTokens,
  };

  // Session management
  let sessionId: string;
  let state: ConversationState;

  if (resumeSessionId) {
    const session = loadSession(resumeSessionId);
    if (session) {
      sessionId = resumeSessionId;
      state = session.state as ConversationState;
      console.log(styled(`Resumed session ${sessionId} (${state.turns} turns)`, color.dim));
    } else {
      console.error(
        styled(`Session "${resumeSessionId}" not found. Starting new session.`, color.yellow),
      );
      sessionId = generateSessionId();
      state = createConversation(systemPrompt);
    }
  } else {
    sessionId = generateSessionId();
    state = createConversation(systemPrompt);
  }

  const toolNames = toolRegistry ? toolRegistry.tools.map((t) => t.name).join(", ") : "none";

  // Header
  console.log(styled("navi", color.bold, color.cyan) + styled(" v0.7.0", color.dim));
  console.log(styled(`provider: ${provider.name} · model: ${config.model}`, color.dim));
  console.log(styled(`tools: ${toolNames}`, color.dim));
  console.log(
    styled(
      `context: ${contextConfig.maxContextTokens.toLocaleString()} tokens (${contextStrategy})`,
      color.dim,
    ),
  );
  console.log(styled(`session: ${sessionId}`, color.dim));
  console.log(styled("commands: /quit /clear /usage /save /load <id> /sessions\n", color.dim));

  const promptStr = `${styled("›", color.cyan)} `;

  function autoSave() {
    saveSession(sessionId, state, config.model, config.provider);
  }

  process.stdout.write(promptStr);
  for await (const line of console) {
    const command = parseInput(line);

    switch (command.type) {
      case "quit": {
        autoSave();
        const total = state.totalInputTokens + state.totalOutputTokens;
        console.log(
          styled(
            `\n${state.turns} turns · ${total.toLocaleString()} tokens · saved ${sessionId}`,
            color.dim,
          ),
        );
        process.exit(0);
        break;
      }
      case "clear":
        state.messages.length = 0;
        state.turns = 0;
        state.totalInputTokens = 0;
        state.totalOutputTokens = 0;
        console.log(styled("conversation cleared\n", color.dim));
        break;
      case "usage": {
        const total = state.totalInputTokens + state.totalOutputTokens;
        console.log(
          styled(
            `${state.turns} turns · ${state.totalInputTokens.toLocaleString()}↑ ${state.totalOutputTokens.toLocaleString()}↓ · ${total.toLocaleString()} total\nsession: ${sessionId}\n`,
            color.dim,
          ),
        );
        break;
      }
      case "save":
        autoSave();
        console.log(styled(`saved session ${sessionId}\n`, color.green));
        break;
      case "load": {
        const session = loadSession(command.id);
        if (session) {
          sessionId = command.id;
          state.messages = session.state.messages as ConversationState["messages"];
          state.systemPrompt = session.state.systemPrompt;
          state.turns = session.state.turns;
          state.totalInputTokens = session.state.totalInputTokens;
          state.totalOutputTokens = session.state.totalOutputTokens;
          console.log(styled(`loaded session ${sessionId} (${state.turns} turns)\n`, color.green));
        } else {
          console.log(styled(`session "${command.id}" not found\n`, color.red));
        }
        break;
      }
      case "sessions": {
        const sessions = listSessions();
        if (sessions.length === 0) {
          console.log(styled("no saved sessions\n", color.dim));
        } else {
          console.log(styled("Saved sessions:", color.bold));
          for (const s of sessions.slice(0, 20)) {
            const current = s.id === sessionId ? " ←" : "";
            const date = new Date(s.updatedAt).toLocaleString();
            console.log(
              `  ${styled(s.id, color.cyan)} ${styled(`${s.turns}t`, color.dim)} ${styled(`${s.totalTokens.toLocaleString()}tok`, color.dim)} ${styled(s.provider, color.dim)}/${styled(s.model, color.dim)} ${styled(date, color.gray)}${styled(current, color.green)}`,
            );
          }
          console.log("");
        }
        break;
      }
      case "message": {
        if (!command.text) break;
        const spinner = useTui ? createSpinner() : undefined;
        let streaming = false;

        try {
          await sendMessage({
            config,
            provider,
            state,
            userText: command.text,
            toolRegistry,
            contextConfig,
            onText: (text) => {
              if (spinner && !streaming) {
                spinner.stop("");
                streaming = true;
              }
              process.stdout.write(text);
            },
            onToolCall: (name, input) => {
              const inputStr = JSON.stringify(input);
              const preview = inputStr.length > 60 ? `${inputStr.slice(0, 60)}…` : inputStr;
              if (useTui) {
                console.log(
                  `\n${styled("⚡", color.yellow)} ${styled(name, color.bold)} ${styled(preview, color.dim)}`,
                );
                spinner?.start(`running ${name}...`);
                streaming = false;
              } else {
                console.log(`\n\x1b[33m⚡ ${name}\x1b[0m ${inputStr}`);
              }
            },
            onToolResult: (name, result, isError) => {
              if (useTui) {
                const icon = isError ? styled("✗", color.red) : styled("✓", color.green);
                const preview = result.length > 120 ? `${result.slice(0, 120)}…` : result;
                spinner?.stop(`${icon} ${styled(name, color.bold)} ${styled(preview, color.dim)}`);
              } else {
                const clr = isError ? "\x1b[31m" : "\x1b[32m";
                const icon = isError ? "✗" : "✓";
                const preview = result.length > 200 ? `${result.slice(0, 200)}...` : result;
                console.log(`${clr}${icon} ${name}\x1b[0m: ${preview}\n`);
              }
            },
            onContextTruncation: (dropped) => {
              console.log(
                styled(`⚠ dropped ${dropped} oldest message(s) (context limit)`, color.yellow),
              );
            },
            confirmTool: async (name, input) => {
              spinner?.stop("");
              const result = await confirm(
                `${styled("allow", color.yellow)} ${styled(name, color.bold)}? ${styled(JSON.stringify(input), color.dim)} ${styled("[y/N]", color.dim)} `,
              );
              return result;
            },
          });
          console.log("\n");

          // Auto-save after each turn
          autoSave();
        } catch (err) {
          spinner?.stop("");
          console.error(
            `${styled("error:", color.red)} ${err instanceof Error ? err.message : String(err)}\n`,
          );
        }
        break;
      }
    }

    process.stdout.write(promptStr);
  }
}

async function main() {
  const { prompt, systemPrompt, noTools, noTui, provider, sessionId, contextStrategy } = parseArgs(
    process.argv.slice(2),
  );

  const useTui = !noTui && process.stdout.isTTY === true;

  if (prompt) {
    await runSingleShot(prompt, systemPrompt, useTui, provider);
    return;
  }

  if (!process.stdin.isTTY) {
    const stdinText = await readStdin();
    if (stdinText) {
      await runSingleShot(stdinText, systemPrompt, useTui, provider);
      return;
    }
  }

  await runRepl(systemPrompt, !noTools, contextStrategy, useTui, provider, sessionId);
}

main();
