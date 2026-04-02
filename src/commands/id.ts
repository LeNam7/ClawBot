import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const IdCommand: ICommand = {
  name: "/id",
  aliases: ["/whoami"],
  description: "Xem ID Telegram của bạn",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    await ctx.reply(
      `👤 User ID: \`${ctx.from?.id}\`\n` +
      `💬 Chat ID: \`${ctx.chat?.id}\``,
      { parse_mode: "Markdown" }
    );
    return true;
  }
};
