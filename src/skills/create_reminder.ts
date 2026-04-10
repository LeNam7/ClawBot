import type { Skill, SkillContext } from "./manager.js";
import type { HandlerDeps } from "../pipeline/handler.js";

const skill: Skill = {
  name: "create_reminder",
  description:
    "Create a scheduled reminder (one-shot or recurring). " +
    "STRICT RULES: " +
    "1. ONLY call this tool when user EXPLICITLY requests a reminder with clear words: nhắc, đặt lịch, thông báo lúc, báo tôi lúc, remind me, set alarm. " +
    "2. NEVER call this tool just because user mentions time or activity. " +
    "3. ALWAYS ask 'Bạn muốn nhắc 1 lần hay lặp lại hằng ngày?' BEFORE calling this tool, unless user already specified. " +
    "4. For one-shot: use a future datetime cron or pass one_shot=true. " +
    "5. Default assumption is ONE-TIME unless user says daily/hằng ngày/mỗi ngày.",
  input_schema: {
    type: "object",
    properties: {
      cron_expression: {
        type: "string",
        description:
          "Standard 5-field cron expression: minute hour day month weekday. " +
          "Examples: '10 12 * * *' = daily at 12:10, '0 8 * * 1-5' = weekdays at 8:00",
      },
      message: {
        type: "string",
        description: "The reminder message to send. Use the same language as the user.",
      },
      one_shot: {
        type: "boolean",
        description: "If true, reminder runs once only. Default true unless user explicitly wants recurring.",
      },
    },
    required: ["cron_expression", "message"],
  },
  execute: async (args: any, deps: HandlerDeps, ctx: SkillContext) => {
    if (!deps.cronManager) return "Reminder feature is not available.";
    
    await ctx.sendProgress(`Đang tạo lịch nhắc...`);
    const job = deps.cronManager.add(ctx.msg.chatId, ctx.msg.userId, args.cron_expression, args.message);
    
    if (job) {
      return `Reminder created. ID: ${job.id.slice(-6)}. Schedule: "${args.cron_expression}". Message: "${args.message}"`;
    }
    return `Failed to create reminder. Invalid cron expression: "${args.cron_expression}"`;
  }
};

export default skill;
