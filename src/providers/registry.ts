/**
 * Provider registry — maps provider names to implementations.
 */

import type { Provider } from "./types.ts";
import { anthropicProvider } from "./anthropic.ts";
import { openaiProvider } from "./openai.ts";

const providers = new Map<string, Provider>([
  ["anthropic", anthropicProvider],
  ["openai", openaiProvider],
]);

export function getProvider(name: string): Provider {
  const provider = providers.get(name);
  if (!provider) {
    const available = Array.from(providers.keys()).join(", ");
    throw new Error(`Unknown provider: "${name}". Available: ${available}`);
  }
  return provider;
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}
