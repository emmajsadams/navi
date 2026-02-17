import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["ANTHROPIC_API_KEY"] = "test-key-123";
    delete process.env["NAVI_MODEL"];
    delete process.env["ANTHROPIC_BASE_URL"];
    delete process.env["NAVI_MAX_TOKENS"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads config with defaults", () => {
    const config = loadConfig();
    expect(config.apiKey).toBe("test-key-123");
    expect(config.model).toBe("claude-sonnet-4-20250514");
    expect(config.baseUrl).toBe("https://api.anthropic.com");
    expect(config.maxTokens).toBe(4096);
  });

  it("respects env overrides", () => {
    process.env["NAVI_MODEL"] = "claude-haiku-35-20241022";
    process.env["ANTHROPIC_BASE_URL"] = "https://custom.api.com";
    process.env["NAVI_MAX_TOKENS"] = "1024";

    const config = loadConfig();
    expect(config.model).toBe("claude-haiku-35-20241022");
    expect(config.baseUrl).toBe("https://custom.api.com");
    expect(config.maxTokens).toBe(1024);
  });

  it("throws without API key", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    expect(() => loadConfig()).toThrow("ANTHROPIC_API_KEY is required");
  });
});
