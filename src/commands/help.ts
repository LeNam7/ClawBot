import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { registry } from "./registry.js";

export const HelpCommand: ICommand = {
  name: "/help",
  description: "Hiện trợ giúp",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const commands = registry.getAll();
    let text = `🤖 *Clawbot* — Claude trên Telegram\n\n`;
    text += `*Lệnh hiện có:*\n`;
    for (const cmd of commands) {
      if (cmd.category === "hidden") continue;
      text += `${cmd.name} — ${cmd.description}\n`;
    }
    text += `\nModel: \`${deps.config.model}\``;
    await ctx.reply(text, { parse_mode: "Markdown" });
    return true;
  }
};
