const fs = require('fs');
const path = require('path');
const srcDir = path.resolve('src/commands');

const helpCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { registry } from "./registry.js";

export const HelpCommand: ICommand = {
  name: "/help",
  description: "Hiện trợ giúp",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const commands = registry.getAll();
    let text = \`🤖 *Clawbot* — Claude trên Telegram\\n\\n\`;
    text += \`*Lệnh hiện có:*\\n\`;
    for (const cmd of commands) {
      if (cmd.category === "hidden") continue;
      text += \`\${cmd.name} — \${cmd.description}\\n\`;
    }
    text += \`\\nModel: \\\`\${deps.config.model}\\\`\`;
    await ctx.reply(text, { parse_mode: "Markdown" });
    return true;
  }
};
`;

const idCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const IdCommand: ICommand = {
  name: "/id",
  aliases: ["/whoami"],
  description: "Xem ID Telegram của bạn",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    await ctx.reply(
      \`👤 User ID: \\\`\${ctx.from?.id}\\\`\\n\` +
      \`💬 Chat ID: \\\`\${ctx.chat?.id}\\\`\`,
      { parse_mode: "Markdown" }
    );
    return true;
  }
};
`;

const newCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { makeSessionKey, saveMemory } from "./utils.js";

export const NewCommand: ICommand = {
  name: "/new",
  aliases: ["/reset"],
  description: "Bắt đầu cuộc trò chuyện mới (xóa lịch sử chat)",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const key = makeSessionKey(ctx);
    await saveMemory(key, deps.sessionManager, deps.config);
    deps.sessionManager.reset(key);
    await ctx.reply("✅ Đã bắt đầu cuộc trò chuyện mới.");
    return true;
  }
};
`;

const modelCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";

export const ModelCommand: ICommand = {
  name: "/model",
  description: "Xem model đang dùng",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    await ctx.reply(\`🧠 Model: \\\`\${deps.config.model}\\\`\`, { parse_mode: "Markdown" });
    return true;
  }
};
`;

const stopCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { cancelStream } from "../pipeline/active-streams.js";

export const StopCommand: ICommand = {
  name: "/stop",
  description: "Dừng phản hồi đang chạy",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const chatId = String(ctx.chat?.id ?? "");
    const cancelled = cancelStream(chatId);
    await ctx.reply(cancelled ? "⏹ Đã dừng phản hồi." : "Không có phản hồi nào đang chạy.");
    return true;
  }
};
`;

const exportCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { InputFile } from "grammy";
import { makeSessionKey, buildExportMarkdown } from "./utils.js";
import fs from "node:fs";
import path from "node:path";

export const ExportCommand: ICommand = {
  name: "/export",
  description: "Xuất lịch sử chat",
  category: "basic",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    const key = makeSessionKey(ctx);
    const turns = deps.sessionManager.getHistory(key);
    if (turns.length === 0) {
      await ctx.reply("Không có lịch sử để xuất.");
      return true;
    }
    const content = buildExportMarkdown(key, turns);
    const tmpPath = path.join(
      path.dirname(deps.config.dbPath),
      \`export-\${Date.now()}.md\`
    );
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, content, "utf8");
    try {
      await ctx.replyWithDocument(
        new InputFile(tmpPath, \`chat-export-\${Date.now()}.md\`),
        { caption: "📄 Lịch sử chat" }
      );
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
    return true;
  }
};
`;

const bashCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { runBash } from "../plugins/bash.js";

export const BashCommand: ICommand = {
  name: "/bash",
  description: "Chạy lệnh shell",
  category: "advanced",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    if (!args) {
      await ctx.reply("Usage: /bash <command>");
      return true;
    }
    await ctx.replyWithChatAction("typing");
    const output = await runBash(args, deps.config.bashTimeoutMs);
    const reply = output.length > 3800
      ? output.slice(0, 3800) + "\\n...(truncated)"
      : output;
    await ctx.reply(\`\\\`\\\`\\\`\\n\${reply}\\n\\\`\\\`\\\`\`, { parse_mode: "Markdown" });
    return true;
  }
};
`;

const skillCmd = `import type { ICommand, CommandDeps } from "./types.js";
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
      await ctx.reply(\`Skill không tìm thấy: \\\`\${args.split(" ")[0]}\\\`\\n\\n\${SKILL_LIST}\`, {
        parse_mode: "Markdown",
      });
      return true;
    }
    await ctx.reply(result.output);
    return true;
  }
};
`;

const btwCmd = `import type { ICommand, CommandDeps } from "./types.js";
import type { Context } from "grammy";
import { handleInbound } from "../pipeline/handler.js";

export const BtwCommand: ICommand = {
  name: "/btw",
  description: "Hỏi nhanh không lưu lịch sử",
  category: "ai",
  execute: async (ctx: Context, args: string, deps: CommandDeps) => {
    if (!args || !deps.aiClient || !deps.channelRegistry) return false;

    void ctx.replyWithChatAction("typing");
    const inbound = {
      id: \`telegram:btw:\${ctx.from?.id}:\${Date.now()}\`,
      channel: "telegram" as const,
      userId: String(ctx.from?.id ?? "unknown"),
      chatId: String(ctx.chat?.id ?? "unknown"),
      text: args,
      receivedAt: new Date().toISOString(),
      raw: null,
    };
    await handleInbound(
      inbound,
      {
        sessionManager: deps.sessionManager,
        aiClient: deps.aiClient,
        channelRegistry: deps.channelRegistry,
        config: deps.config,
        browserManager: deps.browserManager!,
      },
      { noHistory: true }
    );
    return true;
  }
};
`;

const cronCmd = `import type { ICommand, CommandDeps } from "./types.js";
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
    const cronArgs = args.split(/\\s+/);
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
        (j) => \`• \\\`\${j.id.slice(-6)}\\\` — \\\`\${j.expression}\\\`\\n  📝 \${j.prompt}\`
      );
      await ctx.reply(\`*Cron jobs:*\\n\${lines.join("\\n\\n")}\`, { parse_mode: "Markdown" });
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
        await ctx.reply(\`Không tìm thấy job: \\\`\${jobIdPart}\\\`\`, { parse_mode: "Markdown" });
        return true;
      }
      cronManager.delete(chatId, job.id);
      await ctx.reply(\`✅ Đã xóa job \\\`\${job.id.slice(-6)}\\\`\`, { parse_mode: "Markdown" });
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
        const parts = rest.split(/\\s+/);
        const fields = parts.length >= 6 ? 6 : 5;
        expression = parts.slice(0, fields).join(" ");
        prompt = parts.slice(fields).join(" ");
      }

      if (!prompt) {
        await ctx.reply(
          "Usage: /cron add <cron-expression> <prompt>\\n" +
          "Ví dụ: \`/cron add 0 8 * * * Nhắc tôi uống nước\`",
          { parse_mode: "Markdown" }
        );
        return true;
      }

      const job = cronManager.add(chatId, userId, expression, prompt);
      if (!job) {
        await ctx.reply(\`❌ Cron expression không hợp lệ: \\\`\${expression}\\\`\`, {
          parse_mode: "Markdown",
        });
        return true;
      }
      await ctx.reply(
        \`✅ Đã thêm cron job \\\`\${job.id.slice(-6)}\\\`\\n\` +
        \`⏰ \\\`\${expression}\\\`\\n\` +
        \`📝 \${prompt}\`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    await ctx.reply(
      "*Cron commands:*\\n" +
      "\`/cron add <expr> <prompt>\` — Thêm job\\n" +
      "\`/cron list\` — Danh sách jobs\\n" +
      "\`/cron del <id>\` — Xóa job",
      { parse_mode: "Markdown" }
    );
    return true;
  }
};
`;

const indexTs = `import { registry } from "./registry.js";
import { HelpCommand } from "./help.js";
import { IdCommand } from "./id.js";
import { NewCommand } from "./new.js";
import { ModelCommand } from "./model.js";
import { StopCommand } from "./stop.js";
import { ExportCommand } from "./export.js";
import { BashCommand } from "./bash.js";
import { SkillCommand } from "./skill.js";
import { BtwCommand } from "./btw.js";
import { CronCommand } from "./cron.js";

export function registerAllCommands() {
  registry.register(HelpCommand);
  registry.register(IdCommand);
  registry.register(NewCommand);
  registry.register(ModelCommand);
  registry.register(StopCommand);
  registry.register(ExportCommand);
  registry.register(BashCommand);
  registry.register(SkillCommand);
  registry.register(BtwCommand);
  registry.register(CronCommand);
}

export { registry };
`;

fs.writeFileSync(path.join(srcDir, 'help.ts'), helpCmd);
fs.writeFileSync(path.join(srcDir, 'id.ts'), idCmd);
fs.writeFileSync(path.join(srcDir, 'new.ts'), newCmd);
fs.writeFileSync(path.join(srcDir, 'model.ts'), modelCmd);
fs.writeFileSync(path.join(srcDir, 'stop.ts'), stopCmd);
fs.writeFileSync(path.join(srcDir, 'export.ts'), exportCmd);
fs.writeFileSync(path.join(srcDir, 'bash.ts'), bashCmd);
fs.writeFileSync(path.join(srcDir, 'skill.ts'), skillCmd);
fs.writeFileSync(path.join(srcDir, 'btw.ts'), btwCmd);
fs.writeFileSync(path.join(srcDir, 'cron.ts'), cronCmd);
fs.writeFileSync(path.join(srcDir, 'index.ts'), indexTs);

console.log('Done!');
