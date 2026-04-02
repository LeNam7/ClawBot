import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { runBash } from "../plugins/bash.js";

export const BashCommand: ICommand = {
  name: "/bash",
  description: "Chạy lệnh shell",
  category: "advanced",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    if (!args) {
      await ctx.reply("Usage: /bash <command>");
      return true;
    }
    await ctx.replyWithChatAction("typing");
    const output = await runBash(args, deps.config.bashTimeoutMs);
    const reply = output.length > 3800
      ? output.slice(0, 3800) + "\n...(truncated)"
      : output;
    await ctx.reply(`\`\`\`\n${reply}\n\`\`\``, { parse_mode: "Markdown" });
    return true;
  }
};
