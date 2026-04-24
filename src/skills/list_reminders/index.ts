import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "list_reminders",
  description: "List all active reminders and scheduled jobs for the current user/chat. Use when the user asks what tasks or reminders are currently scheduled.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    if (!deps.cronManager) return "Reminder feature is not available.";
    
    await ctx.sendProgress(`Đang lấy danh sách công việc...`);
    const jobs = deps.cronManager.list(ctx.msg.chatId);
    
    let output = "=== STATIC SYSTEM CRONS (DO NOT EDIT/OVERRIDE) ===\n";
    if (deps.config.systemCrons && deps.config.systemCrons.length > 0) {
      deps.config.systemCrons.forEach((c) => {
        output += `- [Lịch Đánh Thức Cố Định]: ${c} (Bot sẽ tự dậy để kiểm tra tasks.json)\n`;
      });
    } else {
      output += "- Không có.\n";
    }

    output += "\n=== DYNAMIC REMINDERS (CREATED BY YOU) ===\n";
    if (jobs.length === 0) {
      output += "- No active custom reminders found.";
    } else {
      output += jobs.map((j) => `- ID: ${j.id.slice(-6)} | Cron: ${j.expression} | Msg: ${j.prompt}`).join("\n");
    }
    
    return output;
  }
};

export default skill;
