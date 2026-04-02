import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { runSkill, SKILL_LIST } from "../plugins/skills/index.js";

export const SkillCommand: ICommand = {
  name: "/skill",
  description: "Dùng skill tĩnh",
  category: "advanced",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    if (!args) {
      await ctx.reply(SKILL_LIST, { parse_mode: "Markdown" });
      return true;
    }
    await ctx.replyWithChatAction("typing");
    const result = await runSkill(args);
    if (!result) {
      await ctx.reply(`Skill không tìm thấy: \`${args.split(" ")[0]}\`\n\n${SKILL_LIST}`, {
        parse_mode: "Markdown",
      });
      return true;
    }
    await ctx.reply(result.output);
    return true;
  }
};
