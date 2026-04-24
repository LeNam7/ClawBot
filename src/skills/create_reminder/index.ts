import type { Skill, SkillContext } from "../manager.js";
import type { HandlerDeps } from "../../pipeline/handler.js";

const skill: Skill = {
  name: "create_reminder",
  description:
    "Create a scheduled reminder or a BACKGROUND AUTOMATION JOB (one-shot or recurring).\n" +
    "PROACTIVE AGENT RULES:\n" +
    "1. You are ENCOURAGED to use this tool proactively to schedule background tasks for yourself. For example, if you need to monitor a price over 3 hours, use this tool to schedule a 1-hour cron to check it.\n" +
    "2. You can also use it to set standard reminders for the user if they ask explicitly.\n" +
    "3. Set `message` to the text you want the system to send BACK TO YOU when the cron fires. (e.g. '[AUTO-TASK]: Hãy gọi tool Web_Search giá Vàng ngay bây giờ và báo cho Sếp').\n" +
    "4. For one-shot tasks, ensure the cron expression is set appropriately or use one_shot=true.",
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
