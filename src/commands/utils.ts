import type { Context } from "grammy";
import type { SessionManager } from "../session/manager.js";
import type { Config } from "../config/env.js";
import fs from "node:fs";
import path from "node:path";

export function makeSessionKey(ctx: Context): string {
  const userId = String(ctx.from?.id ?? "unknown");
  const chatId = String(ctx.chat?.id ?? "unknown");
  return `telegram:${userId}:${chatId}`;
}

export function buildExportMarkdown(
  key: string,
  turns: { role: string; content: unknown }[]
): string {
  const lines = [
    `# Chat Export`,
    `**Session:** ${key}`,
    `**Exported:** ${new Date().toISOString()}`,
    `**Turns:** ${turns.length}`,
    ``,
    `---`,
    ``,
  ];
  for (const t of turns) {
    const role = t.role === "user" ? "👤 User" : "🤖 Gemma";
    const content = typeof t.content === "string"
      ? t.content
      : JSON.stringify(t.content);
    lines.push(`### ${role}\n\n${content}\n`);
  }
  return lines.join("\n");
}

export async function saveMemory(
  key: string,
  sessionManager: SessionManager,
  config: Config
): Promise<void> {
  const turns = sessionManager.getHistory(key);
  if (turns.length === 0) return;

  const memDir = path.join(path.dirname(config.dbPath), "memories");
  fs.mkdirSync(memDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 16).replace(":", "");
  const filename = `${date}-${time}-${key.replace(/:/g, "_")}.md`;

  const content = [
    `# Session Memory`,
    `**Key:** ${key}`,
    `**Saved:** ${new Date().toISOString()}`,
    `**Turns:** ${turns.length}`,
    ``,
    `## Conversation`,
    ...turns.map((t) => {
      const c = typeof t.content === "string" ? t.content : JSON.stringify(t.content);
      return `**${t.role === "user" ? "User" : "Gemma"}:** ${c}`;
    }),
  ].join("\n");

  fs.writeFileSync(path.join(memDir, filename), content, "utf8");
}
