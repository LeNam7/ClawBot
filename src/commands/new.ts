import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { makeSessionKey, saveMemory } from "./utils.js";

export const NewCommand: ICommand = {
  name: "/new",
  aliases: ["/reset"],
  description: "Bắt đầu cuộc trò chuyện mới (xóa lịch sử chat)",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const key = makeSessionKey(ctx);
    await saveMemory(key, deps.sessionManager, deps.config);
    deps.sessionManager.reset(key);
    await ctx.reply("✅ Đã bắt đầu cuộc trò chuyện mới.");
    return true;
  }
};
