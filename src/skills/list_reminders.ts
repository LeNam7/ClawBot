import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

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
    
    if (jobs.length === 0) return "No active reminders found for this chat.";
    
    return "Active reminders:\n" + jobs.map((j) => `- ID: ${j.id.slice(-6)} | Cron: ${j.expression} | Msg: ${j.prompt}`).join("\n");
  }
};

export default skill;
