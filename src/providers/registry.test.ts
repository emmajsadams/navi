import { describe, expect, it } from "bun:test";
import { getProvider, listProviders } from "./registry.ts";

describe("provider registry", () => {
  it("lists available providers", () => {
    const providers = listProviders();
    expect(providers).toContain("anthropic");
    expect(providers).toContain("openai");
  });

  it("returns anthropic provider", () => {
    const provider = getProvider("anthropic");
    expect(provider.name).toBe("anthropic");
  });

  it("returns openai provider", () => {
    const provider = getProvider("openai");
    expect(provider.name).toBe("openai");
  });

  it("throws on unknown provider", () => {
    expect(() => getProvider("unknown")).toThrow("Unknown provider");
  });
});
