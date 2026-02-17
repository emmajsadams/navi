export type Config = {
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
};

export function loadConfig(): Config {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required. Copy .env.example to .env and add your key.");
  }

  return {
    apiKey,
    model: process.env["NAVI_MODEL"] ?? "claude-sonnet-4-20250514",
    baseUrl: process.env["ANTHROPIC_BASE_URL"] ?? "https://api.anthropic.com",
    maxTokens: Number(process.env["NAVI_MAX_TOKENS"] ?? "4096"),
  };
}
