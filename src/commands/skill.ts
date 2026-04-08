import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { runSkill, loader } from "../plugins/skills/index.js";
import type { HandlerDeps } from "../pipeline/handler.js";

function getDynamicSkillList(): string {
  const skills = loader.getDefinitions();
  if (skills.length === 0) return "*Chưa có skill nào được load.*";
  return "*Skills có sẵn (dùng qua /skill):*\n" + skills.map(s => `\`${s.name}\` — ${s.description}`).join("\n");
}

export const SkillCommand: ICommand = {
  name: "/skill",
  description: "Dùng skill tĩnh",
  category: "advanced",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const skillListStr = getDynamicSkillList();
    if (!args) {
      await ctx.reply(skillListStr, { parse_mode: "Markdown" });
      return true;
    }
    await ctx.replyWithChatAction("typing");
    
    // Ép kiểu CommandDeps thành HandlerDeps do cấu trúc giống nhau
    const result = await runSkill(args, deps as unknown as HandlerDeps);
    if (!result) {
      await ctx.reply(`Skill không tìm thấy: \`${args.split(" ")[0]}\`\n\n${skillListStr}`, {
        parse_mode: "Markdown",
      });
      return true;
    }
    await ctx.reply(result.output);
    return true;
  }
};
