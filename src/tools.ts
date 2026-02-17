import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";

export type ToolSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type Tool = {
  name: string;
  description: string;
  input_schema: ToolSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
};

export type ToolRegistry = {
  tools: Tool[];
  get: (name: string) => Tool | undefined;
  apiFormat: () => ApiTool[];
};

export type ApiTool = {
  name: string;
  description: string;
  input_schema: ToolSchema;
};

export function createToolRegistry(tools: Tool[]): ToolRegistry {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return {
    tools,
    get: (name: string) => toolMap.get(name),
    apiFormat: () =>
      tools.map(({ name, description, input_schema }) => ({
        name,
        description,
        input_schema,
      })),
  };
}

// --- Built-in tools ---

const readFileTool: Tool = {
  name: "read_file",
  description: "Read the contents of a file at the given path.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to read" },
    },
    required: ["path"],
  },
  execute: async (input) => {
    const path = resolve(String(input["path"]));
    try {
      return readFileSync(path, "utf-8");
    } catch (err) {
      throw new Error(
        `Failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

const writeFileTool: Tool = {
  name: "write_file",
  description:
    "Write content to a file at the given path. Creates the file if it doesn't exist, overwrites if it does.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the file to write",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
    },
    required: ["path", "content"],
  },
  execute: async (input) => {
    const path = resolve(String(input["path"]));
    const content = String(input["content"]);
    try {
      writeFileSync(path, content, "utf-8");
      return `Wrote ${content.length} bytes to ${path}`;
    } catch (err) {
      throw new Error(
        `Failed to write ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

const listDirTool: Tool = {
  name: "list_dir",
  description:
    "List the contents of a directory. Returns file names with type indicators (/ for directories).",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path to the directory to list",
      },
    },
    required: ["path"],
  },
  execute: async (input) => {
    const dirPath = resolve(String(input["path"]));
    try {
      const entries = readdirSync(dirPath);
      const lines = entries.map((entry) => {
        try {
          const stat = statSync(join(dirPath, entry));
          return stat.isDirectory() ? `${entry}/` : entry;
        } catch {
          return entry;
        }
      });
      return lines.join("\n");
    } catch (err) {
      throw new Error(
        `Failed to list ${dirPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

const execTool: Tool = {
  name: "exec",
  description: "Execute a shell command and return its output. Use with caution.",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "Shell command to execute",
      },
    },
    required: ["command"],
  },
  execute: async (input) => {
    const command = String(input["command"]);
    try {
      const output = execSync(command, {
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      });
      return output;
    } catch (err) {
      const execErr = err as {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      const parts: string[] = [];
      if (execErr.stdout) parts.push(execErr.stdout);
      if (execErr.stderr) parts.push(execErr.stderr);
      if (parts.length === 0)
        parts.push(`Command failed with exit code ${execErr.status ?? "unknown"}`);
      return parts.join("\n");
    }
  },
};

export const builtinTools: Tool[] = [readFileTool, writeFileTool, listDirTool, execTool];
