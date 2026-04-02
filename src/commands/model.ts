import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const ModelCommand: ICommand = {
  name: "/model",
  description: "Xem model đang dùng",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    await ctx.reply(`🧠 Model: \`${deps.config.model}\``, { parse_mode: "Markdown" });
    return true;
  }
};
