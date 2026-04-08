import { reloadSkills } from "../plugins/skills/index.js";
import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const ReloadSkillsCommand: ICommand = {
  name: "/reload_skills",
  description: "Tải lại toàn bộ skills (dùng khi thêm skill mới)",
  category: "hidden",
  execute: async (ctx: Context, _args: string, _deps: CommandDeps) => {
    try {
      await reloadSkills();
      await ctx.reply("✅ Đã tải lại toàn bộ skills thành công!");
      return true;
    } catch (err: any) {
      await ctx.reply(`❌ Lỗi khi tải lại skills: ${err.message}`);
      return false;
    }
  },
};
