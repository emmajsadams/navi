import { z } from "zod/v4";

const configSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.url(),
  maxTokens: z.number().int().positive(),
  provider: z.string().min(1),
});

export type Config = z.infer<typeof configSchema>;

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; envKey: string }> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    envKey: "ANTHROPIC_API_KEY",
  },
  openai: {
    baseUrl: "https://api.openai.com",
    envKey: "OPENAI_API_KEY",
  },
};

export function loadConfig(providerOverride?: string): Config {
  const provider = providerOverride ?? process.env["NAVI_PROVIDER"] ?? "anthropic";
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS["anthropic"]!;

  const apiKey = process.env[defaults.envKey] ?? process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(`${defaults.envKey} is required. Copy .env.example to .env and add your key.`);
  }

  const defaultModel = provider === "openai" ? "gpt-4o" : "claude-sonnet-4-20250514";

  const raw = {
    apiKey,
    model: process.env["NAVI_MODEL"] ?? defaultModel,
    baseUrl: process.env[`${provider.toUpperCase()}_BASE_URL`] ?? defaults.baseUrl,
    maxTokens: Number(process.env["NAVI_MAX_TOKENS"] ?? "4096"),
    provider,
  };

  return configSchema.parse(raw);
}
