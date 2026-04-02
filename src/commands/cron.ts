import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const CronCommand: ICommand = {
  name: "/cron",
  description: "Quản lý hệ thống cron",
  category: "advanced",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const cronManager = deps.cronManager;
    if (!cronManager) {
      await ctx.reply("Cron not available.");
      return true;
    }
    const cronArgs = args.split(/\s+/);
    const sub = cronArgs[0]?.toLowerCase();
    const chatId = String(ctx.chat?.id ?? "");
    const userId = String(ctx.from?.id ?? "");

    if (sub === "list") {
      const jobs = cronManager.list(chatId);
      if (jobs.length === 0) {
        await ctx.reply("Không có cron job nào.");
        return true;
      }
      const lines = jobs.map(
        (j) => `• \`${j.id.slice(-6)}\` — \`${j.expression}\`\n  📝 ${j.prompt}`
      );
      await ctx.reply(`*Cron jobs:*\n${lines.join("\n\n")}`, { parse_mode: "Markdown" });
      return true;
    }

    if (sub === "del" || sub === "delete" || sub === "rm") {
      const jobIdPart = cronArgs[1];
      if (!jobIdPart) {
        await ctx.reply("Usage: /cron del <id>");
        return true;
      }
      const jobs = cronManager.list(chatId);
      const job = jobs.find((j) => j.id.endsWith(jobIdPart) || j.id === jobIdPart);
      if (!job) {
        await ctx.reply(`Không tìm thấy job: \`${jobIdPart}\``, { parse_mode: "Markdown" });
        return true;
      }
      cronManager.delete(chatId, job.id);
      await ctx.reply(`✅ Đã xóa job \`${job.id.slice(-6)}\``, { parse_mode: "Markdown" });
      return true;
    }

    if (sub === "add") {
      const rest = cronArgs.slice(1).join(" ");
      let expression: string;
      let prompt: string;

      if (rest.startsWith("@")) {
        const spaceIdx = rest.indexOf(" ");
        if (spaceIdx === -1) {
          await ctx.reply("Usage: /cron add @hourly <prompt>");
          return true;
        }
        expression = rest.slice(0, spaceIdx);
        prompt = rest.slice(spaceIdx + 1).trim();
      } else {
        const parts = rest.split(/\s+/);
        const fields = parts.length >= 6 ? 6 : 5;
        expression = parts.slice(0, fields).join(" ");
        prompt = parts.slice(fields).join(" ");
      }

      if (!prompt) {
        await ctx.reply(
          "Usage: /cron add <cron-expression> <prompt>\n" +
          "Ví dụ: `/cron add 0 8 * * * Nhắc tôi uống nước`",
          { parse_mode: "Markdown" }
        );
        return true;
      }

      const job = cronManager.add(chatId, userId, expression, prompt);
      if (!job) {
        await ctx.reply(`❌ Cron expression không hợp lệ: \`${expression}\``, {
          parse_mode: "Markdown",
        });
        return true;
      }
      await ctx.reply(
        `✅ Đã thêm cron job \`${job.id.slice(-6)}\`\n` +
        `⏰ \`${expression}\`\n` +
        `📝 ${prompt}`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    await ctx.reply(
      "*Cron commands:*\n" +
      "`/cron add <expr> <prompt>` — Thêm job\n" +
      "`/cron list` — Danh sách jobs\n" +
      "`/cron del <id>` — Xóa job",
      { parse_mode: "Markdown" }
    );
    return true;
  }
};
