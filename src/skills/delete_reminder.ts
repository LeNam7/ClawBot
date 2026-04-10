import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "delete_reminder",
  description: "Delete a specific reminder by its ID. Use when the user asks to cancel or remove a scheduled reminder.",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The ID of the reminder to delete (usually the last 6 characters or full ID).",
      },
    },
    required: ["id"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    if (!deps.cronManager) return "Reminder feature is not available.";
    
    const id = args.id ?? "";
    if (!id) return "Error: Missing reminder ID.";
    
    await ctx.sendProgress(`Đang xóa công việc ID ${id}...`);
    
    const jobs = deps.cronManager.list(ctx.msg.chatId);
    const target = jobs.find((j) => j.id === id || j.id.endsWith(id));
    if (!target) return `Error: Reminder ID "${id}" not found.`;
    
    const success = deps.cronManager.delete(ctx.msg.chatId, target.id);
    return success ? `Reminder ${target.id.slice(-6)} deleted successfully.` : `Failed to delete reminder ${id}.`;
  }
};

export default skill;
