import { describe, expect, it } from "bun:test";
import { createConversation } from "./repl.ts";
import {
  generateSessionId,
  saveSession,
  loadSession,
  listSessions,
  deleteSession,
} from "./sessions.ts";

// We'll test the public API with the real filesystem
describe("sessions", () => {
  describe("generateSessionId", () => {
    it("generates unique ids", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it("generates string ids", () => {
      const id = generateSessionId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe("save and load", () => {
    it("round-trips session data", () => {
      const state = createConversation("test system prompt");
      state.messages.push({ role: "user", content: "hello" });
      state.messages.push({ role: "assistant", content: "hi there" });
      state.turns = 1;
      state.totalInputTokens = 10;
      state.totalOutputTokens = 20;

      const id = generateSessionId();
      saveSession(id, state, "test-model", "anthropic");

      const loaded = loadSession(id);
      expect(loaded).toBeDefined();
      expect(loaded!.metadata.id).toBe(id);
      expect(loaded!.metadata.model).toBe("test-model");
      expect(loaded!.metadata.provider).toBe("anthropic");
      expect(loaded!.metadata.turns).toBe(1);
      expect(loaded!.metadata.totalTokens).toBe(30);
      expect(loaded!.state.messages).toHaveLength(2);
      expect(loaded!.state.systemPrompt).toBe("test system prompt");

      // Cleanup
      deleteSession(id);
    });
  });

  describe("loadSession", () => {
    it("returns undefined for nonexistent session", () => {
      expect(loadSession("nonexistent-id")).toBeUndefined();
    });
  });

  describe("listSessions", () => {
    it("returns array", () => {
      const sessions = listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it("includes saved sessions", () => {
      const state = createConversation(undefined);
      const id = generateSessionId();
      saveSession(id, state, "test-model", "anthropic");

      const sessions = listSessions();
      const found = sessions.find((s) => s.id === id);
      expect(found).toBeDefined();

      deleteSession(id);
    });
  });

  describe("deleteSession", () => {
    it("deletes existing session", () => {
      const state = createConversation(undefined);
      const id = generateSessionId();
      saveSession(id, state, "test-model", "anthropic");

      expect(deleteSession(id)).toBe(true);
      expect(loadSession(id)).toBeUndefined();
    });

    it("returns false for nonexistent session", () => {
      expect(deleteSession("nonexistent")).toBe(false);
    });
  });
});
