#!/usr/bin/env bun

import { streamMessage } from "./api.ts";
import { loadConfig } from "./config.ts";

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks)).trim();
}

async function main() {
  const config = loadConfig();

  // Read prompt from args or stdin
  let prompt = process.argv.slice(2).join(" ");

  if (!prompt && !process.stdin.isTTY) {
    prompt = await readStdin();
  }

  if (!prompt) {
    console.error("Usage: navi <prompt>");
    console.error('       echo "prompt" | navi');
    process.exit(1);
  }

  const messages = [{ role: "user" as const, content: prompt }];

  for await (const event of streamMessage(config, messages)) {
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

main();
