#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { streamMessage } from "./api.ts";
import { loadConfig } from "./config.ts";
import { createConversation, parseInput, sendMessage } from "./repl.ts";

function parseArgs(args: string[]): {
  prompt: string | undefined;
  systemPrompt: string | undefined;
} {
  let systemPrompt: string | undefined;
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
    } else if (arg) {
      rest.push(arg);
    }
  }

  return {
    prompt: rest.length > 0 ? rest.join(" ") : undefined,
    systemPrompt,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks)).trim();
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

async function runRepl(systemPrompt: string | undefined) {
  const config = loadConfig();
  const state = createConversation(systemPrompt);

  console.log("navi v0.2.0");
  console.log("Type /quit to exit, /clear to reset, /usage for stats.\n");

  const prompt = "\x1b[36mnavi>\x1b[0m ";

  process.stdout.write(prompt);
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
          await sendMessage(config, state, command.text, (text) => {
            process.stdout.write(text);
          });
          console.log("\n");
        } catch (err) {
          console.error(`\nerror: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        break;
    }

    process.stdout.write(prompt);
  }
}

async function main() {
  const { prompt, systemPrompt } = parseArgs(process.argv.slice(2));

  // If prompt provided or stdin is piped, single-shot mode
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

  // Otherwise, interactive REPL
  await runRepl(systemPrompt);
}

main();
