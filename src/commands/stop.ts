import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { cancelStream } from "../pipeline/active-streams.js";

export const StopCommand: ICommand = {
  name: "/stop",
  description: "Dừng phản hồi đang chạy",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const chatId = String(ctx.chat?.id ?? "");
    const cancelled = cancelStream(chatId);
    await ctx.reply(cancelled ? "⏹ Đã dừng phản hồi." : "Không có phản hồi nào đang chạy.");
    return true;
  }
};
