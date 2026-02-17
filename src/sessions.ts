/**
 * Session persistence — save and restore conversations.
 * Uses JSON files in a sessions directory.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod/v4";
import type { ConversationState } from "./repl.ts";

const sessionMetadataSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  provider: z.string().min(1),
  turns: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SessionMetadata = z.infer<typeof sessionMetadataSchema>;

const conversationStateSchema = z.object({
  messages: z.array(z.unknown()),
  systemPrompt: z.string().optional(),
  totalInputTokens: z.number().int().min(0),
  totalOutputTokens: z.number().int().min(0),
  turns: z.number().int().min(0),
});

const sessionDataSchema = z.object({
  metadata: sessionMetadataSchema,
  state: conversationStateSchema,
});

export type SessionData = z.infer<typeof sessionDataSchema>;

const SESSIONS_DIR = join(homedir(), ".navi", "sessions");

function ensureDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

export function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}-${time}-${rand}`;
}

export function saveSession(
  id: string,
  state: ConversationState,
  model: string,
  provider: string,
): void {
  ensureDir();

  const existing = loadSession(id);
  const now = new Date().toISOString();

  const data = {
    metadata: {
      id,
      model,
      provider,
      turns: state.turns,
      totalTokens: state.totalInputTokens + state.totalOutputTokens,
      createdAt: existing?.metadata.createdAt ?? now,
      updatedAt: now,
    },
    state,
  };

  // Validate before writing
  sessionDataSchema.parse(data);

  writeFileSync(sessionPath(id), JSON.stringify(data, null, 2), "utf-8");
}

export function loadSession(id: string): SessionData | undefined {
  const path = sessionPath(id);
  if (!existsSync(path)) return undefined;

  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return sessionDataSchema.parse(parsed) as SessionData;
  } catch {
    return undefined;
  }
}

export function listSessions(): SessionMetadata[] {
  ensureDir();

  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  const sessions: SessionMetadata[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(SESSIONS_DIR, file), "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      const data = sessionDataSchema.parse(parsed) as SessionData;
      sessions.push(data.metadata);
    } catch {
      // skip corrupt files
    }
  }

  // Sort by updatedAt descending
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return sessions;
}

export function deleteSession(id: string): boolean {
  const path = sessionPath(id);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
