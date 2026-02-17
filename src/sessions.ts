/**
 * Session persistence — save and restore conversations.
 * Uses JSON files in a sessions directory.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ConversationState } from "./repl.ts";

export type SessionMetadata = {
  id: string;
  model: string;
  provider: string;
  turns: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
};

export type SessionData = {
  metadata: SessionMetadata;
  state: ConversationState;
};

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

  const data: SessionData = {
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

  writeFileSync(sessionPath(id), JSON.stringify(data, null, 2), "utf-8");
}

export function loadSession(id: string): SessionData | undefined {
  const path = sessionPath(id);
  if (!existsSync(path)) return undefined;

  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as SessionData;
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
      const data = JSON.parse(raw) as SessionData;
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
