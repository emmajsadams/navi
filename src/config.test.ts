import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["ANTHROPIC_API_KEY"] = "test-key-123";
    delete process.env["NAVI_MODEL"];
    delete process.env["ANTHROPIC_BASE_URL"];
    delete process.env["NAVI_MAX_TOKENS"];
    delete process.env["NAVI_PROVIDER"];
    delete process.env["OPENAI_API_KEY"];
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
    expect(config.provider).toBe("anthropic");
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

  it("supports openai provider", () => {
    process.env["OPENAI_API_KEY"] = "sk-test";
    const config = loadConfig("openai");
    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("sk-test");
    expect(config.model).toBe("gpt-4o");
    expect(config.baseUrl).toBe("https://api.openai.com");
  });

  it("accepts provider override", () => {
    const config = loadConfig("anthropic");
    expect(config.provider).toBe("anthropic");
  });
});
