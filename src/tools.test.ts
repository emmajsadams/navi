import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { builtinTools, createToolRegistry } from "./tools.ts";

const testDir = join(import.meta.dir, "../.test-tmp");

describe("createToolRegistry", () => {
  it("creates registry with lookup", () => {
    const registry = createToolRegistry(builtinTools);
    expect(registry.tools).toHaveLength(4);
    expect(registry.get("read_file")).toBeDefined();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("formats for API", () => {
    const registry = createToolRegistry(builtinTools);
    const api = registry.apiFormat();
    expect(api).toHaveLength(4);
    for (const tool of api) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("input_schema");
      // Should not have execute function
      expect(tool).not.toHaveProperty("execute");
    }
  });
});

describe("built-in tools", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("read_file reads a file", async () => {
    const filePath = join(testDir, "test.txt");
    writeFileSync(filePath, "hello world");

    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("read_file");
    const result = await tool!.execute({ path: filePath });
    expect(result).toBe("hello world");
  });

  it("read_file throws on missing file", async () => {
    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("read_file");
    await expect(tool!.execute({ path: join(testDir, "nope.txt") })).rejects.toThrow(
      "Failed to read",
    );
  });

  it("write_file writes a file", async () => {
    const filePath = join(testDir, "out.txt");
    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("write_file");
    const result = await tool!.execute({
      path: filePath,
      content: "test content",
    });
    expect(result).toContain("Wrote 12 bytes");

    const readTool = registry.get("read_file");
    const content = await readTool!.execute({ path: filePath });
    expect(content).toBe("test content");
  });

  it("list_dir lists directory contents", async () => {
    writeFileSync(join(testDir, "a.txt"), "");
    writeFileSync(join(testDir, "b.txt"), "");
    mkdirSync(join(testDir, "subdir"));

    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("list_dir");
    const result = await tool!.execute({ path: testDir });
    expect(result).toContain("a.txt");
    expect(result).toContain("b.txt");
    expect(result).toContain("subdir/");
  });

  it("exec runs a command", async () => {
    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("exec");
    const result = await tool!.execute({ command: "echo hello" });
    expect(result.trim()).toBe("hello");
  });

  it("exec handles failing commands", async () => {
    const registry = createToolRegistry(builtinTools);
    const tool = registry.get("exec");
    const result = await tool!.execute({
      command: "exit 1",
    });
    // Should return output, not throw
    expect(typeof result).toBe("string");
  });
});
