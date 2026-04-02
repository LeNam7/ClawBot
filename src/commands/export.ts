import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { InputFile } from "grammy";
import { makeSessionKey, buildExportMarkdown } from "./utils.js";
import fs from "node:fs";
import path from "node:path";

export const ExportCommand: ICommand = {
  name: "/export",
  description: "Xuất lịch sử chat",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const key = makeSessionKey(ctx);
    const turns = deps.sessionManager.getHistory(key);
    if (turns.length === 0) {
      await ctx.reply("Không có lịch sử để xuất.");
      return true;
    }
    const content = buildExportMarkdown(key, turns);
    const tmpPath = path.join(
      path.dirname(deps.config.dbPath),
      `export-${Date.now()}.md`
    );
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, content, "utf8");
    try {
      await ctx.replyWithDocument(
        new InputFile(tmpPath, `chat-export-${Date.now()}.md`),
        { caption: "📄 Lịch sử chat" }
      );
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
    return true;
  }
};
