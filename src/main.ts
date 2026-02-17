#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { streamMessage } from "./api.ts";
import { loadConfig } from "./config.ts";
import { type ContextConfig, getContextLimit } from "./context.ts";
import { createConversation, parseInput, sendMessage } from "./repl.ts";
import { builtinTools, createToolRegistry } from "./tools.ts";

function parseArgs(args: string[]): {
  prompt: string | undefined;
  systemPrompt: string | undefined;
  noTools: boolean;
  contextStrategy: "truncate" | "error";
} {
  let systemPrompt: string | undefined;
  let noTools = false;
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

async function runSingleShot(prompt: string, systemPrompt: string | undefined) {
  const config = loadConfig();
  const messages = [{ role: "user" as const, content: prompt }];

  for await (const event of streamMessage(config, messages, systemPrompt)) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.text);
        break;
      case "usage":
        console.log(
          `\n\n---\ntokens: ${event.usage.inputTokens} in / ${event.usage.outputTokens} out`,
        );
        break;
      case "error":
        console.error(`\nerror: ${event.error}`);
        process.exit(1);
    }
  }
}

async function runRepl(
  systemPrompt: string | undefined,
  useTools: boolean,
  contextStrategy: "truncate" | "error",
) {
  const config = loadConfig();
  const state = createConversation(systemPrompt);
  const toolRegistry = useTools ? createToolRegistry(builtinTools) : undefined;

  const contextConfig: ContextConfig = {
    maxContextTokens: getContextLimit(config.model),
    strategy: contextStrategy,
    reservedTokens: config.maxTokens, // reserve space for the response
  };

  const toolNames = toolRegistry ? toolRegistry.tools.map((t) => t.name).join(", ") : "none";

  console.log("navi v0.4.0");
  console.log(`Tools: ${toolNames}`);
  console.log(`Context: ${contextConfig.maxContextTokens} tokens (${contextStrategy})`);
  console.log("Type /quit to exit, /clear to reset, /usage for stats.\n");

  const promptStr = "\x1b[36mnavi>\x1b[0m ";

  process.stdout.write(promptStr);
  for await (const line of console) {
    const command = parseInput(line);

    switch (command.type) {
      case "quit":
        console.log(
          `\nSession: ${state.turns} turns, ${state.totalInputTokens + state.totalOutputTokens} tokens total`,
        );
        process.exit(0);
        break;
      case "clear":
        state.messages.length = 0;
        state.turns = 0;
        state.totalInputTokens = 0;
        state.totalOutputTokens = 0;
        console.log("Conversation cleared.\n");
        break;
      case "usage":
        console.log(
          `Turns: ${state.turns} | Tokens: ${state.totalInputTokens} in / ${state.totalOutputTokens} out | Total: ${state.totalInputTokens + state.totalOutputTokens}\n`,
        );
        break;
      case "message":
        if (!command.text) break;
        try {
          await sendMessage({
            config,
            state,
            userText: command.text,
            toolRegistry,
            contextConfig,
            onText: (text) => process.stdout.write(text),
            onToolCall: (name, input) => {
              console.log(`\n\x1b[33m⚡ ${name}\x1b[0m ${JSON.stringify(input)}`);
            },
            onToolResult: (name, result, isError) => {
              const color = isError ? "\x1b[31m" : "\x1b[32m";
              const icon = isError ? "✗" : "✓";
              const preview = result.length > 200 ? `${result.slice(0, 200)}...` : result;
              console.log(`${color}${icon} ${name}\x1b[0m: ${preview}\n`);
            },
            onContextTruncation: (dropped) => {
              console.log(
                `\x1b[33m⚠ Context truncated: dropped ${dropped} oldest message(s)\x1b[0m\n`,
              );
            },
            confirmTool: async (name, input) => {
              return confirm(`\x1b[33mAllow ${name}?\x1b[0m ${JSON.stringify(input)} [y/N] `);
            },
          });
          console.log("\n");
        } catch (err) {
          console.error(`\nerror: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        break;
    }

    process.stdout.write(promptStr);
  }
}

async function main() {
  const { prompt, systemPrompt, noTools, contextStrategy } = parseArgs(process.argv.slice(2));

  if (prompt) {
    await runSingleShot(prompt, systemPrompt);
    return;
  }

  if (!process.stdin.isTTY) {
    const stdinText = await readStdin();
    if (stdinText) {
      await runSingleShot(stdinText, systemPrompt);
      return;
    }
  }

  await runRepl(systemPrompt, !noTools, contextStrategy);
}

main();
